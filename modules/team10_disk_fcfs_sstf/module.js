(function () {
    "use strict";

    window.OSDashboard = window.OSDashboard || { modules: {} };

    const DEFAULT_QUEUE = [2069, 1212, 2296, 2800, 544, 1618, 356, 1523];
    const DEFAULT_HEAD = 2150;
    const DEFAULT_MAX_CYLINDER = 4999;

    let state = {
        queue: DEFAULT_QUEUE.slice(),
        head: DEFAULT_HEAD,
        maxCylinder: DEFAULT_MAX_CYLINDER,
        algorithm: "FCFS",

        sequence: [],
        steps: [],
        currentStep: 0,
        totalMovement: 0,

        hasRun: false,
        running: false,
        timer: null,

        container: null
    };

    function cloneDefaultQueue() {
        return DEFAULT_QUEUE.slice();
    }

    function parseQueue(value) {
        if (Array.isArray(value)) {
            return value.map(Number);
        }

        return value
            .split(",")
            .map(function (item) {
                return item.trim();
            })
            .filter(function (item) {
                return item !== "";
            })
            .map(Number);
    }

    function validateInput(queue, head, maxCylinder) {
        if (!queue.length) {
            return "Request queue cannot be empty.";
        }

        if (
            !Number.isInteger(head) ||
            head < 0 ||
            head > maxCylinder
        ) {
            return "Initial head position must be between 0 and the maximum cylinder.";
        }

        for (let i = 0; i < queue.length; i++) {
            if (
                !Number.isInteger(queue[i]) ||
                queue[i] < 0 ||
                queue[i] > maxCylinder
            ) {
                return "Every request must be an integer between 0 and the maximum cylinder.";
            }
        }

        return null;
    }

    function calculateFCFS(queue, head) {
        let current = head;
        let total = 0;
        const steps = [];
        const sequence = [head];

        queue.forEach(function (request, index) {
            const distance = Math.abs(current - request);

            total += distance;

            steps.push({
                step: index + 1,
                from: current,
                to: request,
                distance: distance,
                cumulative: total
            });

            current = request;
            sequence.push(request);
        });

        return {
            sequence: sequence,
            steps: steps,
            total: total
        };
    }

    function calculateSSTF(queue, head) {
        let current = head;
        let total = 0;

        const remaining = queue.map(function (value, index) {
            return {
                value: value,
                originalIndex: index
            };
        });

        const steps = [];
        const sequence = [head];

        while (remaining.length > 0) {
            let selectedIndex = 0;
            let shortestDistance = Math.abs(
                current - remaining[0].value
            );

            for (let i = 1; i < remaining.length; i++) {
                const distance = Math.abs(
                    current - remaining[i].value
                );

                /*
                 * If distances are equal, use the original
                 * request order to make the result deterministic.
                 */
                if (distance < shortestDistance) {
                    shortestDistance = distance;
                    selectedIndex = i;
                }
            }

            const selected = remaining[selectedIndex];

            total += shortestDistance;

            steps.push({
                step: steps.length + 1,
                from: current,
                to: selected.value,
                distance: shortestDistance,
                cumulative: total
            });

            current = selected.value;
            sequence.push(selected.value);

            remaining.splice(selectedIndex, 1);
        }

        return {
            sequence: sequence,
            steps: steps,
            total: total
        };
    }

    function calculateBoth(queue, head) {
        return {
            FCFS: calculateFCFS(queue, head),
            SSTF: calculateSSTF(queue, head)
        };
    }

    function calculateCurrent() {
        if (state.algorithm === "SSTF") {
            return calculateSSTF(state.queue, state.head);
        }

        return calculateFCFS(state.queue, state.head);
    }

    function stopAnimation() {
        state.running = false;

        if (state.timer !== null) {
            clearInterval(state.timer);
            state.timer = null;
        }
    }

    function prepareSimulation() {
        stopAnimation();

        const queueInput = state.container.querySelector(
            ".os-team10-queue-input"
        );

        const headInput = state.container.querySelector(
            ".os-team10-head-input"
        );

        const maxInput = state.container.querySelector(
            ".os-team10-max-input"
        );

        const algorithmInput = state.container.querySelector(
            ".os-team10-algorithm-input"
        );

        const queue = parseQueue(queueInput.value);
        const head = Number(headInput.value);
        const maxCylinder = Number(maxInput.value);
        const algorithm = algorithmInput.value;

        const error = validateInput(queue, head, maxCylinder);

        const errorBox = state.container.querySelector(
            ".os-team10-error"
        );

        if (error) {
            if (errorBox) {
                errorBox.textContent = error;
                errorBox.classList.add("os-team10-visible");
            }
            return false;
        }

        if (errorBox) {
            errorBox.textContent = "";
            errorBox.classList.remove("os-team10-visible");
        }

        state.queue = queue;
        state.head = head;
        state.maxCylinder = maxCylinder;
        state.algorithm = algorithm;

        const result = calculateCurrent();

        state.sequence = result.sequence;
        state.steps = result.steps;
        state.currentStep = 0;
        state.totalMovement = 0;
        state.hasRun = true;

        return true;
    }

    function runSimulation() {
        if (!prepareSimulation()) {
            return;
        }

        state.currentStep = state.steps.length;
        if (state.steps.length > 0) {
            state.totalMovement =
                state.steps[state.steps.length - 1].cumulative;
        }

        renderDashboard();
    }

    function handleStartAnimation() {
        if (
            !state.hasRun ||
            !state.steps.length ||
            state.currentStep >= state.steps.length
        ) {
            if (!prepareSimulation()) {
                return;
            }
        } else {
            const queueInput = state.container.querySelector(
                ".os-team10-queue-input"
            );
            const headInput = state.container.querySelector(
                ".os-team10-head-input"
            );
            const maxInput = state.container.querySelector(
                ".os-team10-max-input"
            );
            const algorithmInput = state.container.querySelector(
                ".os-team10-algorithm-input"
            );

            if (queueInput && headInput && maxInput && algorithmInput) {
                const queue = parseQueue(queueInput.value);
                const head = Number(headInput.value);
                const maxCylinder = Number(maxInput.value);
                const algorithm = algorithmInput.value;

                const queueChanged =
                    queue.join(",") !== state.queue.join(",");
                if (
                    queueChanged ||
                    head !== state.head ||
                    maxCylinder !== state.maxCylinder ||
                    algorithm !== state.algorithm
                ) {
                    if (!prepareSimulation()) {
                        return;
                    }
                }
            }
        }

        startAnimation();
    }

    function getTrackPosition(value) {
        return (
            (value / state.maxCylinder) * 100
        );
    }

    function createTrackSVG() {
        const width = 1200;
        const height = 330;
        const left = 55;
        const right = 55;
        const usableWidth = width - left - right;
        const trackY = 75;

        let svg = "";

        svg += '<svg class="os-team10-track-svg" ';
        svg += 'viewBox="0 0 ' + width + " " + height + '">';
        svg += '<defs>';
        svg += '<marker id="os-team10-arrow" ';
        svg += 'markerWidth="8" markerHeight="8" ';
        svg += 'refX="7" refY="3" orient="auto">';
        svg += '<path d="M0,0 L0,6 L8,3 z" ';
        svg += 'class="os-team10-arrow-shape"></path>';
        svg += "</marker>";
        svg += "</defs>";

        /*
         * Main cylinder line.
         */
        svg +=
            '<line x1="' +
            left +
            '" y1="' +
            trackY +
            '" x2="' +
            (width - right) +
            '" y2="' +
            trackY +
            '" class="os-team10-track-line"></line>';

        /*
         * Cylinder labels.
         */
        const divisions = 10;

        for (let i = 0; i <= divisions; i++) {
            const cylinder = Math.round(
                (state.maxCylinder / divisions) * i
            );

            const x =
                left +
                (cylinder / state.maxCylinder) *
                usableWidth;

            svg +=
                '<line x1="' +
                x +
                '" y1="' +
                (trackY - 8) +
                '" x2="' +
                x +
                '" y2="' +
                (trackY + 8) +
                '" class="os-team10-tick"></line>';

            svg +=
                '<text x="' +
                x +
                '" y="' +
                (trackY + 32) +
                '" text-anchor="middle" class="os-team10-axis-label">' +
                cylinder +
                "</text>";
        }

        /*
         * Request markers.
         */
        const requestCounts = {};

        state.queue.forEach(function (request) {
            requestCounts[request] =
                (requestCounts[request] || 0) + 1;
        });

        Object.keys(requestCounts).forEach(function (key) {
            const request = Number(key);

            const x =
                left +
                (request / state.maxCylinder) *
                usableWidth;

            svg +=
                '<circle cx="' +
                x +
                '" cy="' +
                trackY +
                '" r="7" class="os-team10-request-dot"></circle>';

            svg +=
                '<text x="' +
                x +
                '" y="' +
                (trackY - 24) +
                '" text-anchor="middle" class="os-team10-request-label">' +
                request +
                "</text>";
        });

        /*
         * Initial head marker.
         */
        const headX =
            left +
            (state.head / state.maxCylinder) *
            usableWidth;

        svg +=
            '<line x1="' +
            headX +
            '" y1="' +
            (trackY - 65) +
            '" x2="' +
            headX +
            '" y2="' +
            (trackY + 65) +
            '" class="os-team10-head-line"></line>';

        svg +=
            '<text x="' +
            headX +
            '" y="' +
            (trackY - 82) +
            '" text-anchor="middle" class="os-team10-head-label">' +
            "START " +
            state.head +
            "</text>";

        /*
         * Movement path.
         */
        let previous = state.head;
        let previousY = trackY + 48;

        for (
            let i = 0;
            i < state.currentStep;
            i++
        ) {
            const current = state.steps[i].to;

            const x1 =
                left +
                (previous / state.maxCylinder) *
                usableWidth;

            const x2 =
                left +
                (current / state.maxCylinder) *
                usableWidth;

            const pathY = trackY + 48 + i * 25;

            svg +=
                '<line x1="' +
                x2 +
                '" y1="' +
                (trackY + 8) +
                '" x2="' +
                x2 +
                '" y2="' +
                pathY +
                '" class="os-team10-step-guide"></line>';

            svg +=
                '<line x1="' +
                x1 +
                '" y1="' +
                previousY +
                '" x2="' +
                x2 +
                '" y2="' +
                pathY +
                '" class="os-team10-movement-line"></line>';

            svg +=
                '<circle cx="' +
                x2 +
                '" cy="' +
                pathY +
                '" r="5" class="os-team10-step-dot"></circle>';

            previous = current;
            previousY = pathY;
        }

        /*
         * Current head.
         */
        if (state.hasRun) {
            let currentHead = state.head;

            if (state.currentStep > 0 && state.steps[state.currentStep - 1]) {
                currentHead =
                    state.steps[state.currentStep - 1].to;
            }

            const currentX =
                left +
                (currentHead / state.maxCylinder) *
                usableWidth;

            svg +=
                '<circle cx="' +
                currentX +
                '" cy="' +
                trackY +
                '" r="12" class="os-team10-current-head"></circle>';

            svg +=
                '<text x="' +
                currentX +
                '" y="' +
                (trackY + 75) +
                '" text-anchor="middle" class="os-team10-current-label">' +
                "HEAD " +
                currentHead +
                "</text>";
        }

        svg += "</svg>";

        return svg;
    }

    function renderSequence() {
        if (!state.hasRun || !state.sequence.length) {
            return `
                <div class="os-team10-empty-table">
                    Click &ldquo;Run Simulation&rdquo; or &ldquo;Start Animation&rdquo; to view the service sequence.
                </div>
            `;
        }

        let html = "";

        state.sequence.forEach(function (value, index) {
            const active =
                index === state.currentStep
                    ? " os-team10-sequence-active"
                    : "";

            const completed =
                index < state.currentStep
                    ? " os-team10-sequence-completed"
                    : "";

            html +=
                '<span class="os-team10-sequence-item' +
                active +
                completed +
                '">' +
                value +
                "</span>";

            if (index < state.sequence.length - 1) {
                html +=
                    '<span class="os-team10-sequence-arrow">→</span>';
            }
        });

        return html;
    }

    function renderResultsTable() {
        if (!state.hasRun || !state.steps.length) {
            return `
                <div class="os-team10-empty-table">
                    Run the simulation to generate the movement table.
                </div>
            `;
        }

        let rows = "";

        state.steps.forEach(function (step, index) {
            const active =
                index === state.currentStep - 1
                    ? " os-team10-table-active"
                    : "";

            rows += `
                <tr class="${active}">
                    <td>${step.step}</td>
                    <td>${step.from}</td>
                    <td>${step.to}</td>
                    <td>${step.distance}</td>
                    <td>${step.cumulative}</td>
                </tr>
            `;
        });

        return `
            <div class="os-team10-table-wrapper">
                <table class="os-team10-results-table">
                    <thead>
                        <tr>
                            <th>Step</th>
                            <th>From</th>
                            <th>Requested Cylinder</th>
                            <th>Seek Distance</th>
                            <th>Cumulative Movement</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    }

    function renderComparison() {
        if (!state.hasRun) {
            return `
                <div class="os-team10-empty-table">
                    Run the simulation to view the FCFS vs SSTF comparison.
                </div>
            `;
        }

        const comparison = calculateBoth(
            state.queue,
            state.head
        );

        return `
            <div class="os-team10-comparison-grid">

                <div class="os-team10-comparison-card">
                    <div class="os-team10-comparison-title">
                        FCFS
                    </div>

                    <div class="os-team10-comparison-value">
                        ${comparison.FCFS.total}
                        <span>cylinders</span>
                    </div>

                    <div class="os-team10-comparison-sequence">
                        ${comparison.FCFS.sequence.join(" → ")}
                    </div>
                </div>

                <div class="os-team10-comparison-card">
                    <div class="os-team10-comparison-title">
                        SSTF
                    </div>

                    <div class="os-team10-comparison-value">
                        ${comparison.SSTF.total}
                        <span>cylinders</span>
                    </div>

                    <div class="os-team10-comparison-sequence">
                        ${comparison.SSTF.sequence.join(" → ")}
                    </div>
                </div>

            </div>
        `;
    }

    function renderDashboard() {
        if (!state.container) {
            return;
        }

        const completed = state.currentStep;

        let displayedMovement = 0;

        if (state.hasRun && completed > 0 && state.steps[completed - 1]) {
            displayedMovement =
                state.steps[completed - 1].cumulative;
        }

        state.totalMovement = displayedMovement;

        let currentHead = state.head;

        if (state.hasRun && completed > 0 && state.steps[completed - 1]) {
            currentHead =
                state.steps[completed - 1].to;
        }

        let currentRequest = "—";
        if (state.hasRun) {
            currentRequest =
                completed < state.steps.length
                    ? state.steps[completed].to
                    : "Complete";
        }

        state.container.innerHTML = `
            <div class="os-team10">

                <header class="os-team10-header">

                    <div class="os-team10-header-left">
                        <div>
                            <h1 class="os-team10-title">
                                Disk Scheduling : FCFS and SSTF
                            </h1>
                        </div>
                    </div>

                </header>

                <section class="os-team10-explanation">
                    <div class="os-team10-explanation-card os-team10-explanation-wide">
                        <span class="os-team10-label">ABOUT</span>
                        <h2>Disk Scheduling Algorithms</h2>
                        <p>
                            Disk scheduling algorithms decide the order in which pending disk I/O requests are serviced. This
                            dashboard explains two common methods: FCFS, which serves requests in arrival order, and SSTF,
                            which serves the nearest request first. FCFS is simple and fair but can cause more head movement,
                            while SSTF often reduces seek time and improves throughput but may starve requests that are farther
                            away. Their advantages and disadvantages are explained below.
                        </p>

                        <span class="os-team10-label">FCFS</span>
                        <h3>First-Come, First-Served</h3>
                        <p><strong>How it works:</strong> FCFS services requests in the exact order they arrive, without
                            changing the queue order.</p>
                        <ul>
                            <li><strong>Advantages:</strong> simple to implement, predictable, and fair because no request is skipped.</li>
                            <li><strong>Disadvantages:</strong> can produce large head movements, higher average seek time, and
                                lower performance when requests are scattered across the disk.</li>
                        </ul>

                        <span class="os-team10-label">SSTF</span>
                        <h3>Shortest Seek Time First</h3>
                        <p><strong>How it works:</strong> SSTF selects the pending request closest to the current disk-head
                            position, then repeats the decision after each movement.</p>
                        <ul>
                            <li><strong>Seek Time:</strong> time taken for the disk arm to move the read/write head to the target cylinder/track.</li>
                            <li><strong>Rotational Latency:</strong> time taken for the target sector on the platter to rotate under the read/write head.</li>
                            <li><strong>Advantages:</strong> usually reduces average seek time and improves throughput compared
                                with FCFS.</li>
                            <li><strong>Disadvantages:</strong> requests far from the current head may starve, and the locally
                                nearest choice does not always minimize total movement.</li>
                        </ul>
                    </div>
                </section>

                <section class="os-team10-control-panel">

                    <div class="os-team10-section-heading">
                        <div>
                            <h2>Simulation Configuration</h2>
                            <p>
                                Configure the disk request queue and starting head position.
                            </p>
                        </div>
                    </div>

                    <div class="os-team10-input-grid">

                        <div class="os-team10-input-group os-team10-input-wide">
                            <label>
                                Request Queue
                            </label>

                            <input
                                type="text"
                                class="os-team10-queue-input"
                                value="${state.queue.join(", ")}"
                                placeholder="98, 183, 37, 122..."
                            />

                            <span class="os-team10-input-help">
                                Enter cylinder requests separated by commas.
                            </span>
                        </div>

                        <div class="os-team10-input-group">
                            <label>
                                Initial Head
                            </label>

                            <input
                                type="number"
                                class="os-team10-head-input"
                                value="${state.head}"
                                min="0"
                            />
                        </div>

                        <div class="os-team10-input-group">
                            <label>
                                Maximum Cylinder
                            </label>

                            <input
                                type="number"
                                class="os-team10-max-input"
                                value="${state.maxCylinder}"
                                min="1"
                            />
                        </div>

                        <div class="os-team10-input-group">
                            <label>
                                Algorithm
                            </label>

                            <select class="os-team10-algorithm-input">
                                <option value="FCFS"
                                    ${state.algorithm === "FCFS" ? "selected" : ""}>
                                    FCFS
                                </option>

                                <option value="SSTF"
                                    ${state.algorithm === "SSTF" ? "selected" : ""}>
                                    SSTF
                                </option>
                            </select>
                        </div>

                    </div>

                    <div class="os-team10-error"></div>

                    <div class="os-team10-button-row">

                        <button
                            type="button"
                            class="os-team10-btn os-team10-btn-primary os-team10-run-btn">
                            Run Simulation
                        </button>

                        <button
                            type="button"
                            class="os-team10-btn os-team10-btn-secondary os-team10-start-btn">
                            Start Animation
                        </button>

                        <button
                            type="button"
                            class="os-team10-btn os-team10-btn-secondary os-team10-next-btn">
                            Next Step
                        </button>

                        <button
                            type="button"
                            class="os-team10-btn os-team10-btn-ghost os-team10-pause-btn">
                            Pause
                        </button>

                        <button
                            type="button"
                            class="os-team10-btn os-team10-btn-ghost os-team10-reset-btn">
                            Reset
                        </button>

                    </div>

                </section>


                <section class="os-team10-metrics">

                    <div class="os-team10-metric-card">
                        <span>Current Head</span>
                        <strong>${state.hasRun ? currentHead : "—"}</strong>
                        <small>cylinder</small>
                    </div>

                    <div class="os-team10-metric-card">
                        <span>Requests Completed</span>
                        <strong>${state.hasRun ? completed : "—"}</strong>
                        <small>${state.hasRun ? `of ${state.queue.length}` : "—"}</small>
                    </div>

                    <div class="os-team10-metric-card">
                        <span>Total Movement</span>
                        <strong>${state.hasRun ? displayedMovement : "—"}</strong>
                        <small>cylinders</small>
                    </div>

                    <div class="os-team10-metric-card">
                        <span>Next Request</span>
                        <strong>${state.hasRun ? currentRequest : "—"}</strong>
                        <small>${state.algorithm}</small>
                    </div>

                </section>

                <section class="os-team10-main-card">

                    <div class="os-team10-card-heading">
                        <div>
                            <span class="os-team10-label">
                                HEAD MOVEMENT
                            </span>

                            <h2>
                                Disk Track Visualization
                            </h2>
                        </div>

                        <div class="os-team10-algorithm-pill">
                            ${state.algorithm}
                        </div>
                    </div>

                    <div class="os-team10-legend">

                        <span>
                            <i class="os-team10-legend-dot os-team10-legend-request"></i>
                            Request
                        </span>

                        <span>
                            <i class="os-team10-legend-dot os-team10-legend-current"></i>
                            Current Head
                        </span>

                        <span>
                            <i class="os-team10-legend-line"></i>
                            Movement Path
                        </span>

                    </div>

                    <div class="os-team10-track-wrapper">
                        ${createTrackSVG()}
                    </div>

                </section>

                <section class="os-team10-main-card">

                    <div class="os-team10-card-heading">
                        <div>
                            <span class="os-team10-label">
                                SERVICE ORDER
                            </span>

                            <h2>
                                Head Movement Sequence
                            </h2>
                        </div>
                    </div>

                    <div class="os-team10-sequence-container">
                        ${renderSequence()}
                    </div>

                </section>

                <section class="os-team10-main-card">

                    <div class="os-team10-card-heading">
                        <div>
                            <span class="os-team10-label">
                                CALCULATION
                            </span>

                            <h2>
                                Movement Breakdown
                            </h2>
                        </div>
                    </div>

                    ${renderResultsTable()}

                </section>

                <section class="os-team10-main-card">

                    <div class="os-team10-card-heading">
                        <div>
                            <span class="os-team10-label">
                                COMPARISON
                            </span>

                            <h2>
                                FCFS vs SSTF
                            </h2>

                            <p>
                                Both algorithms are calculated using the same input data.
                            </p>
                        </div>
                    </div>

                    ${renderComparison()}

                </section>

                <footer class="os-team10-footer">
                    <div>
                        <strong>Disk Scheduling I</strong>
                        <span>·</span>
                        FCFS & SSTF
                    </div>

                    <div>
                        Disk Scheduling Visualization
                    </div>
                </footer>

            </div>
        `;

        attachEvents();
    }

    function attachEvents() {
        const runButton =
            state.container.querySelector(
                ".os-team10-run-btn"
            );

        const startButton =
            state.container.querySelector(
                ".os-team10-start-btn"
            );

        const nextButton =
            state.container.querySelector(
                ".os-team10-next-btn"
            );

        const pauseButton =
            state.container.querySelector(
                ".os-team10-pause-btn"
            );

        const resetButton =
            state.container.querySelector(
                ".os-team10-reset-btn"
            );

        runButton.addEventListener(
            "click",
            function () {
                runSimulation();
            }
        );

        startButton.addEventListener(
            "click",
            function () {
                handleStartAnimation();
            }
        );

        nextButton.addEventListener(
            "click",
            function () {
                stopAnimation();
                if (
                    !state.hasRun ||
                    !state.steps.length ||
                    state.currentStep >= state.steps.length
                ) {
                    if (!prepareSimulation()) {
                        return;
                    }
                }
                nextStep();
            }
        );

        pauseButton.addEventListener(
            "click",
            function () {
                stopAnimation();
                renderDashboard();
            }
        );

        resetButton.addEventListener(
            "click",
            function () {
                reset();
            }
        );
    }

    function nextStep() {
        if (
            state.currentStep >=
            state.steps.length
        ) {
            stopAnimation();
            return;
        }

        state.currentStep++;

        renderDashboard();

        if (
            state.currentStep >=
            state.steps.length
        ) {
            stopAnimation();
            renderDashboard();
        }
    }

    function startAnimation() {
        stopAnimation();

        state.running = true;

        renderDashboard();

        state.timer = setInterval(
            function () {
                if (
                    state.currentStep >=
                    state.steps.length
                ) {
                    stopAnimation();
                    renderDashboard();
                    return;
                }

                nextStep();
            },
            900
        );
    }

    function reset() {
        stopAnimation();

        state.queue = cloneDefaultQueue();
        state.head = DEFAULT_HEAD;
        state.maxCylinder = DEFAULT_MAX_CYLINDER;
        state.algorithm = "FCFS";

        state.sequence = [];
        state.steps = [];
        state.currentStep = 0;
        state.totalMovement = 0;
        state.hasRun = false;

        renderDashboard();
    }

    function render(container) {
        state.container = container;

        state.queue = cloneDefaultQueue();
        state.head = DEFAULT_HEAD;
        state.maxCylinder = DEFAULT_MAX_CYLINDER;
        state.algorithm = "FCFS";

        state.sequence = [];
        state.steps = [];
        state.currentStep = 0;
        state.totalMovement = 0;
        state.hasRun = false;

        renderDashboard();
    }

    function getMetrics() {
        try {
            const result = calculateCurrent();

            return {
                primaryMetricLabel: "Total Head Movement",
                primaryMetricValue: Number(result.total),
                unit: "cylinders"
            };
        } catch (error) {
            const fallback = calculateFCFS(
                DEFAULT_QUEUE,
                DEFAULT_HEAD
            );

            return {
                primaryMetricLabel: "Total Head Movement",
                primaryMetricValue: Number(fallback.total),
                unit: "cylinders"
            };
        }
    }

    window.OSDashboard.modules["disk_fcfs_sstf"] = {
        title: "Disk Scheduling — FCFS & SSTF",
        render: render,
        reset: reset,
        getMetrics: getMetrics
    };

})();