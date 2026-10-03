(function() {
  class Semaphore {
    constructor(value) {
      this.value = value;
      this.queue = [];
    }
    
    async wait() {
      if (this.value > 0) {
        this.value--;
        return Promise.resolve();
      } else {
        return new Promise(resolve => {
          this.queue.push(resolve);
        });
      }
    }
    
    signal() {
      if (this.queue.length > 0) {
        const resolve = this.queue.shift();
        resolve();
      } else {
        this.value++;
      }
    }
    
    reset(val) {
      this.value = val;
      this.queue.forEach(res => res());
      this.queue = [];
    }
  }
  
  let state = {
    isRunning: false,
    runEpoch: 0,
    bufferSize: 8,
    buffer: new Array(8).fill(false),
    head: 0,
    tail: 0,
    empty: new Semaphore(8),
    full: new Semaphore(0),
    mutex: new Semaphore(1),
    prodSpeed: 1200,
    consSpeed: 1800,
    prodState: 'IDLE',
    consState: 'IDLE',
    uiElements: {}
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  async function blockIfPaused(epoch) {
    while (!state.isRunning && state.runEpoch === epoch) {
      await sleep(100);
    }
    return state.runEpoch === epoch;
  }

  async function producerLoop() {
    while (true) {
      while (!state.isRunning) await sleep(100);
      let epoch = state.runEpoch;

      updateState('prod', 'PRODUCING');
      await sleep(state.prodSpeed);
      if (state.runEpoch !== epoch) continue;
      
      if (!(await blockIfPaused(epoch))) continue;
      updateState('prod', 'WAIT(EMPTY)');
      await state.empty.wait();
      if (state.runEpoch !== epoch) continue;
      
      if (!(await blockIfPaused(epoch))) continue;
      updateState('prod', 'WAIT(MUTEX)');
      await state.mutex.wait();
      if (state.runEpoch !== epoch) continue;
      
      if (!(await blockIfPaused(epoch))) continue;
      updateState('prod', 'CRITICAL');
      updateMutexLock('prod');
      
      await sleep(400); 
      if (state.runEpoch !== epoch) continue;
      
      state.buffer[state.head] = true;
      state.head = (state.head + 1) % state.bufferSize;
      renderBuffer();
      
      state.mutex.signal();
      state.full.signal();
      updateMutexLock('none');
      updateGauges();
    }
  }

  async function consumerLoop() {
    while (true) {
      while (!state.isRunning) await sleep(100);
      let epoch = state.runEpoch;

      updateState('cons', 'IDLE');
      
      if (!(await blockIfPaused(epoch))) continue;
      updateState('cons', 'WAIT(FULL)');
      await state.full.wait();
      if (state.runEpoch !== epoch) continue;
      
      if (!(await blockIfPaused(epoch))) continue;
      updateState('cons', 'WAIT(MUTEX)');
      await state.mutex.wait();
      if (state.runEpoch !== epoch) continue;
      
      if (!(await blockIfPaused(epoch))) continue;
      updateState('cons', 'CRITICAL');
      updateMutexLock('cons');
      
      await sleep(400); 
      if (state.runEpoch !== epoch) continue;
      
      state.buffer[state.tail] = false;
      state.tail = (state.tail + 1) % state.bufferSize;
      renderBuffer();
      
      state.mutex.signal();
      state.empty.signal();
      updateMutexLock('none');
      updateGauges();
      
      if (!(await blockIfPaused(epoch))) continue;
      updateState('cons', 'CONSUMING');
      await sleep(state.consSpeed);
      if (state.runEpoch !== epoch) continue;
    }
  }

  function updateState(process, status) {
    if (process === 'prod') state.prodState = status;
    else state.consState = status;
    
    if (state.uiElements[process + 'State']) {
      const el = state.uiElements[process + 'State'];
      el.textContent = status;
      el.className = 'process-state ' + 
        (status.indexOf('WAIT') !== -1 ? 'blocked' : (status === 'CRITICAL' ? 'active' : ''));
    }
    
    if (state.prodState === 'WAIT(MUTEX)' && state.consState === 'CRITICAL' ||
        state.consState === 'WAIT(MUTEX)' && state.prodState === 'CRITICAL') {
      if (state.uiElements.lock) state.uiElements.lock.classList.add('contention');
    } else {
      if (state.uiElements.lock) state.uiElements.lock.classList.remove('contention');
    }
  }

  function updateMutexLock(holder) {
    if (!state.uiElements.lock) return;
    state.uiElements.lock.className = 'carousel-lock';
    if (holder === 'prod') state.uiElements.lock.classList.add('locked-prod');
    if (holder === 'cons') state.uiElements.lock.classList.add('locked-cons');
  }

  function updateGauges() {
    if (state.uiElements.emptyVal) {
      state.uiElements.emptyVal.textContent = state.empty.value;
      state.uiElements.emptyVal.className = 'gauge-value' + (state.empty.value === 0 ? ' critical' : '');
    }
    if (state.uiElements.fullVal) {
      state.uiElements.fullVal.textContent = state.full.value;
      state.uiElements.fullVal.className = 'gauge-value' + (state.full.value === 0 ? ' critical' : '');
    }
    if (state.uiElements.mutexVal) {
      state.uiElements.mutexVal.textContent = state.mutex.value;
      state.uiElements.mutexVal.className = 'gauge-value' + (state.mutex.value === 0 ? ' critical' : '');
    }
  }

  function renderBuffer() {
    if (!state.uiElements.slots) return;
    state.buffer.forEach((isFilled, i) => {
      if (state.uiElements.slots[i]) {
        state.uiElements.slots[i].className = 'slot' + (isFilled ? ' filled' : '');
      }
    });
  }

  function rebuildSlots(newSize) {
    state.bufferSize = newSize;
    state.buffer = new Array(newSize).fill(false);
    state.head = 0;
    state.tail = 0;
    
    state.empty.reset(newSize);
    state.full.reset(0);
    state.mutex.reset(1);
    
    const carousel = state.uiElements.carousel;
    
    carousel.innerHTML = '<div class="carousel-rotor" id="os-team07-rotor"></div><div class="carousel-lock" id="os-team07-lock">MUX</div>';
    
    const rotor = carousel.querySelector('#os-team07-rotor');
    state.uiElements.lock = carousel.querySelector('#os-team07-lock');
    
    state.uiElements.slots = [];
    
    let radius = 100;
    if (newSize > 10) radius = 110;
    if (newSize > 14) radius = 130;
    if (newSize > 18) radius = 150;
    
    const containerSize = (radius * 2) + 80;
    carousel.style.width = containerSize + 'px';
    carousel.style.height = containerSize + 'px';
    
    for (let i = 0; i < newSize; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      const angle = (i * (360 / newSize));
      slot.style.transform = "rotate(" + angle + "deg) translate(" + radius + "px) rotate(-" + angle + "deg)";
      rotor.appendChild(slot);
      state.uiElements.slots.push(slot);
    }
    
    renderBuffer();
    updateGauges();
    updateMutexLock('none');
  }

  function setupUI(container) {
    container.innerHTML = 
      '<div class="os-team07">' +
        '<div class="header">' +
          '<div class="title-section">' +
            '<h2>Producer-Consumer Lock Sequence</h2>' +
          '</div>' +
          '<div class="controls">' +
            '<button class="btn" id="os-team07-start">START</button>' +
            '<button class="btn d-none" id="os-team07-stop">STOP</button>' +
            '<div class="speed-control">' +
              '<label>SLOTS</label>' +
              '<input type="number" id="os-team07-bsize" min="1" max="20" value="' + state.bufferSize + '">' +
            '</div>' +
            '<div class="speed-control">' +
              '<label>PROD SPEED (<span id="os-team07-pspeed-val">' + state.prodSpeed + '</span>ms)</label>' +
              '<input type="range" id="os-team07-pspeed" min="500" max="3000" step="100" value="' + state.prodSpeed + '">' +
            '</div>' +
            '<div class="speed-control">' +
              '<label>CONS SPEED (<span id="os-team07-cspeed-val">' + state.consSpeed + '</span>ms)</label>' +
              '<input type="range" id="os-team07-cspeed" min="500" max="3000" step="100" value="' + state.consSpeed + '">' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="dashboard-content">' +
          '<div class="sim-section">' +
            '<div class="workspace">' +
              '<div class="process-station">' +
                '<div class="process-label">Producer Arm</div>' +
                '<div class="process-state" id="os-team07-pstate">IDLE</div>' +
              '</div>' +
              '<div class="carousel-container" id="os-team07-carousel">' +
              '</div>' +
              '<div class="process-station">' +
                '<div class="process-label">Extractor Arm</div>' +
                '<div class="process-state" id="os-team07-cstate">IDLE</div>' +
              '</div>' +
            '</div>' +
            '<div class="gauges">' +
              '<div class="gauge">' +
                '<div class="gauge-label">Empty (Slots)</div>' +
                '<div class="gauge-value" id="os-team07-val-empty">' + state.bufferSize + '</div>' +
              '</div>' +
              '<div class="gauge">' +
                '<div class="gauge-label">Mutex (Lock)</div>' +
                '<div class="gauge-value" id="os-team07-val-mutex">1</div>' +
              '</div>' +
              '<div class="gauge">' +
                '<div class="gauge-label">Full (Items)</div>' +
                '<div class="gauge-value" id="os-team07-val-full">0</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="docs-section">' +
            '<h3>The Producer-Consumer Problem</h3>' +
            '<p>This module visualizes one of the most famous synchronization challenges in computer science: <strong>The Producer-Consumer Problem</strong>.</p>' +
            '<h4>What is happening?</h4>' +
            '<p>Imagine a factory where one robotic arm (the <strong>Producer</strong>) builds items and places them onto a circular conveyor belt. Another robotic arm (the <strong>Consumer</strong>) takes those items off the belt to pack them.</p>' +
            '<p>Because they work at different speeds, they need strict rules to communicate so they don\'t crash, overfill the belt, or take an item from an empty slot. We solve this using <strong>Semaphores</strong> (smart counters) and a <strong>Mutex</strong> (a lock).</p>' +
            '<h4>The Lock Sequence</h4>' +
            '<ul>' +
              '<li><strong>Mutex (The Lock):</strong> There is only one physical key to the carousel. To touch the belt, an arm must grab the Mutex (changing it to 0). If it\'s 0, the other arm must wait (<strong style="color:var(--theme-orange)">orange</strong>). This prevents mid-air collisions!</li>' +
              '<li><strong>Empty Semaphore:</strong> Counts empty slots left. If 0, the Producer sleeps until the Consumer removes something.</li>' +
              '<li><strong>Full Semaphore:</strong> Counts items ready. If 0, the Consumer sleeps until the Producer builds something.</li>' +
            '</ul>' +
            '<h4>Process States</h4>' +
            '<ul>' +
              '<li><strong>IDLE:</strong> The arm is currently inactive or waiting to start.</li>' +
              '<li><strong>PRODUCING / CONSUMING:</strong> The arm is doing its own local work away from the shared belt.</li>' +
              '<li><strong>WAIT(...):</strong> The arm is blocked and waiting for a lock or space. It turns <strong style="color:var(--theme-orange)">orange</strong>.</li>' +
              '<li><strong>CRITICAL:</strong> The arm has successfully grabbed the Mutex lock and is actively modifying the carousel.</li>' +
            '</ul>' +
            '<h4>Behind the Scenes: The Code</h4>' +
            '<div class="code-container">' +
              '<div class="code-block">' +
                '<strong style="color:#0d9488;">// PRODUCER</strong><br>' +
                'while (true) {<br>' +
                '&nbsp;&nbsp;item = produceItem();<br>' +
                '&nbsp;&nbsp;<span style="color:#a1a1aa;">// Wait for space</span><br>' +
                '&nbsp;&nbsp;<span style="color:#ea580c;">wait</span>(empty);<br>' +
                '&nbsp;&nbsp;<span style="color:#a1a1aa;">// Grab lock</span><br>' +
                '&nbsp;&nbsp;<span style="color:#ea580c;">wait</span>(mutex);<br>' +
                '<br>' +
                '&nbsp;&nbsp;putItem(item);<br>' +
                '<br>' +
                '&nbsp;&nbsp;<span style="color:#a1a1aa;">// Release lock</span><br>' +
                '&nbsp;&nbsp;<span style="color:#10b981;">signal</span>(mutex);<br>' +
                '&nbsp;&nbsp;<span style="color:#10b981;">signal</span>(full);<br>' +
                '}' +
              '</div>' +
              '<div class="code-block">' +
                '<strong style="color:#0d9488;">// CONSUMER</strong><br>' +
                'while (true) {<br>' +
                '&nbsp;&nbsp;<span style="color:#a1a1aa;">// Wait for item</span><br>' +
                '&nbsp;&nbsp;<span style="color:#ea580c;">wait</span>(full);<br>' +
                '&nbsp;&nbsp;<span style="color:#a1a1aa;">// Grab lock</span><br>' +
                '&nbsp;&nbsp;<span style="color:#ea580c;">wait</span>(mutex);<br>' +
                '<br>' +
                '&nbsp;&nbsp;item = takeItem();<br>' +
                '<br>' +
                '&nbsp;&nbsp;<span style="color:#a1a1aa;">// Release lock</span><br>' +
                '&nbsp;&nbsp;<span style="color:#10b981;">signal</span>(mutex);<br>' +
                '&nbsp;&nbsp;<span style="color:#10b981;">signal</span>(empty);<br>' +
                '<br>' +
                '&nbsp;&nbsp;consumeItem(item);<br>' +
                '}' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    state.uiElements.prodState = container.querySelector('#os-team07-pstate');
    state.uiElements.consState = container.querySelector('#os-team07-cstate');
    state.uiElements.emptyVal = container.querySelector('#os-team07-val-empty');
    state.uiElements.mutexVal = container.querySelector('#os-team07-val-mutex');
    state.uiElements.fullVal = container.querySelector('#os-team07-val-full');
    state.uiElements.carousel = container.querySelector('#os-team07-carousel');
    state.uiElements.bsizeInput = container.querySelector('#os-team07-bsize');
    
    rebuildSlots(state.bufferSize);
    
    const startBtn = container.querySelector('#os-team07-start');
    const stopBtn = container.querySelector('#os-team07-stop');

    startBtn.addEventListener('click', () => {
      state.isRunning = !state.isRunning;
      startBtn.textContent = state.isRunning ? 'PAUSE' : 'START';
      startBtn.className = 'btn' + (state.isRunning ? ' active' : '');
      
      if (stopBtn) stopBtn.classList.remove('d-none');
      
      if (state.isRunning) {
        state.uiElements.carousel.classList.add('is-spinning');
      } else {
        state.uiElements.carousel.classList.remove('is-spinning');
      }
    });
    
    stopBtn.addEventListener('click', () => {
      window.OSDashboard.modules["team07_prod_cons"].reset(true);
    });

    state.uiElements.bsizeInput.addEventListener('change', (e) => {
      let size = parseInt(e.target.value, 10);
      if (isNaN(size) || size < 1) size = 1;
      if (size > 20) size = 20;
      e.target.value = size;
      
      state.bufferSize = size;
      window.OSDashboard.modules["team07_prod_cons"].reset(true);
    });

    const pSpeedVal = container.querySelector('#os-team07-pspeed-val');
    const cSpeedVal = container.querySelector('#os-team07-cspeed-val');

    container.querySelector('#os-team07-pspeed').addEventListener('input', (e) => {
      state.prodSpeed = parseInt(e.target.value, 10);
      pSpeedVal.textContent = state.prodSpeed;
    });
    container.querySelector('#os-team07-cspeed').addEventListener('input', (e) => {
      state.consSpeed = parseInt(e.target.value, 10);
      cSpeedVal.textContent = state.consSpeed;
    });
  }

  producerLoop();
  consumerLoop();

  window.OSDashboard = window.OSDashboard || { modules: {} };
  window.OSDashboard.modules["team07_prod_cons"] = {
    title: "", 
    
    render: function(container) {
      setupUI(container);
    },
    
    reset: function(keepConfig = false) {
      state.isRunning = false;
      state.runEpoch++;
      
      if (!keepConfig) {
        state.bufferSize = 8;
        state.prodSpeed = 1200;
        state.consSpeed = 1800;
        
        if (state.uiElements.bsizeInput) state.uiElements.bsizeInput.value = 8;
        const pInput = document.getElementById('os-team07-pspeed');
        const cInput = document.getElementById('os-team07-cspeed');
        if (pInput) { pInput.value = 1200; document.getElementById('os-team07-pspeed-val').textContent = 1200; }
        if (cInput) { cInput.value = 1800; document.getElementById('os-team07-cspeed-val').textContent = 1800; }
      }
      
      if (state.uiElements.prodState) {
        rebuildSlots(state.bufferSize);
        updateState('prod', 'IDLE');
        updateState('cons', 'IDLE');
        
        const startBtn = document.getElementById('os-team07-start');
        if (startBtn) {
          startBtn.textContent = 'START';
          startBtn.className = 'btn';
        }
        
        const stopBtn = document.getElementById('os-team07-stop');
        if (stopBtn) {
          stopBtn.classList.add('d-none');
        }

        const carousel = document.getElementById('os-team07-carousel');
        if (carousel) {
          carousel.classList.remove('is-spinning');
        }
      }
    },
    
    getMetrics: function() {
      let fullCount = state.buffer.filter(v => v).length;
      return {
        primaryMetricLabel: "Buffer Utilization",
        primaryMetricValue: (fullCount / state.bufferSize) * 100,
        unit: "%"
      };
    }
  };
})();
