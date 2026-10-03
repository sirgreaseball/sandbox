(function () {
"use strict";
window.OSDashboard = window.OSDashboard || { modules: {} };

const DEFAULT_MODE = "fixed";
const STEP_DELAY = 2200;

let state = {
    mode: DEFAULT_MODE,
    running: false,
    step: 0,
    mealsServed: 0,
    philosophers: [],
    forks: [],
    events: [],
    currentExplanation: "Click Start or Next Step to begin the simulation.",
    interval: null,
    container: null,

    lastTurn: 0 // Priority rotation to prevent starvation
};

function initialize() {
    state.philosophers = [];
    for (let i = 0; i < 5; i++) {
        state.philosophers.push({
            id: i,
            name: "Philosopher " + (i + 1),
            status: "Thinking",
            meals: 0,
            eatTime: 0
        });
    }

    state.forks = [];
    for (let i = 0; i < 5; i++) {
        state.forks.push({
            id: i,
            owner: null
        });
    }

    state.events = [];
    state.step = 0;
    state.mealsServed = 0;
    state.lastTurn = 0;

    state.currentExplanation =
        "All five philosophers start in the Thinking state.";
}

initialize();

/* Correct physical table mappings */
function leftFork(p) {
    // P1 (0) -> F5 (4), P2 (1) -> F1 (0), P3 (2) -> F2 (1), etc.
    return (p - 1 + 5) % 5;
}

function rightFork(p) {
    // P1 (0) -> F1 (0), P2 (1) -> F2 (1), P3 (2) -> F3 (2), etc.
    return p;
}

function canEatFixed(p) {
    const first = Math.min(leftFork(p), rightFork(p));
    const second = Math.max(leftFork(p), rightFork(p));

    return (
        state.forks[first].owner === null &&
        state.forks[second].owner === null
    );
}

function canEatNaive(p) {
    return (
        state.forks[leftFork(p)].owner === null &&
        state.forks[rightFork(p)].owner === null
    );
}

function addEvent(message) {
    const time = new Date().toLocaleTimeString();

    state.events.unshift({
        time: time,
        message: message
    });

    if (state.events.length > 10) {
        state.events.pop();
    }
}

function acquireForks(p) {
    let first;
    let second;

    if (state.mode === "fixed") {
        first = Math.min(leftFork(p), rightFork(p));
        second = Math.max(leftFork(p), rightFork(p));
    } else {
        first = leftFork(p);
        second = rightFork(p);
    }

    if (state.forks[first].owner === null && state.forks[second].owner === null) {
        state.forks[first].owner = p;
        state.forks[second].owner = p;

        state.philosophers[p].status = "Eating";
        state.philosophers[p].eatTime = 0;

        addEvent(
            "P" + (p + 1) + " acquired F" + (first + 1) + " and F" + (second + 1) + " → Eating"
        );

        state.currentExplanation =
            "Both forks available. Philosopher " +
            (p + 1) +
            " acquired F" +
            (first + 1) +
            " first, then F" +
            (second + 1) +
            " and is now Eating.";

        return true;
    }

    return false;
}

function releaseForks(p) {
    state.forks.forEach(function (fork) {
        if (fork.owner === p) {
            fork.owner = null;
        }
    });

    state.philosophers[p].meals++;
    state.mealsServed++;
    state.philosophers[p].status = "Thinking";
    state.lastTurn = (p + 1) % 5; // Rotate turn priority so everyone gets meals

    addEvent(
        "P" + (p + 1) + " finished eating → forks released → Thinking"
    );

    state.currentExplanation =
        "Philosopher " +
        (p + 1) +
        " finished eating, released both forks, and returned to Thinking.";
}

function naiveDeadlockDemo() {
    for (let i = 0; i < 5; i++) {
        // In naive, everyone holds their left fork
        const lf = leftFork(i);
        state.forks[lf].owner = i;
        state.philosophers[i].status = "Hungry";
    }

    state.currentExplanation =
        "DEADLOCK DETECTED: Every philosopher holds one fork and waits indefinitely for the second fork.";

    addEvent(
        "DEADLOCK! All philosophers hold their left fork and wait for their right fork."
    );
}

function performStep() {
    state.step++;

    /* NAIVE DEADLOCK SIMULATION */
    if (state.mode === "naive" && state.step === 4) {
        naiveDeadlockDemo();
        render();
        return;
    }

    if (state.mode === "naive" && state.step > 4) {
        state.currentExplanation =
            "The system is deadlocked because of Circular Wait. No philosopher can obtain two forks.";

        addEvent(
            "System blocked: circular wait continues."
        );
        render();
        return;
    }

    /* 1. Finish eating philosophers */
    for (let i = 0; i < 5; i++) {
        const p = state.philosophers[i];
        if (p.status === "Eating") {
            p.eatTime++;
            if (p.eatTime >= 2) {
                releaseForks(i);
            }
        }
    }

    /* 2. Transition a thinking philosopher to hungry using round-robin order */
    for (let count = 0; count < 5; count++) {
        const idx = (state.lastTurn + count) % 5;
        const p = state.philosophers[idx];
        if (p.status === "Thinking") {
            p.status = "Hungry";
            addEvent(p.name + " becomes Hungry and requests adjacent forks.");
            state.currentExplanation =
                p.name + " is Hungry and is waiting for both required forks.";
            break;
        }
    }

    /* 3. Try to satisfy hungry philosophers */
    for (let count = 0; count < 5; count++) {
        const idx = (state.lastTurn + count) % 5;
        const p = state.philosophers[idx];

        if (p.status === "Hungry") {
            const possible =
                state.mode === "fixed"
                    ? canEatFixed(p.id)
                    : canEatNaive(p.id);

            if (possible) {
                acquireForks(p.id);
                break;
            }
        }
    }

    render();
}

function startSimulation() {
    if (state.running) return;

    state.running = true;
    addEvent("Simulation started.");

    state.interval = setInterval(
        performStep,
        STEP_DELAY
    );

    render();
}

function pauseSimulation() {
    state.running = false;

    if (state.interval) {
        clearInterval(state.interval);
        state.interval = null;
    }

    addEvent("Simulation paused.");
    render();
}

function resetSimulation() {
    pauseSimulation();
    state.mode = DEFAULT_MODE;

    initialize();
    render();
}

function changeMode(mode) {
    pauseSimulation();
    state.mode = mode;
    initialize();

    state.currentExplanation =
        mode === "fixed"
            ? "Fixed solution selected. Resource Hierarchy will prevent circular wait."
            : "Naive solution selected. Deadlock can occur when every philosopher holds one fork.";

    addEvent(
        mode === "fixed"
            ? "Fixed Resource Hierarchy selected."
            : "Naive deadlock-prone solution selected."
    );

    render();
}

function getStatusClass(status) {
    if (status === "Eating") return "eating";
    if (status === "Hungry") return "hungry";
    return "thinking";
}

function renderTable() {
    let philosophersHTML = "";

    for (let i = 0; i < 5; i++) {
        const angle = (i * 72 - 90) * Math.PI / 180;
        const x = 50 + Math.cos(angle) * 36;
        const y = 50 + Math.sin(angle) * 38;
        const p = state.philosophers[i];

        philosophersHTML += `
            <div class="os-team09-philosopher-position" style="left:${x}%;top:${y}%;">
                <div class="os-team09-philosopher-card ${getStatusClass(p.status)}">
                    <div class="os-team09-p-icon">P${i + 1}</div>
                    <strong>P${i + 1}</strong>
                    <span>${p.status}</span>
                    <small>Meals: ${p.meals}</small>
                </div>
            </div>
        `;
    }

    let forksHTML = "";

    for (let i = 0; i < 5; i++) {
        // Fork i sits between Philosopher i and Philosopher (i+1)%5
        const angle = (i * 72 - 54) * Math.PI / 180;
        const x = 50 + Math.cos(angle) * 20;
        const y = 50 + Math.sin(angle) * 23;

        const owner =
            state.forks[i].owner === null
                ? "Free"
                : "P" + (state.forks[i].owner + 1);

        forksHTML += `
            <div class="os-team09-fork" style="left:${x}%;top:${y}%;">
                <b>F${i + 1}</b>
                <small>${owner}</small>
            </div>
        `;
    }

    return `
        <div class="os-team09-table-area">
            <div class="os-team09-table">
                <div class="os-team09-table-center">
                    <strong>DINING</strong>
                    <strong>TABLE</strong>
                    <span>5 Philosophers</span>
                    <span>5 Forks</span>
                </div>
                ${forksHTML}
                ${philosophersHTML}
            </div>
        </div>
    `;
}

function renderWorkingProcess() {
    return `
        <div class="os-team09-working-card">
            <div class="os-team09-working-header">
                <h3>Working Process</h3>
                <span class="os-team09-live">● LIVE</span>
            </div>

            <div class="os-team09-current-step">
                <div class="os-team09-step-number">${state.step}</div>
                <div>
                    <strong>Current Step</strong>
                    <p>${state.currentExplanation}</p>
                </div>
            </div>

            <div class="os-team09-event-list">
                ${
                    state.events.length === 0
                        ? `<div class="os-team09-empty">Click <b>Start</b> or <b>Next Step</b> to view execution.</div>`
                        : state.events.map(function (event) {
                            return `
                                <div class="os-team09-event">
                                    <span>${event.time}</span>
                                    <p>${event.message}</p>
                                </div>
                            `;
                        }).join("")
                }
            </div>
        </div>
    `;
}

function render() {
    if (!state.container) return;
    state.container.innerHTML = `
        <div class="os-team09">
            <header class="os-team09-header">
                <div>
                    <h1>Dining Philosophers Problem</h1>
                    <p>Process Synchronization • Deadlock Avoidance</p>
                </div>

                <div class="os-team09-mode">
                    <label>Algorithm</label>
                    <select class="os-team09-mode-select">
                        <option value="fixed" ${state.mode === "fixed" ? "selected" : ""}>
                            Fixed — Resource Hierarchy
                        </option>
                        <option value="naive" ${state.mode === "naive" ? "selected" : ""}>
                            Naive — Deadlock Prone
                        </option>
                    </select>
                </div>
            </header>

            <div class="os-team09-top-buttons">
                <button class="os-team09-primary os-team09-start">▶ Start</button>
                <button class="os-team09-secondary os-team09-pause">⏸ Pause</button>
                <button class="os-team09-secondary os-team09-step">⏭ Next Step</button>
                <button class="os-team09-secondary os-team09-reset">↻ Reset</button>
            </div>

            <div class="os-team09-metrics">
                <div>
                    <span>Meals Served</span>
                    <strong>${state.mealsServed}</strong>
                </div>
                <div>
                    <span>Current Step</span>
                    <strong>${state.step}</strong>
                </div>
                <div>
                    <span>Algorithm</span>
                    <strong>${state.mode === "fixed" ? "FIXED" : "NAIVE"}</strong>
                </div>
                <div>
                    <span>Status</span>
                    <strong>${state.running ? "RUNNING" : "PAUSED"}</strong>
                </div>
            </div>

            <div class="os-team09-main">
                <section class="os-team09-left">
                    <div class="os-team09-section-heading">
                        <div>
                            <h2>Live Dining Table</h2>
                            <p>Observe philosopher states and fork usage</p>
                        </div>
                        <div class="os-team09-legend">
                            <span><i class="thinking"></i> Thinking</span>
                            <span><i class="hungry"></i> Hungry</span>
                            <span><i class="eating"></i> Eating</span>
                        </div>
                    </div>

                    ${renderTable()}

                    <div class="os-team09-description">
                        <h2>Problem Description</h2>
                        <p>Five philosophers sit around a circular table with one fork between every pair of philosophers. To eat, each philosopher needs both adjacent forks. The operating system must coordinate access to prevent deadlock.</p>
                    </div>
                </section>

                <aside class="os-team09-right">
                    ${renderWorkingProcess()}

                    <div class="os-team09-algorithm-card">
                        <h2>Current Algorithm</h2>
                        ${
                            state.mode === "fixed"
                                ? `<div class="os-team09-good">
                                        <strong>✓ Resource Hierarchy</strong>
                                        <p>Always acquire the lower-numbered fork first, then the higher-numbered fork. Prevents circular wait.</p>
                                   </div>`
                                : `<div class="os-team09-warning">
                                        <strong>⚠ Naive Solution</strong>
                                        <p>Each philosopher grabs their left fork first. Prone to circular wait and total deadlock.</p>
                                   </div>`
                        }
                    </div>
                </aside>
            </div>
        </div>
    `;

    state.container.querySelector(".os-team09-start").addEventListener("click", startSimulation);
    state.container.querySelector(".os-team09-pause").addEventListener("click", pauseSimulation);
    state.container.querySelector(".os-team09-step").addEventListener("click", function () {
        if (state.running) pauseSimulation();
        performStep();
    });
    state.container.querySelector(".os-team09-reset").addEventListener("click", resetSimulation);
    state.container.querySelector(".os-team09-mode-select").addEventListener("change", function () {
        changeMode(this.value);
    });
}

window.OSDashboard.modules["team09_dining_phil"] = {
    title: "Dining Philosophers Problem",
    render: function (container) {
        state.container = container;
        render();
    },
    reset: function () {
        resetSimulation();
    },
    getMetrics: function () {
        return {
            primaryMetricLabel: "Meals Served",
            primaryMetricValue: Number(state.mealsServed),
            unit: ""
        };
    }
};
})();
