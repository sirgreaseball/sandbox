window.OSDashboard = window.OSDashboard || { modules: {} };

(function () {

    /* =========================================================
       DEFAULT SAMPLE DATA
       ========================================================= */

    const DEFAULT_ALLOCATION = [
        [0, 1, 0],
        [2, 0, 0],
        [3, 0, 2],
        [2, 1, 1],
        [0, 0, 2]
    ];

    const DEFAULT_MAXIMUM = [
        [7, 5, 3],
        [3, 2, 2],
        [9, 0, 2],
        [2, 2, 2],
        [4, 3, 3]
    ];

    const DEFAULT_AVAILABLE = [3, 3, 2];

    let allocation = [];
    let maximum = [];
    let available = [];

    let currentContainer = null;

    let animation = {
        steps: [],
        currentStep: 0,
        timer: null
    };

    let lastSystemState = "Unsafe";


    /* =========================================================
       BASIC UTILITIES
       ========================================================= */

    function cloneMatrix(matrix) {
        return matrix.map(function (row) {
            return row.slice();
        });
    }


    function resetData() {

        allocation = cloneMatrix(DEFAULT_ALLOCATION);

        maximum = cloneMatrix(DEFAULT_MAXIMUM);

        available = DEFAULT_AVAILABLE.slice();

        lastSystemState = "Unsafe";

        stopAnimation();

        animation = {
            steps: [],
            currentStep: 0,
            timer: null
        };
    }


    function escapeHTML(value) {

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /* =========================================================
       NEED MATRIX
       Need = Maximum - Allocation
       ========================================================= */

    function calculateNeed() {

        return maximum.map(function (row, i) {

            return row.map(function (value, j) {

                return value - allocation[i][j];

            });

        });
    }


    /* =========================================================
       SAFETY ALGORITHM
       ========================================================= */

    function getSafetyResult(
        alloc,
        max,
        avail
    ) {

        alloc = alloc || allocation;
        max = max || maximum;
        avail = avail || available;

        const need = max.map(function (row, i) {

            return row.map(function (value, j) {

                return value - alloc[i][j];

            });

        });


        const work = avail.slice();

        const finish =
            new Array(alloc.length).fill(false);

        const sequence = [];

        const steps = [];


        while (sequence.length < alloc.length) {

            let found = false;


            for (let i = 0; i < alloc.length; i++) {

                if (finish[i]) {
                    continue;
                }


                const canFinish =
                    need[i][0] <= work[0] &&
                    need[i][1] <= work[1] &&
                    need[i][2] <= work[2];


                steps.push({

                    process: i,

                    workBefore: work.slice(),

                    need: need[i].slice(),

                    canFinish: canFinish,

                    workAfter: null

                });


                if (canFinish) {

                    for (let j = 0; j < 3; j++) {

                        work[j] += alloc[i][j];

                    }


                    finish[i] = true;

                    sequence.push(i);

                    steps[steps.length - 1].workAfter =
                        work.slice();

                    found = true;

                    break;
                }

            }


            if (!found) {
                break;
            }
        }


        const safe =
            sequence.length === alloc.length;


        return {

            safe: safe,

            sequence: sequence,

            steps: steps,

            need: need,

            finalWork: work

        };
    }


    /* =========================================================
       MATRIX HTML
       ========================================================= */

    function renderMatrix(
        title,
        matrix,
        editable,
        matrixName
    ) {

        let html = "";

        html += `
            <div class="os-team06-matrix-card">

                <div class="os-team06-matrix-title">

                    <h3>${title}</h3>

                    <span>
                        ${editable
                            ? "Editable"
                            : "Auto Calculated"}
                    </span>

                </div>

                <div class="os-team06-table-wrap">

                    <table>

                        <thead>

                            <tr>
                                <th>Process</th>
                                <th>Resource A</th>
                                <th>Resource B</th>
                                <th>Resource C</th>
                            </tr>

                        </thead>

                        <tbody>
        `;


        matrix.forEach(function (row, i) {

            html += `
                <tr>
                    <td class="os-team06-process-name">
                        P${i}
                    </td>
            `;


            row.forEach(function (value, j) {

                if (editable) {

                    html += `
                        <td>

                            <input
                                class="os-team06-number-input"
                                type="number"
                                min="0"
                                value="${value}"
                                data-matrix="${matrixName}"
                                data-row="${i}"
                                data-col="${j}"
                            >

                        </td>
                    `;

                } else {

                    html += `
                        <td class="os-team06-need-cell">
                            ${value}
                        </td>
                    `;

                }

            });


            html += "</tr>";

        });


        html += `
                        </tbody>

                    </table>

                </div>

            </div>
        `;


        return html;
    }


    /* =========================================================
       THEORY SECTION
       ========================================================= */

    function renderTheory() {

        return `

            <div class="os-team06-theory-card">

                <div class="os-team06-theory-header">

                    <h3>
                        Theory &amp; Algorithms
                    </h3>

                    <p>
                        Understand the theory first, then use the
                        interactive visualizations below to observe
                        how the algorithms work.
                    </p>

                </div>


                <div class="os-team06-theory-grid">


                    <!-- SAFE STATE -->

                    <div class="os-team06-theory-block">

                        <h4>
                            Safe State
                        </h4>

                        <p>
                            A system is in a
                            <b>Safe State</b> when there is at least
                            one sequence in which every process can
                            obtain its remaining required resources,
                            complete execution and release its
                            allocated resources.
                        </p>

                        <p>
                            This order is called the
                            <b>Safe Sequence</b>.
                        </p>

                    </div>


                    <!-- UNSAFE STATE -->

                    <div class="os-team06-theory-block">

                        <h4>
                            Unsafe State
                        </h4>

                        <p>
                            A system is in an
                            <b>Unsafe State</b> when the current
                            resources cannot guarantee that all
                            processes can complete in any valid order.
                        </p>

                        <p>
                            The system therefore cannot guarantee
                            avoidance of deadlock.
                        </p>

                    </div>


                    <!-- CALCULATIONS -->

                    <div class="os-team06-theory-block">

                        <h4>
                            Important Calculations
                        </h4>

                        <div class="os-team06-formula-list">

                            <div>
                                <b>Need</b>
                                =
                                <b>Maximum − Allocation</b>
                            </div>

                            <div>
                                <b>Work</b>
                                =
                                <b>Available</b>
                            </div>

                            <div>
                                After completion:
                                <b>
                                    Work =
                                    Work + Allocation
                                </b>
                            </div>

                        </div>

                    </div>

                </div>


                <!-- SAFETY ALGORITHM -->

                <div class="os-team06-algorithm-section">

                    <h4>
                        1. Safety Algorithm
                    </h4>

                    <p>
                        The Safety Algorithm determines whether
                        the current resource allocation leaves the
                        system in a safe state.
                    </p>


                    <ol>

                        <li>
                            Initialize
                            <b>Work = Available</b>.
                        </li>

                        <li>
                            Set
                            <b>Finish[i] = false</b>
                            for every process.
                        </li>

                        <li>
                            Find an unfinished process
                            <b>Pi</b> such that:
                            <br>
                            <b>Need[i] &le; Work</b>
                        </li>

                        <li>
                            If such a process is found,
                            assume that it completes.
                        </li>

                        <li>
                            Release its allocated resources:
                            <br>
                            <b>
                                Work =
                                Work + Allocation[i]
                            </b>
                        </li>

                        <li>
                            Set
                            <b>Finish[i] = true</b>
                            and add the process to the
                            Safe Sequence.
                        </li>

                        <li>
                            Repeat the process until all processes
                            finish or no suitable process can be found.
                        </li>

                        <li>
                            If every process finishes,
                            the system is <b>SAFE</b>.
                            Otherwise, it is <b>UNSAFE</b>.
                        </li>

                    </ol>

                </div>


                <!-- RESOURCE REQUEST ALGORITHM -->

                <div class="os-team06-algorithm-section">

                    <h4>
                        2. Resource-Request Algorithm
                    </h4>

                    <p>
                        The Resource-Request Algorithm determines
                        whether a new resource request can be granted
                        without making the system unsafe.
                    </p>


                    <ol>

                        <li>
                            Let process <b>Pi</b> submit
                            <b>Request[i]</b>.
                        </li>

                        <li>
                            Check:
                            <br>
                            <b>
                                Request[i] &le; Need[i]
                            </b>
                            <br>
                            If false, reject the request.
                        </li>

                        <li>
                            Check:
                            <br>
                            <b>
                                Request[i] &le; Available
                            </b>
                            <br>
                            If false, the process must wait.
                        </li>

                        <li>
                            Temporarily allocate the requested resources:
                            <br><br>

                            <b>
                                Available =
                                Available − Request
                            </b>

                            <br>

                            <b>
                                Allocation =
                                Allocation + Request
                            </b>

                            <br>

                            <b>
                                Need =
                                Need − Request
                            </b>
                        </li>

                        <li>
                            Run the Safety Algorithm on the
                            temporary state.
                        </li>

                        <li>
                            If the temporary state is safe,
                            the request receives
                            <b>PASS</b> and the allocation is granted.
                        </li>

                        <li>
                            If the temporary state is unsafe,
                            the request receives
                            <b>FAIL</b> and the temporary allocation
                            is rolled back.
                        </li>

                    </ol>

                </div>


                <!-- KEY CONDITIONS -->

                <div class="os-team06-theory-note">

                    <b>Key Conditions:</b>

                    <br><br>

                    Request &le; Need

                    <br>

                    Request &le; Available

                    <br>

                    Tentative allocation must result in
                    a Safe State.

                </div>

            </div>

        `;
    }


    /* =========================================================
       AVAILABLE RESOURCES
       ========================================================= */

    function renderAvailable() {

        return `

            <div class="os-team06-available-card">

                <div class="os-team06-section-heading">

                    <div>

                        <h3>
                            Available Resources
                        </h3>

                        <p>
                            Resources currently available in
                            the system.
                        </p>

                    </div>

                </div>


                <div class="os-team06-resource-grid">

                    <label>

                        Resource A

                        <input
                            type="number"
                            min="0"
                            value="${available[0]}"
                            data-available="0"
                        >

                    </label>


                    <label>

                        Resource B

                        <input
                            type="number"
                            min="0"
                            value="${available[1]}"
                            data-available="1"
                        >

                    </label>


                    <label>

                        Resource C

                        <input
                            type="number"
                            min="0"
                            value="${available[2]}"
                            data-available="2"
                        >

                    </label>

                </div>

            </div>

        `;
    }


    /* =========================================================
       SAFETY ALGORITHM VISUALIZATION
       ========================================================= */

    function renderAnimationPanel() {

        let processes = "";

        allocation.forEach(function (_, i) {

            processes += `
                <div
                    class="os-team06-process-box"
                    data-animation-process="${i}"
                >
                    P${i}
                </div>
            `;

        });


        return `

            <div class="os-team06-animation-card">

                <div class="os-team06-section-heading">

                    <div>

                        <h3>
                            Safety Algorithm —
                            Step by Step
                        </h3>

                        <p>
                            Each step checks whether the selected
                            process can complete with the current
                            Work vector.
                        </p>

                    </div>


                    <div class="os-team06-animation-controls">

                        <button
                            class="os-team06-secondary-button"
                            id="os-team06-start-animation"
                        >
                            Start
                        </button>


                        <button
                            class="os-team06-secondary-button"
                            id="os-team06-next-step"
                        >
                            Next Step
                        </button>


                        <button
                            class="os-team06-reset-button"
                            id="os-team06-reset-animation"
                        >
                            Reset Steps
                        </button>

                    </div>

                </div>


                <div
                    class="os-team06-process-track"
                    id="os-team06-process-track"
                >

                    ${processes}

                </div>


                <div
                    class="os-team06-animation-message"
                    id="os-team06-animation-message"
                >
                    Press Start or Next Step to begin.
                </div>


                <div class="os-team06-work-panel">

                    <div>
                        <span>Work A</span>
                        <strong id="os-team06-work-a">-</strong>
                    </div>

                    <div>
                        <span>Work B</span>
                        <strong id="os-team06-work-b">-</strong>
                    </div>

                    <div>
                        <span>Work C</span>
                        <strong id="os-team06-work-c">-</strong>
                    </div>

                    <div>
                        <span>Safe Sequence</span>
                        <strong id="os-team06-sequence-text">
                            -
                        </strong>
                    </div>

                </div>

            </div>

        `;
    }


    /* =========================================================
       RESOURCE REQUEST PANEL
       ========================================================= */

    function renderRequestPanel() {

        let options = "";

        allocation.forEach(function (_, i) {

            options += `
                <option value="${i}">
                    P${i}
                </option>
            `;

        });


        return `

            <div class="os-team06-request-card">

                <div class="os-team06-section-heading">

                    <div>

                        <h3>
                            Resource-Request Algorithm
                        </h3>

                        <p>
                            Submit a resource request and test
                            whether it can safely be granted.
                        </p>

                    </div>

                </div>


                <div class="os-team06-request-grid">

                    <label>

                        Process

                        <select
                            id="os-team06-request-process"
                        >

                            ${options}

                        </select>

                    </label>


                    <label>

                        Request A

                        <input
                            id="os-team06-request-a"
                            type="number"
                            min="0"
                            value="0"
                        >

                    </label>


                    <label>

                        Request B

                        <input
                            id="os-team06-request-b"
                            type="number"
                            min="0"
                            value="0"
                        >

                    </label>


                    <label>

                        Request C

                        <input
                            id="os-team06-request-c"
                            type="number"
                            min="0"
                            value="0"
                        >

                    </label>

                </div>


                <button
                    class="os-team06-primary-button"
                    id="os-team06-submit-request"
                >
                    Submit Resource Request
                </button>


                <div
                    class="os-team06-request-result"
                    id="os-team06-request-result"
                >
                    No resource request submitted yet.
                </div>

            </div>

        `;
    }


    /* =========================================================
       MAIN RENDER
       ========================================================= */

    function render(container) {

        currentContainer = container;

        stopAnimation();


        const need = calculateNeed();


        container.innerHTML = `

            <div class="os-team06">


                <!-- HEADER -->

                <div class="os-team06-header">

                    <div>

                        <h2>
                            Deadlock Avoidance:Banker's Algorithm
                        </h2>

                        

                    </div>


                   

                </div>


                <!-- INTRODUCTION -->

                <div class="os-team06-introduction">

                    <h3>
                        What is Banker's Algorithm?
                    </h3>

                    <p>
                        Banker's Algorithm is a deadlock avoidance
                        algorithm used by Operating Systems.
                        Before allocating resources, it checks whether
                        the resulting system can remain in a safe state.
                    </p>

                </div>


                <!-- CONCEPTS -->

                <div class="os-team06-concepts">


                    <div>

                        <h4>
                            Allocation Matrix
                        </h4>

                        <p>
                            Shows the resources currently allocated
                            to each process.
                        </p>

                    </div>


                    <div>

                        <h4>
                            Maximum Matrix
                        </h4>

                        <p>
                            Shows the maximum resources each process
                            may require.
                        </p>

                    </div>


                    <div>

                        <h4>
                            Need Matrix
                        </h4>

                        <p>
                            Shows the remaining resources required
                            by each process.
                        </p>

                    </div>


                    <div>

                        <h4>
                            Safe State
                        </h4>

                        <p>
                            A state where at least one Safe Sequence
                            exists.
                        </p>

                    </div>


                    <div>

                        <h4>
                            Unsafe State
                        </h4>

                        <p>
                            A state where completion of all processes
                            cannot currently be guaranteed.
                        </p>

                    </div>


                    <div>

                        <h4>
                            Safe Sequence
                        </h4>

                        <p>
                            An order in which all processes can safely
                            complete.
                        </p>

                    </div>


                </div>


                <!-- STATE -->

                <div
                    id="os-team06-state-banner"
                    class="os-team06-state-banner neutral"
                >
                    System state has not been checked yet.
                </div>


                <!-- THEORY -->

                ${renderTheory()}


                <!-- DATA -->

                <div class="os-team06-section">


                    ${renderAvailable()}


                    ${renderMatrix(
                        "Allocation Matrix",
                        allocation,
                        true,
                        "allocation"
                    )}


                    ${renderMatrix(
                        "Maximum Matrix",
                        maximum,
                        true,
                        "maximum"
                    )}


                    ${renderMatrix(
                        "Need Matrix",
                        need,
                        false,
                        "need"
                    )}


                </div>


                <!-- SAFETY VISUALIZATION -->

                ${renderAnimationPanel()}


                <!-- RESOURCE REQUEST -->

                ${renderRequestPanel()}


            </div>

        `;


        attachEvents();

        updateStateBanner();

    }


    /* =========================================================
       EVENT HANDLERS
       ========================================================= */

    function attachEvents() {


        currentContainer
            .querySelectorAll("[data-matrix]")
            .forEach(function (input) {

                input.addEventListener(
                    "change",
                    function () {

                        const matrix =
                            this.dataset.matrix;

                        const row =
                            Number(this.dataset.row);

                        const col =
                            Number(this.dataset.col);

                        const value =
                            Math.max(
                                0,
                                Number(this.value)
                            );


                        this.value = value;


                        if (matrix === "allocation") {

                            allocation[row][col] =
                                value;

                        }


                        if (matrix === "maximum") {

                            maximum[row][col] =
                                value;

                        }


                        render(currentContainer);

                    }
                );

            });


        currentContainer
            .querySelectorAll("[data-available]")
            .forEach(function (input) {

                input.addEventListener(
                    "change",
                    function () {

                        const index =
                            Number(
                                this.dataset.available
                            );


                        available[index] =
                            Math.max(
                                0,
                                Number(this.value)
                            );


                        this.value =
                            available[index];


                        updateStateBanner();

                    }
                );

            });


        currentContainer
            .querySelector(
                "#os-team06-start-animation"
            )
            .addEventListener(
                "click",
                startAnimation
            );


        currentContainer
            .querySelector(
                "#os-team06-next-step"
            )
            .addEventListener(
                "click",
                nextAnimationStep
            );


        currentContainer
            .querySelector(
                "#os-team06-reset-animation"
            )
            .addEventListener(
                "click",
                resetAnimation
            );


        currentContainer
            .querySelector(
                "#os-team06-submit-request"
            )
            .addEventListener(
                "click",
                submitResourceRequest
            );

    }


    /* =========================================================
       STATE BANNER
       ========================================================= */

    function updateStateBanner() {

        if (!currentContainer) {
            return;
        }


        const result =
            getSafetyResult();


        lastSystemState =
            result.safe
                ? "Safe"
                : "Unsafe";


        const banner =
            currentContainer.querySelector(
                "#os-team06-state-banner"
            );


        if (result.safe) {

            banner.className =
                "os-team06-state-banner safe";

            banner.innerHTML =
                "✓ SYSTEM IS IN A SAFE STATE";

        } else {

            banner.className =
                "os-team06-state-banner unsafe";

            banner.innerHTML =
                "✗ SYSTEM IS IN AN UNSAFE STATE";

        }

    }


    /* =========================================================
       ANIMATION
       ========================================================= */

    function prepareAnimation() {

        const result =
            getSafetyResult();


        animation.steps =
            result.steps.slice();


        animation.currentStep = 0;


        updateAnimationUI();

    }


    function startAnimation() {

        stopAnimation();

        prepareAnimation();


        animation.timer =
            setInterval(
                function () {

                    if (
                        animation.currentStep >=
                        animation.steps.length
                    ) {

                        stopAnimation();

                        showAnimationComplete();

                        return;
                    }


                    performAnimationStep();

                },
                1000
            );
    }


    function nextAnimationStep() {

        stopAnimation();


        if (
            animation.steps.length === 0 ||
            animation.currentStep >=
            animation.steps.length
        ) {

            prepareAnimation();

        }


        performAnimationStep();

    }


    function performAnimationStep() {

        if (
            animation.currentStep >=
            animation.steps.length
        ) {

            showAnimationComplete();

            return;
        }


        const step =
            animation.steps[
                animation.currentStep
            ];


        const boxes =
            currentContainer.querySelectorAll(
                "[data-animation-process]"
            );


        boxes.forEach(function (box) {

            box.classList.remove(
                "checking",
                "completed",
                "failed"
            );

        });


        const currentBox =
            currentContainer.querySelector(
                '[data-animation-process="' +
                step.process +
                '"]'
            );


        if (currentBox) {

            currentBox.classList.add(
                "checking"
            );

        }


        const message =
            currentContainer.querySelector(
                "#os-team06-animation-message"
            );


        if (step.canFinish) {

            if (currentBox) {

                currentBox.classList.remove(
                    "checking"
                );

                currentBox.classList.add(
                    "completed"
                );

            }


            message.innerHTML =
                "Step " +
                (animation.currentStep + 1) +
                ": <b>P" +
                step.process +
                "</b> can finish because " +
                "Need [" +
                step.need.join(", ") +
                "] &le; Work [" +
                step.workBefore.join(", ") +
                "]. Resources are released.";

        } else {

            if (currentBox) {

                currentBox.classList.remove(
                    "checking"
                );

                currentBox.classList.add(
                    "failed"
                );

            }


            message.innerHTML =
                "Step " +
                (animation.currentStep + 1) +
                ": <b>P" +
                step.process +
                "</b> cannot finish because " +
                "Need [" +
                step.need.join(", ") +
                "] exceeds Work [" +
                step.workBefore.join(", ") +
                "].";

        }


        animation.currentStep++;


        updateAnimationUI();


        if (
            animation.currentStep >=
            animation.steps.length
        ) {

            setTimeout(
                showAnimationComplete,
                500
            );

        }

    }


    function updateAnimationUI() {

        if (!currentContainer) {
            return;
        }


        const result =
            getSafetyResult();


        let work =
            available.slice();


        let sequence = [];


        for (
            let i = 0;
            i < animation.currentStep &&
            i < result.steps.length;
            i++
        ) {

            const step =
                result.steps[i];


            if (step.canFinish) {

                work =
                    step.workAfter.slice();

                sequence.push(
                    step.process
                );

            }

        }


        currentContainer.querySelector(
            "#os-team06-work-a"
        ).textContent = work[0];


        currentContainer.querySelector(
            "#os-team06-work-b"
        ).textContent = work[1];


        currentContainer.querySelector(
            "#os-team06-work-c"
        ).textContent = work[2];


        currentContainer.querySelector(
            "#os-team06-sequence-text"
        ).textContent =
            sequence.length > 0
                ? sequence
                    .map(function (p) {
                        return "P" + p;
                    })
                    .join(" → ")
                : "-";

    }


    function showAnimationComplete() {

        if (!currentContainer) {
            return;
        }


        const result =
            getSafetyResult();


        const message =
            currentContainer.querySelector(
                "#os-team06-animation-message"
            );


        if (result.safe) {

            message.innerHTML =
                "<b>Safety check complete.</b> " +
                "Safe Sequence: " +
                result.sequence
                    .map(function (p) {
                        return "P" + p;
                    })
                    .join(" → ");

        } else {

            message.innerHTML =
                "<b>Safety check complete.</b> " +
                "No complete Safe Sequence exists.";

        }


        updateStateBanner();

        stopAnimation();

    }


    function stopAnimation() {

        if (animation.timer !== null) {

            clearInterval(
                animation.timer
            );

            animation.timer = null;

        }

    }


    function resetAnimation() {

        stopAnimation();


        animation = {
            steps: [],
            currentStep: 0,
            timer: null
        };


        if (!currentContainer) {
            return;
        }


        currentContainer
            .querySelectorAll(
                "[data-animation-process]"
            )
            .forEach(function (box) {

                box.classList.remove(
                    "checking",
                    "completed",
                    "failed"
                );

            });


        currentContainer.querySelector(
            "#os-team06-animation-message"
        ).textContent =
            "Press Start or Next Step to begin.";


        currentContainer.querySelector(
            "#os-team06-work-a"
        ).textContent = "-";


        currentContainer.querySelector(
            "#os-team06-work-b"
        ).textContent = "-";


        currentContainer.querySelector(
            "#os-team06-work-c"
        ).textContent = "-";


        currentContainer.querySelector(
            "#os-team06-sequence-text"
        ).textContent = "-";

    }


    /* =========================================================
       RESOURCE REQUEST ALGORITHM
       ========================================================= */

    function submitResourceRequest() {

        const process =
            Number(
                currentContainer.querySelector(
                    "#os-team06-request-process"
                ).value
            );


        const request = [

            Number(
                currentContainer.querySelector(
                    "#os-team06-request-a"
                ).value
            ),

            Number(
                currentContainer.querySelector(
                    "#os-team06-request-b"
                ).value
            ),

            Number(
                currentContainer.querySelector(
                    "#os-team06-request-c"
                ).value
            )

        ];


        const need =
            calculateNeed();


        /* CHECK FOR NEGATIVE VALUES */

        if (
            request.some(function (value) {
                return value < 0;
            })
        ) {

            showRequestResult(
                false,
                "FAIL",
                "Resource request cannot contain negative values."
            );

            return;
        }


        /* REQUEST <= NEED */

        for (let j = 0; j < 3; j++) {

            if (
                request[j] >
                need[process][j]
            ) {

                showRequestResult(
                    false,
                    "FAIL",
                    "P" +
                    process +
                    " requested more resources than its remaining Need."
                );

                return;
            }

        }


        /* REQUEST <= AVAILABLE */

        for (let j = 0; j < 3; j++) {

            if (
                request[j] >
                available[j]
            ) {

                showRequestResult(
                    false,
                    "FAIL",
                    "Requested resources exceed the currently Available resources."
                );

                return;
            }

        }


        /* TEMPORARY ALLOCATION */

        const tempAllocation =
            cloneMatrix(allocation);


        const tempAvailable =
            available.slice();


        for (let j = 0; j < 3; j++) {

            tempAllocation[process][j] +=
                request[j];

            tempAvailable[j] -=
                request[j];

        }


        /* RUN SAFETY ALGORITHM */

        const safety =
            getSafetyResult(
                tempAllocation,
                maximum,
                tempAvailable
            );


        /* PASS */

        if (safety.safe) {

            allocation =
                tempAllocation;

            available =
                tempAvailable;


            showRequestResult(
                true,
                "PASS",
                "Request granted. The resulting state is safe. " +
                "Safe Sequence: " +
                safety.sequence
                    .map(function (p) {
                        return "P" + p;
                    })
                    .join(" → ")
            );


            render(currentContainer);

        }


        /* FAIL */

        else {

            showRequestResult(
                false,
                "FAIL",
                "Request denied. The tentative allocation would " +
                "make the system unsafe. The allocation was rolled back."
            );

        }

    }


    function showRequestResult(
        passed,
        label,
        message
    ) {

        const box =
            currentContainer.querySelector(
                "#os-team06-request-result"
            );


        box.className =
            passed
                ? "os-team06-request-result pass"
                : "os-team06-request-result fail";


        box.innerHTML =

            "<strong>" +
            label +
            "</strong>" +

            "<span>" +
            escapeHTML(message) +
            "</span>";

    }


    /* =========================================================
       RESET
       ========================================================= */

    function reset() {

        resetData();


        if (currentContainer) {

            render(
                currentContainer
            );

        }

    }


    /* =========================================================
       METRICS
       REQUIRED BY TEAM 15
       ========================================================= */

    function getMetrics() {

        const result =
            getSafetyResult();


        lastSystemState =
            result.safe
                ? "Safe"
                : "Unsafe";


        return {

            primaryMetricLabel:
                "System State",

            primaryMetricValue:
                lastSystemState,

            unit:
                ""

        };

    }


    /* =========================================================
       INITIALIZE
       ========================================================= */

    resetData();


    /* =========================================================
       REQUIRED TEAM 6 MODULE INTERFACE
       ========================================================= */

    window.OSDashboard.modules[
        "team06_bankers"
    ] = {

        title:
            "Banker's Algorithm",

        render:
            function (container) {

                render(container);

            },

        reset:
            function () {

                reset();

            },

        getMetrics:
            function () {

                return getMetrics();

            }

    };


})();