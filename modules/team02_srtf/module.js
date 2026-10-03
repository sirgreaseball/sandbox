(function () {
  "use strict";

  window.OSDashboard = window.OSDashboard || { modules: {} };

  const KEY = "team02_srtf";
  const DEFAULT_ROWS = [
    { pid: "P1", at: 0, bt: 8 },
    { pid: "P2", at: 1, bt: 4 },
    { pid: "P3", at: 2, bt: 2 },
    { pid: "P4", at: 3, bt: 1 },
    { pid: "P5", at: 5, bt: 3 }
  ];

  const state = {
    rows: cloneRows(DEFAULT_ROWS),
    timeline: [],
    segments: [],
    results: [],
    stepIndex: 0,
    playing: false,
    timer: null,
    root: null,
    metrics: null
  };

  function cloneRows(rows) {
    return rows.map(function (row) {
      return { pid: row.pid, at: Number(row.at), bt: Number(row.bt) };
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function calculateModel(rows) {
    const processes = rows.map(function (p, index) {
      return {
        pid: p.pid,
        at: Number(p.at),
        bt: Number(p.bt),
        remaining: Number(p.bt),
        index: index
      };
    });

    let time = 0;
    let finished = 0;
    let previousPid = null;
    let previousRemaining = null;
    const timeline = [];
    const completion = {};
    const segments = [];

    while (finished < processes.length) {
      const ready = processes
        .filter(function (p) { return p.at <= time && p.remaining > 0; })
        .sort(function (a, b) {
          return a.remaining - b.remaining || a.at - b.at || a.index - b.index;
        });

      if (ready.length === 0) {
        timeline.push({
          time: time,
          pid: "IDLE",
          remainingBefore: 0,
          remainingAfter: 0,
          queue: [],
          preempted: false,
          completed: false,
          reason: "CPU idle — no process has arrived yet."
        });
        previousPid = "IDLE";
        previousRemaining = 0;
        time += 1;
        continue;
      }

      const current = ready[0];
      const before = current.remaining;
      const preempted = previousPid !== null &&
        previousPid !== "IDLE" &&
        previousPid !== current.pid &&
        previousRemaining > 0;

      let reason = "Continues with the shortest remaining time.";
      if (preempted) {
        reason = current.pid + " preempts " + previousPid + " because its remaining time is shorter.";
      } else if (previousPid === "IDLE") {
        reason = current.pid + " starts when the CPU becomes available.";
      } else if (previousPid === null) {
        reason = current.pid + " is selected as the shortest remaining job at time " + time + ".";
      }

      current.remaining -= 1;
      const after = current.remaining;
      const completed = after === 0;
      if (completed) {
        reason = current.pid + " completes at time " + (time + 1) + ".";
      }

      timeline.push({
        time: time,
        pid: current.pid,
        remainingBefore: before,
        remainingAfter: after,
        queue: ready.map(function (p) {
          return { pid: p.pid, remaining: p.remaining };
        }),
        preempted: preempted,
        completed: completed,
        reason: reason
      });

      if (completed) {
        completion[current.pid] = time + 1;
        finished += 1;
      }

      previousPid = current.pid;
      previousRemaining = after;
      time += 1;
    }

    timeline.forEach(function (step) {
      const last = segments[segments.length - 1];
      if (last && last.pid === step.pid && last.end === step.time) {
        last.end = step.time + 1;
        last.steps.push(step);
      } else {
        segments.push({
          pid: step.pid,
          start: step.time,
          end: step.time + 1,
          steps: [step],
          preempted: step.preempted
        });
      }
      if (step.preempted && segments.length) {
        segments[segments.length - 1].preempted = true;
      }
    });

    const results = rows.map(function (p) {
      const ct = completion[p.pid];
      const tat = ct - p.at;
      const wt = tat - p.bt;
      return { pid: p.pid, at: p.at, bt: p.bt, ct: ct, tat: tat, wt: wt };
    });

    const avgWT = results.reduce(function (sum, p) { return sum + p.wt; }, 0) / results.length;
    const avgTAT = results.reduce(function (sum, p) { return sum + p.tat; }, 0) / results.length;

    return {
      timeline: timeline,
      segments: segments,
      results: results,
      avgWT: avgWT,
      avgTAT: avgTAT
    };
  }

  function metricForRows(rows) {
    const model = calculateModel(rows);
    return model.avgWT;
  }

  function stopTimer() {
    if (state.timer !== null) {
      window.clearInterval(state.timer);
      state.timer = null;
    }
    state.playing = false;
  }

  function render(container) {
    stopTimer();
    state.root = container;
    state.stepIndex = 0;
    state.metrics = metricForRows(state.rows);

    container.innerHTML = `
      <div class="os-team02">
        <header class="os-team02__header">
          <div>
            <h1>Shortest Remaining Time First (SRTF)</h1>
        </header>

        <section class="os-team02__card os-team02__about">
          <div class="os-team02__section-title">
            <div><span class="os-team02__step-label">CONCEPT</span><h2>How SRTF works</h2></div>
          </div>
          <p><strong>Shortest Remaining Time First</strong> is the preemptive version of Shortest Job First (SJF). Whenever the CPU is ready, the process with the <strong>least remaining burst time</strong> among arrived processes is selected. If a new process arrives with a shorter remaining time than the running process, the running process is preempted.</p>
          <div class="os-team02__flow">
            <span>Processes arrive</span><b>→</b><span>Check ready queue</span><b>→</b><span>Choose minimum remaining time</span><b>→</b><span>Execute 1 time unit</span><b>→</b><span>Repeat until all finish</span>
          </div>
          <div class="os-team02__info-grid">
            <article><h3>Advantages</h3><ul><li>Usually gives a low average waiting time when short jobs are available.</li><li>Responds quickly to newly arrived short processes.</li><li>Preemption allows the scheduler to adapt dynamically as the ready queue changes.</li><li>Useful for workloads where shorter jobs should receive earlier CPU service.</li></ul></article>
            <article><h3>Disadvantages</h3><ul><li>Long processes can suffer from starvation if short processes keep arriving.</li><li>Frequent preemption increases context-switch overhead.</li><li>Arrival time and remaining burst time must be tracked continuously.</li><li>Actual future CPU burst lengths are difficult to know exactly in a real system.</li></ul></article>
          </div>
        </section>

        <section class="os-team02__card">
          <div class="os-team02__section-heading"><div><span class="os-team02__step-label">1</span><h2>Process Input</h2></div><span class="os-team02__hint">Default: 5 processes</span></div>
          <p class="os-team02__muted">Edit arrival time (AT) and burst time (BT). AT ≥ 0 and BT ≥ 1. The scheduler uses deterministic tie-breaking: remaining time → arrival time → input order.</p>
          <div class="os-team02__table-wrap">
            <table class="os-team02__table" data-role="input-table">
              <thead><tr><th>Process</th><th>Arrival Time</th><th>Burst Time</th><th>Action</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="os-team02__actions">
            <button type="button" data-action="add">+ Add Process</button>
            <button type="button" data-action="calculate">Calculate SRTF</button>
            <button type="button" class="os-team02__button--light" data-action="reset">Reset Sample</button>
          </div>
          <div class="os-team02__validation" data-role="validation" aria-live="polite"></div>
        </section>

        <section class="os-team02__card">
          <div class="os-team02__section-heading"><div><span class="os-team02__step-label">2</span><h2>Live SRTF Simulation</h2></div><span class="os-team02__status" data-role="status">Ready</span></div>
          <div class="os-team02__controls">
            <button type="button" data-action="start">▶ Start</button>
            <button type="button" data-action="step">Step 1 Unit</button>
            <button type="button" class="os-team02__button--light" data-action="pause">Pause</button>
            <label class="os-team02__speed">Speed <input data-role="speed" type="range" min="150" max="1200" step="50" value="550"><span data-role="speed-value">550 ms</span></label>
          </div>
          <div class="os-team02__live-grid">
            <div class="os-team02__live-card"><span>Current time</span><strong data-role="clock">0</strong></div>
            <div class="os-team02__live-card os-team02__live-card--accent"><span>Running process</span><strong data-role="running">—</strong></div>
            <div class="os-team02__live-card"><span>Remaining burst</span><strong data-role="remaining">—</strong></div>
            <div class="os-team02__live-card"><span>Progress</span><strong data-role="progress">0 / 0</strong></div>
          </div>

          <div class="os-team02__simulation-grid">
            <div>
              <h3 class="os-team02__subheading">Ready Queue</h3>
              <div class="os-team02__queue" data-role="queue"><span class="os-team02__empty">No arrived processes</span></div>
            </div>
            <div>
              <h3 class="os-team02__subheading">Step Explanation</h3>
              <div class="os-team02__explanation" data-role="explanation">Press <strong>Calculate SRTF</strong>, then use <strong>Start</strong> or <strong>Step 1 Unit</strong>.</div>
            </div>
          </div>
        </section>

        <section class="os-team02__card">
          <div class="os-team02__section-heading"><div><span class="os-team02__step-label">3</span><h2>Animated Gantt Chart</h2></div><span class="os-team02__hint">Preemption points are marked</span></div>
          <div class="os-team02__gantt-wrap">
            <div class="os-team02__gantt" data-role="gantt"><div class="os-team02__empty">Calculate the schedule to begin.</div></div>
            <div class="os-team02__time-axis" data-role="axis"></div>
          </div>
          <div class="os-team02__legend">
            <span><i class="os-team02__legend-dot os-team02__legend-dot--run"></i>Executed time unit</span>
            <span><i class="os-team02__legend-dot os-team02__legend-dot--preempt"></i>Preemption occurred</span>
            <span><i class="os-team02__legend-dot os-team02__legend-dot--idle"></i>CPU idle</span>
          </div>
          <div class="os-team02__preemption-log" data-role="preemption-log"></div>
        </section>

        <section class="os-team02__card">
          <div class="os-team02__section-heading"><div><span class="os-team02__step-label">4</span><h2>Results</h2></div><span class="os-team02__hint">CT, TAT and WT</span></div>
          <div class="os-team02__stats">
            <div><span>Average Waiting Time</span><strong data-role="avg-wt">—</strong><small>Primary dashboard metric</small></div>
            <div><span>Average Turnaround Time</span><strong data-role="avg-tat">—</strong><small>Completion − Arrival</small></div>
            <div><span>Completed Processes</span><strong data-role="completed">0</strong><small>Out of total processes</small></div>
          </div>
          <div class="os-team02__table-wrap">
            <table class="os-team02__table os-team02__results-table" data-role="result-table">
              <thead><tr><th>Process</th><th>AT</th><th>BT</th><th>CT</th><th>TAT</th><th>WT</th></tr></thead>
              <tbody><tr><td colspan="6">No results yet.</td></tr></tbody>
            </table>
          </div>
        </section>

        <section class="os-team02__card os-team02__formula-card">
          <h2>Key formulas</h2>
          <div class="os-team02__formula-grid">
            <div><b>Turnaround Time (TAT)</b><span>CT − AT</span></div>
            <div><b>Waiting Time (WT)</b><span>TAT − BT</span></div>
            <div><b>Average WT</b><span>Σ WT / Number of processes</span></div>
            <div><b>Average TAT</b><span>Σ TAT / Number of processes</span></div>
          </div>
        </section>
      </div>
    `;

    bindEvents(container);
    renderInputs(container);
    updateSimulationView(container);
  }

  function bindEvents(container) {
    container.querySelector('[data-action="add"]').addEventListener("click", function () {
      stopTimer();
      const nextNumber = nextPidNumber();
      state.rows.push({ pid: "P" + nextNumber, at: 0, bt: 1 });
      state.metrics = null;
      state.stepIndex = 0;
      renderInputs(container);
      clearComputedView(container);
    });

    container.querySelector('[data-action="calculate"]').addEventListener("click", function () {
      calculateAndPrepare(container);
    });

    container.querySelector('[data-action="reset"]').addEventListener("click", function () {
      reset();
      render(container);
    });

    container.querySelector('[data-action="start"]').addEventListener("click", function () {
      startPlayback(container);
    });

    container.querySelector('[data-action="step"]').addEventListener("click", function () {
      stepOnce(container);
    });

    container.querySelector('[data-action="pause"]').addEventListener("click", function () {
      stopTimer();
      updateStatus(container, "Paused");
    });

    container.querySelector('[data-role="speed"]').addEventListener("input", function (event) {
      const value = Number(event.target.value);
      container.querySelector('[data-role="speed-value"]').textContent = value + " ms";
      if (state.playing) {
        startPlayback(container);
      }
    });
  }

  function nextPidNumber() {
    let number = state.rows.length + 1;
    const used = state.rows.map(function (row) { return row.pid; });
    while (used.indexOf("P" + number) !== -1) number += 1;
    return number;
  }

  function renderInputs(container) {
    const body = container.querySelector('[data-role="input-table"] tbody');
    body.innerHTML = "";

    state.rows.forEach(function (row, index) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${escapeHtml(row.pid)}</strong></td>
        <td><input class="os-team02__number-input" type="number" min="0" step="1" value="${row.at}" data-field="at" data-index="${index}" aria-label="Arrival time for ${escapeHtml(row.pid)}"></td>
        <td><input class="os-team02__number-input" type="number" min="1" step="1" value="${row.bt}" data-field="bt" data-index="${index}" aria-label="Burst time for ${escapeHtml(row.pid)}"></td>
        <td><button type="button" class="os-team02__button--light os-team02__remove" data-remove="${index}">Remove</button></td>
      `;
      body.appendChild(tr);
    });

    body.querySelectorAll("input").forEach(function (input) {
      input.addEventListener("change", function () {
        const index = Number(input.dataset.index);
        const field = input.dataset.field;
        const min = field === "at" ? 0 : 1;
        let value = Number(input.value);
        if (!Number.isFinite(value)) value = min;
        value = Math.max(min, Math.floor(value));
        input.value = value;
        state.rows[index][field] = value;
        state.metrics = null;
        stopTimer();
        state.stepIndex = 0;
        clearComputedView(container);
      });
    });

    body.querySelectorAll("[data-remove]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (state.rows.length <= 1) return;
        state.rows.splice(Number(button.dataset.remove), 1);
        state.metrics = null;
        stopTimer();
        state.stepIndex = 0;
        renderInputs(container);
        clearComputedView(container);
      });
    });
  }

  function calculateAndPrepare(container) {
    stopTimer();
    const validation = validateRows();
    const validationEl = container.querySelector('[data-role="validation"]');
    if (!validation.valid) {
      validationEl.textContent = validation.message;
      validationEl.className = "os-team02__validation os-team02__validation--error";
      return;
    }

    validationEl.textContent = "Input accepted. SRTF schedule generated successfully.";
    validationEl.className = "os-team02__validation os-team02__validation--success";

    const model = calculateModel(state.rows);
    state.timeline = model.timeline;
    state.segments = model.segments;
    state.results = model.results;
    state.metrics = model.avgWT;
    state.stepIndex = 0;

    renderFinalResults(container);
    renderGantt(container, 0);
    renderAxis(container);
    renderPreemptionLog(container);
    updateSimulationView(container);
    updateStatus(container, "Ready — step through the schedule");
  }

  function validateRows() {
    if (!state.rows.length) return { valid: false, message: "Add at least one process." };
    for (let i = 0; i < state.rows.length; i += 1) {
      const row = state.rows[i];
      if (!Number.isInteger(row.at) || row.at < 0) return { valid: false, message: row.pid + ": arrival time must be a whole number ≥ 0." };
      if (!Number.isInteger(row.bt) || row.bt < 1) return { valid: false, message: row.pid + ": burst time must be a whole number ≥ 1." };
    }
    return { valid: true, message: "" };
  }

  function clearComputedView(container) {
    state.timeline = [];
    state.segments = [];
    state.results = [];
    state.stepIndex = 0;
    container.querySelector('[data-role="gantt"]').innerHTML = '<div class="os-team02__empty">Calculate the schedule to begin.</div>';
    container.querySelector('[data-role="axis"]').innerHTML = "";
    container.querySelector('[data-role="preemption-log"]').innerHTML = "";
    container.querySelector('[data-role="result-table"] tbody').innerHTML = '<tr><td colspan="6">No results yet.</td></tr>';
    container.querySelector('[data-role="avg-wt"]').textContent = "—";
    container.querySelector('[data-role="avg-tat"]').textContent = "—";
    container.querySelector('[data-role="completed"]').textContent = "0";
    updateSimulationView(container);
    updateStatus(container, "Input changed — calculate again");
  }

  function renderGantt(container, visibleSteps) {
    const gantt = container.querySelector('[data-role="gantt"]');
    const count = Math.max(0, Math.min(Number(visibleSteps), state.timeline.length));
    if (!state.timeline.length) {
      gantt.innerHTML = '<div class="os-team02__empty">Calculate the schedule to begin.</div>';
      return;
    }

    const steps = state.timeline.slice(0, count);
    if (!steps.length) {
      gantt.innerHTML = '<div class="os-team02__empty">Press “Step 1 Unit” or “Start” to animate the Gantt chart.</div>';
      return;
    }

    gantt.innerHTML = "";
    steps.forEach(function (step) {
      const block = document.createElement("div");
      block.className = "os-team02__gantt-unit";
      if (step.pid === "IDLE") block.classList.add("os-team02__gantt-unit--idle");
      if (step.preempted) block.classList.add("os-team02__gantt-unit--preempted");
      block.title = "Time " + step.time + "–" + (step.time + 1) + ": " + step.pid;
      block.innerHTML = '<strong>' + escapeHtml(step.pid) + '</strong><span>' + step.time + '–' + (step.time + 1) + '</span>';
      gantt.appendChild(block);
    });
  }

  function renderAxis(container) {
    const axis = container.querySelector('[data-role="axis"]');
    if (!state.timeline.length) {
      axis.innerHTML = "";
      return;
    }
    axis.innerHTML = state.timeline.map(function (step) {
      return '<span>' + step.time + '</span>';
    }).join("") + '<span>' + state.timeline.length + '</span>';
  }

  function renderPreemptionLog(container) {
    const log = container.querySelector('[data-role="preemption-log"]');
    const preemptions = state.timeline.filter(function (step) { return step.preempted; });
    if (!preemptions.length) {
      log.innerHTML = '<div class="os-team02__notice">No preemption occurs for the current input. Try adding a short process after a longer process has started.</div>';
      return;
    }
    log.innerHTML = '<h3 class="os-team02__subheading">Preemption events</h3>' + preemptions.map(function (step) {
      return '<div class="os-team02__event"><strong>t = ' + step.time + '</strong><span>' + escapeHtml(step.reason) + '</span></div>';
    }).join("");
  }

  function renderFinalResults(container) {
    const body = container.querySelector('[data-role="result-table"] tbody');
    body.innerHTML = state.results.map(function (p) {
      return '<tr><td><strong>' + escapeHtml(p.pid) + '</strong></td><td>' + p.at + '</td><td>' + p.bt + '</td><td>' + p.ct + '</td><td>' + p.tat + '</td><td>' + p.wt + '</td></tr>';
    }).join("");
    container.querySelector('[data-role="avg-wt"]').textContent = state.results.length ? (state.results.reduce(function (sum, p) { return sum + p.wt; }, 0) / state.results.length).toFixed(2) : "—";
    container.querySelector('[data-role="avg-tat"]').textContent = state.results.length ? (state.results.reduce(function (sum, p) { return sum + p.tat; }, 0) / state.results.length).toFixed(2) : "—";
    container.querySelector('[data-role="completed"]').textContent = "0 / " + state.results.length;
  }

  function updateSimulationView(container) {
    const completedSteps = state.timeline.slice(0, state.stepIndex);
    const currentStep = state.timeline[state.stepIndex - 1];
    const clock = state.stepIndex === 0 ? 0 : currentStep.time + 1;

    container.querySelector('[data-role="clock"]').textContent = clock;
    container.querySelector('[data-role="running"]').textContent = currentStep && !currentStep.completed && currentStep.pid !== "IDLE" ? currentStep.pid : "—";
    container.querySelector('[data-role="remaining"]').textContent = currentStep ? currentStep.remainingAfter : "—";
    container.querySelector('[data-role="progress"]').textContent = state.stepIndex + " / " + state.timeline.length;

    const queue = container.querySelector('[data-role="queue"]');
    if (!currentStep || currentStep.pid === "IDLE" || currentStep.completed) {
      queue.innerHTML = '<span class="os-team02__empty">' + (currentStep && currentStep.completed ? 'No process is waiting after this completion.' : 'No process is running at this instant.') + '</span>';
    } else {
      const visibleQueue = currentStep.queue.filter(function (p) { return p.remaining > 0; });
      queue.innerHTML = visibleQueue.length ? visibleQueue.map(function (p) {
        const running = p.pid === currentStep.pid;
        return '<span class="os-team02__queue-item' + (running ? ' os-team02__queue-item--running' : '') + '"><strong>' + escapeHtml(p.pid) + '</strong><small>R = ' + p.remaining + '</small>' + (running ? '<em>RUNNING</em>' : '') + '</span>';
      }).join("") : '<span class="os-team02__empty">No process is waiting.</span>';
    }

    const explanation = container.querySelector('[data-role="explanation"]');
    explanation.textContent = currentStep ? currentStep.reason : "Press Calculate SRTF, then use Start or Step 1 Unit.";
    if (currentStep && currentStep.preempted) {
      explanation.classList.add("os-team02__explanation--preempted");
    } else {
      explanation.classList.remove("os-team02__explanation--preempted");
    }

    renderGantt(container, state.stepIndex);
    if (state.timeline.length) renderAxis(container);

    const completed = state.results.length ? completedSteps.filter(function (step, index) {
      return step.completed && index < state.stepIndex;
    }).length : 0;
    container.querySelector('[data-role="completed"]').textContent = completed + " / " + (state.results.length || state.rows.length);

    const stepButton = container.querySelector('[data-action="step"]');
    const startButton = container.querySelector('[data-action="start"]');
    if (stepButton) stepButton.disabled = state.stepIndex >= state.timeline.length;
    if (startButton) startButton.disabled = state.stepIndex >= state.timeline.length;
  }

  function updateStatus(container, text) {
    const status = container.querySelector('[data-role="status"]');
    if (status) status.textContent = text;
  }

  function ensureCalculated(container) {
    if (!state.timeline.length) {
      calculateAndPrepare(container);
      return state.timeline.length > 0;
    }
    return true;
  }

  function stepOnce(container) {
    if (!ensureCalculated(container)) return;
    if (state.stepIndex >= state.timeline.length) {
      stopTimer();
      updateStatus(container, "Complete");
      return;
    }
    const step = state.timeline[state.stepIndex];
    state.stepIndex += 1;
    updateSimulationView(container);
    updateStatus(container, state.stepIndex >= state.timeline.length ? "Complete" : "Running step-by-step");
    if (step.preempted) {
      updateStatus(container, "Preemption at t = " + step.time);
    }
    if (state.stepIndex >= state.timeline.length) stopTimer();
  }

  function startPlayback(container) {
    if (!ensureCalculated(container)) return;
    stopTimer();
    if (state.stepIndex >= state.timeline.length) state.stepIndex = 0;
    state.playing = true;
    updateStatus(container, "Playing");
    const speed = Number(container.querySelector('[data-role="speed"]').value) || 550;
    state.timer = window.setInterval(function () {
      if (!state.playing) return;
      stepOnce(container);
      if (state.stepIndex >= state.timeline.length) stopTimer();
    }, speed);
  }

  function reset() {
    stopTimer();
    state.rows = cloneRows(DEFAULT_ROWS);
    state.timeline = [];
    state.segments = [];
    state.results = [];
    state.stepIndex = 0;
    state.metrics = metricForRows(state.rows);
  }

  function getMetrics() {
    if (state.metrics === null || !Number.isFinite(state.metrics)) {
      state.metrics = metricForRows(state.rows);
    }
    return {
      primaryMetricLabel: "Avg Waiting Time",
      primaryMetricValue: Number(state.metrics.toFixed(2)),
      unit: "units"
    };
  }

  window.OSDashboard.modules[KEY] = {
    title: "CPU Scheduling II — Shortest Remaining Time First (SRTF)",
    render: render,
    reset: reset,
    getMetrics: getMetrics
  };
}());
