/**
 * Disk Scheduling — SCAN & C-SCAN Module
 * Team 11 (Clean Light Mode & Neat Alignment)
 *
 * Implements the SCAN (Elevator) and C-SCAN (Circular SCAN) disk scheduling algorithms
 * with interactive real-time visualizer, Chart.js trajectory plot, and dynamic metrics.
 */

window.OSDashboard = window.OSDashboard || { modules: {} };

window.OSDashboard.modules["team11_disk_scan"] = (function () {
  // Built-in Default State
  const DEFAULT_CONFIG = {
    head: 53,
    maxCylinder: 199,
    direction: "right", // "right" (increasing) or "left" (decreasing)
    requestsStr: "98, 183, 37, 122, 14, 124, 65, 67",
    algorithm: "SCAN", // "SCAN" or "C-SCAN"
    animationSpeed: 700 // ms per step
  };

  // Internal Module State
  let state = {
    ...DEFAULT_CONFIG,
    requests: [98, 183, 37, 122, 14, 124, 65, 67],
    sequence: [], // Array of step objects
    currentStepIndex: 0,
    totalHeadMovement: 0,
    isPlaying: false,
    timer: null,
    chartInstance: null,
    containerElement: null
  };

  /**
   * Parse comma-separated string into sorted/filtered valid cylinder numbers
   */
  function parseRequests(str, maxCyl) {
    if (!str || typeof str !== "string") return [];
    return str
      .split(/[,\s]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n >= 0 && n <= maxCyl);
  }

  /**
   * Compute the SCAN Algorithm sequence and head movement
   */
  function computeSCAN(startHead, requests, maxCyl, direction) {
    const leftReqs = requests.filter((r) => r < startHead).sort((a, b) => a - b);
    const rightReqs = requests.filter((r) => r >= startHead).sort((a, b) => a - b);

    const steps = [];
    let current = startHead;
    let totalDist = 0;

    // Initial step
    steps.push({
      step: 0,
      cylinder: current,
      dist: 0,
      runningTotal: 0,
      type: "start",
      desc: `Head starts at cylinder ${current}`
    });

    let stepNum = 1;

    if (direction === "right") {
      // Move towards maxCylinder
      for (const r of rightReqs) {
        const d = Math.abs(r - current);
        totalDist += d;
        current = r;
        steps.push({
          step: stepNum++,
          cylinder: current,
          dist: d,
          runningTotal: totalDist,
          type: "serve",
          desc: `Servicing request at track ${current} (+${d} cyl)`
        });
      }

      // If requests remain on left, hit boundary maxCyl and reverse
      if (leftReqs.length > 0) {
        if (current !== maxCyl) {
          const d = Math.abs(maxCyl - current);
          totalDist += d;
          current = maxCyl;
          steps.push({
            step: stepNum++,
            cylinder: current,
            dist: d,
            runningTotal: totalDist,
            type: "boundary",
            desc: `Reached upper disk boundary ${maxCyl} — Reversing direction! (+${d} cyl)`
          });
        }

        // Reverse and service left requests descending
        for (let i = leftReqs.length - 1; i >= 0; i--) {
          const r = leftReqs[i];
          const d = Math.abs(r - current);
          totalDist += d;
          current = r;
          steps.push({
            step: stepNum++,
            cylinder: current,
            dist: d,
            runningTotal: totalDist,
            type: "serve",
            desc: `Servicing request on return sweep at track ${current} (+${d} cyl)`
          });
        }
      }
    } else {
      // Move towards cylinder 0
      for (let i = leftReqs.length - 1; i >= 0; i--) {
        const r = leftReqs[i];
        const d = Math.abs(r - current);
        totalDist += d;
        current = r;
        steps.push({
          step: stepNum++,
          cylinder: current,
          dist: d,
          runningTotal: totalDist,
          type: "serve",
          desc: `Servicing request at track ${current} (+${d} cyl)`
        });
      }

      // If requests remain on right, hit boundary 0 and reverse
      if (rightReqs.length > 0) {
        if (current !== 0) {
          const d = Math.abs(0 - current);
          totalDist += d;
          current = 0;
          steps.push({
            step: stepNum++,
            cylinder: current,
            dist: d,
            runningTotal: totalDist,
            type: "boundary",
            desc: `Reached lower disk boundary 0 — Reversing direction! (+${d} cyl)`
          });
        }

        // Reverse and service right requests ascending
        for (const r of rightReqs) {
          const d = Math.abs(r - current);
          totalDist += d;
          current = r;
          steps.push({
            step: stepNum++,
            cylinder: current,
            dist: d,
            runningTotal: totalDist,
            type: "serve",
            desc: `Servicing request on return sweep at track ${current} (+${d} cyl)`
          });
        }
      }
    }

    return { steps, totalDist };
  }

  /**
   * Compute the C-SCAN Algorithm sequence and head movement
   */
  function computeCSCAN(startHead, requests, maxCyl, direction) {
    const leftReqs = requests.filter((r) => r < startHead).sort((a, b) => a - b);
    const rightReqs = requests.filter((r) => r >= startHead).sort((a, b) => a - b);

    const steps = [];
    let current = startHead;
    let totalDist = 0;

    steps.push({
      step: 0,
      cylinder: current,
      dist: 0,
      runningTotal: 0,
      type: "start",
      desc: `Head starts at cylinder ${current}`
    });

    let stepNum = 1;

    if (direction === "right") {
      // Move right towards maxCyl
      for (const r of rightReqs) {
        const d = Math.abs(r - current);
        totalDist += d;
        current = r;
        steps.push({
          step: stepNum++,
          cylinder: current,
          dist: d,
          runningTotal: totalDist,
          type: "serve",
          desc: `Servicing request at track ${current} (+${d} cyl)`
        });
      }

      if (leftReqs.length > 0) {
        // Hit boundary maxCyl
        if (current !== maxCyl) {
          const d = Math.abs(maxCyl - current);
          totalDist += d;
          current = maxCyl;
          steps.push({
            step: stepNum++,
            cylinder: current,
            dist: d,
            runningTotal: totalDist,
            type: "boundary",
            desc: `Reached upper disk boundary ${maxCyl} (+${d} cyl)`
          });
        }

        // Jump back to track 0 (Circular reset)
        const jumpDist = maxCyl;
        totalDist += jumpDist;
        current = 0;
        steps.push({
          step: stepNum++,
          cylinder: current,
          dist: jumpDist,
          runningTotal: totalDist,
          type: "jump",
          desc: `C-SCAN Jump: Circular wrap from ${maxCyl} ➔ 0 without servicing (+${jumpDist} cyl)`
        });

        // Resume sweeping right
        for (const r of leftReqs) {
          const d = Math.abs(r - current);
          totalDist += d;
          current = r;
          steps.push({
            step: stepNum++,
            cylinder: current,
            dist: d,
            runningTotal: totalDist,
            type: "serve",
            desc: `Servicing request after circular wrap at track ${current} (+${d} cyl)`
          });
        }
      }
    } else {
      // Move left towards 0
      for (let i = leftReqs.length - 1; i >= 0; i--) {
        const r = leftReqs[i];
        const d = Math.abs(r - current);
        totalDist += d;
        current = r;
        steps.push({
          step: stepNum++,
          cylinder: current,
          dist: d,
          runningTotal: totalDist,
          type: "serve",
          desc: `Servicing request at track ${current} (+${d} cyl)`
        });
      }

      if (rightReqs.length > 0) {
        // Hit boundary 0
        if (current !== 0) {
          const d = Math.abs(0 - current);
          totalDist += d;
          current = 0;
          steps.push({
            step: stepNum++,
            cylinder: current,
            dist: d,
            runningTotal: totalDist,
            type: "boundary",
            desc: `Reached lower disk boundary 0 (+${d} cyl)`
          });
        }

        // Jump back to maxCyl
        const jumpDist = maxCyl;
        totalDist += jumpDist;
        current = maxCyl;
        steps.push({
          step: stepNum++,
          cylinder: current,
          dist: jumpDist,
          runningTotal: totalDist,
          type: "jump",
          desc: `C-SCAN Jump: Circular wrap from 0 ➔ ${maxCyl} without servicing (+${jumpDist} cyl)`
        });

        // Resume sweeping left descending
        for (let i = rightReqs.length - 1; i >= 0; i--) {
          const r = rightReqs[i];
          const d = Math.abs(r - current);
          totalDist += d;
          current = r;
          steps.push({
            step: stepNum++,
            cylinder: current,
            dist: d,
            runningTotal: totalDist,
            type: "serve",
            desc: `Servicing request after circular wrap at track ${current} (+${d} cyl)`
          });
        }
      }
    }

    return { steps, totalDist };
  }

  /**
   * Recalculate simulation data based on current state
   */
  function recalculate() {
    state.requests = parseRequests(state.requestsStr, state.maxCylinder);

    let result;
    if (state.algorithm === "SCAN") {
      result = computeSCAN(state.head, state.requests, state.maxCylinder, state.direction);
    } else {
      result = computeCSCAN(state.head, state.requests, state.maxCylinder, state.direction);
    }

    state.sequence = result.steps;
    state.totalHeadMovement = result.totalDist;

    if (state.currentStepIndex >= state.sequence.length) {
      state.currentStepIndex = state.sequence.length - 1;
    }
  }

  /**
   * Get human readable speed label
   */
  function getSpeedLabel(ms) {
    if (ms <= 300) return "Fast (0.3s)";
    if (ms <= 600) return "Normal (0.6s)";
    if (ms <= 1000) return "Slow (1.0s)";
    return "Very Slow (1.5s)";
  }

  /**
   * Generate Module HTML markup dynamically
   */
  function buildHTML() {
    return `
      <div class="os-team11">
        <!-- Header -->
        <div class="module-header">
          <div class="title-group">
            <div class="badge-icon">💽</div>
            <div>
              <h2 class="module-title">Disk Scheduling — SCAN & C-SCAN</h2>
            </div>
          </div>
          <div class="algo-tabs">
            <button class="tab-btn ${state.algorithm === "SCAN" ? "active" : ""}" data-algo="SCAN" id="os-team11-tab-scan">
              <span>SCAN (Elevator)</span>
            </button>
            <button class="tab-btn ${state.algorithm === "C-SCAN" ? "active tab-cscan" : ""}" data-algo="C-SCAN" id="os-team11-tab-cscan">
              <span>C-SCAN (Circular)</span>
            </button>
          </div>
        </div>

        <!-- Comprehensive Educational Description Card -->
        <div class="disk-overview-card">
          <div class="overview-header">
            <div class="overview-badge">📖 Operating Systems • Storage & I/O Management</div>
            <div class="overview-status-tag ${state.algorithm === "C-SCAN" ? "cscan-tag" : ""}">
              Active Mode: <strong>${state.algorithm === "SCAN" ? "SCAN (Elevator Algorithm)" : "C-SCAN (Circular SCAN)"}</strong>
            </div>
          </div>
          
          <div class="overview-body">
            <p class="overview-lead">
              <strong>Disk Scheduling</strong> is a fundamental operating system subsystem responsible for ordering pending I/O read/write requests across magnetic disk cylinders (tracks). Because mechanical disk arm travel is the dominant bottleneck in secondary storage performance, disk scheduling algorithms systematically minimize <strong>Seek Time</strong> (the time required to position the read/write head over the target cylinder), eliminate starvation, and maximize overall I/O throughput.
            </p>

            <!-- Key Fundamentals Pill Strip (Original 3 + 3 Access Time Components) -->
            <div class="disk-concepts-strip">
              <div class="concept-item">
                <span class="concept-icon">⏱️</span>
                <div>
                  <span class="concept-title">Disk Access Time</span>
                  <span class="concept-desc">Seek Time + Rotational Latency + Transfer Time</span>
                </div>
              </div>
              <div class="concept-item">
                <span class="concept-icon">🎯</span>
                <div>
                  <span class="concept-title">Primary Objective</span>
                  <span class="concept-desc">Minimize Head Movement (Total Seek Distance in Cylinders)</span>
                </div>
              </div>
              <div class="concept-item">
                <span class="concept-icon">📊</span>
                <div>
                  <span class="concept-title">Evaluation Metric</span>
                  <span class="concept-desc">Total Head Movement &amp; Average Seek Distance per Request</span>
                </div>
              </div>
              <div class="concept-item">
                <span class="concept-icon">🔍</span>
                <div>
                  <span class="concept-title">Seek Time</span>
                  <span class="concept-desc">Time to position read/write head over target cylinder</span>
                </div>
              </div>
              <div class="concept-item">
                <span class="concept-icon">🔄</span>
                <div>
                  <span class="concept-title">Rotational Latency</span>
                  <span class="concept-desc">Delay waiting for target disk sector to rotate under head</span>
                </div>
              </div>
              <div class="concept-item">
                <span class="concept-icon">⚡</span>
                <div>
                  <span class="concept-title">Transfer Time</span>
                  <span class="concept-desc">Time required to transfer data bytes to/from disk controller</span>
                </div>
              </div>
            </div>

            <!-- Algorithm Deep Dive Grid -->
            <div class="overview-algo-grid">
              <div class="algo-info-card ${state.algorithm === "SCAN" ? "card-active-scan" : ""}">
                <div class="algo-card-title">
                  <span class="algo-card-icon">🛗</span>
                  <span>SCAN Algorithm (Elevator)</span>
                  ${state.algorithm === "SCAN" ? '<span class="mini-status-badge">CURRENT ACTIVE</span>' : ""}
                </div>
                <p class="algo-card-text">
                  The read/write head moves in one direction across the disk surface, servicing all pending cylinder requests along its path until reaching the <strong>extreme disk boundary</strong> (Track ${state.maxCylinder} or Track 0). Upon hitting the boundary, the head <strong>reverses its sweep direction</strong> and services the remaining requests on the return pass.
                </p>
                <div class="algo-highlights">
                  <div class="highlight-point"><strong>✓ Advantage:</strong> Simple to implement, avoids starvation, yields high overall throughput.</div>
                  <div class="highlight-point"><strong>⚠ Characteristic:</strong> Requests arriving just behind the sweep direction experience longer wait times until the head reverses.</div>
                </div>
              </div>

              <div class="algo-info-card ${state.algorithm === "C-SCAN" ? "card-active-cscan" : ""}">
                <div class="algo-card-title cscan-title">
                  <span class="algo-card-icon">🔄</span>
                  <span>C-SCAN Algorithm (Circular SCAN)</span>
                  ${state.algorithm === "C-SCAN" ? '<span class="mini-status-badge cscan-badge">CURRENT ACTIVE</span>' : ""}
                </div>
                <p class="algo-card-text">
                  Designed specifically to provide a <strong>more uniform and fair waiting time</strong> for all cylinders. The disk head sweeps in a single direction servicing requests until it hits the end boundary, then immediately performs a <strong>circular wrap jump</strong> back to the opposite boundary track <em>without servicing requests during the jump</em>, before resuming the sweep in the original direction.
                </p>
                <div class="algo-highlights">
                  <div class="highlight-point"><strong>✓ Advantage:</strong> Uniform waiting times across all cylinders; treats tracks as a continuous circular ring.</div>
                  <div class="highlight-point"><strong>⚠ Characteristic:</strong> Incurs jump seek distance across boundaries without servicing I/O on the return trip.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Horizontal Input & Controls Bar -->
        <div class="horizontal-controls-bar">
          <!-- Main Parameters Row -->
          <div class="horizontal-params-row">
            <div class="form-group flex-grow-queue">
              <label class="form-label" for="os-team11-input-queue">
                <span class="label-icon">📝</span> Request Queue (Track Cylinders)
              </label>
              <input type="text" id="os-team11-input-queue" class="form-input" value="${state.requestsStr}" placeholder="e.g. 98, 183, 37, 122, 14, 124, 65, 67" />
            </div>

            <div class="form-group flex-fixed-sm">
              <label class="form-label" for="os-team11-input-head">
                <span class="label-icon">📍</span> Initial Head
              </label>
              <input type="number" id="os-team11-input-head" class="form-input" value="${state.head}" min="0" max="${state.maxCylinder}" />
            </div>

            <div class="form-group flex-fixed-sm">
              <label class="form-label" for="os-team11-input-maxcyl">
                <span class="label-icon">📏</span> Max Cylinder
              </label>
              <input type="number" id="os-team11-input-maxcyl" class="form-input" value="${state.maxCylinder}" min="10" max="10000" />
            </div>

            <div class="form-group flex-fixed-dir">
              <label class="form-label" for="os-team11-select-dir">
                <span class="label-icon">🧭</span> Sweep Direction
              </label>
              <select id="os-team11-select-dir" class="form-select">
                <option value="right" ${state.direction === "right" ? "selected" : ""}>Increasing (➔ Track ${state.maxCylinder})</option>
                <option value="left" ${state.direction === "left" ? "selected" : ""}>Decreasing (⬅ Track 0)</option>
              </select>
            </div>

            <div class="form-group flex-fixed-actions">
              <label class="form-label">&nbsp;</label>
              <div class="primary-btn-row">
                <button class="btn btn-primary" id="os-team11-btn-apply" title="Execute Algorithm">▶ Run</button>
                <button class="btn btn-secondary" id="os-team11-btn-reset" title="Reset Default State">↺ Reset</button>
              </div>
            </div>
          </div>

          <!-- Secondary Row: Quick Presets & Interactive Playback Toolbar -->
          <div class="horizontal-toolbar-row">
            <!-- Quick Presets -->
            <div class="presets-inline-group">
              <span class="toolbar-label">⚡ Quick Presets:</span>
              <div class="preset-buttons-wrap">
                <button class="preset-btn" data-preset="textbook">📖 Textbook (53)</button>
                <button class="preset-btn" data-preset="clustered">🎯 Clustered</button>
                <button class="preset-btn" data-preset="extremes">↔ Boundary Heavy</button>
                <button class="preset-btn" data-preset="random">🎲 Random (8)</button>
              </div>
            </div>

            <!-- Playback & Speed Controls -->
            <div class="playback-inline-group">
              <div class="playback-btn-wrap">
                <button class="btn btn-secondary btn-step" id="os-team11-btn-prev" title="Previous Step">⏮ Prev</button>
                <button class="btn btn-accent btn-play-main" id="os-team11-btn-play" title="Play / Pause Animation">⏵ Play</button>
                <button class="btn btn-secondary btn-step" id="os-team11-btn-next" title="Next Step">Next ⏭</button>
              </div>
              <div class="speed-control-wrap">
                <span class="speed-label">Speed:</span>
                <input type="range" id="os-team11-speed-slider" class="speed-slider" min="200" max="1400" step="50" value="${1600 - state.animationSpeed}" />
                <span class="speed-tag" id="os-team11-speed-tag">${getSpeedLabel(state.animationSpeed)}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Full-Width Display & Visualization Area -->
        <div class="display-area">
          <!-- Live Metrics Row -->
          <div class="metrics-grid">
            <div class="metric-box">
              <span class="metric-label">Total Head Movement</span>
              <div class="metric-val" id="os-team11-val-total">${state.totalHeadMovement}<span class="metric-unit">cyl</span></div>
            </div>
            <div class="metric-box orange-accent">
              <span class="metric-label">Current Head Track</span>
              <div class="metric-val" id="os-team11-val-curr">${state.sequence[state.currentStepIndex]?.cylinder ?? state.head}<span class="metric-unit">pos</span></div>
            </div>
            <div class="metric-box purple-accent">
              <span class="metric-label">Average Seek Distance</span>
              <div class="metric-val" id="os-team11-val-avg">${state.requests.length ? (state.totalHeadMovement / state.requests.length).toFixed(1) : 0}<span class="metric-unit">cyl/req</span></div>
            </div>
            <div class="metric-box green-accent">
              <span class="metric-label">Progress</span>
              <div class="metric-val" id="os-team11-val-step">${state.currentStepIndex} / ${state.sequence.length - 1}<span class="metric-unit">steps</span></div>
            </div>
          </div>

          <!-- Interactive Track-Number Line Bar -->
          <div class="track-visualizer-card">
            <div class="track-header">
              <h3 class="card-heading">🎯 Physical Disk Track Ruler</h3>
              <div class="direction-indicator ${state.algorithm === "C-SCAN" ? "cscan-dir" : ""}" id="os-team11-dir-tag">
                ${state.direction === "right" ? "Sweeping Right ➔" : "⬅ Sweeping Left"}
              </div>
            </div>

            <div class="track-ruler-container" id="os-team11-track-container">
              <!-- Outer Track Bar -->
              <div class="track-bar" id="os-team11-track-bar">
                <!-- Boundaries -->
                <div class="track-boundary-left"><span class="boundary-tag boundary-tag-left">Track 0</span></div>
                <div class="track-boundary-right"><span class="boundary-tag boundary-tag-right">Track ${state.maxCylinder}</span></div>
                <!-- Request Pins dynamically injected -->
                <div id="os-team11-pins-wrap"></div>
                <!-- Head Marker -->
                <div class="head-pointer" id="os-team11-head-pointer">
                  <span class="head-pin-badge" id="os-team11-head-badge">Track: ${state.head}</span>
                  <div class="head-pin-icon">▼</div>
                  <div class="head-pin-line"></div>
                </div>
              </div>
            </div>

            <!-- Real-time Event Action Callout -->
            <div class="action-callout" id="os-team11-action-callout">
              <span id="os-team11-action-text">${state.sequence[state.currentStepIndex]?.desc || "Ready"}</span>
              <span class="tag-badge tag-start" id="os-team11-action-tag">STEP ${state.currentStepIndex}</span>
            </div>
          </div>

          <!-- Chart.js 2D Trajectory Graph -->
          <div class="chart-card">
            <div class="track-header">
              <h3 class="card-heading">📈 Head Trajectory vs Sequence Step</h3>
              <span class="form-label" style="font-size:0.75rem; color:var(--os-text-muted);">X: Cylinder (0 - ${state.maxCylinder}) | Y: Step Order (0 - ${state.sequence.length - 1})</span>
            </div>
            <div class="chart-container-box">
              <canvas id="os-team11-chart-canvas"></canvas>
            </div>
          </div>

          <!-- Step Breakdown Table & Side-by-Side Comparison Grid -->
          <div class="details-grid">
            <!-- Step Log Table -->
            <div class="table-card">
              <h3 class="card-heading">📋 Seek Sequence Log</h3>
              <div class="table-scroll">
                <table class="data-table" id="os-team11-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Cylinder</th>
                      <th>Distance</th>
                      <th>Running Total</th>
                      <th>Event</th>
                    </tr>
                  </thead>
                  <tbody id="os-team11-table-body">
                    <!-- Dynamic rows -->
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Comparison Card -->
            <div class="comparison-card">
              <h3 class="card-heading">⚖️ Algorithm Comparison</h3>
              <div class="compare-row" id="os-team11-compare-row">
                <!-- Dynamically computed for current queue -->
              </div>
              <div class="theory-info" style="margin-top:auto;">
                💡 <strong>Summary:</strong> SCAN reverses sweep direction at the boundary, whereas C-SCAN wraps around in a single direction to provide uniform request wait time.
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render dynamic request pins along the track bar with staggered labels to avoid overlaps
   */
  function updateTrackPins() {
    if (!state.containerElement) return;
    const pinsWrap = state.containerElement.querySelector("#os-team11-pins-wrap");
    if (!pinsWrap) return;

    pinsWrap.innerHTML = "";
    const servedSet = new Set();
    for (let i = 0; i <= state.currentStepIndex; i++) {
      if (state.sequence[i]) {
        servedSet.add(state.sequence[i].cylinder);
      }
    }

    // Sort requests to stagger adjacent close pins accurately
    const sortedReqsWithIndex = [...state.requests]
      .map((val, originalIdx) => ({ val, originalIdx }))
      .sort((a, b) => a.val - b.val);

    sortedReqsWithIndex.forEach((item, sortIdx) => {
      const req = item.val;
      const pct = (req / state.maxCylinder) * 100;
      const isServed = servedSet.has(req);
      const isStaggerHigh = sortIdx % 2 === 1;

      const pin = document.createElement("div");
      pin.className = `request-pin ${isServed ? "served" : ""} ${isStaggerHigh ? "stagger-high" : "stagger-low"}`;
      pin.style.left = `${pct}%`;
      pin.title = `Request #${item.originalIdx + 1}: Cylinder ${req}`;
      pin.innerHTML = `<span class="request-pin-label">${req}</span>`;
      pinsWrap.appendChild(pin);
    });
  }

  /**
   * Update the physical head pointer position
   */
  function updateHeadPosition() {
    if (!state.containerElement) return;
    const pointer = state.containerElement.querySelector("#os-team11-head-pointer");
    const badge = state.containerElement.querySelector("#os-team11-head-badge");
    const calloutText = state.containerElement.querySelector("#os-team11-action-text");
    const calloutTag = state.containerElement.querySelector("#os-team11-action-tag");
    const callout = state.containerElement.querySelector("#os-team11-action-callout");
    const valCurr = state.containerElement.querySelector("#os-team11-val-curr");
    const valStep = state.containerElement.querySelector("#os-team11-val-step");

    const currentStep = state.sequence[state.currentStepIndex] || { cylinder: state.head, dist: 0, runningTotal: 0, type: "start", desc: "Ready" };
    const pct = Math.max(0, Math.min(100, (currentStep.cylinder / state.maxCylinder) * 100));

    if (pointer) {
      pointer.style.left = `${pct}%`;
    }
    if (badge) {
      badge.textContent = `Track: ${currentStep.cylinder}`;
    }
    if (valCurr) {
      valCurr.innerHTML = `${currentStep.cylinder}<span class="metric-unit">pos</span>`;
    }
    if (valStep) {
      valStep.innerHTML = `${state.currentStepIndex} / ${state.sequence.length - 1}<span class="metric-unit">steps</span>`;
    }

    if (callout && calloutText && calloutTag) {
      calloutText.textContent = currentStep.desc;
      calloutTag.textContent = `STEP ${state.currentStepIndex}`;
      callout.className = "action-callout";

      if (currentStep.type === "boundary") {
        callout.classList.add("bounce-event");
        calloutTag.className = "tag-badge tag-boundary";
        calloutTag.textContent = "BOUNDARY HIT";
      } else if (currentStep.type === "jump") {
        callout.classList.add("jump-event");
        calloutTag.className = "tag-badge tag-jump";
        calloutTag.textContent = "CIRCULAR JUMP";
      } else if (currentStep.type === "serve") {
        calloutTag.className = "tag-badge tag-serve";
        calloutTag.textContent = "SERVICED";
      } else {
        calloutTag.className = "tag-badge tag-start";
        calloutTag.textContent = "INITIAL HEAD";
      }
    }

    updateTrackPins();
    highlightTableRow();
    updateChartHighlight();
  }

  /**
   * Render the Seek Sequence Table
   */
  function renderTable() {
    if (!state.containerElement) return;
    const tbody = state.containerElement.querySelector("#os-team11-table-body");
    if (!tbody) return;

    tbody.innerHTML = "";
    state.sequence.forEach((stepItem, idx) => {
      const tr = document.createElement("tr");
      tr.id = `os-team11-row-${idx}`;
      if (idx === state.currentStepIndex) tr.classList.add("active-step");
      if (stepItem.type === "jump") tr.classList.add("jump-step");
      if (stepItem.type === "boundary") tr.classList.add("boundary-step");

      let tagClass = "tag-serve";
      let tagLabel = "Serve";
      if (stepItem.type === "start") {
        tagClass = "tag-start";
        tagLabel = "Start";
      } else if (stepItem.type === "boundary") {
        tagClass = "tag-boundary";
        tagLabel = "Boundary";
      } else if (stepItem.type === "jump") {
        tagClass = "tag-jump";
        tagLabel = "Wrap Jump";
      }

      tr.innerHTML = `
        <td>${stepItem.step}</td>
        <td><strong>${stepItem.cylinder}</strong></td>
        <td>${stepItem.dist > 0 ? `+${stepItem.dist}` : "-"}</td>
        <td>${stepItem.runningTotal}</td>
        <td><span class="tag-badge ${tagClass}">${tagLabel}</span></td>
      `;

      tr.addEventListener("click", () => {
        pauseAnimation();
        state.currentStepIndex = idx;
        updateHeadPosition();
      });

      tbody.appendChild(tr);
    });
  }

  /**
   * Highlight current row in the step log table without scrolling the parent page
   */
  function highlightTableRow(autoScrollInternal = false) {
    if (!state.containerElement) return;
    const tbody = state.containerElement.querySelector("#os-team11-table-body");
    const scrollContainer = state.containerElement.querySelector(".table-scroll");
    if (!tbody) return;

    const rows = tbody.querySelectorAll("tr");
    rows.forEach((r, idx) => {
      if (idx === state.currentStepIndex) {
        r.classList.add("active-step");
        if (autoScrollInternal && scrollContainer) {
          scrollContainer.scrollTop = r.offsetTop - scrollContainer.offsetTop - 20;
        }
      } else {
        r.classList.remove("active-step");
      }
    });
  }

  /**
   * Render side-by-side comparison between SCAN and C-SCAN for current dataset
   */
  function renderComparison() {
    if (!state.containerElement) return;
    const compareRow = state.containerElement.querySelector("#os-team11-compare-row");
    if (!compareRow) return;

    const scanResult = computeSCAN(state.head, state.requests, state.maxCylinder, state.direction);
    const cscanResult = computeCSCAN(state.head, state.requests, state.maxCylinder, state.direction);

    const isCurrentScan = state.algorithm === "SCAN";

    compareRow.innerHTML = `
      <div class="compare-item" style="border-color: ${isCurrentScan ? "var(--os-teal)" : "var(--os-card-border)"}; background: ${isCurrentScan ? "var(--os-teal-light)" : "#f8fafc"};">
        <div class="compare-title" style="color: var(--os-teal);">
          <span>SCAN (Elevator)</span>
          ${isCurrentScan ? '<span class="tag-badge tag-start">ACTIVE</span>' : ""}
        </div>
        <div class="compare-stat" style="color: var(--os-teal);">${scanResult.totalDist} <span style="font-size:0.75rem; color:var(--os-text-muted);">cylinders</span></div>
        <div class="compare-desc">Steps: ${scanResult.steps.length} | Avg seek: ${(scanResult.totalDist / (state.requests.length || 1)).toFixed(1)} cyl</div>
      </div>
      <div class="compare-item" style="border-color: ${!isCurrentScan ? "var(--os-orange)" : "var(--os-card-border)"}; background: ${!isCurrentScan ? "var(--os-orange-light)" : "#f8fafc"};">
        <div class="compare-title" style="color: var(--os-orange);">
          <span>C-SCAN (Circular)</span>
          ${!isCurrentScan ? '<span class="tag-badge tag-jump">ACTIVE</span>' : ""}
        </div>
        <div class="compare-stat" style="color: var(--os-orange);">${cscanResult.totalDist} <span style="font-size:0.75rem; color:var(--os-text-muted);">cylinders</span></div>
        <div class="compare-desc">Steps: ${cscanResult.steps.length} | Avg seek: ${(cscanResult.totalDist / (state.requests.length || 1)).toFixed(1)} cyl</div>
      </div>
    `;
  }

  /**
   * Render or update Chart.js 2D Trajectory Plot with proper margins to prevent text clipping
   */
  function initChart() {
    if (!state.containerElement) return;
    const canvas = state.containerElement.querySelector("#os-team11-chart-canvas");
    if (!canvas) return;

    if (state.chartInstance) {
      state.chartInstance.destroy();
      state.chartInstance = null;
    }

    if (typeof Chart === "undefined") {
      const parent = canvas.parentElement;
      if (parent) {
        parent.innerHTML = `
          <div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--os-text-muted); font-size:0.85rem; border:1px dashed var(--os-card-border); border-radius:6px; padding:1rem; text-align:center;">
            Chart.js is loading or not available. Real-time physical track visualization and step log table are fully active above.
          </div>
        `;
      }
      return;
    }

    const dataPoints = state.sequence.map((item) => ({
      x: item.cylinder,
      y: item.step
    }));

    const pointBackgroundColors = state.sequence.map((item, idx) => {
      if (idx === state.currentStepIndex) return "#1d4ed8";
      if (item.type === "start") return "#0891b2";
      if (item.type === "boundary") return "#7c3aed";
      if (item.type === "jump") return "#ea580c";
      return "#16a34a";
    });

    const pointRadius = state.sequence.map((_, idx) => (idx === state.currentStepIndex ? 8 : 5));

    const ctx = canvas.getContext("2d");
    state.chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        datasets: [
          {
            label: `${state.algorithm} Head Trajectory`,
            data: dataPoints,
            borderColor: state.algorithm === "SCAN" ? "#0891b2" : "#ea580c",
            backgroundColor: "rgba(8, 145, 178, 0.05)",
            borderWidth: 2.5,
            pointBackgroundColor: pointBackgroundColors,
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            pointRadius: pointRadius,
            pointHoverRadius: 9,
            fill: false,
            tension: 0.1,
            segment: {
              borderDash: (ctx) => {
                const p1Index = ctx.p1DataIndex;
                if (state.sequence[p1Index]?.type === "jump") {
                  return [6, 6];
                }
                return undefined;
              },
              borderColor: (ctx) => {
                const p1Index = ctx.p1DataIndex;
                if (state.sequence[p1Index]?.type === "jump") {
                  return "#ea580c";
                }
                return state.algorithm === "SCAN" ? "#0891b2" : "#ea580c";
              }
            }
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            left: 15,
            right: 15,
            top: 10,
            bottom: 5
          }
        },
        animation: {
          duration: 300
        },
        plugins: {
          legend: {
            display: true,
            labels: {
              color: "#475569",
              font: { size: 11, family: "inherit", weight: "600" }
            }
          },
          tooltip: {
            backgroundColor: "#ffffff",
            titleColor: "#0f172a",
            bodyColor: "#475569",
            borderColor: "#cbd5e1",
            borderWidth: 1,
            boxPadding: 4,
            callbacks: {
              label: function (context) {
                const step = state.sequence[context.dataIndex];
                if (!step) return "";
                return `Step ${step.step}: Track ${step.cylinder} (Seek: ${step.dist} cyl)`;
              }
            }
          }
        },
        scales: {
          x: {
            type: "linear",
            min: 0,
            max: state.maxCylinder,
            title: {
              display: true,
              text: "Cylinder / Track Number",
              color: "#475569",
              font: { size: 11, weight: "bold" }
            },
            grid: {
              color: "#f1f5f9"
            },
            ticks: {
              color: "#64748b",
              stepSize: Math.ceil(state.maxCylinder / 10)
            }
          },
          y: {
            type: "linear",
            reverse: true,
            min: 0,
            max: Math.max(state.sequence.length - 1, 1),
            title: {
              display: true,
              text: "Sequence Step (Time Order ➔)",
              color: "#475569",
              font: { size: 11, weight: "bold" },
              padding: { bottom: 5 }
            },
            grid: {
              color: "#f1f5f9"
            },
            ticks: {
              color: "#64748b",
              stepSize: 1
            }
          }
        }
      }
    });
  }

  /**
   * Update active step highlight in the chart
   */
  function updateChartHighlight() {
    if (!state.chartInstance || !state.chartInstance.data.datasets[0]) return;

    const dataset = state.chartInstance.data.datasets[0];
    dataset.pointBackgroundColor = state.sequence.map((item, idx) => {
      if (idx === state.currentStepIndex) return "#1d4ed8";
      if (item.type === "start") return "#0891b2";
      if (item.type === "boundary") return "#7c3aed";
      if (item.type === "jump") return "#ea580c";
      return "#16a34a";
    });

    dataset.pointRadius = state.sequence.map((_, idx) => (idx === state.currentStepIndex ? 9 : 5));
    state.chartInstance.update("none");
  }

  /**
   * Animation & Playback controls
   */
  function playAnimation() {
    if (state.isPlaying) return;
    state.isPlaying = true;
    updatePlayButton();

    if (state.currentStepIndex >= state.sequence.length - 1) {
      state.currentStepIndex = 0;
      updateHeadPosition();
    }

    state.timer = setInterval(() => {
      if (state.currentStepIndex < state.sequence.length - 1) {
        state.currentStepIndex++;
        updateHeadPosition();
      } else {
        pauseAnimation();
      }
    }, state.animationSpeed);
  }

  function pauseAnimation() {
    state.isPlaying = false;
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    updatePlayButton();
  }

  function updatePlayButton() {
    if (!state.containerElement) return;
    const playBtn = state.containerElement.querySelector("#os-team11-btn-play");
    if (playBtn) {
      playBtn.innerHTML = state.isPlaying ? "⏸ Pause" : "⏵ Play";
      playBtn.classList.toggle("btn-primary", state.isPlaying);
      playBtn.classList.toggle("btn-accent", !state.isPlaying);
    }
  }

  /**
   * Bind DOM Events inside container
   */
  function bindEvents() {
    if (!state.containerElement) return;
    const root = state.containerElement;

    // Algorithm switcher tabs
    const scanTab = root.querySelector("#os-team11-tab-scan");
    const cscanTab = root.querySelector("#os-team11-tab-cscan");

    if (scanTab) {
      scanTab.addEventListener("click", () => {
        pauseAnimation();
        readInputsFromDOM();
        state.algorithm = "SCAN";
        updateAllViews();
      });
    }

    if (cscanTab) {
      cscanTab.addEventListener("click", () => {
        pauseAnimation();
        readInputsFromDOM();
        state.algorithm = "C-SCAN";
        updateAllViews();
      });
    }

    // Apply button
    const applyBtn = root.querySelector("#os-team11-btn-apply");
    if (applyBtn) {
      applyBtn.addEventListener("click", () => {
        pauseAnimation();
        readInputsFromDOM();
        recalculate();
        state.currentStepIndex = 0;
        updateAllViews();
      });
    }

    // Reset button
    const resetBtn = root.querySelector("#os-team11-btn-reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        window.OSDashboard.modules["team11_disk_scan"].reset();
      });
    }

    // Play/Pause button
    const playBtn = root.querySelector("#os-team11-btn-play");
    if (playBtn) {
      playBtn.addEventListener("click", () => {
        if (state.isPlaying) {
          pauseAnimation();
        } else {
          playAnimation();
        }
      });
    }

    // Prev / Next step buttons
    const prevBtn = root.querySelector("#os-team11-btn-prev");
    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        pauseAnimation();
        if (state.currentStepIndex > 0) {
          state.currentStepIndex--;
          updateHeadPosition();
        }
      });
    }

    const nextBtn = root.querySelector("#os-team11-btn-next");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        pauseAnimation();
        if (state.currentStepIndex < state.sequence.length - 1) {
          state.currentStepIndex++;
          updateHeadPosition();
        }
      });
    }

    // Speed slider & tag
    const speedSlider = root.querySelector("#os-team11-speed-slider");
    const speedTag = root.querySelector("#os-team11-speed-tag");
    if (speedSlider) {
      speedSlider.addEventListener("input", (e) => {
        state.animationSpeed = 1600 - parseInt(e.target.value, 10);
        if (speedTag) {
          speedTag.textContent = getSpeedLabel(state.animationSpeed);
        }
        if (state.isPlaying) {
          pauseAnimation();
          playAnimation();
        }
      });
    }

    // Preset buttons
    const presetBtns = root.querySelectorAll(".preset-btn");
    presetBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const preset = e.target.getAttribute("data-preset");
        loadPreset(preset);
      });
    });

    // Enter key support in input
    const queueInput = root.querySelector("#os-team11-input-queue");
    if (queueInput) {
      queueInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          applyBtn?.click();
        }
      });
    }
  }

  /**
   * Load Preset Datasets
   */
  function loadPreset(name) {
    pauseAnimation();
    if (name === "textbook") {
      state.head = 53;
      state.maxCylinder = 199;
      state.direction = "right";
      state.requestsStr = "98, 183, 37, 122, 14, 124, 65, 67";
    } else if (name === "clustered") {
      state.head = 100;
      state.maxCylinder = 199;
      state.direction = "right";
      state.requestsStr = "95, 98, 102, 105, 110, 20, 25, 30";
    } else if (name === "extremes") {
      state.head = 50;
      state.maxCylinder = 199;
      state.direction = "left";
      state.requestsStr = "2, 195, 15, 180, 5, 190, 25, 170";
    } else if (name === "random") {
      const maxC = state.maxCylinder || 199;
      const count = 8;
      const randReqs = [];
      while (randReqs.length < count) {
        const r = Math.floor(Math.random() * (maxC + 1));
        if (!randReqs.includes(r)) randReqs.push(r);
      }
      state.head = Math.floor(Math.random() * (maxC + 1));
      state.requestsStr = randReqs.join(", ");
    }

    recalculate();
    state.currentStepIndex = 0;
    updateAllViews();
  }

  /**
   * Read Form Inputs from DOM
   */
  function readInputsFromDOM() {
    if (!state.containerElement) return;
    const root = state.containerElement;

    const queueVal = root.querySelector("#os-team11-input-queue")?.value;
    const headVal = parseInt(root.querySelector("#os-team11-input-head")?.value, 10);
    const maxCylVal = parseInt(root.querySelector("#os-team11-input-maxcyl")?.value, 10);
    const dirVal = root.querySelector("#os-team11-select-dir")?.value;

    if (queueVal !== undefined) state.requestsStr = queueVal;
    if (!isNaN(maxCylVal) && maxCylVal > 0) state.maxCylinder = maxCylVal;
    if (!isNaN(headVal) && headVal >= 0 && headVal <= state.maxCylinder) state.head = headVal;
    if (dirVal === "right" || dirVal === "left") state.direction = dirVal;
  }

  /**
   * Sync and update all UI views after state change
   */
  function updateAllViews() {
    if (!state.containerElement) return;
    const currentScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    recalculate();

    // Re-render whole container layout
    state.containerElement.innerHTML = buildHTML();
    bindEvents();
    renderTable();
    renderComparison();
    updateHeadPosition();
    initChart();

    // Maintain stable viewport position without unwanted jumping
    window.scrollTo({ top: currentScrollY, behavior: "instant" });
  }

  // Public Module API
  return {
    title: "Disk Scheduling — SCAN & C-SCAN",

    render: function (container) {
      if (!container) return;
      state.containerElement = container;
      recalculate();
      state.currentStepIndex = 0;
      updateAllViews();
    },

    reset: function () {
      pauseAnimation();
      state = {
        ...DEFAULT_CONFIG,
        requests: [98, 183, 37, 122, 14, 124, 65, 67],
        sequence: [],
        currentStepIndex: 0,
        totalHeadMovement: 0,
        isPlaying: false,
        timer: null,
        chartInstance: null,
        containerElement: state.containerElement
      };
      recalculate();
      updateAllViews();
    },

    getMetrics: function () {
      if (!state.sequence || state.sequence.length === 0) {
        recalculate();
      }
      return {
        primaryMetricLabel: "Total Head Movement",
        primaryMetricValue: state.totalHeadMovement || 0,
        unit: "cylinders"
      };
    }
  };
})();
