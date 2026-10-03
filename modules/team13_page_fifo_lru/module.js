
(() => {
    window.OSDashboard = window.OSDashboard || {};
    window.OSDashboard.modules = window.OSDashboard.modules || {};

    window.OSDashboard.modules["team13_page_fifo_lru"] = (() => {
        const DEFAULT_REFERENCE = [7, 0, 1, 2, 0, 3, 0, 4, 2, 3];
        const DEFAULT_FRAMES = 3;
        const DEFAULT_ALGORITHM = "FIFO";

        let root = null;
        let referenceString = [...DEFAULT_REFERENCE];
        let frameCount = DEFAULT_FRAMES;
        let algorithm = DEFAULT_ALGORITHM;
        let history = [];
        let currentStep = 0;
        let autoPlayTimer = null;

        function escapeHTML(value) {
            return String(value)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        function parseReference(value) {
            const parts = String(value).trim().split(/[\s,]+/).filter(Boolean);
            if (!parts.length) throw new Error("Enter at least one page number.");
            const nums = parts.map(Number);
            if (nums.some(n => !Number.isInteger(n) || n < 0)) {
                throw new Error("Use non-negative whole numbers only.");
            }
            return nums;
        }

        function simulateFIFO(refs, frames) {
            const memory = [];
            let pointer = 0;
            const result = [];

            refs.forEach((page, index) => {
                const before = [...memory];
                const hit = memory.includes(page);

                if (!hit) {
                    if (memory.length < frames) {
                        memory.push(page);
                    } else {
                        memory[pointer] = page;
                        pointer = (pointer + 1) % frames;
                    }
                }

                result.push({
                    index,
                    page,
                    before,
                    after: [...memory],
                    hit,
                    event: hit ? "HIT" : "FAULT",
                    pointer
                });
            });

            return result;
        }

        function simulateLRU(refs, frames) {
            const memory = [];
            const lastUsed = new Map();
            const result = [];

            refs.forEach((page, index) => {
                const before = [...memory];
                const hit = memory.includes(page);

                if (hit) {
                    lastUsed.set(page, index);
                } else {
                    if (memory.length < frames) {
                        memory.push(page);
                    } else {
                        let victim = memory[0];
                        let oldest = lastUsed.get(victim) ?? -1;

                        memory.forEach(candidate => {
                            const usedAt = lastUsed.get(candidate) ?? -1;
                            if (usedAt < oldest) {
                                oldest = usedAt;
                                victim = candidate;
                            }
                        });

                        memory[memory.indexOf(victim)] = page;
                        lastUsed.delete(victim);
                    }
                    lastUsed.set(page, index);
                }

                result.push({
                    index,
                    page,
                    before,
                    after: [...memory],
                    hit,
                    event: hit ? "HIT" : "FAULT"
                });
            });

            return result;
        }

        function buildHistory() {
            history = algorithm === "FIFO"
                ? simulateFIFO(referenceString, frameCount)
                : simulateLRU(referenceString, frameCount);
            currentStep = 0;
        }

        function countFaults(untilStep = currentStep) {
            return history.slice(0, untilStep).filter(x => !x.hit).length;
        }

        function countHits(untilStep = currentStep) {
            return history.slice(0, untilStep).filter(x => x.hit).length;
        }

        function stopAutoPlay() {
            if (autoPlayTimer) {
                clearInterval(autoPlayTimer);
                autoPlayTimer = null;
            }
        }

        function render(container) {
            stopAutoPlay();
            root = container;
            root.innerHTML = `
                <section class="os-team13">
                    <div class="pr-hero">
                        <div>
                            <h1>Page Replacement Algorithm - FIFO &amp; LRU</h1>
                        </div>
                    </div>

                    <div class="learning-section">
                        <div class="learning-header">
                            <h2>Theory</h2>
                        </div>

                        <div class="definition-card">
                            <div class="note-number">01</div>
                            <div>
                                <h3>What is Page Replacement?</h3>
                                <p>
                                    <b>Page replacement</b> is a fundamental memory-management mechanism in modern operating systems supporting <b>virtual memory</b> and <b>demand paging</b>. Virtual memory enables systems to execute processes whose total address space exceeds available physical RAM by loading pages into memory frames only when demanded by the CPU.
                                </p>
                                <p style="margin-top: 8px;">
                                    When the CPU requests a page that is not currently in memory, a <b>Page Fault</b> occurs. If free memory frames are available, the OS simply reads the page from disk into an empty frame. However, when <b>all memory frames are occupied (memory over-allocation)</b>, the OS must perform <b>Page Replacement</b>: it executes a replacement algorithm (such as FIFO or LRU) to choose an existing resident page (called the <b>victim page</b>), evicts it to backing store (disk), and allocates that freed frame to the newly requested page.
                                </p>

                                <div class="def-subheading">Step-by-Step Page Replacement Lifecycle</div>
                                <ol class="manual-steps">
                                    <li><b>Page Fault Trigger:</b> CPU accesses a logical page whose Page Table entry is marked <i>Invalid (0)</i>.</li>
                                    <li><b>Frame Allocation Check:</b> The OS checks physical memory for an available free frame.</li>
                                    <li><b>Victim Selection:</b> When no free frames remain, a <b>Page Replacement Algorithm</b> selects which resident page to evict.</li>
                                    <li><b>Write-Back (Dirty Check):</b> If the victim page was modified while in RAM (<i>Dirty/Modify Bit = 1</i>), it is written back to swap disk; unmodified pages are discarded with zero disk write overhead.</li>
                                    <li><b>Swap In Demanded Page:</b> The requested page is read from disk into the freed frame.</li>
                                    <li><b>Update Page Table &amp; Restart:</b> The victim's entry is marked <i>Invalid (0)</i>, the new page is marked <i>Valid (1)</i> with its new frame number, and the faulting instruction restarts.</li>
                                </ol>

                                <div class="def-subheading">Key Concepts &amp; Hardware Support</div>
                                <div class="terms-grid">
                                    <div class="term-box">
                                        <b style="color: var(--blue);">Victim Page</b>
                                        <p>The resident page chosen by the replacement algorithm (arrival order in FIFO, usage recency in LRU) to be evicted from physical memory.</p>
                                    </div>
                                    <div class="term-box">
                                        <b style="color: var(--teal);">Dirty / Modify Bit</b>
                                        <p>Hardware bit set by the MMU on writes. Clean pages require no disk write during eviction, reducing page-fault service time by half.</p>
                                    </div>
                                    <div class="term-box">
                                        <b style="color: var(--orange);">Thrashing Prevention</b>
                                        <p>The primary goal is minimizing page faults. If replacement frequency is too high, the system spends all its time paging rather than executing code.</p>
                                    </div>
                                </div>

                                <div class="real-life">
                                    <b>Real-life Analogy:</b> Imagine a study desk with space for only <b>3 open books</b> (physical frames), while you need to reference <b>10 books</b> from the library (virtual pages). When you need a 4th book and the desk is full, you must close one book, return it to the shelf (swap out), and open the new book on the desk (swap in). An effective page replacement strategy ensures the book you put away is the one you won't need anytime soon.
                                </div>
                            </div>
                        </div>

                        <div class="two-column-notes">
                            <article class="algorithm-note hit-note">
                                <div class="note-title">
                                    <span class="algo-icon">H</span>
                                    <div>
                                        <h3>Page Hit</h3>
                                        <span>Page is already resident in physical memory (RAM)</span>
                                    </div>
                                </div>

                                <h4>Definition</h4>
                                <p>
                                    A <b>Page Hit</b> occurs when the CPU references a memory address whose page
                                    is already loaded into one of the physical frames in RAM. The Memory Management Unit
                                    (MMU) maps the virtual address directly to physical memory, enabling execution
                                    in nanoseconds with <b>zero disk transfer</b> and no OS intervention.
                                </p>

                                <h4>How the MMU handles a Page Hit</h4>
                                <ol class="manual-steps">
                                    <li>The CPU generates a logical/virtual address (Page Number + Offset).</li>
                                    <li>The MMU looks up the Page Table (or Translation Lookaside Buffer / TLB).</li>
                                    <li>The valid-invalid bit for that page entry is verified as <b>Valid (1)</b>.</li>
                                    <li>The physical frame number is extracted immediately without any traps.</li>
                                    <li>The CPU reads or writes data at hardware bus speed (~50–100 ns).</li>
                                </ol>

                                <div class="formula-box hit-formula">
                                    <b>Hit Ratio Formula:</b>
                                    <br>
                                    <code>Hit Ratio = (Total Hits / Total References) × 100%</code>
                                    <p style="margin: 6px 0 0; color: #52637a; font-size: 10px;">
                                        A higher hit ratio maximizes throughput and eliminates costly disk paging delays.
                                    </p>
                                </div>
                            </article>

                            <article class="algorithm-note fault-note">
                                <div class="note-title">
                                    <span class="algo-icon">F</span>
                                    <div>
                                        <h3>Page Fault (Page Miss)</h3>
                                        <span>Page is absent from RAM and must be fetched from disk</span>
                                    </div>
                                </div>

                                <h4>Definition</h4>
                                <p>
                                    A <b>Page Fault</b> occurs when the CPU references a page that is <b>not currently present</b>
                                    in physical RAM. The MMU discovers the page entry is marked invalid and generates a hardware
                                    trap (interrupt) to the Operating System, requiring disk I/O to fetch the page into memory.
                                </p>

                                <h4>Step-by-Step Page Fault Handling</h4>
                                <ol class="manual-steps">
                                    <li>The MMU inspects the page table entry and detects the bit is <b>Invalid (0)</b>.</li>
                                    <li>A hardware trap triggers a page fault interrupt to the OS kernel.</li>
                                    <li>The OS verifies the access and locates the page on backing store (disk/swap).</li>
                                    <li>The OS finds an empty frame; if all frames are full, a <b>Page Replacement Algorithm</b> (FIFO or LRU) picks a victim page to evict.</li>
                                    <li>The OS executes disk I/O to load the missing page into the designated frame.</li>
                                    <li>The page table entry is updated with the new frame number and set to <b>Valid (1)</b>.</li>
                                    <li>The interrupted process instruction restarts seamlessly.</li>
                                </ol>

                                <div class="formula-box fault-formula">
                                    <b>Fault Ratio Formula:</b>
                                    <br>
                                    <code>Fault Ratio = (Total Faults / Total References) × 100%</code>
                                    <p style="margin: 6px 0 0; color: #52637a; font-size: 10px;">
                                        Disk access takes ~5–10 milliseconds (~100,000× slower than RAM). Reducing page faults is the primary goal of replacement algorithms.
                                    </p>
                                </div>
                            </article>
                        </div>

                        <div class="two-column-notes">
                            <article class="algorithm-note fifo-note">
                                <div class="note-title">
                                    <span class="algo-icon">F</span>
                                    <div>
                                        <h3>FIFO — First In First Out</h3>
                                        <span>Replace the page that entered memory first.</span>
                                    </div>
                                </div>

                                <h4>Definition</h4>
                                <p>
                                    FIFO removes the page that has been in memory for the longest time.
                                    It follows the same basic idea as a queue: <b>the first page in is the
                                    first page out.</b>
                                </p>

                                <h4>How to solve FIFO in a book</h4>
                                <ol class="manual-steps">
                                    <li>Draw the required number of frame rows.</li>
                                    <li>Read the reference string from left to right, one page at a time.</li>
                                    <li>If the page is already in a frame, write <b>H</b> (Hit). Do not change the frames.</li>
                                    <li>If the page is not in memory, write <b>F</b> (Fault).</li>
                                    <li>If an empty frame exists, place the page there.</li>
                                    <li>When all frames are full, remove the page that entered earliest.</li>
                                    <li>Move the FIFO pointer to the next frame position.</li>
                                    <li>At the end, count all F marks. That is the total page-fault count.</li>
                                </ol>

                                <div class="formula-box">
                                    <b>FIFO rule to remember:</b>
                                    “Oldest arrival leaves first.”
                                </div>

                                <h4>FIFO notebook format</h4>
                                <div class="notebook-table">
                                    <div class="mini-row header">
                                        <span>Reference</span><span>7</span><span>0</span><span>1</span><span>2</span><span>0</span>
                                    </div>
                                    <div class="mini-row">
                                        <span>Frame 1</span><span>7</span><span>7</span><span>7</span><span>2</span><span>2</span>
                                    </div>
                                    <div class="mini-row">
                                        <span>Frame 2</span><span>–</span><span>0</span><span>0</span><span>0</span><span>0</span>
                                    </div>
                                    <div class="mini-row">
                                        <span>Frame 3</span><span>–</span><span>–</span><span>1</span><span>1</span><span>1</span>
                                    </div>
                                    <div class="mini-row result">
                                        <span>Result</span><span>F</span><span>F</span><span>F</span><span>F</span><span>H</span>
                                    </div>
                                </div>
                                <p class="small-note">
                                    Continue the same process for every remaining reference. The exact
                                    replacement order is based on arrival time, not on how recently a page was used.
                                </p>
                            </article>

                            <article class="algorithm-note lru-note">
                                <div class="note-title">
                                    <span class="algo-icon">L</span>
                                    <div>
                                        <h3>LRU — Least Recently Used</h3>
                                        <span>Replace the page that was used least recently.</span>
                                    </div>
                                </div>

                                <h4>Definition</h4>
                                <p>
                                    LRU replaces the page whose most recent use is farthest in the past.
                                    In other words, when a fault occurs and memory is full, look backward
                                    through the reference string and remove the page that has not been used
                                    for the longest time.
                                </p>

                                <h4>How to solve LRU in a book</h4>
                                <ol class="manual-steps">
                                    <li>Draw the required number of frame rows.</li>
                                    <li>Read the reference string from left to right.</li>
                                    <li>If the page is already in a frame, write <b>H</b> (Hit). Keep the frames unchanged.</li>
                                    <li>If the page is absent, write <b>F</b> (Fault).</li>
                                    <li>If an empty frame exists, place the new page there.</li>
                                    <li>When all frames are full, look backward in the reference string.</li>
                                    <li>Find which current page was used least recently.</li>
                                    <li>Replace that least-recently-used page with the required page.</li>
                                    <li>Count all F marks at the end to get total page faults.</li>
                                </ol>

                                <div class="formula-box">
                                    <b>LRU rule to remember:</b>
                                    “The page not used for the longest time leaves.”
                                </div>

                                <h4>LRU backward-check trick</h4>
                                <div class="backward-trick">
                                    <span>Current fault →</span>
                                    <span>Look backward ←</span>
                                    <span>First occurrence of each resident page</span>
                                    <span>Page found farthest back = victim</span>
                                </div>
                                <p class="small-note">
                                    Example: if the current frames contain 2, 0, 3 and looking backward
                                    shows 3 was used most recently, 0 before that, and 2 farthest back,
                                    then <b>2</b> is the LRU victim.
                                </p>
                            </article>
                        </div>

                        <div class="worked-example">
                            <div class="worked-heading">
                                <span class="section-kicker">WORKED EXAMPLE</span>
                                <h2>Reference String: 7, 0, 1, 2, 0, 3, 0, 4, 2, 3</h2>
                                <p>Number of frames = 3. Work from left to right.</p>
                            </div>

                            <div class="comparison-table-wrap">
                                <table class="worked-table">
                                    <thead>
                                        <tr>
                                            <th>Page</th>
                                            <th>7</th><th>0</th><th>1</th><th>2</th><th>0</th>
                                            <th>3</th><th>0</th><th>4</th><th>2</th><th>3</th>
                                        </tr>
                                    </thead>
                                    <tbody id="workedExampleBody"></tbody>
                                </table>
                            </div>

                            <div class="worked-rules">
                                <div>
                                    <b>For FIFO:</b> keep a queue/order of arrival. On every fault with full memory,
                                    replace the oldest resident page.
                                </div>
                                <div>
                                    <b>For LRU:</b> on every fault with full memory, inspect previous references and
                                    replace the resident page used least recently.
                                </div>
                            </div>
                        </div>


                        <div class="difference-card">
                            <h3>FIFO vs LRU — Quick Revision</h3>
                            <div class="quick-table">
                                <div class="qrow qhead"><span>Point</span><span>FIFO</span><span>LRU</span></div>
                                <div class="qrow"><span>Full form</span><span>First In First Out</span><span>Least Recently Used</span></div>
                                <div class="qrow"><span>Victim selection</span><span>Oldest arrival</span><span>Least recently used</span></div>
                                <div class="qrow"><span>Main thing to track</span><span>Arrival order / queue</span><span>Recent usage</span></div>
                                <div class="qrow"><span>On a Hit</span><span>Keep frames as they are</span><span>Keep page, update its recent-use information</span></div>
                                <div class="qrow"><span>Easy memory trick</span><span>“First in → first out”</span><span>“Not used recently → out”</span></div>
                            </div>
                        </div>
                    </div>

                    <div class="simulation-section-heading" id="simulationStart">
                        <h2>Simulation</h2>
                    </div>

                    <div class="settings-card">
                        <div class="input-block">
                            <label for="referenceInput">Reference String</label>
                            <input id="referenceInput" type="text"
                                value="${DEFAULT_REFERENCE.join(", ")}"
                                placeholder="Example: 7, 0, 1, 2, 0, 3">
                            <small>Enter numbers separated by commas or spaces. Example: 7, 0, 1, 2, 0, 3</small>
                        </div>

                        <div class="input-block small-input">
                            <label for="framesInput">Number of Frames</label>
                            <input id="framesInput" type="number" min="1" max="6" value="${DEFAULT_FRAMES}">
                            <small>Enter 1–6 frames.</small>
                        </div>

                        <div class="input-block">
                            <label for="algorithmSelect">Algorithm</label>
                            <select id="algorithmSelect">
                                <option value="FIFO">FIFO — First In First Out</option>
                                <option value="LRU">LRU — Least Recently Used</option>
                            </select>
                        </div>

                        <button class="primary-btn" id="loadBtn">Load Simulation</button>
                    </div>

                    <div id="errorBox" class="error-box" hidden></div>

                    <div class="concept-strip">
                        <div class="concept-item">
                            <span class="concept-icon blue">1</span>
                            <div><b>Reference</b><small>Page requested by CPU</small></div>
                        </div>
                        <div class="concept-arrow">→</div>
                        <div class="concept-item">
                            <span class="concept-icon teal">2</span>
                            <div><b>Check Frames</b><small>Is the page already in memory?</small></div>
                        </div>
                        <div class="concept-arrow">→</div>
                        <div class="concept-item">
                            <span class="concept-icon orange">3</span>
                            <div><b>HIT / FAULT</b><small>Replace only when necessary</small></div>
                        </div>
                    </div>

                    <div class="stream-card">
                        <div class="section-heading">
                            <div>
                                <span class="section-kicker">REFERENCE STREAM</span>
                                <h2>Page-by-page execution</h2>
                            </div>
                            <span class="step-pill" id="stepPill">Step 0 / ${referenceString.length}</span>
                        </div>
                        <div class="reference-stream" id="referenceStream"></div>
                    </div>

                    <div class="metrics-grid">
                        <div class="metric-card">
                            <span>Page Faults</span>
                            <strong id="faultMetric">0</strong>
                            <small>Pages not found in memory</small>
                        </div>
                        <div class="metric-card">
                            <span>Page Hits</span>
                            <strong id="hitMetric">0</strong>
                            <small>Pages already in memory</small>
                        </div>
                        <div class="metric-card">
                            <span>Hit Ratio</span>
                            <strong id="hitRatioMetric">0%</strong>
                            <small>Hits ÷ processed references</small>
                        </div>
                        <div class="metric-card">
                            <span>Fault Ratio</span>
                            <strong id="faultRatioMetric">0%</strong>
                            <small>Faults ÷ processed references</small>
                        </div>
                    </div>

                    <div class="sim-grid">
                        <div class="memory-card">
                            <div class="section-heading">
                                <div>
                                    <span class="section-kicker">MAIN MEMORY</span>
                                    <h2>Memory Frames</h2>
                                </div>
                                <span class="algorithm-tag" id="algorithmTag">${algorithm}</span>
                            </div>

                            <div id="memoryFrames" class="memory-frames"></div>

                            <div id="statusMessage" class="status-message neutral">
                                Press <b>Next Step</b> to begin.
                            </div>

                            <div class="progress-wrap">
                                <div class="progress-labels">
                                    <span>Progress</span>
                                    <span id="progressText">0%</span>
                                </div>
                                <div class="progress-track"><div id="progressBar"></div></div>
                            </div>

                            <div class="controls">
                                <button id="prevBtn" class="control-btn">← Previous</button>
                                <button id="playBtn" class="control-btn play">▶ Auto Play</button>
                                <button id="nextBtn" class="control-btn next">Next Step →</button>
                                <button id="resetBtn" class="control-btn">↻ Reset</button>
                            </div>
                        </div>

                        <div class="history-card">
                            <div class="section-heading">
                                <div>
                                    <span class="section-kicker">EXECUTION LOG</span>
                                    <h2>Step History</h2>
                                </div>
                            </div>
                            <div class="table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Step</th>
                                            <th>Page</th>
                                            <th>Result</th>
                                            <th>Frames After</th>
                                        </tr>
                                    </thead>
                                    <tbody id="historyBody"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>



                    <div id="completionCard" class="completion-card" hidden></div>
                </section>
            `;

            bindEvents();
            buildHistory();
            renderAll();
        }

        function bindEvents() {
            root.querySelector("#loadBtn").addEventListener("click", loadSimulation);

            root.querySelector("#algorithmSelect").addEventListener("change", e => {
                algorithm = e.target.value;
                buildHistory();
                showError("");
                renderAll();
            });

            root.querySelector("#nextBtn").addEventListener("click", nextStep);
            root.querySelector("#prevBtn").addEventListener("click", previousStep);
            root.querySelector("#playBtn").addEventListener("click", toggleAutoPlay);
            root.querySelector("#resetBtn").addEventListener("click", reset);

            root.querySelector("#referenceInput").addEventListener("keydown", e => {
                if (e.key === "Enter") loadSimulation();
            });
        }

        function loadSimulation() {
            try {
                const refs = parseReference(root.querySelector("#referenceInput").value);
                const frames = Number(root.querySelector("#framesInput").value);

                if (!Number.isInteger(frames) || frames < 1 || frames > 6) {
                    throw new Error("Number of frames must be between 1 and 6.");
                }

                referenceString = refs;
                frameCount = frames;
                algorithm = root.querySelector("#algorithmSelect").value;
                stopAutoPlay();
                buildHistory();
                showError("");
                renderAll();
            } catch (err) {
                showError(err.message);
            }
        }

        function showError(message) {
            const box = root.querySelector("#errorBox");
            if (!message) {
                box.hidden = true;
                box.textContent = "";
                return;
            }
            box.hidden = false;
            box.textContent = message;
        }

        function nextStep() {
            if (currentStep < history.length) {
                currentStep++;
                renderAll();
            }
        }

        function previousStep() {
            if (currentStep > 0) {
                currentStep--;
                renderAll();
            }
        }

        function toggleAutoPlay() {
            const button = root.querySelector("#playBtn");

            if (autoPlayTimer) {
                stopAutoPlay();
                button.textContent = "▶ Auto Play";
                return;
            }

            if (currentStep >= history.length) currentStep = 0;

            button.textContent = "❚❚ Pause";
            autoPlayTimer = setInterval(() => {
                if (currentStep >= history.length) {
                    stopAutoPlay();
                    button.textContent = "▶ Auto Play";
                    renderAll();
                    return;
                }
                currentStep++;
                renderAll();
            }, 850);
        }

        function reset() {
            stopAutoPlay();

            referenceString = [...DEFAULT_REFERENCE];
            frameCount = DEFAULT_FRAMES;
            algorithm = DEFAULT_ALGORITHM;

            const refInput = root.querySelector("#referenceInput");
            const frameInput = root.querySelector("#framesInput");
            const select = root.querySelector("#algorithmSelect");

            refInput.value = DEFAULT_REFERENCE.join(", ");
            frameInput.value = DEFAULT_FRAMES;
            select.value = DEFAULT_ALGORITHM;

            buildHistory();
            showError("");
            renderAll();
        }

        function renderAll() {
            renderReferenceStream();
            renderMetrics();
            renderFrames();
            renderStatus();
            renderHistory();
            renderWorkedExample();
            renderCompletion();
        }

        function renderReferenceStream() {
            const box = root.querySelector("#referenceStream");
            box.innerHTML = referenceString.map((page, i) => {
                let state = "";
                if (i < currentStep) state = history[i].hit ? "was-hit" : "was-fault";
                if (i === currentStep - 1) state += " current";

                return `<div class="reference-item ${state}" title="Reference ${i + 1}: page ${escapeHTML(page)}">
                    <span class="ref-index">${i + 1}</span>
                    <b>${escapeHTML(page)}</b>
                </div>`;
            }).join("");

            root.querySelector("#stepPill").textContent =
                `Step ${currentStep} / ${referenceString.length}`;
        }

        function renderMetrics() {
            const faults = countFaults();
            const hits = countHits();
            const total = currentStep;
            const hitRatio = total ? (hits / total) * 100 : 0;
            const faultRatio = total ? (faults / total) * 100 : 0;

            root.querySelector("#faultMetric").textContent = faults;
            root.querySelector("#hitMetric").textContent = hits;
            root.querySelector("#hitRatioMetric").textContent = `${hitRatio.toFixed(1)}%`;
            root.querySelector("#faultRatioMetric").textContent = `${faultRatio.toFixed(1)}%`;
        }

        function renderFrames() {
            const box = root.querySelector("#memoryFrames");
            const current = currentStep ? history[currentStep - 1] : null;
            const frames = current ? current.after : [];

            box.innerHTML = Array.from({ length: frameCount }, (_, i) => {
                const value = frames[i];
                const isNew = current && value !== undefined && current.after[i] !== current.before[i];

                return `
                    <div class="frame ${isNew ? "updated" : ""}">
                        <span class="frame-label">Frame ${i + 1}</span>
                        <div class="frame-value">${value === undefined ? "—" : escapeHTML(value)}</div>
                    </div>
                `;
            }).join("");

            root.querySelector("#algorithmTag").textContent = algorithm;
        }

        function renderStatus() {
            const box = root.querySelector("#statusMessage");
            const progress = history.length ? Math.round((currentStep / history.length) * 100) : 0;

            root.querySelector("#progressBar").style.width = `${progress}%`;
            root.querySelector("#progressText").textContent = `${progress}%`;

            if (currentStep === 0) {
                box.className = "status-message neutral";
                box.innerHTML = `Press <b>Next Step</b> to begin the simulation.`;
                return;
            }

            const event = history[currentStep - 1];

            if (event.hit) {
                box.className = "status-message hit";
                box.innerHTML = `✓ <b>HIT:</b> Page <strong>${escapeHTML(event.page)}</strong> is already in memory. No replacement needed.`;
            } else {
                let detail = "";
                if (event.before.length < frameCount) {
                    detail = "An empty frame was available, so the page was loaded.";
                } else if (algorithm === "FIFO") {
                    detail = "FIFO replaced the page that arrived earliest.";
                } else {
                    detail = "LRU replaced the page that had not been used for the longest time.";
                }

                box.className = "status-message fault";
                box.innerHTML = `⚠ <b>PAGE FAULT:</b> Page <strong>${escapeHTML(event.page)}</strong> was not in memory. ${detail}`;
            }
        }

        function renderHistory() {
            const body = root.querySelector("#historyBody");
            if (!currentStep) {
                body.innerHTML = `<tr><td colspan="4" class="empty-row">No steps completed yet.</td></tr>`;
                return;
            }

            body.innerHTML = history.slice(0, currentStep).map(event => `
                <tr class="${event.hit ? "hit-row" : "fault-row"}">
                    <td>${event.index + 1}</td>
                    <td><b>${escapeHTML(event.page)}</b></td>
                    <td><span class="result-badge ${event.hit ? "hit-badge" : "fault-badge"}">${event.event}</span></td>
                    <td>${event.after.map(v => escapeHTML(v)).join("  |  ")}</td>
                </tr>
            `).join("");
        }

        function renderWorkedExample() {
            const body = root.querySelector("#workedExampleBody");

            const fifo = simulateFIFO(DEFAULT_REFERENCE, 3);
            const lru = simulateLRU(DEFAULT_REFERENCE, 3);

            function frameRows(sim) {
                const rows = [];
                for (let r = 0; r < 3; r++) {
                    rows.push(`<tr><th>Frame ${r + 1}</th>${sim.map(s => `<td>${s.after[r] === undefined ? "—" : s.after[r]}</td>`).join("")
                        }</tr>`);
                }
                return rows.join("");
            }

            function resultRow(sim, label) {
                return `<tr class="example-result"><th>${label}</th>${sim.map(s => `<td><b>${s.hit ? "H" : "F"}</b></td>`).join("")
                    }</tr>`;
            }

            body.innerHTML =
                `<tr class="example-title"><th colspan="11">FIFO</th></tr>` +
                frameRows(fifo) +
                resultRow(fifo, "H / F") +
                `<tr class="example-title"><th colspan="11">LRU</th></tr>` +
                frameRows(lru) +
                resultRow(lru, "H / F");
        }

        function renderCompletion() {
            const card = root.querySelector("#completionCard");

            if (currentStep < history.length) {
                card.hidden = true;
                return;
            }

            const faults = countFaults(history.length);
            const hits = countHits(history.length);
            const hitRatio = history.length ? (hits / history.length) * 100 : 0;

            card.hidden = false;
            card.innerHTML = `
                <div class="completion-check">✓</div>
                <div>
                    <span class="section-kicker">SIMULATION COMPLETE</span>
                    <h3>${algorithm} finished for ${referenceString.length} references</h3>
                    <p><b>${faults}</b> page faults and <b>${hits}</b> page hits. Hit ratio: <b>${hitRatio.toFixed(1)}%</b>.</p>
                </div>
            `;
        }

        function getMetrics() {
            return {
                primaryMetricLabel: "Page Faults",
                primaryMetricValue: countFaults(),
                unit: "faults"
            };
        }

        return {
            render,
            reset,
            getMetrics
        };
    })();
})();
