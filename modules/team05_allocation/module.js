window.OSDashboard = window.OSDashboard || { modules: {} };

window.OSDashboard.modules["team05_allocation"] = (function() {
    // Initial sample data
    const initialBlocks = [
        { id: '1', size: 100 },
        { id: '2', size: 500 },
        { id: '3', size: 200 },
        { id: '4', size: 300 },
        { id: '5', size: 600 }
    ];

    const initialProcesses = [
        { id: '1', size: 212 },
        { id: '2', size: 417 },
        { id: '3', size: 112 },
        { id: '4', size: 426 }
    ];

    // State
    let blocks = [];
    let processes = [];
    let allocations = []; // { processId, blockId, size }
    let totalFragmentation = 0;
    let totalExternalFragmentation = 0;
    let mainContainer = null;
    let selectedAlgorithm = 'first-fit';
    let isAllocated = false;

    // Algorithm descriptions
    const descriptions = {
        'first-fit': '<strong>First Fit:</strong> Allocates the first hole that is big enough. Searching starts at the beginning of the set of holes. Fast, but can cause fragmentation at the beginning of memory.',
        'best-fit': '<strong>Best Fit:</strong> Allocates the smallest hole that is big enough. Searches the entire list to find the tightest fit. Produces the smallest leftover hole, but can create tiny, unusable fragments.',
        'worst-fit': '<strong>Worst Fit:</strong> Allocates the largest hole. Searches the entire list. Produces the largest leftover hole, which may be more useful than the smaller leftover holes from a best-fit approach.'
    };

    function cloneData(data) {
        return JSON.parse(JSON.stringify(data));
    }

    function resetData() {
        console.log("RESET BUTTON CLICKED - Executing resetData()");
        console.log("STATE BEFORE RESET: blocks=" + blocks.length + ", isAllocated=" + isAllocated);
        blocks = cloneData(initialBlocks);
        processes = cloneData(initialProcesses);
        allocations = [];
        totalFragmentation = 0;
        totalExternalFragmentation = 0;
        isAllocated = false;
        console.log("STATE AFTER RESET: blocks=" + blocks.length + ", isAllocated=" + isAllocated);
    }

    function init() {
        resetData();
    }

    // Algorithms
    function allocateFirstFit() {
        let currentBlocks = cloneData(blocks);
        currentBlocks.forEach(b => b.isUsed = false);
        allocations = [];
        
        for (let i = 0; i < processes.length; i++) {
            let p = processes[i];
            let allocated = false;
            
            for (let j = 0; j < currentBlocks.length; j++) {
                if (!currentBlocks[j].isUsed && currentBlocks[j].size >= p.size) {
                    allocations.push({
                        processId: p.id,
                        processSize: p.size,
                        blockId: currentBlocks[j].id,
                        originalBlockSize: currentBlocks[j].size,
                        status: 'Allocated'
                    });
                    currentBlocks[j].isUsed = true;
                    allocated = true;
                    break;
                }
            }
            
            if (!allocated) {
                allocations.push({
                    processId: p.id,
                    processSize: p.size,
                    blockId: '-',
                    originalBlockSize: '-',
                    status: 'Not Allocated'
                });
            }
        }
        
        calculateFragmentation();
    }

    function allocateBestFit() {
        let currentBlocks = cloneData(blocks);
        currentBlocks.forEach(b => b.isUsed = false);
        allocations = [];
        
        for (let i = 0; i < processes.length; i++) {
            let p = processes[i];
            let bestIdx = -1;
            
            for (let j = 0; j < currentBlocks.length; j++) {
                if (!currentBlocks[j].isUsed && currentBlocks[j].size >= p.size) {
                    if (bestIdx === -1 || currentBlocks[j].size < currentBlocks[bestIdx].size) {
                        bestIdx = j;
                    }
                }
            }
            
            if (bestIdx !== -1) {
                allocations.push({
                    processId: p.id,
                    processSize: p.size,
                    blockId: currentBlocks[bestIdx].id,
                    originalBlockSize: currentBlocks[bestIdx].size,
                    status: 'Allocated'
                });
                currentBlocks[bestIdx].isUsed = true;
            } else {
                allocations.push({
                    processId: p.id,
                    processSize: p.size,
                    blockId: '-',
                    originalBlockSize: '-',
                    status: 'Not Allocated'
                });
            }
        }
        
        calculateFragmentation();
    }

    function allocateWorstFit() {
        let currentBlocks = cloneData(blocks);
        currentBlocks.forEach(b => b.isUsed = false);
        allocations = [];
        
        for (let i = 0; i < processes.length; i++) {
            let p = processes[i];
            let worstIdx = -1;
            
            for (let j = 0; j < currentBlocks.length; j++) {
                if (!currentBlocks[j].isUsed && currentBlocks[j].size >= p.size) {
                    if (worstIdx === -1 || currentBlocks[j].size > currentBlocks[worstIdx].size) {
                        worstIdx = j;
                    }
                }
            }
            
            if (worstIdx !== -1) {
                allocations.push({
                    processId: p.id,
                    processSize: p.size,
                    blockId: currentBlocks[worstIdx].id,
                    originalBlockSize: currentBlocks[worstIdx].size,
                    status: 'Allocated'
                });
                currentBlocks[worstIdx].isUsed = true;
            } else {
                allocations.push({
                    processId: p.id,
                    processSize: p.size,
                    blockId: '-',
                    originalBlockSize: '-',
                    status: 'Not Allocated'
                });
            }
        }
        
        calculateFragmentation();
    }

    function calculateFragmentation() {
        totalFragmentation = 0;
        totalExternalFragmentation = 0;
        allocations.forEach(a => {
            if (a.status === 'Allocated') {
                totalFragmentation += (a.originalBlockSize - a.processSize);
            }
        });
        
        const allocatedBlockIds = allocations
            .filter(a => a.status === 'Allocated')
            .map(a => a.blockId);
            
        blocks.forEach(b => {
            if (!allocatedBlockIds.includes(b.id)) {
                totalExternalFragmentation += b.size;
            }
        });
    }

    function runAllocation() {
        if (selectedAlgorithm === 'first-fit') {
            allocateFirstFit();
        } else if (selectedAlgorithm === 'best-fit') {
            allocateBestFit();
        } else if (selectedAlgorithm === 'worst-fit') {
            allocateWorstFit();
        }
        isAllocated = true;
        renderUI();
    }

    // UI Rendering
    function renderUI() {
        if (!mainContainer) return;
        
        mainContainer.innerHTML = '';
        
        const wrapper = document.createElement('div');
        wrapper.className = 'os-team05';
        
        wrapper.innerHTML = `
            <h2>Contiguous Memory / Process Allocation</h2>
            
            <div class="controls">
                <div class="control-group">
                    <label for="algo-select">Algorithm</label>
                    <select id="algo-select">
                        <option value="first-fit" ${selectedAlgorithm === 'first-fit' ? 'selected' : ''}>First Fit</option>
                        <option value="best-fit" ${selectedAlgorithm === 'best-fit' ? 'selected' : ''}>Best Fit</option>
                        <option value="worst-fit" ${selectedAlgorithm === 'worst-fit' ? 'selected' : ''}>Worst Fit</option>
                    </select>
                </div>
                <button type="button" id="allocate-btn">Allocate</button>
                <button type="button" id="reset-btn" class="reset-btn">Reset</button>
            </div>
            
            <div class="description" id="algo-description">
                ${descriptions[selectedAlgorithm]}
            </div>
            
            <div class="data-panels">
                <div class="panel">
                    <h3>Memory Blocks</h3>
                    <table id="blocks-table">
                        <tr>
                            <th>Block ID</th>
                            <th>Size (KB)</th>
                            <th>Action</th>
                        </tr>
                        ${blocks.map((b, idx) => `
                            <tr>
                                <td><input type="text" value="${b.id}" data-type="block" data-idx="${idx}" data-field="id" ${isAllocated ? 'disabled' : ''}></td>
                                <td><input type="number" min="1" value="${b.size}" data-type="block" data-idx="${idx}" data-field="size" ${isAllocated ? 'disabled' : ''}></td>
                                <td><button type="button" class="delete-btn" data-type="block" data-idx="${idx}" ${isAllocated ? 'disabled' : ''}>X</button></td>
                            </tr>
                        `).join('')}
                    </table>
                    ${!isAllocated ? `
                    <div class="add-row">
                        <button type="button" id="add-block-btn">+ Add Memory Block</button>
                    </div>` : ''}
                </div>
                
                <div class="panel">
                    <h3>Processes</h3>
                    <table id="processes-table">
                        <tr>
                            <th>Process ID</th>
                            <th>Size (KB)</th>
                            <th>Action</th>
                        </tr>
                        ${processes.map((p, idx) => `
                            <tr>
                                <td><input type="text" value="${p.id}" data-type="process" data-idx="${idx}" data-field="id" ${isAllocated ? 'disabled' : ''}></td>
                                <td><input type="number" min="1" value="${p.size}" data-type="process" data-idx="${idx}" data-field="size" ${isAllocated ? 'disabled' : ''}></td>
                                <td><button type="button" class="delete-btn" data-type="process" data-idx="${idx}" ${isAllocated ? 'disabled' : ''}>X</button></td>
                            </tr>
                        `).join('')}
                    </table>
                    ${!isAllocated ? `
                    <div class="add-row">
                        <button type="button" id="add-process-btn">+ Add Process</button>
                    </div>` : ''}
                </div>
            </div>
            
            ${isAllocated ? `
            <div class="visualization">
                <h3>Memory Allocation Diagram</h3>
                <div class="memory-blocks">
                    ${generateDiagramHTML()}
                </div>
            </div>
            
            <div class="results">
                <h3>Allocation Results</h3>
                <table>
                    <tr>
                        <th>Process</th>
                        <th>Process Size (KB)</th>
                        <th>Allocated Block</th>
                        <th>Block Size (KB)</th>
                        <th>Status</th>
                    </tr>
                    ${allocations.map(a => `
                        <tr>
                            <td>P${a.processId}</td>
                            <td>${a.processSize}</td>
                            <td>${a.blockId !== '-' ? 'Block ' + a.blockId : '-'}</td>
                            <td>${a.originalBlockSize !== '-' ? a.originalBlockSize : '-'}</td>
                            <td class="${a.status === 'Allocated' ? 'status-allocated' : 'status-not-allocated'}">${a.status}</td>
                        </tr>
                    `).join('')}
                </table>
            </div>
            
            <div class="metrics">
                <div class="metric-item">
                    <span>Internal Fragmentation:</span> <strong>${totalFragmentation} KB</strong>
                    <div class="metric-desc">Unused space inside allocated blocks</div>
                </div>
                <div class="metric-item">
                    <span>External Fragmentation:</span> <strong>${totalExternalFragmentation} KB</strong>
                    <div class="metric-desc">Total size of completely free blocks</div>
                </div>
            </div>
            ` : ''}
            
            <div class="educational-sections">
                <div class="learning-section">
                    <h3 class="collapsible-header">📚 Learn the Terminology <span>▼</span></h3>
                    <div class="term-grid collapsible-content" style="display: none;">
                        <div class="term-card">
                            <h4>Contiguous Memory Allocation</h4>
                            <p>A memory allocation technique in which a process is stored in one continuous block of memory.</p>
                        </div>
                        <div class="term-card">
                            <h4>Memory Block</h4>
                            <p>A fixed section of memory available for allocation.</p>
                        </div>
                        <div class="term-card">
                            <h4>Hole</h4>
                            <p>A free area of memory that is available for allocating a process.</p>
                        </div>
                        <div class="term-card">
                            <h4>First Fit</h4>
                            <p>Allocates a process to the first available memory block that is large enough.</p>
                        </div>
                        <div class="term-card">
                            <h4>Best Fit</h4>
                            <p>Allocates a process to the smallest available memory block that is large enough.</p>
                        </div>
                        <div class="term-card">
                            <h4>Worst Fit</h4>
                            <p>Allocates a process to the largest available memory block.</p>
                        </div>
                        <div class="term-card">
                            <h4>Internal Fragmentation</h4>
                            <p>Unused space inside a memory block that has already been allocated to a process.</p>
                        </div>
                        <div class="term-card">
                            <h4>External Fragmentation</h4>
                            <p>Free memory outside allocated blocks that is available as separate free areas.</p>
                        </div>
                        <div class="term-card">
                            <h4>Free Memory</h4>
                            <p>Memory that is currently not being used by any process.</p>
                        </div>
                        <div class="term-card">
                            <h4>Fragmentation</h4>
                            <p>Memory space that cannot be used by processes due to how it is divided.</p>
                        </div>
                    </div>
                </div>

                <div class="manual-solve">
                    <h3 class="collapsible-header">📝 How to Solve Manually <span>▼</span></h3>
                    <div class="collapsible-content" style="display: none;">
                        <p>Learn how to solve memory allocation problems using our default sample data.</p>
                        
                        <div class="solve-step">
                            <h4>STEP 1 — Write the memory blocks</h4>
                            <p>List all available memory blocks in their original order:</p>
                            <ul>
                                <li>B1 = 100 KB</li>
                                <li>B2 = 500 KB</li>
                                <li>B3 = 200 KB</li>
                                <li>B4 = 300 KB</li>
                                <li>B5 = 600 KB</li>
                            </ul>
                        </div>

                        <div class="solve-step">
                            <h4>STEP 2 — Write the processes</h4>
                            <p>List the processes to be allocated in order:</p>
                            <ul>
                                <li>P1 = 212 KB</li>
                                <li>P2 = 417 KB</li>
                                <li>P3 = 112 KB</li>
                                <li>P4 = 426 KB</li>
                            </ul>
                        </div>

                        <div class="solve-step">
                            <h4>STEP 3 — Apply the selected algorithm</h4>
                            <p><strong>First Fit:</strong> Start checking from the first block every time and select the FIRST suitable block.</p>
                            <p><strong>Best Fit:</strong> Check all available blocks and select the SMALLEST block that can accommodate the process.</p>
                            <p><strong>Worst Fit:</strong> Check all available blocks and select the LARGEST block that can accommodate the process.</p>
                        </div>

                        <div class="solve-step">
                            <h4>STEP 4 — Calculate internal fragmentation</h4>
                            <p>Formula: <code>Internal Fragmentation = Block Size - Process Size</code></p>
                            <p>Example: If P1 (212 KB) is put in a 500 KB block:<br>
                            <code>500 - 212 = 288 KB</code><br>
                            Explain that this leftover is INSIDE the allocated block.</p>
                        </div>

                        <div class="solve-step">
                            <h4>STEP 5 — Calculate external fragmentation</h4>
                            <p>Formula: <code>External Fragmentation = Sum of sizes of completely free blocks</code></p>
                            <p>Example: If blocks B1 (100 KB) and B3 (200 KB) are completely empty after all allocations:<br>
                            <code>100 + 200 = 300 KB</code><br>
                            Explain that these are free spaces OUTSIDE allocated blocks.</p>
                        </div>

                        <div class="solve-step">
                            <h4>STEP 6 — Identify unallocated processes</h4>
                            <p>If no suitable block is available: <strong>Process → Not Allocated</strong><br>
                            Explain that this means none of the currently available blocks is large enough for that process.</p>
                        </div>

                        <div class="worked-results">
                            <div class="result-box">
                                <h5>FIRST FIT:</h5>
                                <ul>
                                    <li>P1 → B2</li>
                                    <li>P2 → B5</li>
                                    <li>P3 → B3</li>
                                    <li>P4 → Not Allocated</li>
                                </ul>
                                <p><strong>Internal fragmentation:</strong><br>
                                P1: 500 - 212 = 288 KB<br>
                                P2: 600 - 417 = 183 KB<br>
                                P3: 200 - 112 = 88 KB<br>
                                Total Internal Fragmentation = 559 KB</p>
                                <p><strong>External fragmentation:</strong><br>
                                Total External Fragmentation = 400 KB</p>
                            </div>
                            
                            <div class="result-box">
                                <h5>BEST FIT:</h5>
                                <ul>
                                    <li>P1 → B4</li>
                                    <li>P2 → B2</li>
                                    <li>P3 → B3</li>
                                    <li>P4 → B5</li>
                                </ul>
                                <p><strong>Internal fragmentation:</strong><br>
                                P1: 300 - 212 = 88 KB<br>
                                P2: 500 - 417 = 83 KB<br>
                                P3: 200 - 112 = 88 KB<br>
                                P4: 600 - 426 = 174 KB<br>
                                Total Internal Fragmentation = 433 KB</p>
                                <p><strong>External fragmentation:</strong><br>
                                Total External Fragmentation = 100 KB</p>
                            </div>
                            
                            <div class="result-box">
                                <h5>WORST FIT:</h5>
                                <ul>
                                    <li>P1 → B5</li>
                                    <li>P2 → B2</li>
                                    <li>P3 → B4</li>
                                    <li>P4 → Not Allocated</li>
                                </ul>
                                <p><strong>Internal fragmentation:</strong><br>
                                P1: 600 - 212 = 388 KB<br>
                                P2: 500 - 417 = 83 KB<br>
                                P3: 300 - 112 = 188 KB<br>
                                Total Internal Fragmentation = 659 KB</p>
                                <p><strong>External fragmentation:</strong><br>
                                Total External Fragmentation = 300 KB</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        mainContainer.appendChild(wrapper);
        attachEvents(wrapper);
    }

    function generateDiagramHTML() {
        if (blocks.length === 0) return '<p>No memory blocks available.</p>';
        
        const maxSize = Math.max(...blocks.map(b => b.size), 100);
        let html = '';
        
        blocks.forEach(block => {
            // Under fixed partitioning, a block holds at most one process.
            const blockAllocation = allocations.find(a => a.blockId === block.id);
            let segmentsHtml = '';
            
            if (blockAllocation) {
                const heightPct = (blockAllocation.processSize / block.size) * 100;
                segmentsHtml += `<div class="allocated-segment" style="height: ${heightPct}%;" title="P${blockAllocation.processId} (${blockAllocation.processSize} KB)">P${blockAllocation.processId}</div>`;
                
                const internalFrag = block.size - blockAllocation.processSize;
                if (internalFrag > 0) {
                    const fragHeightPct = (internalFrag / block.size) * 100;
                    segmentsHtml += `<div class="free-segment" style="height: ${fragHeightPct}%; color: #dc2626;" title="Internal Fragmentation (${internalFrag} KB)">${internalFrag} KB Waste</div>`;
                }
            } else {
                segmentsHtml += `<div class="free-segment" style="height: 100%;" title="Free (${block.size} KB)">Free</div>`;
            }
            
            // Adjust visual height representation relative to the largest block (max height ~ 350px)
            const pixelHeight = Math.max((block.size / maxSize) * 350, 120);
            
            html += `
                <div class="memory-block" style="height: ${pixelHeight}px;">
                    <div class="block-header" title="Block ${block.id} (${block.size} KB)">Block ${block.id}<br>${block.size}K</div>
                    <div class="block-body">
                        ${segmentsHtml}
                    </div>
                </div>
            `;
        });
        
        return html;
    }

    function attachEvents(wrapper) {
        // Use event delegation for all button clicks to avoid attaching listeners to elements that get replaced
        wrapper.addEventListener('click', (e) => {
            const collapsibleHeader = e.target.closest('.collapsible-header');
            if (collapsibleHeader) {
                const content = collapsibleHeader.nextElementSibling;
                const icon = collapsibleHeader.querySelector('span');
                if (content.style.display === 'none') {
                    content.style.display = content.classList.contains('term-grid') ? 'grid' : 'block';
                    icon.textContent = '▲';
                } else {
                    content.style.display = 'none';
                    icon.textContent = '▼';
                }
                return;
            }

            if (e.target.id === 'allocate-btn') {
                e.preventDefault();
                runAllocation();
            } else if (e.target.id === 'reset-btn') {
                e.preventDefault();
                resetData();
                renderUI();
                console.log("UI re-rendered after reset.");
            } else if (e.target.id === 'add-block-btn') {
                e.preventDefault();
                const nextId = blocks.length > 0 ? Math.max(...blocks.map(b => parseInt(b.id) || 0)) + 1 : 1;
                blocks.push({ id: nextId.toString(), size: 100 });
                renderUI();
            } else if (e.target.id === 'add-process-btn') {
                e.preventDefault();
                const nextId = processes.length > 0 ? Math.max(...processes.map(p => parseInt(p.id) || 0)) + 1 : 1;
                processes.push({ id: nextId.toString(), size: 100 });
                renderUI();
            } else if (e.target.classList.contains('delete-btn')) {
                e.preventDefault();
                const type = e.target.getAttribute('data-type');
                const idx = parseInt(e.target.getAttribute('data-idx'));
                if (type === 'block') blocks.splice(idx, 1);
                else if (type === 'process') processes.splice(idx, 1);
                renderUI();
            }
        });

        // Algorithm Select
        const algoSelect = wrapper.querySelector('#algo-select');
        if (algoSelect) {
            algoSelect.addEventListener('change', (e) => {
                selectedAlgorithm = e.target.value;
                const desc = wrapper.querySelector('#algo-description');
                if (desc) desc.innerHTML = descriptions[selectedAlgorithm];
                if (isAllocated) {
                    runAllocation();
                }
            });
        }
        
        if (!isAllocated) {
            // Edit inputs
            wrapper.querySelectorAll('input[data-type]').forEach(input => {
                input.addEventListener('change', (e) => {
                    const type = e.target.getAttribute('data-type');
                    const idx = parseInt(e.target.getAttribute('data-idx'));
                    const field = e.target.getAttribute('data-field');
                    
                    if (type === 'block') {
                        blocks[idx][field] = field === 'size' ? Math.max(1, parseInt(e.target.value) || 1) : e.target.value;
                    } else if (type === 'process') {
                        processes[idx][field] = field === 'size' ? Math.max(1, parseInt(e.target.value) || 1) : e.target.value;
                    }
                    if (field === 'size') {
                         e.target.value = type === 'block' ? blocks[idx][field] : processes[idx][field];
                    }
                });
            });
        }
    }

    // Public API for dashboard framework
    return {
        title: "Contiguous Memory / Process Allocation",
        render: function(container) {
            mainContainer = container;
            if (blocks.length === 0) {
                init();
            }
            renderUI();
        },
        reset: function() {
            init();
            if (mainContainer) {
                renderUI();
            }
        },
        getMetrics: function() {
            return {
                primaryMetricLabel: "Total Internal Fragmentation",
                primaryMetricValue: totalFragmentation,
                unit: "KB"
            };
        }
    };
})();
