window.OSDashboard = window.OSDashboard || { modules: {} };

window.OSDashboard.modules["team08_readers_writers"] = (function() {
    let state = null;
    let containerElement = null;

    function defaultState() {
        return {
            activeReadersList: [],
            activeWriter: null,
            waitingReaders: [],
            waitingWriters: [],
            eventLog: [],
            nextReaderId: 1,
            nextWriterId: 1,
            timeouts: []
        };
    }

    // Initialize state immediately so getMetrics works before render is called
    state = defaultState();

    function logEvent(msg) {
        state.eventLog.unshift(msg); 
        // Keep only the 6 most recent events so we don't need a scrollbar
        if (state.eventLog.length > 6) state.eventLog.pop();
        updateUI();
    }
    
    function setSafeTimeout(callback, delay) {
        const id = setTimeout(() => {
            state.timeouts = state.timeouts.filter(t => t !== id);
            callback();
        }, delay);
        state.timeouts.push(id);
    }

    function clearAllTimeouts() {
        if (state && state.timeouts) {
            state.timeouts.forEach(clearTimeout);
            state.timeouts = [];
        }
    }

    function readerArrives() {
        const rId = `R${state.nextReaderId++}`;
        logEvent(`Reader ${rId} arrived`);
        
        // If writer is active, readers must wait
        if (state.activeWriter !== null) {
            state.waitingReaders.push(rId);
            logEvent(`Reader ${rId} waiting`);
        } else {
            // First readers-writers solution: Readers do not wait if a writer is only waiting
            enterReader(rId);
        }
        updateUI();
    }

    function enterReader(rId) {
        state.activeReadersList.push(rId);
        logEvent(`Reader ${rId} entered shared resource`);
        
        setSafeTimeout(() => {
            leaveReader(rId);
        }, 3000 + Math.random() * 2000); // Leaves after 3-5s
    }

    function leaveReader(rId) {
        state.activeReadersList = state.activeReadersList.filter(id => id !== rId);
        logEvent(`Reader ${rId} left`);
        
        // If no more readers, check if writers are waiting
        if (state.activeReadersList.length === 0) {
            if (state.waitingWriters.length > 0) {
                const wId = state.waitingWriters.shift();
                enterWriter(wId);
            }
        }
        updateUI();
    }

    function writerArrives() {
        const wId = `W${state.nextWriterId++}`;
        logEvent(`Writer ${wId} arrived`);
        
        // Writer must wait if there are active readers OR an active writer
        if (state.activeReadersList.length > 0 || state.activeWriter !== null) {
            state.waitingWriters.push(wId);
            logEvent(`Writer ${wId} waiting`);
        } else {
            enterWriter(wId);
        }
        updateUI();
    }

    function enterWriter(wId) {
        state.activeWriter = wId;
        logEvent(`Writer ${wId} entered shared resource`);
        
        setSafeTimeout(() => {
            leaveWriter(wId);
        }, 4000); // Leaves after 4s
    }

    function leaveWriter(wId) {
        state.activeWriter = null;
        logEvent(`Writer ${wId} left`);
        
        // Reader preference: wake up all waiting readers first
        if (state.waitingReaders.length > 0) {
            const readersToEnter = [...state.waitingReaders];
            state.waitingReaders = [];
            readersToEnter.forEach(r => enterReader(r));
        } else if (state.waitingWriters.length > 0) {
            // If no readers are waiting, wake up the next waiting writer
            const nextWId = state.waitingWriters.shift();
            enterWriter(nextWId);
        }
        updateUI();
    }
    
    function clearLog() {
        state.eventLog = [];
        updateUI();
    }

    function updateUI() {
        if (!containerElement) return;
        
        const activeReadersEl = containerElement.querySelector('.os-team08-active-readers-count');
        if (activeReadersEl) {
            activeReadersEl.textContent = state.activeReadersList.length.toString().padStart(2, '0');
        }
        
        const lockStateEl = containerElement.querySelector('.os-team08-lock-state');
        if (lockStateEl) {
            const isLocked = state.activeWriter !== null;
            lockStateEl.textContent = isLocked ? "LOCKED" : "UNLOCKED";
            if (isLocked) {
                lockStateEl.classList.add('locked');
                lockStateEl.classList.remove('unlocked');
            } else {
                lockStateEl.classList.add('unlocked');
                lockStateEl.classList.remove('locked');
            }
        }
        
        const sharedResourceEl = containerElement.querySelector('.os-team08-shared-resource');
        if (sharedResourceEl) {
            sharedResourceEl.innerHTML = '';
            if (state.activeWriter !== null) {
                sharedResourceEl.innerHTML = `<div class="os-team08-process writer-process">[ ${state.activeWriter} ]</div>`;
            } else {
                state.activeReadersList.forEach(rId => {
                    sharedResourceEl.innerHTML += `<div class="os-team08-process reader-process">[ ${rId} ]</div>`;
                });
            }
        }
        
        const waitingReadersEl = containerElement.querySelector('.os-team08-waiting-readers');
        if (waitingReadersEl) {
            waitingReadersEl.innerHTML = state.waitingReaders.map(rId => 
                `<div class="os-team08-process reader-process waiting" title="Reason: Writer currently has exclusive access">[ ${rId} ]</div>`
            ).join('');
        }

        const waitingWritersEl = containerElement.querySelector('.os-team08-waiting-writers');
        if (waitingWritersEl) {
            waitingWritersEl.innerHTML = state.waitingWriters.map(wId => {
                const reason = state.activeWriter !== null ? "Writer currently has exclusive access" : "Readers currently active";
                return `<div class="os-team08-process writer-process waiting" title="Reason: ${reason}">[ ${wId} ]</div>`;
            }).join('');
        }

        const logEl = containerElement.querySelector('.os-team08-timeline-log');
        if (logEl) {
            logEl.innerHTML = state.eventLog.map(msg => `<li>&bull; ${msg}</li>`).join('');
        }
    }

    return {
        title: "Readers-Writers Problem",

        render: function(container) {
            containerElement = container;
            container.innerHTML = `
                <div class="os-team08">
                    <div class="os-team08-dashboard">
                        <div class="os-team08-header">
                            <h2>Readers-Writers Problem</h2>
                            <p>Process Synchronization</p>
                        </div>

                        <div class="os-team08-theory">
                            <h3>What is this?</h3>
                            <p>Imagine a shared notebook in a library. Multiple students (<strong>Readers</strong>) can read it at the exact same time without any issues. However, if someone wants to write in it (<strong>Writer</strong>), they need exclusive access so nobody reads half-written sentences and nobody else scribbles over their work.</p>
                            
                            <h3>Real-World Applications</h3>
                            <p>You interact with this every day to prevent data corruption! Examples include:</p>
                            <ul>
                                <li><strong>Airline Booking:</strong> Thousands can view available seats (Readers), but when you click "Buy" (Writer), the system briefly locks the database to prevent double-booking.</li>
                                <li><strong>E-Commerce Inventory:</strong> Millions browse a product page (Readers), but updating the stock count (Writer) requires exclusive access.</li>
                            </ul>

                            <h3>How this algorithm works (Readers-Preference):</h3>
                            <ul>
                                <li>Multiple readers can access the shared resource together.</li>
                                <li>A writer must wait if anyone else is currently reading or writing.</li>
                                <li><strong>The Catch:</strong> If a writer is waiting in line, new readers get to skip the line and join the current readers! The writer only gets a turn when the resource is completely empty.</li>
                            </ul>
                        </div>
                        
                        <div class="os-team08-stats-row">
                            <div class="os-team08-stat-card">
                                <h3>ACTIVE READERS</h3>
                                <div class="os-team08-active-readers-count">00</div>
                            </div>
                            <div class="os-team08-stat-card">
                                <h3>WRITER LOCK</h3>
                                <div class="os-team08-lock-state unlocked">UNLOCKED</div>
                            </div>
                        </div>

                        <div class="os-team08-main-area">
                            <div class="os-team08-resource-panel">
                                <h3>SHARED RESOURCE</h3>
                                <div class="os-team08-shared-resource os-team08-process-container">
                                </div>
                            </div>
                            
                            <div class="os-team08-queues-panel">
                                <div class="os-team08-queue">
                                    <h4>WAITING READERS</h4>
                                    <div class="os-team08-waiting-readers os-team08-process-container"></div>
                                </div>
                                <div class="os-team08-queue">
                                    <h4>WAITING WRITERS</h4>
                                    <div class="os-team08-waiting-writers os-team08-process-container"></div>
                                </div>
                            </div>
                        </div>

                        <div class="os-team08-controls">
                            <button class="os-team08-btn reader-btn" id="os-team08-btn-reader">Reader Arrives</button>
                            <button class="os-team08-btn writer-btn" id="os-team08-btn-writer">Writer Arrives</button>
                            <button class="os-team08-btn clear-btn" id="os-team08-btn-clear">Clear Log</button>
                        </div>

                        <div class="os-team08-timeline-panel">
                            <h3>ACCESS TIMELINE</h3>
                            <ul class="os-team08-timeline-log"></ul>
                        </div>
                    </div>
                </div>
            `;

            // Setup event listeners safely. Repeated renders clear previous innerHTML listeners.
            const readerBtn = container.querySelector('#os-team08-btn-reader');
            const writerBtn = container.querySelector('#os-team08-btn-writer');
            const clearBtn = container.querySelector('#os-team08-btn-clear');

            if (readerBtn) readerBtn.addEventListener('click', readerArrives);
            if (writerBtn) writerBtn.addEventListener('click', writerArrives);
            if (clearBtn) clearBtn.addEventListener('click', clearLog);

            updateUI();
        },

        reset: function() {
            clearAllTimeouts();
            state = defaultState();
            updateUI();
        },

        getMetrics: function() {
            return {
                primaryMetricLabel: "Active Readers",
                primaryMetricValue: state.activeReadersList.length,
                unit: ""
            };
        }
    };
})();
