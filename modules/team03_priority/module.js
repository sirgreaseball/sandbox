/**
 * Team 3 - Priority Scheduling Educational Module
 * Clean, Modern, Professional Educational Website for CPU Scheduling.
 *
 * Algorithm Rules Preserved:
 * - Lower priority number = Higher priority (1 > 2 > 3 > 4)
 * - Preemptive Preemption Rule: Arriving process preempts ONLY if its priority number is strictly smaller (<).
 *   Same priority does NOT cause preemption.
 * - Tie-Breaking: Earliest Arrival Time (AT), then original Input Order.
 */

(function () {
  'use strict';

  // Ensure window reference exists if executed in headless environments
  const root = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : global);
  if (typeof window === 'undefined') {
    root.window = root;
  }

  // ---------------------------------------------------------------------------
  // 1. CORE SCHEDULING ENGINE (Independent of DOM - Preserved Algorithm)
  // ---------------------------------------------------------------------------
  const PriorityEngine = {
    // Retained for reference/tests if requested programmatically
    DEFAULT_DATA: [
      { pid: 'P1', at: 0, bt: 4, priority: 2 },
      { pid: 'P2', at: 1, bt: 3, priority: 1 },
      { pid: 'P3', at: 2, bt: 6, priority: 3 },
      { pid: 'P4', at: 3, bt: 2, priority: 4 },
      { pid: 'P5', at: 4, bt: 5, priority: 2 }
    ],

    // Section 7 Visual Example Dataset
    EXAMPLE_DATA: [
      { pid: 'P1', at: 0, bt: 7, priority: 3 },
      { pid: 'P2', at: 2, bt: 4, priority: 1 },
      { pid: 'P3', at: 3, bt: 2, priority: 4 },
      { pid: 'P4', at: 5, bt: 5, priority: 2 }
    ],

    /**
     * Validate an array of process definitions.
     */
    validateProcesses: function (processes) {
      const errors = [];
      if (!Array.isArray(processes) || processes.length === 0) {
        errors.push('Process list cannot be empty. Please add at least one process.');
        return { valid: false, errors };
      }

      const seenPids = new Set();
      processes.forEach((p, idx) => {
        const rowNum = idx + 1;
        const pid = (p.pid !== undefined && p.pid !== null) ? String(p.pid).trim() : '';

        if (!pid) {
          errors.push(`Row ${rowNum}: Process ID cannot be empty.`);
        } else if (seenPids.has(pid)) {
          errors.push(`Row ${rowNum}: Duplicate PID "${pid}" detected. Process IDs must be unique.`);
        } else {
          seenPids.add(pid);
        }

        const at = Number(p.at);
        if (!Number.isInteger(at) || at < 0) {
          errors.push(`Process "${pid || 'Row ' + rowNum}": Arrival Time must be an integer >= 0 (got ${p.at}).`);
        }

        const bt = Number(p.bt);
        if (!Number.isInteger(bt) || bt <= 0) {
          errors.push(`Process "${pid || 'Row ' + rowNum}": Burst Time must be an integer > 0 (got ${p.bt}).`);
        }

        const prio = Number(p.priority);
        if (!Number.isInteger(prio) || prio < 1) {
          errors.push(`Process "${pid || 'Row ' + rowNum}": Priority must be an integer >= 1 (got ${p.priority}).`);
        }
      });

      return { valid: errors.length === 0, errors };
    },

    /**
     * Clone processes and initialize simulation attributes.
     */
    cloneProcesses: function (processes) {
      return processes.map((p, idx) => ({
        pid: String(p.pid).trim(),
        at: Number(p.at),
        bt: Number(p.bt),
        priority: Number(p.priority),
        inputOrder: idx,
        remainingBt: Number(p.bt),
        firstStart: null,
        start: null,
        completion: null,
        tat: null,
        wt: null,
        rt: null,
        finished: false
      }));
    },

    /**
     * Comparator for Priority Scheduling:
     * 1. Smaller priority number = higher priority
     * 2. Smaller arrival time = earlier arrival
     * 3. Smaller input order = earlier in input list
     */
    comparePriority: function (a, b) {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      if (a.at !== b.at) {
        return a.at - b.at;
      }
      return a.inputOrder - b.inputOrder;
    },

    /**
     * Coalesce consecutive raw time slices into clean Gantt segments.
     */
    buildGanttSegments: function (rawSlices) {
      if (!rawSlices || rawSlices.length === 0) return [];
      const segments = [];
      let current = {
        pid: rawSlices[0].pid,
        start: rawSlices[0].time,
        end: rawSlices[0].time + 1
      };

      for (let i = 1; i < rawSlices.length; i++) {
        const slice = rawSlices[i];
        if (slice.pid === current.pid && slice.time === current.end) {
          current.end += 1;
        } else {
          segments.push({ ...current });
          current = {
            pid: slice.pid,
            start: slice.time,
            end: slice.time + 1
          };
        }
      }
      segments.push({ ...current });
      return segments;
    },

    /**
     * Run full Non-Preemptive Priority Simulation directly.
     */
    simulateNonPreemptive: function (inputProcesses) {
      const validation = this.validateProcesses(inputProcesses);
      if (!validation.valid) {
        throw new Error(validation.errors.join('; '));
      }

      const processes = this.cloneProcesses(inputProcesses);
      const n = processes.length;
      let completedCount = 0;
      let currentTime = 0;
      const ganttSegments = [];
      const executionOrder = [];

      while (completedCount < n) {
        const ready = processes.filter(p => !p.finished && p.at <= currentTime);

        if (ready.length === 0) {
          const unfinished = processes.filter(p => !p.finished);
          const nextAt = Math.min(...unfinished.map(p => p.at));
          if (nextAt > currentTime) {
            ganttSegments.push({
              pid: 'IDLE',
              start: currentTime,
              end: nextAt
            });
            currentTime = nextAt;
          }
          continue;
        }

        ready.sort((a, b) => this.comparePriority(a, b));
        const selected = ready[0];

        const startTime = currentTime;
        selected.firstStart = startTime;
        selected.start = startTime;
        currentTime += selected.bt;
        selected.completion = currentTime;
        selected.tat = selected.completion - selected.at;
        selected.wt = selected.tat - selected.bt;
        selected.rt = selected.firstStart - selected.at;
        selected.remainingBt = 0;
        selected.finished = true;
        completedCount++;

        executionOrder.push(selected.pid);
        ganttSegments.push({
          pid: selected.pid,
          start: startTime,
          end: currentTime
        });
      }

      const metrics = this.calculateMetrics(processes, currentTime);
      return {
        processes,
        ganttSegments,
        executionOrder,
        preemptionEvents: [],
        metrics,
        totalTime: currentTime
      };
    },

    /**
     * Run full Preemptive Priority Simulation directly.
     */
    simulatePreemptive: function (inputProcesses) {
      const validation = this.validateProcesses(inputProcesses);
      if (!validation.valid) {
        throw new Error(validation.errors.join('; '));
      }

      const processes = this.cloneProcesses(inputProcesses);
      const n = processes.length;
      let completedCount = 0;
      let currentTime = 0;
      const rawSlices = [];
      const preemptionEvents = [];
      let runningPid = null;

      while (completedCount < n) {
        const arrived = processes.filter(p => !p.finished && p.at <= currentTime);

        if (arrived.length === 0) {
          runningPid = null;
          rawSlices.push({ pid: 'IDLE', time: currentTime });
          currentTime++;
          continue;
        }

        let selected = null;
        if (runningPid) {
          const currentRunning = processes.find(p => p.pid === runningPid && !p.finished);
          if (currentRunning) {
            // Preemption rule: strictly smaller priority number
            const strictlyHigher = arrived.filter(p => p.priority < currentRunning.priority);
            if (strictlyHigher.length > 0) {
              strictlyHigher.sort((a, b) => this.comparePriority(a, b));
              const preemptor = strictlyHigher[0];
              preemptionEvents.push({
                type: 'preemption',
                time: currentTime,
                fromPid: currentRunning.pid,
                toPid: preemptor.pid,
                fromPriority: currentRunning.priority,
                toPriority: preemptor.priority,
                reason: `Reason:\n${preemptor.pid} arrived with a higher priority.\n\n${currentRunning.pid} Priority: ${currentRunning.priority}\n${preemptor.pid} Priority: ${preemptor.priority}\n\nTherefore ${preemptor.pid} gets the CPU.`
              });
              selected = preemptor;
            } else {
              selected = currentRunning; // Same priority keeps CPU
            }
          }
        }

        if (!selected) {
          arrived.sort((a, b) => this.comparePriority(a, b));
          selected = arrived[0];
        }

        runningPid = selected.pid;

        if (selected.firstStart === null) {
          selected.firstStart = currentTime;
          selected.start = currentTime;
        }

        rawSlices.push({ pid: selected.pid, time: currentTime });
        selected.remainingBt -= 1;

        if (selected.remainingBt === 0) {
          selected.finished = true;
          selected.completion = currentTime + 1;
          selected.tat = selected.completion - selected.at;
          selected.wt = selected.tat - selected.bt;
          selected.rt = selected.firstStart - selected.at;
          completedCount++;
          runningPid = null;
        }

        currentTime++;
      }

      const ganttSegments = this.buildGanttSegments(rawSlices);
      const metrics = this.calculateMetrics(processes, currentTime);

      return {
        processes,
        ganttSegments,
        preemptionEvents,
        metrics,
        totalTime: currentTime
      };
    },

    /**
     * Compute summary metrics for completed processes.
     */
    calculateMetrics: function (processes, totalTime) {
      if (!processes || processes.length === 0) {
        return {
          avgWT: 0,
          avgTAT: 0,
          avgRT: 0,
          cpuUtilization: 0,
          totalTime: 0
        };
      }

      let sumWT = 0;
      let sumTAT = 0;
      let sumRT = 0;
      let sumBT = 0;

      processes.forEach(p => {
        sumWT += (p.wt !== null ? p.wt : 0);
        sumTAT += (p.tat !== null ? p.tat : 0);
        sumRT += (p.rt !== null ? p.rt : 0);
        sumBT += p.bt;
      });

      const count = processes.length;
      const avgWT = Number((sumWT / count).toFixed(2));
      const avgTAT = Number((sumTAT / count).toFixed(2));
      const avgRT = Number((sumRT / count).toFixed(2));
      const cpuUtilization = totalTime > 0 ? Number(((sumBT / totalTime) * 100).toFixed(1)) : 0;

      return {
        avgWT,
        avgTAT,
        avgRT,
        cpuUtilization,
        totalTime
      };
    },

    /**
     * Generate step-by-step snapshot sequence for discrete simulation.
     */
    generateSimulationSteps: function (inputProcesses, mode) {
      const validation = this.validateProcesses(inputProcesses);
      if (!validation.valid) {
        throw new Error(validation.errors.join('; '));
      }

      const isPreemptive = mode === 'preemptive';
      const processes = this.cloneProcesses(inputProcesses);
      const n = processes.length;
      let completedCount = 0;
      let currentTime = 0;
      const rawSlices = [];
      const steps = [];
      const preemptionHistory = [];
      let runningPid = null;

      const cloneState = () => processes.map(p => ({ ...p }));

      while (completedCount < n && currentTime < 500) {
        const arrived = processes.filter(p => !p.finished && p.at <= currentTime);
        let selected = null;
        let stepPreemption = null;
        let explanation = '';

        if (arrived.length === 0) {
          runningPid = null;
          explanation = `Time ${currentTime}: No process has arrived in the ready queue. The CPU is IDLE.`;
          rawSlices.push({ pid: 'IDLE', time: currentTime });

          steps.push({
            time: currentTime,
            runningPid: 'IDLE',
            selectedPid: null,
            readyQueue: [],
            arrivedPids: arrived.map(p => p.pid),
            ganttSegments: this.buildGanttSegments(rawSlices),
            preemptionEvent: null,
            preemptionHistory: [...preemptionHistory],
            explanation,
            processes: cloneState(),
            isFinished: false
          });

          currentTime++;
          continue;
        }

        if (isPreemptive) {
          if (runningPid) {
            const currentRunning = processes.find(p => p.pid === runningPid && !p.finished);
            if (currentRunning) {
              const strictlyHigher = arrived.filter(p => p.priority < currentRunning.priority);
              if (strictlyHigher.length > 0) {
                strictlyHigher.sort((a, b) => this.comparePriority(a, b));
                const preemptor = strictlyHigher[0];
                stepPreemption = {
                  type: 'preemption',
                  time: currentTime,
                  fromPid: currentRunning.pid,
                  toPid: preemptor.pid,
                  fromPriority: currentRunning.priority,
                  toPriority: preemptor.priority,
                  reason: `Reason:\n${preemptor.pid} arrived with a higher priority.\n\n${currentRunning.pid} Priority: ${currentRunning.priority}\n${preemptor.pid} Priority: ${preemptor.priority}\n\nTherefore ${preemptor.pid} gets the CPU.`
                };
                preemptionHistory.push(stepPreemption);
                selected = preemptor;
                explanation = `Time ${currentTime}: ⚠️ Process ${currentRunning.pid} is PREEMPTED because newly arrived ${preemptor.pid} has higher priority (Priority ${preemptor.priority} < ${currentRunning.priority}).`;
              } else {
                selected = currentRunning;
                explanation = `Time ${currentTime}: Process ${selected.pid} continues running. Ready processes have equal or lower priority.`;
              }
            }
          }

          if (!selected) {
            arrived.sort((a, b) => this.comparePriority(a, b));
            selected = arrived[0];
            explanation = `Time ${currentTime}: Selected ${selected.pid} from ready queue (highest priority: ${selected.priority}).`;
          }

          runningPid = selected.pid;
          if (selected.firstStart === null) {
            selected.firstStart = currentTime;
            selected.start = currentTime;
          }

          const readyQueue = arrived
            .filter(p => p.pid !== selected.pid)
            .sort((a, b) => this.comparePriority(a, b))
            .map(p => ({ ...p }));

          rawSlices.push({ pid: selected.pid, time: currentTime });

          steps.push({
            time: currentTime,
            runningPid: selected.pid,
            selectedPid: selected.pid,
            readyQueue,
            arrivedPids: arrived.map(p => p.pid),
            ganttSegments: this.buildGanttSegments(rawSlices),
            preemptionEvent: stepPreemption,
            preemptionHistory: [...preemptionHistory],
            explanation,
            processes: cloneState(),
            isFinished: false
          });

          selected.remainingBt -= 1;

          if (selected.remainingBt === 0) {
            selected.finished = true;
            selected.completion = currentTime + 1;
            selected.tat = selected.completion - selected.at;
            selected.wt = selected.tat - selected.bt;
            selected.rt = selected.firstStart - selected.at;
            completedCount++;
            runningPid = null;
          }

          currentTime++;

        } else {
          // Non-preemptive logic
          if (runningPid) {
            const currentRunning = processes.find(p => p.pid === runningPid && !p.finished);
            if (currentRunning) {
              selected = currentRunning;
              explanation = `Time ${currentTime}: Process ${selected.pid} is executing uninterrupted until its burst completes.`;
            }
          }

          if (!selected) {
            arrived.sort((a, b) => this.comparePriority(a, b));
            selected = arrived[0];
            explanation = `Time ${currentTime}: Selected ${selected.pid} with highest priority (${selected.priority}) among ready processes.`;
          }

          runningPid = selected.pid;
          if (selected.firstStart === null) {
            selected.firstStart = currentTime;
            selected.start = currentTime;
          }

          const readyQueue = arrived
            .filter(p => p.pid !== selected.pid)
            .sort((a, b) => this.comparePriority(a, b))
            .map(p => ({ ...p }));

          rawSlices.push({ pid: selected.pid, time: currentTime });

          steps.push({
            time: currentTime,
            runningPid: selected.pid,
            selectedPid: selected.pid,
            readyQueue,
            arrivedPids: arrived.map(p => p.pid),
            ganttSegments: this.buildGanttSegments(rawSlices),
            preemptionEvent: null,
            preemptionHistory: [],
            explanation,
            processes: cloneState(),
            isFinished: false
          });

          selected.remainingBt -= 1;

          if (selected.remainingBt === 0) {
            selected.finished = true;
            selected.completion = currentTime + 1;
            selected.tat = selected.completion - selected.at;
            selected.wt = selected.tat - selected.bt;
            selected.rt = selected.firstStart - selected.at;
            completedCount++;
            runningPid = null;
          }

          currentTime++;
        }
      }

      const finalMetrics = this.calculateMetrics(processes, currentTime);
      steps.push({
        time: currentTime,
        runningPid: null,
        selectedPid: null,
        readyQueue: [],
        arrivedPids: processes.map(p => p.pid),
        ganttSegments: this.buildGanttSegments(rawSlices),
        preemptionEvent: null,
        preemptionHistory: [...preemptionHistory],
        explanation: `Simulation finished at time ${currentTime}. All ${n} processes completed successfully.`,
        processes: cloneState(),
        isFinished: true,
        metrics: finalMetrics
      });

      return {
        steps,
        totalTime: currentTime,
        finalMetrics,
        finalGantt: this.buildGanttSegments(rawSlices),
        processes
      };
    }
  };

  if (typeof window !== 'undefined') {
    window.PriorityEngine = PriorityEngine;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PriorityEngine;
  }

  // ---------------------------------------------------------------------------
  // 2. PROCESS COLOR SCHEME (Academic, High-Contrast)
  // ---------------------------------------------------------------------------
  const PID_COLORS = [
    { bg: '#2563EB', text: '#ffffff', border: '#1D4ED8', light: '#DBEAFE' }, // Blue
    { bg: '#0D9488', text: '#ffffff', border: '#0F766E', light: '#CCFBF1' }, // Teal
    { bg: '#7C3AED', text: '#ffffff', border: '#6D28D9', light: '#EDE9FE' }, // Violet
    { bg: '#D97706', text: '#ffffff', border: '#B45309', light: '#FEF3C7' }, // Amber
    { bg: '#DB2777', text: '#ffffff', border: '#BE185D', light: '#FCE7F3' }, // Pink
    { bg: '#059669', text: '#ffffff', border: '#047857', light: '#D1FAE5' }, // Emerald
    { bg: '#475569', text: '#ffffff', border: '#334155', light: '#F1F5F9' }, // Slate
    { bg: '#EA580C', text: '#ffffff', border: '#C2410C', light: '#FFEDD5' }  // Orange
  ];

  function getProcessColor(pid) {
    if (pid === 'IDLE' || !pid) {
      return { bg: '#94A3B8', text: '#FFFFFF', border: '#64748B', light: '#F1F5F9' };
    }
    const num = parseInt(pid.replace(/\D/g, ''), 10);
    const idx = !isNaN(num) ? Math.abs(num - 1) % PID_COLORS.length : Math.abs(pid.charCodeAt(0)) % PID_COLORS.length;
    return PID_COLORS[idx];
  }

  // ---------------------------------------------------------------------------
  // 3. UI VIEW & SIMULATION CONTROLLER
  // ---------------------------------------------------------------------------
  let currentInstance = null;

  function createModuleInstance(container) {
    let mode = 'non-preemptive'; // 'non-preemptive' | 'preemptive'
    // Default starts empty as requested by user ("remove dummy data, user enters")
    let processes = [];
    let simulationSteps = [];
    let currentStepIndex = 0;
    let isPlaying = false;
    let playTimer = null;
    let playSpeedMs = 600;
    let currentMetrics = {
      primaryMetricLabel: 'Avg Waiting Time',
      primaryMetricValue: 0,
      unit: 'units'
    };

    function clearTimer() {
      if (playTimer !== null) {
        clearInterval(playTimer);
        playTimer = null;
      }
      isPlaying = false;
    }

    function initSimulation() {
      clearTimer();
      const validation = PriorityEngine.validateProcesses(processes);
      if (!validation.valid) {
        showValidationErrors(validation.errors);
        return false;
      }
      hideValidationErrors();

      try {
        const simResult = PriorityEngine.generateSimulationSteps(processes, mode);
        simulationSteps = simResult.steps;
        currentStepIndex = 0;
        updateUI();
        return true;
      } catch (err) {
        showValidationErrors([err.message]);
        return false;
      }
    }

    function stepForward() {
      if (simulationSteps.length === 0) {
        if (!initSimulation()) return;
      }
      if (currentStepIndex < simulationSteps.length - 1) {
        currentStepIndex++;
        updateUI();
      } else {
        clearTimer();
        updateUI();
      }
    }

    function startPlayback() {
      if (isPlaying) return;
      if (simulationSteps.length === 0 || currentStepIndex >= simulationSteps.length - 1) {
        if (!initSimulation()) return;
      }
      isPlaying = true;
      updatePlayControls();
      playTimer = setInterval(() => {
        if (currentStepIndex < simulationSteps.length - 1) {
          currentStepIndex++;
          updateUI();
        } else {
          clearTimer();
          updatePlayControls();
        }
      }, playSpeedMs);
    }

    function pausePlayback() {
      clearTimer();
      updatePlayControls();
    }

    function runToEnd() {
      clearTimer();
      if (simulationSteps.length === 0) {
        if (!initSimulation()) return;
      }
      currentStepIndex = simulationSteps.length - 1;
      updateUI();
    }

    function resetModule() {
      clearTimer();
      mode = 'non-preemptive';
      processes = [];
      simulationSteps = [];
      currentStepIndex = 0;
      currentMetrics = {
        primaryMetricLabel: 'Avg Waiting Time',
        primaryMetricValue: 0,
        unit: 'units'
      };
      renderDOM();
    }

    function loadExampleProcesses() {
      clearTimer();
      processes = JSON.parse(JSON.stringify(PriorityEngine.EXAMPLE_DATA));
      simulationSteps = [];
      currentStepIndex = 0;
      renderInputTable();
      renderResultsTablePlaceholder();
      initSimulation();
      // Scroll smoothly to simulator table
      const simSection = container.querySelector('#simulator');
      if (simSection) {
        simSection.scrollIntoView({ behavior: 'smooth' });
      }
    }

    // -------------------------------------------------------------------------
    // DOM GENERATION (Complete 12-Section Professional Educational Layout)
    // -------------------------------------------------------------------------
    function renderDOM() {
      container.innerHTML = '';
      container.className = 'edu-page-root';

      const content = document.createElement('div');
      content.className = 'edu-content-wrapper';

      content.innerHTML = `
        <!-- 1. HERO SECTION -->
        <section class="edu-section edu-hero-section" id="hero">
          <div class="edu-hero-grid">
            <div class="edu-hero-content">
              <span class="edu-badge edu-badge-primary">CPU Scheduling in Operating Systems</span>
              <h1 class="edu-hero-title">PRIORITY SCHEDULING</h1>
              <p class="edu-hero-subtitle">CPU Scheduling in Operating Systems</p>
              <p class="edu-hero-desc">
                Priority Scheduling selects processes based on their priority, allowing important processes to receive CPU time first.
              </p>

              <div class="edu-hero-highlight-card">
                <span class="edu-highlight-icon">⭐</span>
                <div>
                  <span class="edu-highlight-label">Core Golden Rule</span>
                  <strong class="edu-highlight-value">LOWER NUMBER = HIGHER PRIORITY</strong>
                  <span class="edu-highlight-hint">(Priority 1 has higher priority than Priority 2)</span>
                </div>
              </div>

              <div class="edu-hero-actions">
                <a href="#what-is-it" class="edu-btn edu-btn-primary">Start Learning</a>
                <a href="#simulator" class="edu-btn edu-btn-secondary">Open Simulator</a>
              </div>
            </div>

            <!-- CPU Scheduling Illustration -->
            <div class="edu-hero-visual" aria-hidden="true">
              <div class="edu-cpu-illustration-card">
                <div class="edu-ill-header">
                  <span class="edu-ill-dot red"></span>
                  <span class="edu-ill-dot yellow"></span>
                  <span class="edu-ill-dot green"></span>
                  <span class="edu-ill-title">CPU Scheduler Core</span>
                </div>
                <div class="edu-ill-body">
                  <!-- Ready Queue Visual -->
                  <div class="edu-ill-queue">
                    <span class="edu-ill-label">Ready Queue</span>
                    <div class="edu-ill-queue-items">
                      <div class="edu-ill-proc" style="border-left-color: #2563EB;">
                        <strong>P1</strong>
                        <span>Prio: 3</span>
                      </div>
                      <div class="edu-ill-proc selected" style="border-left-color: #0D9488;">
                        <span class="edu-selected-star">★ Selected</span>
                        <strong>P2</strong>
                        <span>Prio: 1</span>
                      </div>
                      <div class="edu-ill-proc" style="border-left-color: #7C3AED;">
                        <strong>P3</strong>
                        <span>Prio: 2</span>
                      </div>
                    </div>
                  </div>

                  <!-- Dispatcher Arrow -->
                  <div class="edu-ill-dispatch">
                    <div class="edu-ill-arrow">
                      <span>Highest Priority (1 &lt; 2 &lt; 3)</span>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </div>
                  </div>

                  <!-- CPU Core Block -->
                  <div class="edu-ill-cpu">
                    <div class="edu-cpu-chip">
                      <span class="edu-cpu-chip-icon">⚡</span>
                      <span class="edu-cpu-chip-title">CPU CORE</span>
                      <div class="edu-cpu-active-proc">
                        <span class="edu-cpu-status-indicator"></span>
                        Running: <strong>P2</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 2. QUICK INTRODUCTION SECTION -->
        <section class="edu-section" id="quick-intro">
          <div class="edu-section-header center">
            <span class="edu-section-eyebrow">At A Glance</span>
            <h2 class="edu-section-title">Quick Introduction</h2>
            <p class="edu-section-desc">Key fundamentals of priority-based process dispatching in one glance.</p>
          </div>

          <div class="edu-intro-grid">
            <div class="edu-intro-card">
              <div class="edu-intro-icon-box">🖥️</div>
              <h3 class="edu-intro-title">CPU SCHEDULING</h3>
              <p class="edu-intro-text">Decides which process gets the CPU.</p>
            </div>

            <div class="edu-intro-card">
              <div class="edu-intro-icon-box">🎖️</div>
              <h3 class="edu-intro-title">PRIORITY</h3>
              <p class="edu-intro-text">Each process is assigned a priority.</p>
            </div>

            <div class="edu-intro-card">
              <div class="edu-intro-icon-box">🎯</div>
              <h3 class="edu-intro-title">SELECTION</h3>
              <p class="edu-intro-text">Highest-priority ready process is selected.</p>
            </div>

            <div class="edu-intro-card">
              <div class="edu-intro-icon-box">⚖️</div>
              <h3 class="edu-intro-title">TYPES</h3>
              <p class="edu-intro-text">Preemptive and Non-Preemptive.</p>
            </div>
          </div>
        </section>

        <!-- 3. WHAT IS PRIORITY SCHEDULING? SECTION -->
        <section class="edu-section" id="what-is-it">
          <div class="edu-section-header">
            <span class="edu-section-eyebrow">Theory Foundation</span>
            <h2 class="edu-section-title">What is Priority Scheduling?</h2>
          </div>

          <div class="edu-two-col-layout">
            <!-- Left Column: Explanation -->
            <div class="edu-theory-left">
              <div class="edu-card edu-theory-main-card">
                <p class="edu-lead-paragraph">
                  Priority Scheduling is a CPU scheduling algorithm in which each process is assigned a priority. The CPU selects the ready process with the highest priority.
                </p>

                <div class="edu-callout-card">
                  <div class="edu-callout-icon">💡</div>
                  <div class="edu-callout-content">
                    <h4 class="edu-callout-title">Remember:</h4>
                    <p class="edu-callout-text">
                      <strong>Lower priority number = Higher priority</strong>
                    </p>
                    <span class="edu-callout-sub">For example, Priority 1 &gt; Priority 2 &gt; Priority 3.</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Column: Simple Flow Diagram -->
            <div class="edu-theory-right">
              <div class="edu-card edu-flow-card">
                <h4 class="edu-flow-title">Scheduling Workflow</h4>
                <div class="edu-vertical-flow">
                  <div class="edu-flow-step">
                    <span class="edu-flow-box">PROCESS</span>
                  </div>
                  <div class="edu-flow-arrow">↓</div>
                  <div class="edu-flow-step">
                    <span class="edu-flow-box accent">PRIORITY ASSIGNED</span>
                  </div>
                  <div class="edu-flow-arrow">↓</div>
                  <div class="edu-flow-step">
                    <span class="edu-flow-box">READY QUEUE</span>
                  </div>
                  <div class="edu-flow-arrow">↓</div>
                  <div class="edu-flow-step">
                    <span class="edu-flow-box highlight">CPU EXECUTION</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 4. HOW DOES IT WORK? SECTION -->
        <section class="edu-section" id="how-it-works">
          <div class="edu-section-header center">
            <span class="edu-section-eyebrow">Execution Flow</span>
            <h2 class="edu-section-title">How Does It Work?</h2>
            <p class="edu-section-desc">Six continuous steps followed by the operating system scheduler.</p>
          </div>

          <div class="edu-steps-grid">
            <div class="edu-step-card">
              <div class="edu-step-badge">Step 01</div>
              <h3 class="edu-step-title">Processes arrive</h3>
              <p class="edu-step-desc">Jobs enter the system and become available for execution.</p>
            </div>

            <div class="edu-step-connector">→</div>

            <div class="edu-step-card">
              <div class="edu-step-badge">Step 02</div>
              <h3 class="edu-step-title">Check the ready queue</h3>
              <p class="edu-step-desc">The scheduler monitors all arrived processes awaiting CPU time.</p>
            </div>

            <div class="edu-step-connector">→</div>

            <div class="edu-step-card">
              <div class="edu-step-badge">Step 03</div>
              <h3 class="edu-step-title">Compare priorities</h3>
              <p class="edu-step-desc">The scheduler evaluates priority numbers (smaller number = higher priority).</p>
            </div>

            <div class="edu-step-connector break">↓</div>

            <div class="edu-step-card">
              <div class="edu-step-badge">Step 04</div>
              <h3 class="edu-step-title">Select the highest-priority process</h3>
              <p class="edu-step-desc">The ready process with the highest priority is allocated the CPU.</p>
            </div>

            <div class="edu-step-connector">→</div>

            <div class="edu-step-card">
              <div class="edu-step-badge">Step 05</div>
              <h3 class="edu-step-title">Execute the process</h3>
              <p class="edu-step-desc">The chosen process runs on the CPU for its designated duration.</p>
            </div>

            <div class="edu-step-connector">→</div>

            <div class="edu-step-card">
              <div class="edu-step-badge">Step 06</div>
              <h3 class="edu-step-title">Repeat</h3>
              <p class="edu-step-desc">The scheduler repeats the cycle until all processes have finished.</p>
            </div>
          </div>
        </section>

        <!-- 5. KEY CONCEPTS SECTION -->
        <section class="edu-section" id="concepts">
          <div class="edu-section-header center">
            <span class="edu-section-eyebrow">Terminology &amp; Formulas</span>
            <h2 class="edu-section-title">Key Concepts</h2>
            <p class="edu-section-desc">Essential metrics and definitions used in operating systems scheduling analysis.</p>
          </div>

          <div class="edu-concepts-grid">
            <div class="edu-concept-card">
              <div class="edu-concept-header">
                <span class="edu-concept-icon">⏱️</span>
                <h3 class="edu-concept-title">Arrival Time (AT)</h3>
              </div>
              <p class="edu-concept-desc">The time when a process enters the ready queue.</p>
              <span class="edu-concept-chip">Input Parameter</span>
            </div>

            <div class="edu-concept-card">
              <div class="edu-concept-header">
                <span class="edu-concept-icon">⚡</span>
                <h3 class="edu-concept-title">Burst Time (BT)</h3>
              </div>
              <p class="edu-concept-desc">The CPU time required by a process.</p>
              <span class="edu-concept-chip">Input Parameter</span>
            </div>

            <div class="edu-concept-card">
              <div class="edu-concept-header">
                <span class="edu-concept-icon">🎖️</span>
                <h3 class="edu-concept-title">Priority</h3>
              </div>
              <p class="edu-concept-desc">Determines which process gets selected first.</p>
              <span class="edu-concept-chip">Lower = Higher Priority</span>
            </div>

            <div class="edu-concept-card">
              <div class="edu-concept-header">
                <span class="edu-concept-icon">🏁</span>
                <h3 class="edu-concept-title">Completion Time (CT)</h3>
              </div>
              <p class="edu-concept-desc">The time when a process finishes execution.</p>
              <span class="edu-concept-chip">End of Burst</span>
            </div>

            <div class="edu-concept-card">
              <div class="edu-concept-header">
                <span class="edu-concept-icon">🔄</span>
                <h3 class="edu-concept-title">Turnaround Time (TAT)</h3>
              </div>
              <p class="edu-concept-desc">Total time elapsed from arrival to completion.</p>
              <code class="edu-formula">TAT = CT - AT</code>
            </div>

            <div class="edu-concept-card">
              <div class="edu-concept-header">
                <span class="edu-concept-icon">⏳</span>
                <h3 class="edu-concept-title">Waiting Time (WT)</h3>
              </div>
              <p class="edu-concept-desc">Total time spent waiting in the ready queue.</p>
              <code class="edu-formula">WT = TAT - BT</code>
            </div>

            <div class="edu-concept-card">
              <div class="edu-concept-header">
                <span class="edu-concept-icon">🚀</span>
                <h3 class="edu-concept-title">Response Time (RT)</h3>
              </div>
              <p class="edu-concept-desc">Time from arrival until the process first gets the CPU.</p>
              <code class="edu-formula">RT = First Start Time - AT</code>
            </div>
          </div>
        </section>

        <!-- 6. TYPES OF PRIORITY SCHEDULING SECTION -->
        <section class="edu-section" id="types">
          <div class="edu-section-header center">
            <span class="edu-section-eyebrow">Algorithm Variants</span>
            <h2 class="edu-section-title">Types of Priority Scheduling</h2>
            <p class="edu-section-desc">Comparing non-preemptive and preemptive execution behaviors.</p>
          </div>

          <div class="edu-types-grid">
            <!-- Non-Preemptive Card -->
            <div class="edu-card edu-type-card">
              <div class="edu-type-badge np">Non-Preemptive</div>
              <h3 class="edu-type-title">NON-PREEMPTIVE</h3>
              <p class="edu-type-summary">"Once a process starts, it runs until it finishes."</p>

              <div class="edu-type-timeline-box">
                <span class="edu-timeline-label">Execution Timeline:</span>
                <div class="edu-timeline-row">
                  <span class="edu-timeline-tag">P1</span>
                  <div class="edu-timeline-bar np">
                    <span>Running without interruption</span>
                    <span class="edu-arrow-right">►</span>
                  </div>
                  <span class="edu-timeline-end">Finish</span>
                </div>
              </div>

              <div class="edu-type-points">
                <div class="edu-point">
                  <span class="edu-point-icon">📌</span>
                  <span>A higher-priority process arriving during execution must wait until the running process finishes.</span>
                </div>
                <div class="edu-point">
                  <span class="edu-point-icon">✓</span>
                  <span>Simple design with zero context-switch preemption overhead.</span>
                </div>
              </div>
            </div>

            <!-- Preemptive Card -->
            <div class="edu-card edu-type-card">
              <div class="edu-type-badge p">Preemptive</div>
              <h3 class="edu-type-title">PREEMPTIVE</h3>
              <p class="edu-type-summary">"A running process can be interrupted when a higher-priority process arrives."</p>

              <div class="edu-type-timeline-box">
                <span class="edu-timeline-label">Execution Timeline:</span>
                <div class="edu-preempt-timeline">
                  <div class="edu-timeline-row">
                    <span class="edu-timeline-tag">P1</span>
                    <div class="edu-timeline-bar p-part1">P1 executes ──► Preempted</div>
                  </div>
                  <div class="edu-timeline-row indent">
                    <span class="edu-timeline-tag">P2</span>
                    <div class="edu-timeline-bar p-interrupt">P2 arrives (Higher Prio) ──► Finish</div>
                  </div>
                  <div class="edu-timeline-row">
                    <span class="edu-timeline-tag">P1</span>
                    <div class="edu-timeline-bar p-resume">P1 resumes ────────► Finish</div>
                  </div>
                </div>
              </div>

              <div class="edu-type-points">
                <div class="edu-point important">
                  <span class="edu-point-icon">⚡</span>
                  <div>
                    <strong>Preemption Rule:</strong> A newly arrived process preempts the current process <strong>ONLY if its priority number is strictly smaller</strong>.
                  </div>
                </div>
                <div class="edu-point">
                  <span class="edu-point-icon">⚖️</span>
                  <span><strong>Same Priority Rule:</strong> Arriving with equal priority must <strong>NOT</strong> cause preemption.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 7. VISUAL EXAMPLE SECTION -->
        <section class="edu-section" id="visual-example">
          <div class="edu-section-header center">
            <span class="edu-section-eyebrow">Walkthrough</span>
            <h2 class="edu-section-title">Visual Example</h2>
            <p class="edu-section-desc">Sample dataset illustrating scheduling decisions at arrival timestamps.</p>
          </div>

          <div class="edu-card edu-example-card">
            <!-- Process Table -->
            <div class="edu-table-responsive">
              <table class="edu-table">
                <thead>
                  <tr>
                    <th scope="col">Process</th>
                    <th scope="col">Arrival Time (AT)</th>
                    <th scope="col">Burst Time (BT)</th>
                    <th scope="col">Priority</th>
                    <th scope="col">Priority Rank</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>P1</strong></td>
                    <td>0</td>
                    <td>7</td>
                    <td>3</td>
                    <td><span class="edu-badge edu-badge-neutral">Medium</span></td>
                  </tr>
                  <tr>
                    <td><strong>P2</strong></td>
                    <td>2</td>
                    <td>4</td>
                    <td>1</td>
                    <td><span class="edu-badge edu-badge-success">Highest</span></td>
                  </tr>
                  <tr>
                    <td><strong>P3</strong></td>
                    <td>3</td>
                    <td>2</td>
                    <td>4</td>
                    <td><span class="edu-badge edu-badge-neutral">Lowest</span></td>
                  </tr>
                  <tr>
                    <td><strong>P4</strong></td>
                    <td>5</td>
                    <td>5</td>
                    <td>2</td>
                    <td><span class="edu-badge edu-badge-info">High</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="edu-example-decision-box">
              <div class="edu-decision-icon">💡</div>
              <div class="edu-decision-text">
                "At each decision point, the CPU checks the available processes and selects the one with the highest priority."
              </div>
            </div>

            <!-- Gantt Illustration Comparison -->
            <div class="edu-example-charts">
              <div class="edu-example-chart-block">
                <span class="edu-chart-title">Non-Preemptive Schedule Gantt:</span>
                <div class="edu-mock-gantt">
                  <div class="edu-mock-seg" style="flex: 7; background-color: #2563EB;">P1 (0-7)</div>
                  <div class="edu-mock-seg" style="flex: 4; background-color: #0D9488;">P2 (7-11)</div>
                  <div class="edu-mock-seg" style="flex: 5; background-color: #D97706;">P4 (11-16)</div>
                  <div class="edu-mock-seg" style="flex: 2; background-color: #7C3AED;">P3 (16-18)</div>
                </div>
                <div class="edu-mock-axis">
                  <span>0</span><span>7</span><span>11</span><span>16</span><span>18</span>
                </div>
              </div>

              <div class="edu-example-chart-block">
                <span class="edu-chart-title">Preemptive Schedule Gantt (P2 preempts P1 at Time 2):</span>
                <div class="edu-mock-gantt">
                  <div class="edu-mock-seg" style="flex: 2; background-color: #2563EB;">P1 (0-2)</div>
                  <div class="edu-mock-seg" style="flex: 4; background-color: #0D9488;">P2 (2-6)</div>
                  <div class="edu-mock-seg" style="flex: 5; background-color: #D97706;">P4 (6-11)</div>
                  <div class="edu-mock-seg" style="flex: 5; background-color: #2563EB;">P1 (11-16)</div>
                  <div class="edu-mock-seg" style="flex: 2; background-color: #7C3AED;">P3 (16-18)</div>
                </div>
                <div class="edu-mock-axis">
                  <span>0</span><span>2</span><span>6</span><span>11</span><span>16</span><span>18</span>
                </div>
              </div>
            </div>

            <div class="edu-example-footer">
              <button type="button" class="edu-btn edu-btn-outline" id="edu-load-example-inline-btn">
                Try This Example in Simulator ↓
              </button>
            </div>
          </div>
        </section>

        <!-- 8. ADVANTAGES AND LIMITATIONS SECTION -->
        <section class="edu-section" id="advantages">
          <div class="edu-section-header center">
            <span class="edu-section-eyebrow">Trade-Off Analysis</span>
            <h2 class="edu-section-title">Advantages and Limitations</h2>
            <p class="edu-section-desc">Balanced review of priority scheduling benefits and common pitfalls.</p>
          </div>

          <div class="edu-adv-lim-grid">
            <!-- Advantages -->
            <div class="edu-card edu-adv-card">
              <div class="edu-card-top-header">
                <span class="edu-adv-badge">Benefits</span>
                <h3 class="edu-adv-title">ADVANTAGES</h3>
              </div>
              <ul class="edu-point-list">
                <li>
                  <span class="edu-check-icon">✓</span>
                  <span>Important processes can execute first</span>
                </li>
                <li>
                  <span class="edu-check-icon">✓</span>
                  <span>Easy to understand</span>
                </li>
                <li>
                  <span class="edu-check-icon">✓</span>
                  <span>Supports preemptive and non-preemptive scheduling</span>
                </li>
                <li>
                  <span class="edu-check-icon">✓</span>
                  <span>Useful when processes have different importance</span>
                </li>
              </ul>
            </div>

            <!-- Limitations -->
            <div class="edu-card edu-lim-card">
              <div class="edu-card-top-header">
                <span class="edu-lim-badge">Pitfalls</span>
                <h3 class="edu-lim-title">LIMITATIONS</h3>
              </div>
              <ul class="edu-point-list">
                <li>
                  <span class="edu-warn-icon">!</span>
                  <span>Low-priority processes may wait for a long time</span>
                </li>
                <li>
                  <span class="edu-warn-icon">!</span>
                  <span>Starvation may occur</span>
                </li>
                <li>
                  <span class="edu-warn-icon">!</span>
                  <span>Priority assignment affects scheduling</span>
                </li>
                <li>
                  <span class="edu-warn-icon">!</span>
                  <span>Aging may be required</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <!-- 9. INTERACTIVE SIMULATOR SECTION -->
        <section class="edu-section" id="simulator">
          <div class="edu-section-header center">
            <span class="edu-section-eyebrow">Hands-On Learning</span>
            <h2 class="edu-section-title">Try Priority Scheduling</h2>
            <p class="edu-section-desc">Enter your processes and see how the CPU schedules them.</p>
          </div>

          <!-- Simulator Container -->
          <div class="edu-simulator-container">
            <!-- Top Controls Toolbar: Mode Selection & Quick Actions -->
            <div class="edu-sim-toolbar">
              <div class="edu-mode-selector" role="tablist" aria-label="Scheduling Algorithm Mode">
                <button type="button" class="edu-mode-btn ${mode === 'non-preemptive' ? 'active' : ''}" id="edu-mode-np" role="tab" aria-selected="${mode === 'non-preemptive'}">
                  Non-Preemptive
                </button>
                <button type="button" class="edu-mode-btn ${mode === 'preemptive' ? 'active' : ''}" id="edu-mode-p" role="tab" aria-selected="${mode === 'preemptive'}">
                  Preemptive
                </button>
              </div>

              <div class="edu-sim-quick-actions">
                <button type="button" class="edu-btn edu-btn-sm edu-btn-outline" id="edu-load-sample-btn">
                  📖 Load Visual Example (P1–P4)
                </button>
                <button type="button" class="edu-btn edu-btn-sm edu-btn-ghost" id="edu-clear-procs-btn">
                  Clear All
                </button>
              </div>
            </div>

            <!-- Validation Error Alert -->
            <div class="edu-alert edu-alert-error" id="edu-validation-alert" style="display: none;" role="alert"></div>

            <!-- Process Input Table Card -->
            <div class="edu-card edu-input-card">
              <div class="edu-card-header-flex">
                <div>
                  <h3 class="edu-card-heading">Process Table</h3>
                  <span class="edu-card-subheading">Define processes below (Lower Priority number = Higher Priority)</span>
                </div>
                <button type="button" class="edu-btn edu-btn-sm edu-btn-primary" id="edu-add-proc-btn">
                  + Add Process
                </button>
              </div>

              <div class="edu-table-responsive">
                <table class="edu-table edu-input-table">
                  <thead>
                    <tr>
                      <th scope="col" style="width: 140px;">Process ID (PID)</th>
                      <th scope="col">Arrival Time (AT)</th>
                      <th scope="col">Burst Time (BT)</th>
                      <th scope="col">Priority</th>
                      <th scope="col" style="width: 80px; text-align: center;">Action</th>
                    </tr>
                  </thead>
                  <tbody id="edu-process-tbody"></tbody>
                </table>
              </div>
            </div>

            <!-- Simulation Controls & Speed Card -->
            <div class="edu-card edu-controls-card">
              <div class="edu-controls-flex">
                <div class="edu-playback-buttons">
                  <button type="button" class="edu-btn edu-btn-primary" id="edu-start-btn">
                    ▶ Start Simulation
                  </button>
                  <button type="button" class="edu-btn edu-btn-secondary" id="edu-pause-btn" disabled>
                    ⏸ Pause
                  </button>
                  <button type="button" class="edu-btn edu-btn-secondary" id="edu-step-btn">
                    ⏭ Next Step
                  </button>
                  <button type="button" class="edu-btn edu-btn-outline" id="edu-run-all-btn">
                    ⚡ Run to End
                  </button>
                  <button type="button" class="edu-btn edu-btn-danger" id="edu-reset-btn">
                    ↺ Reset
                  </button>
                </div>

                <!-- Simulation Speed -->
                <div class="edu-speed-wrap">
                  <label for="edu-speed-slider" class="edu-speed-label">Speed:</label>
                  <input type="range" id="edu-speed-slider" min="100" max="1500" step="50" value="600" aria-label="Playback speed slider">
                  <span id="edu-speed-display" class="edu-speed-tag">600 ms / tick</span>
                </div>
              </div>

              <!-- Status Readout Badges -->
              <div class="edu-status-ribbon">
                <div class="edu-status-pill">
                  <span class="edu-status-k">Current Time</span>
                  <span class="edu-status-v" id="edu-stat-time">0</span>
                </div>
                <div class="edu-status-pill">
                  <span class="edu-status-k">CPU State</span>
                  <span class="edu-status-v" id="edu-stat-cpu">Idle</span>
                </div>
                <div class="edu-status-pill">
                  <span class="edu-status-k">Completed</span>
                  <span class="edu-status-v" id="edu-stat-completed">0 / 0</span>
                </div>
              </div>
            </div>

            <!-- Live Scheduling State: Ready Queue & Running Process -->
            <div class="edu-card edu-live-card">
              <h3 class="edu-card-heading">Live Scheduling State</h3>

              <div class="edu-live-grid">
                <!-- Ready Queue -->
                <div class="edu-live-column">
                  <div class="edu-live-subheading">
                    <span>Ready Queue</span>
                    <span class="edu-sub-badge">Sorted by: Priority ASC → AT ASC</span>
                  </div>
                  <div class="edu-ready-queue-box" id="edu-ready-queue">
                    <span class="edu-empty-queue-msg">Queue is empty</span>
                  </div>
                </div>

                <!-- Active CPU Details -->
                <div class="edu-live-column">
                  <div class="edu-live-subheading">
                    <span>Active CPU Process</span>
                  </div>
                  <div class="edu-proc-stat-grid">
                    <div class="edu-stat-cell">
                      <span class="edu-cell-label">Current Process</span>
                      <span class="edu-cell-value" id="edu-cur-pid">None</span>
                    </div>
                    <div class="edu-stat-cell">
                      <span class="edu-cell-label">Priority</span>
                      <span class="edu-cell-value" id="edu-cur-prio">-</span>
                    </div>
                    <div class="edu-stat-cell">
                      <span class="edu-cell-label">Remaining Burst</span>
                      <span class="edu-cell-value" id="edu-cur-rem">-</span>
                    </div>
                    <div class="edu-stat-cell">
                      <span class="edu-cell-label">CPU Status</span>
                      <span class="edu-cell-value" id="edu-cur-status">Idle</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Dynamic Educational Explanation -->
              <div class="edu-explanation-card">
                <span class="edu-explanation-bulb">💡</span>
                <div class="edu-explanation-text" id="edu-explanation-text">
                  Configure your processes and click "Start Simulation" or "Next Step" to begin.
                </div>
              </div>

            </div>
          </div>
        </section>

        <!-- 10. GANTT CHART SECTION -->
        <section class="edu-section" id="gantt">
          <div class="edu-section-header center">
            <span class="edu-section-eyebrow">Visual Timeline</span>
            <h2 class="edu-section-title">Gantt Chart</h2>
            <p class="edu-section-desc">Dynamic CPU execution timeline generated directly from scheduler events.</p>
          </div>

          <div class="edu-card edu-gantt-card">
            <div class="edu-gantt-card-header">
              <span class="edu-gantt-title">CPU Time Slices</span>
              <span class="edu-badge edu-badge-info" id="edu-gantt-time-badge">Time: 0</span>
            </div>

            <!-- Dynamic Gantt Chart Visual Container -->
            <div class="edu-gantt-chart-outer">
              <div class="edu-gantt-chart-inner" id="edu-gantt-chart">
                <div class="edu-gantt-placeholder">Simulation has not started yet.</div>
              </div>
            </div>
          </div>
        </section>

        <!-- 11. RESULTS SECTION -->
        <section class="edu-section" id="results">
          <div class="edu-section-header center">
            <span class="edu-section-eyebrow">Performance Metrics</span>
            <h2 class="edu-section-title">Results</h2>
            <p class="edu-section-desc">Computed scheduling metrics and process evaluation summary.</p>
          </div>

          <!-- Summary Metric Cards -->
          <div class="edu-metrics-triad">
            <div class="edu-metric-card">
              <span class="edu-metric-label">AVERAGE WAITING TIME</span>
              <span class="edu-metric-num" id="edu-metric-wt">0.00</span>
              <span class="edu-metric-formula">WT = TAT - BT</span>
            </div>

            <div class="edu-metric-card">
              <span class="edu-metric-label">AVERAGE TURNAROUND TIME</span>
              <span class="edu-metric-num" id="edu-metric-tat">0.00</span>
              <span class="edu-metric-formula">TAT = CT - AT</span>
            </div>

            <div class="edu-metric-card">
              <span class="edu-metric-label">AVERAGE RESPONSE TIME</span>
              <span class="edu-metric-num" id="edu-metric-rt">0.00</span>
              <span class="edu-metric-formula">RT = First Start - AT</span>
            </div>

            <div class="edu-metric-card">
              <span class="edu-metric-label">CPU UTILIZATION</span>
              <span class="edu-metric-num" id="edu-metric-util">0.0%</span>
              <span class="edu-metric-formula">Busy Time / Total Time</span>
            </div>
          </div>

          <!-- Process Results Table -->
          <div class="edu-card edu-results-card">
            <h3 class="edu-card-heading">PROCESS RESULTS</h3>
            <div class="edu-table-responsive">
              <table class="edu-table edu-results-table">
                <thead>
                  <tr>
                    <th scope="col">PID</th>
                    <th scope="col">Arrival (AT)</th>
                    <th scope="col">Burst (BT)</th>
                    <th scope="col">Priority</th>
                    <th scope="col">First Start</th>
                    <th scope="col">Completion (CT)</th>
                    <th scope="col">Turnaround (TAT)</th>
                    <th scope="col">Waiting (WT)</th>
                    <th scope="col">Response (RT)</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody id="edu-results-tbody"></tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- 12. REMARKS / PREEMPTION LOG SECTION (AT THE VERY END) -->
        <section class="edu-section" id="notes">
          <div class="edu-section-header center">
            <span class="edu-section-eyebrow">Execution Remarks</span>
            <h2 class="edu-section-title">Remarks & Preemption Log</h2>
            <p class="edu-section-desc">Dynamic preemption event log and execution remarks to remember during scheduling.</p>
          </div>

          <div class="edu-card edu-preemption-card" id="edu-preemption-panel">
            <h4 class="edu-preemption-head" id="edu-preemption-head">PREEMPTION LOG</h4>
            <div class="edu-preemption-list" id="edu-preemption-body">
              No preemption events recorded. Run simulation in Preemptive mode to view preemption remarks.
            </div>
          </div>
        </section>

        <!-- FOOTER -->
        <footer class="edu-footer">
          <div class="edu-footer-content">
            <span>Operating Systems — Priority CPU Scheduling Educational Resource</span>
            <span>Academic Edition • Team 3</span>
          </div>
        </footer>
      `;

      container.appendChild(content);

      bindEventListeners();
      renderInputTable();
      renderResultsTablePlaceholder();
    }

    // -------------------------------------------------------------------------
    // EVENT BINDINGS
    // -------------------------------------------------------------------------
    function bindEventListeners() {
      // Mode selector
      const npBtn = container.querySelector('#edu-mode-np');
      const pBtn = container.querySelector('#edu-mode-p');
      const preemptionPanel = container.querySelector('#edu-preemption-panel');

      if (npBtn && pBtn) {
        npBtn.addEventListener('click', () => {
          if (mode !== 'non-preemptive') {
            mode = 'non-preemptive';
            npBtn.classList.add('active');
            npBtn.setAttribute('aria-selected', 'true');
            pBtn.classList.remove('active');
            pBtn.setAttribute('aria-selected', 'false');
            if (processes.length > 0) initSimulation();
            else resetMetrics();
          }
        });

        pBtn.addEventListener('click', () => {
          if (mode !== 'preemptive') {
            mode = 'preemptive';
            pBtn.classList.add('active');
            pBtn.setAttribute('aria-selected', 'true');
            npBtn.classList.remove('active');
            npBtn.setAttribute('aria-selected', 'false');
            if (processes.length > 0) initSimulation();
            else resetMetrics();
          }
        });
      }

      // Add process button
      const addBtn = container.querySelector('#edu-add-proc-btn');
      if (addBtn) {
        addBtn.addEventListener('click', () => {
          const nextNum = processes.length + 1;
          processes.push({
            pid: `P${nextNum}`,
            at: 0,
            bt: 4,
            priority: nextNum
          });
          renderInputTable();
          renderResultsTablePlaceholder();
          initSimulation();
        });
      }

      // Load sample / example data buttons
      const sampleBtn = container.querySelector('#edu-load-sample-btn');
      if (sampleBtn) {
        sampleBtn.addEventListener('click', loadExampleProcesses);
      }

      const inlineExampleBtn = container.querySelector('#edu-load-example-inline-btn');
      if (inlineExampleBtn) {
        inlineExampleBtn.addEventListener('click', loadExampleProcesses);
      }

      // Clear all processes button
      const clearBtn = container.querySelector('#edu-clear-procs-btn');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          clearTimer();
          processes = [];
          simulationSteps = [];
          currentStepIndex = 0;
          renderInputTable();
          renderResultsTablePlaceholder();
          renderGanttChart([], 0);
          resetMetrics();
        });
      }

      // Playback buttons
      const startBtn = container.querySelector('#edu-start-btn');
      if (startBtn) startBtn.addEventListener('click', startPlayback);

      const pauseBtn = container.querySelector('#edu-pause-btn');
      if (pauseBtn) pauseBtn.addEventListener('click', pausePlayback);

      const stepBtn = container.querySelector('#edu-step-btn');
      if (stepBtn) stepBtn.addEventListener('click', stepForward);

      const runAllBtn = container.querySelector('#edu-run-all-btn');
      if (runAllBtn) runAllBtn.addEventListener('click', runToEnd);

      const resetBtn = container.querySelector('#edu-reset-btn');
      if (resetBtn) resetBtn.addEventListener('click', resetModule);

      // Speed control slider
      const speedSlider = container.querySelector('#edu-speed-slider');
      const speedVal = container.querySelector('#edu-speed-display');
      if (speedSlider && speedVal) {
        speedSlider.addEventListener('input', (e) => {
          playSpeedMs = parseInt(e.target.value, 10);
          speedVal.textContent = `${playSpeedMs} ms / tick`;
          if (isPlaying) {
            clearTimer();
            startPlayback();
          }
        });
      }
    }

    function resetMetrics() {
      currentMetrics = {
        primaryMetricLabel: 'Avg Waiting Time',
        primaryMetricValue: 0,
        unit: 'units'
      };
      const wt = container.querySelector('#edu-metric-wt');
      const tat = container.querySelector('#edu-metric-tat');
      const rt = container.querySelector('#edu-metric-rt');
      const util = container.querySelector('#edu-metric-util');
      const timeBadge = container.querySelector('#edu-gantt-time-badge');
      const statTime = container.querySelector('#edu-stat-time');
      const statCpu = container.querySelector('#edu-stat-cpu');
      const statComp = container.querySelector('#edu-stat-completed');
      const expl = container.querySelector('#edu-explanation-text');

      if (wt) wt.textContent = '0.00';
      if (tat) tat.textContent = '0.00';
      if (rt) rt.textContent = '0.00';
      if (util) util.textContent = '0.0%';
      if (timeBadge) timeBadge.textContent = 'Time: 0';
      if (statTime) statTime.textContent = '0';
      if (statCpu) statCpu.textContent = 'Idle';
      if (statComp) statComp.textContent = '0 / 0';
      if (expl) expl.textContent = 'Processes cleared. Add a process or load the example to simulate.';

      const preemptionBody = container.querySelector('#edu-preemption-body');
      const preemptionHead = container.querySelector('#edu-preemption-head');
      if (preemptionBody) {
        if (mode === 'preemptive') {
          if (preemptionHead) preemptionHead.textContent = 'PREEMPTION LOG';
          preemptionBody.innerHTML = '<div style="color: #78350F; font-size: 0.9rem;">No preemption events recorded. Run simulation in Preemptive mode to view preemption remarks.</div>';
        } else {
          if (preemptionHead) preemptionHead.textContent = 'SCHEDULING REMARKS';
          preemptionBody.innerHTML = `
            <div class="edu-preempt-item" style="border-left-color: var(--edu-blue);">
              <span class="edu-preempt-alert" style="color: var(--edu-navy);">ℹ️ Non-Preemptive Execution</span>
              <div class="edu-preempt-desc" style="color: var(--edu-text-body);">
                In Non-Preemptive Priority Scheduling, running processes cannot be interrupted. Once a process is allocated the CPU, it runs to completion even if higher-priority processes arrive. Switch to <strong>Preemptive Mode</strong> to observe dynamic preemption events.
              </div>
            </div>
          `;
        }
      }
    }

    function updatePlayControls() {
      const startBtn = container.querySelector('#edu-start-btn');
      const pauseBtn = container.querySelector('#edu-pause-btn');
      const stepBtn = container.querySelector('#edu-step-btn');

      if (isPlaying) {
        if (startBtn) startBtn.disabled = true;
        if (pauseBtn) pauseBtn.disabled = false;
        if (stepBtn) stepBtn.disabled = true;
      } else {
        if (startBtn) startBtn.disabled = false;
        if (pauseBtn) pauseBtn.disabled = true;
        if (stepBtn) stepBtn.disabled = false;
      }
    }

    function showValidationErrors(errors) {
      const alertBox = container.querySelector('#edu-validation-alert');
      if (alertBox) {
        alertBox.innerHTML = `<strong>⚠️ Input Error:</strong><ul style="margin: 6px 0 0 16px; padding: 0;">${errors.map(e => `<li>${e}</li>`).join('')}</ul>`;
        alertBox.style.display = 'block';
      }
    }

    function hideValidationErrors() {
      const alertBox = container.querySelector('#edu-validation-alert');
      if (alertBox) {
        alertBox.innerHTML = '';
        alertBox.style.display = 'none';
      }
    }

    // -------------------------------------------------------------------------
    // INPUT TABLE RENDERING (Empty by default, user enters data)
    // -------------------------------------------------------------------------
    function renderInputTable() {
      const tbody = container.querySelector('#edu-process-tbody');
      if (!tbody) return;

      tbody.innerHTML = '';

      if (processes.length === 0) {
        const emptyTr = document.createElement('tr');
        emptyTr.innerHTML = `
          <td colspan="5" class="edu-empty-table-cell">
            <div class="edu-empty-table-box">
              <span class="edu-empty-icon">📝</span>
              <p class="edu-empty-msg">No processes added yet. Please enter your processes or load the example.</p>
              <div class="edu-empty-btns">
                <button type="button" class="edu-btn edu-btn-sm edu-btn-primary" id="edu-empty-add-btn">+ Add First Process</button>
                <button type="button" class="edu-btn edu-btn-sm edu-btn-outline" id="edu-empty-load-btn">Load Example (P1–P4)</button>
              </div>
            </div>
          </td>
        `;
        tbody.appendChild(emptyTr);

        const emptyAddBtn = tbody.querySelector('#edu-empty-add-btn');
        if (emptyAddBtn) {
          emptyAddBtn.addEventListener('click', () => {
            processes.push({ pid: 'P1', at: 0, bt: 4, priority: 1 });
            renderInputTable();
            renderResultsTablePlaceholder();
            initSimulation();
          });
        }

        const emptyLoadBtn = tbody.querySelector('#edu-empty-load-btn');
        if (emptyLoadBtn) {
          emptyLoadBtn.addEventListener('click', loadExampleProcesses);
        }
        return;
      }

      processes.forEach((p, idx) => {
        const tr = document.createElement('tr');
        const color = getProcessColor(p.pid);

        tr.innerHTML = `
          <td>
            <div class="edu-pid-badge-cell">
              <span class="edu-pid-circle" style="background-color: ${color.bg};"></span>
              <input type="text" class="edu-table-input edu-input-pid" value="${p.pid}" data-idx="${idx}" aria-label="Process ID row ${idx + 1}">
            </div>
          </td>
          <td>
            <input type="number" class="edu-table-input edu-input-at" min="0" step="1" value="${p.at}" data-idx="${idx}" aria-label="Arrival time row ${idx + 1}">
          </td>
          <td>
            <input type="number" class="edu-table-input edu-input-bt" min="1" step="1" value="${p.bt}" data-idx="${idx}" aria-label="Burst time row ${idx + 1}">
          </td>
          <td>
            <input type="number" class="edu-table-input edu-input-priority" min="1" step="1" value="${p.priority}" data-idx="${idx}" aria-label="Priority row ${idx + 1}">
          </td>
          <td style="text-align: center;">
            <button type="button" class="edu-btn-del" data-idx="${idx}" aria-label="Delete process ${p.pid}" title="Delete Process">✕</button>
          </td>
        `;

        tbody.appendChild(tr);
      });

      // Bind input events
      tbody.querySelectorAll('.edu-input-pid').forEach(input => {
        input.addEventListener('change', (e) => {
          const idx = parseInt(e.target.dataset.idx, 10);
          processes[idx].pid = e.target.value.trim();
          initSimulation();
        });
      });

      tbody.querySelectorAll('.edu-input-at').forEach(input => {
        input.addEventListener('change', (e) => {
          const idx = parseInt(e.target.dataset.idx, 10);
          processes[idx].at = parseInt(e.target.value, 10);
          initSimulation();
        });
      });

      tbody.querySelectorAll('.edu-input-bt').forEach(input => {
        input.addEventListener('change', (e) => {
          const idx = parseInt(e.target.dataset.idx, 10);
          processes[idx].bt = parseInt(e.target.value, 10);
          initSimulation();
        });
      });

      tbody.querySelectorAll('.edu-input-priority').forEach(input => {
        input.addEventListener('change', (e) => {
          const idx = parseInt(e.target.dataset.idx, 10);
          processes[idx].priority = parseInt(e.target.value, 10);
          initSimulation();
        });
      });

      tbody.querySelectorAll('.edu-btn-del').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.target.dataset.idx, 10);
          processes.splice(idx, 1);
          renderInputTable();
          renderResultsTablePlaceholder();
          if (processes.length > 0) {
            initSimulation();
          } else {
            renderGanttChart([], 0);
            resetMetrics();
          }
        });
      });
    }

    // -------------------------------------------------------------------------
    // RESULTS TABLE PLACEHOLDER
    // -------------------------------------------------------------------------
    function renderResultsTablePlaceholder() {
      const tbody = container.querySelector('#edu-results-tbody');
      if (!tbody) return;

      tbody.innerHTML = '';
      if (processes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #64748b; padding: 24px;">No process results to display. Run the simulation to view calculated metrics.</td></tr>';
        return;
      }

      processes.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${p.pid}</strong></td>
          <td>${p.at}</td>
          <td>${p.bt}</td>
          <td>${p.priority}</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td><span class="edu-badge edu-badge-neutral">Pending</span></td>
        `;
        tbody.appendChild(tr);
      });
    }

    // -------------------------------------------------------------------------
    // LIVE UI UPDATE (Called on simulation ticks)
    // -------------------------------------------------------------------------
    function updateUI() {
      if (simulationSteps.length === 0) return;
      const step = simulationSteps[currentStepIndex];

      // Status badges
      const statTime = container.querySelector('#edu-stat-time');
      if (statTime) statTime.textContent = step.time;

      const cpuVal = container.querySelector('#edu-stat-cpu');
      if (cpuVal) {
        if (!step.runningPid || step.runningPid === 'IDLE') {
          cpuVal.textContent = 'Idle';
          cpuVal.style.color = '#64748B';
        } else {
          const color = getProcessColor(step.runningPid);
          cpuVal.innerHTML = `<span style="color: ${color.bg}; font-weight: 700;">${step.runningPid}</span>`;
        }
      }

      const completedCount = step.processes.filter(p => p.finished).length;
      const statComp = container.querySelector('#edu-stat-completed');
      if (statComp) statComp.textContent = `${completedCount} / ${step.processes.length}`;

      // Current process details
      const curPidEl = container.querySelector('#edu-cur-pid');
      const curPrioEl = container.querySelector('#edu-cur-prio');
      const curRemEl = container.querySelector('#edu-cur-rem');
      const curStatusEl = container.querySelector('#edu-cur-status');

      if (curPidEl) {
        if (!step.runningPid || step.runningPid === 'IDLE') {
          curPidEl.textContent = step.isFinished ? 'None' : 'IDLE';
          curPidEl.style.color = '#0F172A';
          curPrioEl.textContent = '-';
          curRemEl.textContent = '-';
          curStatusEl.textContent = step.isFinished ? 'Finished' : 'Idle';
          curStatusEl.style.color = '#64748B';
        } else {
          const runP = step.processes.find(p => p.pid === step.runningPid);
          const pColor = getProcessColor(step.runningPid);
          curPidEl.innerHTML = `<span style="color: ${pColor.bg}; font-weight: 700;">${step.runningPid}</span>`;
          curPrioEl.textContent = runP ? runP.priority : '-';
          curRemEl.textContent = runP ? runP.remainingBt : '-';
          curStatusEl.textContent = 'Running';
          curStatusEl.style.color = '#0D9488';
        }
      }

      // Ready Queue
      const queueContainer = container.querySelector('#edu-ready-queue');
      if (queueContainer) {
        if (step.readyQueue.length === 0) {
          queueContainer.innerHTML = `<span class="edu-empty-queue-msg">Queue is empty</span>`;
        } else {
          queueContainer.innerHTML = step.readyQueue.map(p => {
            const color = getProcessColor(p.pid);
            return `
              <div class="edu-queue-chip" style="border-left: 4px solid ${color.bg};">
                <span class="edu-queue-chip-pid" style="color: ${color.bg};">${p.pid}</span>
                <span class="edu-queue-chip-tag">Prio: ${p.priority}</span>
                ${mode === 'preemptive' ? `<span class="edu-queue-chip-tag rem">Rem: ${p.remainingBt}</span>` : ''}
                <span class="edu-queue-chip-tag at">AT: ${p.at}</span>
              </div>
            `;
          }).join('');
        }
      }

      // Dynamic Explanation Text
      const explText = container.querySelector('#edu-explanation-text');
      if (explText) explText.textContent = step.explanation;

      // Preemption / Remarks Panel
      const preemptionBody = container.querySelector('#edu-preemption-body');
      const preemptionHead = container.querySelector('#edu-preemption-head');
      if (preemptionBody) {
        if (mode === 'preemptive') {
          if (preemptionHead) preemptionHead.textContent = 'PREEMPTION LOG';
          if (step.preemptionHistory && step.preemptionHistory.length > 0) {
            preemptionBody.innerHTML = step.preemptionHistory.map(evt => `
              <div class="edu-preempt-item">
                <span class="edu-preempt-alert">⚠️ ${evt.fromPid} was preempted at time ${evt.time}</span>
                <div class="edu-preempt-desc">
                  <div><strong>Reason:</strong> ${evt.toPid} arrived with higher priority.</div>
                  <div class="edu-preempt-prio">${evt.fromPid} (Priority ${evt.fromPriority}) vs ${evt.toPid} (Priority ${evt.toPriority})</div>
                  <div class="edu-preempt-winner">Therefore ${evt.toPid} gets the CPU.</div>
                </div>
              </div>
            `).join('');
          } else {
            preemptionBody.innerHTML = '<div style="color: #78350F; font-size: 0.9rem;">No preemption occurred during this simulation.</div>';
          }
        } else {
          if (preemptionHead) preemptionHead.textContent = 'SCHEDULING REMARKS';
          preemptionBody.innerHTML = `
            <div class="edu-preempt-item" style="border-left-color: var(--edu-blue);">
              <span class="edu-preempt-alert" style="color: var(--edu-navy);">ℹ️ Non-Preemptive Execution</span>
              <div class="edu-preempt-desc" style="color: var(--edu-text-body);">
                In Non-Preemptive Priority Scheduling, running processes cannot be interrupted. Once a process is allocated the CPU, it runs to completion even if higher-priority processes arrive. Switch to <strong>Preemptive Mode</strong> to observe dynamic preemption events.
              </div>
            </div>
          `;
        }
      }

      // Gantt Chart
      renderGanttChart(step.ganttSegments, step.time);

      // Metrics & Results
      if (step.isFinished && step.metrics) {
        currentMetrics = {
          primaryMetricLabel: 'Avg Waiting Time',
          primaryMetricValue: step.metrics.avgWT,
          unit: 'units'
        };
        const wt = container.querySelector('#edu-metric-wt');
        const tat = container.querySelector('#edu-metric-tat');
        const rt = container.querySelector('#edu-metric-rt');
        const util = container.querySelector('#edu-metric-util');
        if (wt) wt.textContent = step.metrics.avgWT.toFixed(2);
        if (tat) tat.textContent = step.metrics.avgTAT.toFixed(2);
        if (rt) rt.textContent = step.metrics.avgRT.toFixed(2);
        if (util) util.textContent = `${step.metrics.cpuUtilization.toFixed(1)}%`;
      } else {
        const finishedProcesses = step.processes.filter(p => p.finished);
        if (finishedProcesses.length === step.processes.length && step.processes.length > 0) {
          const m = PriorityEngine.calculateMetrics(step.processes, step.time);
          currentMetrics.primaryMetricValue = m.avgWT;
          const wt = container.querySelector('#edu-metric-wt');
          const tat = container.querySelector('#edu-metric-tat');
          const rt = container.querySelector('#edu-metric-rt');
          const util = container.querySelector('#edu-metric-util');
          if (wt) wt.textContent = m.avgWT.toFixed(2);
          if (tat) tat.textContent = m.avgTAT.toFixed(2);
          if (rt) rt.textContent = m.avgRT.toFixed(2);
          if (util) util.textContent = `${m.cpuUtilization.toFixed(1)}%`;
        }
      }

      renderResultsTable(step.processes, step.runningPid);
      updatePlayControls();
    }

    // -------------------------------------------------------------------------
    // GANTT CHART RENDERING (Visually Attractive Box & Scale Chart)
    // -------------------------------------------------------------------------
    function renderGanttChart(segments, currentTime) {
      const ganttChart = container.querySelector('#edu-gantt-chart');
      const badge = container.querySelector('#edu-gantt-time-badge');
      if (!ganttChart) return;

      if (badge) badge.textContent = `Time: ${currentTime}`;

      if (!segments || segments.length === 0) {
        ganttChart.innerHTML = '<div class="edu-gantt-placeholder">Simulation has not started yet.</div>';
        return;
      }

      const maxTime = Math.max(currentTime, segments[segments.length - 1].end, 1);

      let html = '<div class="edu-gantt-track">';
      segments.forEach(seg => {
        const duration = seg.end - seg.start;
        const widthPercent = (duration / maxTime) * 100;
        const color = getProcessColor(seg.pid);

        if (seg.pid === 'IDLE') {
          html += `
            <div class="edu-gantt-block idle" style="width: ${widthPercent}%;">
              <span class="edu-gantt-block-pid">IDLE</span>
              <span class="edu-gantt-block-range">${seg.start} – ${seg.end}</span>
            </div>
          `;
        } else {
          html += `
            <div class="edu-gantt-block" style="width: ${widthPercent}%; background-color: ${color.bg}; border-color: ${color.border};">
              <span class="edu-gantt-block-pid" style="color: ${color.text};">${seg.pid}</span>
              <span class="edu-gantt-block-range" style="color: ${color.text}; opacity: 0.95;">${seg.start} – ${seg.end}</span>
            </div>
          `;
        }
      });
      html += '</div>';

      // Axis Ticks
      html += '<div class="edu-gantt-axis">';
      const tickSet = new Set();
      segments.forEach(seg => {
        tickSet.add(seg.start);
        tickSet.add(seg.end);
      });
      const sortedTicks = Array.from(tickSet).sort((a, b) => a - b);
      sortedTicks.forEach(tick => {
        const leftPercent = (tick / maxTime) * 100;
        html += `
          <div class="edu-gantt-tick" style="left: ${leftPercent}%;">
            <span class="edu-tick-mark"></span>
            <span class="edu-tick-val">${tick}</span>
          </div>
        `;
      });
      html += '</div>';

      ganttChart.innerHTML = html;
    }

    // -------------------------------------------------------------------------
    // RESULTS TABLE RENDERING
    // -------------------------------------------------------------------------
    function renderResultsTable(procs, currentRunningPid) {
      const tbody = container.querySelector('#edu-results-tbody');
      if (!tbody) return;

      tbody.innerHTML = '';
      if (!procs || procs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #64748b; padding: 24px;">No processes to display.</td></tr>';
        return;
      }

      procs.forEach(p => {
        const tr = document.createElement('tr');
        let statusBadge = '';

        if (p.finished) {
          statusBadge = '<span class="edu-badge edu-badge-success">Completed</span>';
        } else if (p.pid === currentRunningPid) {
          statusBadge = '<span class="edu-badge edu-badge-running">Running</span>';
        } else if (p.firstStart !== null) {
          statusBadge = '<span class="edu-badge edu-badge-preempted">Preempted</span>';
        } else {
          statusBadge = '<span class="edu-badge edu-badge-neutral">Waiting</span>';
        }

        tr.innerHTML = `
          <td><strong>${p.pid}</strong></td>
          <td>${p.at}</td>
          <td>${p.bt}</td>
          <td>${p.priority}</td>
          <td>${p.firstStart !== null ? p.firstStart : '-'}</td>
          <td>${p.completion !== null ? p.completion : '-'}</td>
          <td>${p.tat !== null ? p.tat : '-'}</td>
          <td>${p.wt !== null ? p.wt : '-'}</td>
          <td>${p.rt !== null ? p.rt : '-'}</td>
          <td>${statusBadge}</td>
        `;

        tbody.appendChild(tr);
      });
    }

    // Initial DOM creation
    renderDOM();

    return {
      reset: resetModule,
      getMetrics: function () {
        return { ...currentMetrics };
      },
      initSimulation,
      stepForward,
      startPlayback,
      pausePlayback,
      runToEnd
    };
  }

  // ---------------------------------------------------------------------------
  // 4. MODULE CONTRACT EXPORT
  // ---------------------------------------------------------------------------
  window.OSDashboard = window.OSDashboard || { modules: {} };

  window.OSDashboard.modules['team03_priority'] = {
    title: 'Priority Scheduling',
    render: function (container) {
      if (!container) {
        console.error('[team03_priority] render(container): container element is required.');
        return;
      }
      currentInstance = createModuleInstance(container);
    },
    reset: function () {
      if (currentInstance) {
        currentInstance.reset();
      }
    },
    getMetrics: function () {
      if (currentInstance) {
        return currentInstance.getMetrics();
      }
      return {
        primaryMetricLabel: 'Avg Waiting Time',
        primaryMetricValue: 0,
        unit: 'units'
      };
    }
  };

})();
