window.OSDashboard = window.OSDashboard || { modules: {} };

window.OSDashboard.modules["team14_page_optimal"] = (function() {
    
    // --- Internal State ---
    const DEFAULT_REF_STRING_RAW = "7 0 1 2 0 3 0 4 2 1 0";
    const DEFAULT_FRAMES = 3;
    
    let state = {
        rawInput: DEFAULT_REF_STRING_RAW,
        refString: [],
        frameCount: DEFAULT_FRAMES,
        selectedAlgo: "optimal", // 'optimal', 'fifo', 'lru'
        
        // Simulation state
        history: [], // Array of objects containing state at each step
        currentIndex: -1,
        
        // Runtime
        isRunning: false,
        timer: null,
        speed: 1000, // ms per step
        
        // Metrics for comparison chart
        optimalFaults: 0,
        fifoFaults: 0,
        lruFaults: 0,
        optimalHits: 0,
        fifoHits: 0,
        lruHits: 0,
        
        // DOM / Chart
        container: null,
        chartInstance: null
    };

    // --- Helper: Parsing Input ---
    function parseInput(raw) {
        if (!raw) return [];
        return raw.trim().split(/\s+/).map(v => isNaN(v) ? v : parseInt(v, 10));
    }

    // --- Algorithm: FIFO ---
    function buildFIFOHistory(refs, numFrames) {
        let history = [];
        let frames = new Array(numFrames).fill(undefined);
        let faults = 0;
        let hits = 0;
        let replaceIndex = 0;
        
        for (let i = 0; i < refs.length; i++) {
            let page = refs[i];
            let isFault = true;
            let replacedPage = null;
            let decisionReason = null;
            
            let foundIdx = frames.indexOf(page);
            if (foundIdx !== -1) {
                isFault = false;
                hits++;
            } else {
                faults++;
                let targetIdx = frames.indexOf(undefined);
                if (targetIdx !== -1) {
                    frames[targetIdx] = page;
                } else {
                    replacedPage = frames[replaceIndex];
                    frames[replaceIndex] = page;
                    
                    decisionReason = {
                        incoming: page,
                        replaced: replacedPage,
                        summary: `Page ${replacedPage} was the oldest page in memory (FIFO).`
                    };
                    
                    replaceIndex = (replaceIndex + 1) % numFrames;
                }
            }
            
            history.push({
                index: i,
                request: page,
                isFault: isFault,
                frames: [...frames],
                replacedPage: replacedPage,
                decisionReason: decisionReason,
                cumulativeFaults: faults,
                cumulativeHits: hits
            });
        }
        return { history: history, totalFaults: faults, totalHits: hits };
    }

    // --- Algorithm: LRU ---
    function buildLRUHistory(refs, numFrames) {
        let history = [];
        let frames = new Array(numFrames).fill(undefined);
        let lastUsed = new Array(numFrames).fill(-1);
        let faults = 0;
        let hits = 0;
        
        for (let i = 0; i < refs.length; i++) {
            let page = refs[i];
            let isFault = true;
            let replacedPage = null;
            let decisionReason = null;
            
            let foundIdx = frames.indexOf(page);
            if (foundIdx !== -1) {
                isFault = false;
                hits++;
                lastUsed[foundIdx] = i;
            } else {
                faults++;
                let targetIdx = frames.indexOf(undefined);
                if (targetIdx !== -1) {
                    frames[targetIdx] = page;
                    lastUsed[targetIdx] = i;
                } else {
                    let lruIdx = 0;
                    for (let j = 1; j < numFrames; j++) {
                        if (lastUsed[j] < lastUsed[lruIdx]) {
                            lruIdx = j;
                        }
                    }
                    replacedPage = frames[lruIdx];
                    frames[lruIdx] = page;
                    lastUsed[lruIdx] = i;
                    
                    decisionReason = {
                        incoming: page,
                        replaced: replacedPage,
                        summary: `Page ${replacedPage} was the least recently used.`
                    };
                }
            }
            
            history.push({
                index: i,
                request: page,
                isFault: isFault,
                frames: [...frames],
                replacedPage: replacedPage,
                decisionReason: decisionReason,
                cumulativeFaults: faults,
                cumulativeHits: hits
            });
        }
        return { history: history, totalFaults: faults, totalHits: hits };
    }

    // --- Algorithm: Optimal (Precompute Full Simulation) ---
    function buildOptimalHistory(refs, numFrames) {
        let history = [];
        let frames = new Array(numFrames).fill(undefined);
        let faults = 0;
        let hits = 0;

        for (let i = 0; i < refs.length; i++) {
            let page = refs[i];
            let isFault = true;
            let replacedPage = null;
            let decisionReason = null;
            
            let foundIdx = frames.indexOf(page);
            
            if (foundIdx !== -1) {
                isFault = false;
                hits++;
            } else {
                faults++;
                let targetIdx = frames.indexOf(undefined);
                if (targetIdx !== -1) {
                    frames[targetIdx] = page;
                } else {
                    let farthestDist = -1;
                    let victimIdx = -1;
                    let candidatesInfo = [];
                    
                    for (let j = 0; j < numFrames; j++) {
                        let candidate = frames[j];
                        let nextUseDist = Infinity;
                        
                        for (let k = i + 1; k < refs.length; k++) {
                            if (refs[k] === candidate) {
                                nextUseDist = k - i;
                                break;
                            }
                        }
                        
                        candidatesInfo.push({
                            page: candidate,
                            dist: nextUseDist
                        });
                        
                        if (nextUseDist > farthestDist) {
                            farthestDist = nextUseDist;
                            victimIdx = j;
                        }
                    }
                    
                    replacedPage = frames[victimIdx];
                    frames[victimIdx] = page;
                    
                    let reasonDetails = candidatesInfo.map(c => {
                        let when = c.dist === Infinity ? "Never used again" : `Used in ${c.dist} reference(s)`;
                        return `Page ${c.page} &rarr; ${when}`;
                    });
                    
                    let victimDist = candidatesInfo.find(c => c.page === replacedPage).dist;
                    let summary = victimDist === Infinity 
                        ? `Page ${replacedPage} is not used again.` 
                        : `Page ${replacedPage} has the farthest next use.`;
                        
                    decisionReason = {
                        incoming: page,
                        candidates: reasonDetails,
                        replaced: replacedPage,
                        summary: summary
                    };
                }
            }
            
            history.push({
                index: i,
                request: page,
                isFault: isFault,
                frames: [...frames],
                replacedPage: replacedPage,
                decisionReason: decisionReason,
                cumulativeFaults: faults,
                cumulativeHits: hits
            });
        }
        
        return {
            history: history,
            totalFaults: faults,
            totalHits: hits
        };
    }

    // --- Core Simulation Logic ---
    function initSimulation() {
        let refStrInput = document.getElementById("t14-ref-input").value;
        let framesInput = parseInt(document.getElementById("t14-frames-input").value, 10);
        let algoInput = document.getElementById("t14-algo-select").value;
        
        let isInvalid = false;
        if (!refStrInput.trim()) {
            showError("Reference string cannot be empty.");
            isInvalid = true;
        } else if (isNaN(framesInput) || framesInput < 1) {
            showError("Frames must be at least 1.");
            isInvalid = true;
        }
        
        if (isInvalid) {
            state.refString = [];
            state.history = [];
            state.currentIndex = -1;
            state.fifoFaults = 0; state.fifoHits = 0;
            state.lruFaults = 0; state.lruHits = 0;
            state.optimalFaults = 0; state.optimalHits = 0;
            
            if (state.chartInstance) {
                state.chartInstance.destroy();
                state.chartInstance = null;
            }
            
            document.getElementById("t14-stat-fifo").innerHTML = "-";
            document.getElementById("t14-stat-lru").innerHTML = "-";
            document.getElementById("t14-stat-opt").innerHTML = "-";
            
            let refContainer = document.getElementById("t14-ref-container");
            if (refContainer) refContainer.innerHTML = "";
            
            let framesContainer = document.getElementById("t14-frames-container");
            if (framesContainer) framesContainer.innerHTML = "";
            
            renderMetrics(0, 0, 0);
            
            let decisionPanel = document.getElementById("t14-decision-panel");
            if (decisionPanel) decisionPanel.className = "decision-panel";
            let analysisDiv = document.getElementById("t14-comparison-analysis");
            if (analysisDiv) analysisDiv.style.display = "none";
            
            updateControls();
            return false;
        }
        showError("");
        
        state.rawInput = refStrInput;
        state.refString = parseInput(refStrInput);
        state.frameCount = framesInput;
        state.selectedAlgo = algoInput;
        
        let fifoSim = buildFIFOHistory(state.refString, state.frameCount);
        state.fifoFaults = fifoSim.totalFaults;
        state.fifoHits = fifoSim.totalHits;
        
        let lruSim = buildLRUHistory(state.refString, state.frameCount);
        state.lruFaults = lruSim.totalFaults;
        state.lruHits = lruSim.totalHits;
        
        let optSim = buildOptimalHistory(state.refString, state.frameCount);
        state.optimalFaults = optSim.totalFaults;
        state.optimalHits = optSim.totalHits;
        
        if (state.selectedAlgo === 'fifo') state.history = fifoSim.history;
        else if (state.selectedAlgo === 'lru') state.history = lruSim.history;
        else state.history = optSim.history;
        
        state.currentIndex = -1;
        
        if (state.chartInstance) {
            state.chartInstance.destroy();
            state.chartInstance = null;
        }
        document.getElementById("t14-stat-fifo").innerHTML = "-";
        document.getElementById("t14-stat-lru").innerHTML = "-";
        document.getElementById("t14-stat-opt").innerHTML = "-";
        
        renderReferenceString();
        renderFramesHistory();
        renderMetrics(0, 0, 0);
        
        document.getElementById("t14-decision-panel").className = "decision-panel visible";
        document.getElementById("t14-decision-content").innerHTML = "<div style='color: #718096; font-style: italic;'>Simulation started. Replacements will appear here...</div>";
        
        let analysisDiv = document.getElementById("t14-comparison-analysis");
        if (analysisDiv) analysisDiv.style.display = "none";
        
        updateControls();
        return true;
    }

    function step() {
        if (state.currentIndex >= state.history.length - 1) {
            pause();
            return;
        }
        
        state.currentIndex++;
        let stepState = state.history[state.currentIndex];
        
        renderReferenceString();
        renderFramesHistory();
        renderMetrics(state.currentIndex + 1, stepState.cumulativeHits, stepState.cumulativeFaults);
        
        let decisionPanel = document.getElementById("t14-decision-panel");
        let allDecisions = state.history.slice(0, state.currentIndex + 1).filter(h => h.decisionReason);
        
        if (allDecisions.length > 0) {
            let html = "";
            for (let h of allDecisions) {
                let dr = h.decisionReason;
                let listHtml = "";
                if (dr.candidates) {
                    listHtml = dr.candidates.map(c => `<li>${c}</li>`).join('');
                }
                
                let futureUsageHtml = listHtml ? `<div style="margin-top:8px;"><strong>Future Usage (Optimal algorithm):</strong></div><ul class="decision-list">${listHtml}</ul>` : "";
                
                html += `
                <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 12px;">
                    <div style="color: #2b6cb0; font-weight: bold; margin-bottom: 8px;">Step ${h.index + 1}: Requesting Page ${dr.incoming}</div>
                    ${futureUsageHtml}
                    <div class="decision-result" style="margin-top: 10px;">
                        Decision: Replace Page ${dr.replaced}<br>
                        <span style="font-size: 12px; font-weight: normal;">Reason: ${dr.summary}</span>
                    </div>
                </div>`;
            }
            let contentEl = document.getElementById("t14-decision-content");
            contentEl.innerHTML = html;
            decisionPanel.className = "decision-panel visible";
            contentEl.scrollTop = contentEl.scrollHeight;
        }
        
        updateControls();
        
        if (state.currentIndex === state.history.length - 1) {
            pause();
            updateChart();
            renderComparisonStats();
        }
    }

    function play() {
        if (state.currentIndex >= state.history.length - 1) return;
        state.isRunning = true;
        updateControls();
        
        step();
        
        state.timer = setInterval(() => {
            if (state.currentIndex >= state.history.length - 1) {
                pause();
            } else {
                step();
            }
        }, state.speed);
    }

    function pause() {
        state.isRunning = false;
        clearInterval(state.timer);
        state.timer = null;
        updateControls();
    }

    function doReset() {
        pause();
        initSimulation();
    }

    function setSpeed(ms) {
        state.speed = ms;
        if (state.isRunning) {
            pause();
            play();
        }
    }

    // --- UI Update Helpers ---
    function showError(msg) {
        let el = document.getElementById("t14-error-msg");
        if (el) el.textContent = msg;
    }

    function updateControls() {
        let isEnd = state.currentIndex >= state.history.length - 1;
        document.getElementById("t14-btn-play").disabled = state.isRunning || isEnd;
        document.getElementById("t14-btn-pause").disabled = !state.isRunning;
        document.getElementById("t14-btn-step").disabled = state.isRunning || isEnd;
    }

    function renderReferenceString() {
        let container = document.getElementById("t14-ref-container");
        if (!container) return;
        
        let html = "";
        for (let i = 0; i < state.refString.length; i++) {
            let classes = "ref-item";
            if (i < state.currentIndex) classes += " past";
            else if (i === state.currentIndex) classes += " current";
            else classes += " future";
            
            html += `<div class="${classes}">${state.refString[i]}</div>`;
        }
        container.innerHTML = html;
        
        let currentEl = container.querySelector(".current");
        if (currentEl) {
            currentEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }

    function renderFramesHistory() {
        let container = document.getElementById("t14-frames-container");
        if (!container) return;
        
        if (state.currentIndex < 0) {
            container.innerHTML = "";
            return;
        }

        let html = '<div style="max-height: 400px; overflow-y: auto;"><table class="history-table">';
        html += '<tr><th>Step</th><th>Req</th>';
        for (let i = 0; i < state.frameCount; i++) {
            html += `<th>Frame ${i + 1}</th>`;
        }
        html += '<th>Status</th></tr>';
        
        for (let i = 0; i <= state.currentIndex; i++) {
            let stepState = state.history[i];
            html += `<tr>`;
            html += `<td>${i + 1}</td>`;
            html += `<td>${stepState.request}</td>`;
            
            for (let j = 0; j < state.frameCount; j++) {
                let val = stepState.frames[j];
                let displayVal = (val !== undefined) ? val : "-";
                let isChanged = stepState.isFault && (val === stepState.request);
                let isHit = !stepState.isFault && (val === stepState.request);
                let cellClass = isChanged ? 'class="changed-cell"' : (isHit ? 'class="hit-cell"' : '');
                html += `<td ${cellClass}>${displayVal}</td>`;
            }
            
            if (stepState.isFault) {
                html += `<td class="fault-text">Fault</td>`;
            } else {
                html += `<td class="hit-text">Hit</td>`;
            }
            html += `</tr>`;
        }
        html += '</table></div>';
        
        if (state.currentIndex === state.history.length - 1) {
            let finalHits = state.history[state.currentIndex].cumulativeHits;
            let finalFaults = state.history[state.currentIndex].cumulativeFaults;
            let totalReplacements = state.history.filter(h => h.replacedPage !== null).length;
            let totalReqs = state.refString.length;
            html += `<div class="final-summary">
                <strong>Simulation Complete!</strong><br>
                Total Frames Used: ${state.frameCount}<br>
                Total Hits: ${finalHits}<br>
                Total Faults: ${finalFaults}<br>
                Total Page Replacements: ${totalReplacements}<br>
                Total Requests: ${totalReqs}
            </div>`;
        }
        
        container.innerHTML = html;
        
        let tableDiv = container.querySelector('div');
        if (tableDiv) {
            tableDiv.scrollTop = tableDiv.scrollHeight;
        }
    }

    function renderMetrics(refsProcessed, hits, faults) {
        document.getElementById("t14-met-refs").textContent = `${refsProcessed} / ${state.refString.length}`;
        
        let currentReq = state.currentIndex >= 0 && state.currentIndex < state.history.length 
            ? state.history[state.currentIndex].request 
            : "-";
        document.getElementById("t14-met-curr").textContent = currentReq;
        
        document.getElementById("t14-met-hits").textContent = hits;
        document.getElementById("t14-met-faults").textContent = faults;
        
        let hr = refsProcessed > 0 ? ((hits / refsProcessed) * 100).toFixed(1) + "%" : "0.0%";
        document.getElementById("t14-met-ratio").textContent = hr;
    }

    function renderComparisonStats() {
        document.getElementById("t14-stat-fifo").innerHTML = `${state.fifoFaults} faults<br>${state.fifoHits} hits`;
        document.getElementById("t14-stat-lru").innerHTML = `${state.lruFaults} faults<br>${state.lruHits} hits`;
        document.getElementById("t14-stat-opt").innerHTML = `${state.optimalFaults} faults<br>${state.optimalHits} hits`;
        
        let stats = [
            { name: "FIFO", faults: state.fifoFaults },
            { name: "LRU", faults: state.lruFaults },
            { name: "Optimal", faults: state.optimalFaults }
        ];
        stats.sort((a, b) => a.faults - b.faults);
        let best = stats[0];
        let worst = stats[stats.length - 1];

        let analysisDiv = document.getElementById("t14-comparison-analysis");
        if (analysisDiv) {
            analysisDiv.style.display = "block";
            analysisDiv.innerHTML = `
                <strong>Comparison Analysis (For Current Input):</strong>
                <p style="margin-top: 8px;">Based on the simulation for this reference string, <strong>${best.name}</strong> is the best algorithm with only <strong>${best.faults} Page Faults</strong>. 
                Conversely, <strong>${worst.name}</strong> performed the worst with <strong>${worst.faults} Page Faults</strong>.</p>
                <p style="margin-top: 12px;"><strong>General Performance:</strong></p>
                <ul style="margin-top: 8px; padding-left: 20px;">
                    <li><strong>Best:</strong> The <em>Optimal</em> algorithm is theoretically the best as it always yields the absolute minimum page faults. In practical systems where Optimal is impossible, <em>LRU</em> is generally the best applicable algorithm.</li>
                    <li style="margin-top: 4px;"><strong>Worst:</strong> <em>FIFO</em> is generally the worst because it ignores access patterns and just replaces the oldest page, and can even suffer from Belady's anomaly.</li>
                </ul>
            `;
        }
    }

    function updateChart() {
        let ctx = document.getElementById("t14-comparison-chart");
        if (!ctx) return;
        
        if (state.chartInstance) {
            state.chartInstance.destroy();
        }
        
        state.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['FIFO', 'LRU', 'Optimal'],
                datasets: [
                    {
                        label: 'Page Faults',
                        data: [state.fifoFaults, state.lruFaults, state.optimalFaults],
                        backgroundColor: '#e53e3e',
                    },
                    {
                        label: 'Page Hits',
                        data: [state.fifoHits, state.lruHits, state.optimalHits],
                        backgroundColor: '#38a169',
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    title: {
                        display: false
                    }
                }
            }
        });
    }

    // --- DOM Assembly ---
    function buildDOM() {
        return `
        <div class="os-team14">
        <div class="header">
            <h2>Optimal Page Replacement and Algorithm Comparision</h2>
            <p>Page Replacement Algorithms</p>
        </div>
        
        <div class="descriptions" style="margin-bottom: 24px; background-color: #fffaf0; padding: 20px; border-radius: 8px; border: 1px solid #fbd38d; color: #7b341e; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <h3 style="margin-top: 0; color: #c05621;">Core Concepts</h3>
            <p><strong>Reference String:</strong> A sequence of page numbers that represent the pages requested by a program during its execution.</p>
            <p><strong>Page Replacement:</strong> The process of swapping out an existing page in memory to make room for a new page when a page fault occurs and all memory frames are full.</p>
            <p><strong>Page Hit:</strong> Occurs when the requested page is already present in the memory frames. No replacement is needed.</p>
            <p><strong>Page Fault:</strong> Occurs when the requested page is not found in the memory frames, requiring it to be loaded from disk into memory.</p>
            
            <div style="display: flex; gap: 20px; margin: 20px 0;">
                <div style="flex: 1; text-align: center;">
                    <img src="data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20400%20200%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23fff5f5%22%2F%3E%3Ctext%20x%3D%22200%22%20y%3D%2230%22%20font-family%3D%22Arial%22%20font-size%3D%2216%22%20text-anchor%3D%22middle%22%20font-weight%3D%22bold%22%3EPage%20Replacement%20Process%3C%2Ftext%3E%3Crect%20x%3D%22150%22%20y%3D%2260%22%20width%3D%22100%22%20height%3D%22120%22%20fill%3D%22%23fff%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%3Crect%20x%3D%22150%22%20y%3D%2260%22%20width%3D%22100%22%20height%3D%2240%22%20fill%3D%22%23e2e8f0%22%20stroke%3D%22%23333%22%20stroke-width%3D%221%22%2F%3E%3Ctext%20x%3D%22200%22%20y%3D%2285%22%20font-family%3D%22Arial%22%20font-size%3D%2214%22%20text-anchor%3D%22middle%22%3EPage%201%3C%2Ftext%3E%3Crect%20x%3D%22150%22%20y%3D%22100%22%20width%3D%22100%22%20height%3D%2240%22%20fill%3D%22%23fed7d7%22%20stroke%3D%22%23333%22%20stroke-width%3D%221%22%2F%3E%3Ctext%20x%3D%22200%22%20y%3D%22125%22%20font-family%3D%22Arial%22%20font-size%3D%2214%22%20text-anchor%3D%22middle%22%3EPage%202%3C%2Ftext%3E%3Crect%20x%3D%22150%22%20y%3D%22140%22%20width%3D%22100%22%20height%3D%2240%22%20fill%3D%22%23e2e8f0%22%20stroke%3D%22%23333%22%20stroke-width%3D%221%22%2F%3E%3Ctext%20x%3D%22200%22%20y%3D%22165%22%20font-family%3D%22Arial%22%20font-size%3D%2214%22%20text-anchor%3D%22middle%22%3EPage%203%3C%2Ftext%3E%3Crect%20x%3D%2220%22%20y%3D%22100%22%20width%3D%2260%22%20height%3D%2240%22%20fill%3D%22%23c6f6d5%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%3Ctext%20x%3D%2250%22%20y%3D%22125%22%20font-family%3D%22Arial%22%20font-size%3D%2214%22%20text-anchor%3D%22middle%22%3EPage%204%3C%2Ftext%3E%3Cpath%20d%3D%22M%2090%20120%20L%20135%20120%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%20marker-end%3D%22url%28%23arrow%29%22%2F%3E%3Crect%20x%3D%22320%22%20y%3D%22100%22%20width%3D%2260%22%20height%3D%2240%22%20fill%3D%22%23fed7d7%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%3Ctext%20x%3D%22350%22%20y%3D%22125%22%20font-family%3D%22Arial%22%20font-size%3D%2214%22%20text-anchor%3D%22middle%22%3EPage%202%3C%2Ftext%3E%3Cpath%20d%3D%22M%20265%20120%20L%20310%20120%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%20marker-end%3D%22url%28%23arrow%29%22%2F%3E%3Cdefs%3E%3Cmarker%20id%3D%22arrow%22%20markerWidth%3D%2210%22%20markerHeight%3D%2210%22%20refX%3D%229%22%20refY%3D%223%22%20orient%3D%22auto%22%20markerUnits%3D%22strokeWidth%22%3E%3Cpath%20d%3D%22M0%2C0%20L0%2C6%20L9%2C3%20z%22%20fill%3D%22%23333%22%20%2F%3E%3C%2Fmarker%3E%3C%2Fdefs%3E%3C%2Fsvg%3E" alt="Page Replacement" style="max-width: 100%; height: 200px; object-fit: contain; border-radius: 4px;">
                    <p style="font-size: 12px; color: #666;">Page Replacement Visualized</p>
                </div>
                <div style="flex: 1; text-align: center;">
                    <img src="data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20400%20200%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23fff5f5%22%2F%3E%3Ctext%20x%3D%22200%22%20y%3D%2230%22%20font-family%3D%22Arial%22%20font-size%3D%2216%22%20text-anchor%3D%22middle%22%20font-weight%3D%22bold%22%3EHit%20vs%20Fault%3C%2Ftext%3E%3Crect%20x%3D%2250%22%20y%3D%2260%22%20width%3D%22100%22%20height%3D%22120%22%20fill%3D%22%23fff%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%3Crect%20x%3D%2250%22%20y%3D%2260%22%20width%3D%22100%22%20height%3D%2240%22%20fill%3D%22%23c6f6d5%22%20stroke%3D%22%23333%22%20stroke-width%3D%221%22%2F%3E%3Ctext%20x%3D%22100%22%20y%3D%2285%22%20font-family%3D%22Arial%22%20font-size%3D%2214%22%20text-anchor%3D%22middle%22%3EPage%201%3C%2Ftext%3E%3Ctext%20x%3D%22100%22%20y%3D%22190%22%20font-family%3D%22Arial%22%20font-size%3D%2214%22%20text-anchor%3D%22middle%22%20font-weight%3D%22bold%22%20fill%3D%22%232f855a%22%3EPAGE%20HIT%3C%2Ftext%3E%3Ctext%20x%3D%22100%22%20y%3D%2250%22%20font-family%3D%22Arial%22%20font-size%3D%2212%22%20text-anchor%3D%22middle%22%3EReq%3A%20Page%201%3C%2Ftext%3E%3Cpath%20d%3D%22M%20100%2020%20L%20100%2040%22%20stroke%3D%22%232f855a%22%20stroke-width%3D%222%22%20marker-end%3D%22url%28%23arrow-green%29%22%2F%3E%3Crect%20x%3D%22250%22%20y%3D%2260%22%20width%3D%22100%22%20height%3D%22120%22%20fill%3D%22%23fff%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%3Crect%20x%3D%22250%22%20y%3D%2260%22%20width%3D%22100%22%20height%3D%2240%22%20fill%3D%22%23e2e8f0%22%20stroke%3D%22%23333%22%20stroke-width%3D%221%22%2F%3E%3Ctext%20x%3D%22300%22%20y%3D%2285%22%20font-family%3D%22Arial%22%20font-size%3D%2214%22%20text-anchor%3D%22middle%22%3EPage%202%3C%2Ftext%3E%3Ctext%20x%3D%22300%22%20y%3D%22190%22%20font-family%3D%22Arial%22%20font-size%3D%2214%22%20text-anchor%3D%22middle%22%20font-weight%3D%22bold%22%20fill%3D%22%23c53030%22%3EPAGE%20FAULT%3C%2Ftext%3E%3Ctext%20x%3D%22300%22%20y%3D%2250%22%20font-family%3D%22Arial%22%20font-size%3D%2212%22%20text-anchor%3D%22middle%22%3EReq%3A%20Page%205%3C%2Ftext%3E%3Cpath%20d%3D%22M%20300%2020%20L%20300%2040%22%20stroke%3D%22%23c53030%22%20stroke-width%3D%222%22%20marker-end%3D%22url%28%23arrow-red%29%22%2F%3E%3Cdefs%3E%3Cmarker%20id%3D%22arrow-green%22%20markerWidth%3D%2210%22%20markerHeight%3D%2210%22%20refX%3D%229%22%20refY%3D%223%22%20orient%3D%22auto%22%20markerUnits%3D%22strokeWidth%22%3E%3Cpath%20d%3D%22M0%2C0%20L0%2C6%20L9%2C3%20z%22%20fill%3D%22%232f855a%22%20%2F%3E%3C%2Fmarker%3E%3Cmarker%20id%3D%22arrow-red%22%20markerWidth%3D%2210%22%20markerHeight%3D%2210%22%20refX%3D%229%22%20refY%3D%223%22%20orient%3D%22auto%22%20markerUnits%3D%22strokeWidth%22%3E%3Cpath%20d%3D%22M0%2C0%20L0%2C6%20L9%2C3%20z%22%20fill%3D%22%23c53030%22%20%2F%3E%3C%2Fmarker%3E%3C%2Fdefs%3E%3C%2Fsvg%3E" alt="Page Hit and Fault" style="max-width: 100%; height: 200px; object-fit: contain; border-radius: 4px;">
                    <p style="font-size: 12px; color: #666;">Page Hit vs Page Fault</p>
                </div>
            </div>

            <h3>Algorithms: Factors, Advantages & Disadvantages</h3>
            
            <h4>1. Optimal Page Replacement Algorithm</h4>
            <p><strong>Basic Factor:</strong> Looks into the future to see which page will not be needed for the longest time.</p>
            <p><strong>Advantages:</strong> Guarantees the lowest possible page fault rate for a fixed number of frames. Free from Belady's anomaly.</p>
            <p><strong>Disadvantages:</strong> Impossible to implement practically in OS as it requires future knowledge of requests.</p>
            
            <h4>2. First-In, First-Out (FIFO)</h4>
            <p><strong>Basic Factor:</strong> Keeps track of pages using a queue. The oldest page is replaced first.</p>
            <p><strong>Advantages:</strong> Simple logic, easy to understand and implement with very low overhead.</p>
            <p><strong>Disadvantages:</strong> Poor performance. Blindly replaces pages even if heavily used. Suffers from Belady's anomaly (more frames can mean more faults).</p>
            
            <h4>3. Least Recently Used (LRU)</h4>
            <p><strong>Basic Factor:</strong> Looks at past history. Replaces the page that hasn't been used for the longest time.</p>
            <p><strong>Advantages:</strong> Very good performance, near optimal in practice. Does not suffer from Belady's anomaly.</p>
            <p><strong>Disadvantages:</strong> High overhead to track time of last use for every page. Requires hardware assistance.</p>
        </div>
            
            <div class="grid-layout">
                
                <div class="main-panel">
                    
                    <div class="card">
                        <div class="card-title">Live Metrics</div>
                        <div class="metrics-grid">
                            <div class="metric-item">
                                <div class="metric-label">References</div>
                                <div class="metric-value" id="t14-met-refs">0 / 0</div>
                            </div>
                            <div class="metric-item">
                                <div class="metric-label">Current Page</div>
                                <div class="metric-value" id="t14-met-curr">-</div>
                            </div>
                            <div class="metric-item">
                                <div class="metric-label">Hits</div>
                                <div class="metric-value" id="t14-met-hits">0</div>
                            </div>
                            <div class="metric-item">
                                <div class="metric-label">Page Faults</div>
                                <div class="metric-value" id="t14-met-faults">0</div>
                            </div>
                            <div class="metric-item">
                                <div class="metric-label">Hit Ratio</div>
                                <div class="metric-value" id="t14-met-ratio">0.0%</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-title">Reference String</div>
                        <div class="reference-container" id="t14-ref-container"></div>
                    </div>
                    
                    <div class="card">
                        <div class="card-title">Memory Frames History</div>
                        <div class="frames-container" id="t14-frames-container" style="display: block;"></div>
                        
                        <div id="t14-decision-panel" class="decision-panel" style="margin-top: 20px;">
                            <div class="decision-header">Replacement Decisions Log</div>
                            <div id="t14-decision-content" style="max-height: 250px; overflow-y: auto; padding-right: 8px;"></div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-title">Algorithm Comparison</div>
                        <div class="chart-container">
                            <canvas id="t14-comparison-chart"></canvas>
                        </div>
                        <div class="comparison-stats">
                            <div class="stat-box">
                                <span class="stat-label">FIFO</span>
                                <span class="stat-val" id="t14-stat-fifo">-</span>
                            </div>
                            <div class="stat-box">
                                <span class="stat-label">LRU</span>
                                <span class="stat-val" id="t14-stat-lru">-</span>
                            </div>
                            <div class="stat-box">
                                <span class="stat-label">Optimal</span>
                                <span class="stat-val" id="t14-stat-opt">-</span>
                            </div>
                        </div>
                        <div id="t14-comparison-analysis" style="margin-top: 20px; font-size: 14px; line-height: 1.5; color: #4a5568; padding-top: 15px; border-top: 1px solid #e2e8f0; display: none;">
                        </div>
                    </div>
                    
                </div>
                
                <div class="side-panel">
                    <div class="card">
                        <div class="card-title">Input & Controls</div>
                        <div class="controls-container">
                            <div class="input-group">
                                <label for="t14-ref-input">Reference String</label>
                                <input type="text" id="t14-ref-input" placeholder="e.g. 7 0 1 2 0 3...">
                            </div>
                            <div class="input-group">
                                <label for="t14-frames-input">Number of Frames</label>
                                <input type="number" id="t14-frames-input" min="1" max="10">
                            </div>
                            <div class="input-group">
                                <label for="t14-algo-select">Algorithm</label>
                                <select id="t14-algo-select" style="padding: 8px; border: 1px solid var(--os-gray-300); border-radius: 4px; font-size: 16px;">
                                    <option value="optimal">Optimal</option>
                                    <option value="fifo">FIFO</option>
                                    <option value="lru">LRU</option>
                                </select>
                            </div>
                            
                            <div class="error-msg" id="t14-error-msg"></div>
                            
                            <div class="button-group">
                                <button class="primary" id="t14-btn-run" style="width: 100%;">Apply & Restart</button>
                            </div>
                            <div class="button-group">
                                <button class="secondary" id="t14-btn-play">Play</button>
                                <button class="secondary" id="t14-btn-pause">Pause</button>
                                <button class="secondary" id="t14-btn-step">Step</button>
                                <button class="danger" id="t14-btn-reset">Reset</button>
                            </div>
                            
                            <div class="input-group" style="margin-top: 12px;">
                                <label>Simulation Speed</label>
                                <div class="button-group">
                                    <button class="secondary" style="flex:1; font-size:12px;" onclick="window.OSDashboard.modules['team14_page_optimal']._setSpeed(1500)">Slow</button>
                                    <button class="secondary" style="flex:1; font-size:12px;" onclick="window.OSDashboard.modules['team14_page_optimal']._setSpeed(750)">Normal</button>
                                    <button class="secondary" style="flex:1; font-size:12px;" onclick="window.OSDashboard.modules['team14_page_optimal']._setSpeed(250)">Fast</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
            </div>
        </div>
        `;
    }

    function setupEventListeners() {
        document.getElementById("t14-btn-run").addEventListener("click", () => {
            pause();
            initSimulation();
        });
        
        document.getElementById("t14-btn-play").addEventListener("click", play);
        document.getElementById("t14-btn-pause").addEventListener("click", pause);
        document.getElementById("t14-btn-step").addEventListener("click", step);
        document.getElementById("t14-btn-reset").addEventListener("click", doReset);
    }

    return {
        title: "Page Replacement Algorithms",
        render: function(container) {
            state.container = container;
            container.innerHTML = buildDOM();
            setupEventListeners();
            
            document.getElementById("t14-ref-input").value = DEFAULT_REF_STRING_RAW;
            document.getElementById("t14-frames-input").value = DEFAULT_FRAMES;
            document.getElementById("t14-algo-select").value = "optimal";
            initSimulation();
        },
        reset: function() {
            if (state.container) {
                doReset();
            }
        },
        getMetrics: function() {
            return {
                primaryMetricLabel: "Page Faults",
                primaryMetricValue: state.optimalFaults,
                unit: "faults"
            };
        },
        _setSpeed: setSpeed
    };

})();
