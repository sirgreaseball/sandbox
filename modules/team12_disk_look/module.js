(function () {
  'use strict';

  window.OSDashboard = window.OSDashboard || { modules: {} };
  window.OSDashboard.modules = window.OSDashboard.modules || {};

  var defaults = {
    algorithm: 'LOOK',
    head: '',
    max: '',
    direction: 'right',
    requests: []
  };

  var state = Object.assign({}, defaults, {
    requests: defaults.requests.slice(),
    step: 0,
    animating: false
  });

  var host = null;
  var timer = null;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function safeNumber(value, fallback, min, max) {
    if (value === '' || value === null || value === undefined) {
      return fallback;
    }
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    return clamp(Math.round(numeric), min, max);
  }

  function displayNumber(value) {
    return value === '' || value === null || value === undefined ? '' : value;
  }

  function parseRequests(rawText, maxCylinder) {
    if (!String(rawText).trim()) {
      return [];
    }

    var filled = [];
    String(rawText).split(',').forEach(function (part) {
      var numeric = Number(part.trim());
      if (Number.isFinite(numeric)) {
        filled.push(clamp(Math.round(numeric), 0, maxCylinder));
      }
    });

    return Array.from(new Set(filled));
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      var map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return map[character] || character;
    });
  }

  function sanitizeState() {
    if (state.max === '' || state.max === null || state.max === undefined) {
      state.max = '';
    } else if (!Number.isFinite(Number(state.max)) || Number(state.max) < 1) {
      state.max = '';
    } else {
      state.max = Math.round(Number(state.max));
    }

    if (state.head === '' || state.head === null || state.head === undefined) {
      state.head = '';
    } else if (!Number.isFinite(Number(state.head))) {
      state.head = '';
    } else if (state.max !== '') {
      state.head = safeNumber(state.head, '', 0, state.max);
    }

    if (state.max !== '') {
      state.requests = parseRequests(state.requests.join(', '), state.max);
    } else {
      state.requests = [];
    }

    if (state.algorithm !== 'LOOK' && state.algorithm !== 'C-LOOK') {
      state.algorithm = defaults.algorithm;
    }
    if (state.direction !== 'left' && state.direction !== 'right') {
      state.direction = defaults.direction;
    }
  }

  function stopAnimation() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    state.animating = false;
  }

  function buildServiceOrder() {
    sanitizeState();

    if (state.max === '' || state.head === '' || !state.requests.length) {
      return [];
    }

    var head = state.head;
    var lower = state.requests.filter(function (request) { return request < head; }).sort(function (a, b) { return a - b; });
    var upper = state.requests.filter(function (request) { return request > head; }).sort(function (a, b) { return a - b; });

    var order;
    if (state.algorithm === 'LOOK') {
      if (state.direction === 'right') {
        order = upper.concat(lower.slice().reverse());
      } else {
        order = lower.slice().reverse().concat(upper);
      }
    } else {
      if (state.direction === 'right') {
        order = upper.concat(lower);
      } else {
        order = lower.slice().reverse().concat(upper.slice().reverse());
      }
    }

    return order;
  }

  function schedule() {
    sanitizeState();

    if (state.max === '' || state.head === '') {
      return {
        order: [0],
        steps: [],
        total: 0,
        final: 0,
        requestCount: 0
      };
    }

    var head = state.head;
    var serviceOrder = buildServiceOrder();
    var steps = [];
    var current = head;
    var total = 0;

    serviceOrder.forEach(function (destination, index) {
      var previous = current;
      var movement = Math.abs(destination - previous);
      var wrap = false;

      if (state.algorithm === 'C-LOOK') {
        var lower = state.requests.filter(function (request) { return request < head; }).sort(function (a, b) { return a - b; });
        var upper = state.requests.filter(function (request) { return request > head; }).sort(function (a, b) { return a - b; });

        if (state.direction === 'right' && lower.length && upper.length && destination === lower[0]) {
          wrap = true;
        }
        if (state.direction === 'left' && lower.length && upper.length && destination === upper[upper.length - 1]) {
          wrap = true;
        }
      }

      total += movement;
      current = destination;
      steps.push({
        from: previous,
        to: destination,
        move: movement,
        cumulative: total,
        wrap: wrap
      });
    });

    return {
      order: [head].concat(serviceOrder),
      steps: steps,
      total: total,
      final: current,
      requestCount: serviceOrder.length
    };
  }

  function buildTrackSvg(result) {
    var width = 860;
    var height = 320;
    var pad = 56;
    var maxValue = Math.max(1, state.max);
    var xPos = function (value) {
      return pad + (value / maxValue) * (width - pad * 2);
    };

    var active = Math.min(state.step, result.steps.length);
    var ticks = [0, Math.round(maxValue / 4), Math.round(maxValue / 2), Math.round(maxValue * 3 / 4), maxValue];

    var labelRowRight = [-Infinity, -Infinity, -Infinity];
    var markerRequests = state.requests.slice().sort(function (a, b) { return a - b; });
    var markers = markerRequests.map(function (request) {
      var x = xPos(request);
      var labelHalfWidth = String(request).length * 4.2;
      var row = labelRowRight.findIndex(function (right) { return x - labelHalfWidth > right + 8; });
      if (row < 0) {
        row = labelRowRight.indexOf(Math.min.apply(Math, labelRowRight));
      }
      labelRowRight[row] = x + labelHalfWidth;
      return '<g class="request-marker"><line x1="' + x + '" y1="78" x2="' + x + '" y2="215"></line><circle cx="' + x + '" cy="78" r="7"></circle><text x="' + x + '" y="' + (28 + row * 17) + '">' + request + '</text></g>';
    }).join('');

    var segmentMarkup = result.steps.map(function (step, index) {
      var y1 = 175 - (index * 14);
      var y2 = 175 - ((index + 1) * 14);
      var className = 'path-segment' + (step.wrap ? ' wrap-segment' : '') + (index < active ? ' revealed' : '');
      var wrapLabel = step.wrap ? '<text class="wrap-label" x="' + ((xPos(step.from) + xPos(step.to)) / 2) + '" y="' + (Math.min(y1, y2) - 16) + '">WRAP</text>' : '';
      return '<g class="' + className + '"><path d="M ' + xPos(step.from) + ' ' + y1 + ' L ' + xPos(step.to) + ' ' + y2 + '"></path>' + wrapLabel + '</g>';
    }).join('');

    var currentX = active > 0 ? xPos(result.steps[active - 1].to) : xPos(state.head);
    var currentY = active > 0 ? (175 - (active * 14)) : 175;
    var reversalMarkup = '';
    if (state.algorithm === 'LOOK') {
      var previousDirection = 0;
      var reversalStep = -1;
      result.steps.some(function (step, index) {
        if (step.wrap) {
          return false;
        }
        var direction = step.to > step.from ? 1 : (step.to < step.from ? -1 : 0);
        if (direction && previousDirection && direction !== previousDirection) {
          reversalStep = index;
          return true;
        }
        if (direction) {
          previousDirection = direction;
        }
        return false;
      });
      if (reversalStep >= 0) {
        var reversalCylinder = result.steps[reversalStep].from;
        reversalMarkup = '<text class="graph-event-label reversal-label" x="' + xPos(reversalCylinder) + '" y="112">LOOK REVERSAL</text>';
      }
    }
    var finalStepIndex = result.steps.length - 1;
    var finalY = finalStepIndex >= 0 ? (175 - ((finalStepIndex + 1) * 14)) : 175;
    var finalMarkup = finalStepIndex >= 0
      ? '<text class="graph-event-label final-label" x="' + xPos(result.final) + '" y="' + Math.min(210, finalY + 25) + '">FINAL ' + result.final + '</text>'
      : '';

    return '<svg class="disk-svg" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Disk scheduling path for ' + state.algorithm + '">' +
      '<line class="axis" x1="' + pad + '" y1="230" x2="' + (width - pad) + '" y2="230"></line>' +
      markers +
      '<line class="head-line" x1="' + xPos(state.head) + '" y1="92" x2="' + xPos(state.head) + '" y2="230"></line>' +
      '<circle class="initial-head-marker" cx="' + xPos(state.head) + '" cy="78" r="8"></circle>' +
      '<text class="head-label initial-head-label" x="' + xPos(state.head) + '" y="112">HEAD</text>' +
      '<text class="head-label initial-start-label" x="' + xPos(state.head) + '" y="14">START ' + state.head + '</text>' +
      segmentMarkup +
      reversalMarkup + finalMarkup +
      '<g class="head-dot"><circle cx="' + currentX + '" cy="' + currentY + '" r="9"></circle></g>' +
      ticks.map(function (tick) {
        return '<g class="tick"><line x1="' + xPos(tick) + '" y1="220" x2="' + xPos(tick) + '" y2="236"></line><text x="' + xPos(tick) + '" y="258">' + tick + '</text></g>';
      }).join('') +
      '<text class="track-caption" x="' + pad + '" y="288">Cylinder track • ' + (state.algorithm === 'LOOK' ? 'LOOK reverses at the last pending request.' : 'C-LOOK wraps from the last request in this direction.') + '</text>' +
      '</svg>';
  }

  function renderState() {
    if (!host) {
      return;
    }

    var result = schedule();
    var statusText = state.max !== '' && state.head !== '' ? 'Ready to simulate' : 'Enter head and cylinder limit';
    if (state.animating) {
      statusText = 'Running step ' + Math.min(state.step + 1, result.steps.length) + ' of ' + result.steps.length;
    } else if (result.steps.length && state.step >= result.steps.length) {
      statusText = 'Animation complete';
    }

    var note = state.algorithm === 'LOOK'
      ? '<span class="note-pill">↔ LOOK reverses at the last request in that direction.</span>'
      : '<span class="note-pill wrap-note">↪ C-LOOK wraps from the last request to the next queued cylinder.</span>';

    host.innerHTML = '<section class="os-team12" aria-label="LOOK and C-LOOK disk scheduling dashboard">' +
      '<header class="module-header">' +
      '<div><h1>Disk Scheduling <span>— LOOK &amp; C-LOOK</span></h1><p>Animated head movement for the LOOK and C-LOOK scheduling policies.</p></div>' +
      '<div class="status" aria-live="polite"><span class="status-dot"></span>' + statusText + '</div>' +
      '</header>' +
      '<aside class="learn-card learn-inline"><div class="learn-header"><p class="eyebrow">DESCRIPTION</p><h2>LOOK vs C-LOOK</h2></div><p class="scan-note"><strong>What is seek time?</strong> Seek time is the time taken for a disk drive\'s read/write head to move to the cylinder containing the requested data. Moving the head across many cylinders takes longer, so reducing total head movement can reduce seek time and improve response time. The simulator reports movement in cylinders as a useful estimate; actual seek time also depends on the drive.</p><div class="compare"><div><h3>LOOK</h3><p><strong>How it works:</strong> It services requests in the chosen direction, then reverses at the last pending request in that direction instead of travelling to the disk boundary.<br><strong>Advantages:</strong> Avoids unnecessary travel to the disk boundary, reduces head movement for clustered requests, and balances performance with waiting time.<br><strong>Disadvantages:</strong> Direction changes can add movement, and requests may wait longer when they are far from the current sweep.</p></div><div><h3>C-LOOK</h3><p><strong>How it works:</strong> It services requests in one direction only. After the last request in that direction, it returns to the first pending request on the other side and continues in the same direction; the return is a wrap, not a service pass.<br><strong>Advantages:</strong> Provides more uniform service across cylinders, avoids travel to the physical boundary, and can perform well with busy queues.<br><strong>Disadvantages:</strong> The wrap still requires head movement, and requests just passed may wait until the next sweep.</p></div></div><p class="scan-note"><strong>Why disk scheduling algorithms?</strong> When several read/write requests are waiting, the operating system chooses their service order. LOOK and C-LOOK organize that order to limit unnecessary head movement while balancing throughput and waiting time. SCAN and C-SCAN travel to the physical boundary before reversing or wrapping, while LOOK and C-LOOK stop at the last pending request.</p></aside>' +
      '<section class="control-card" aria-label="Simulation controls">' +
      '<div class="control-grid">' +
      '<label>Algorithm<select data-field="algorithm"><option value="LOOK"' + (state.algorithm === 'LOOK' ? ' selected' : '') + '>LOOK</option><option value="C-LOOK"' + (state.algorithm === 'C-LOOK' ? ' selected' : '') + '>C-LOOK</option></select></label>' +
      '<label>Initial head position<input data-field="head" type="number" min="0" max="' + (state.max || '') + '" value="' + displayNumber(state.head) + '"></label>' +
      '<label>Maximum cylinder<input data-field="max" type="number" min="1" value="' + displayNumber(state.max) + '"></label>' +
      '<label>Direction<select data-field="direction"><option value="right"' + (state.direction === 'right' ? ' selected' : '') + '>Right →</option><option value="left"' + (state.direction === 'left' ? ' selected' : '') + '>Left ←</option></select></label>' +
      '<label class="queue-control">Request queue<input data-field="requests" type="text" value="' + escapeHtml(state.requests.join(', ')) + '" aria-describedby="queue-help"></label>' +
      '</div>' +
      '<p class="help" id="queue-help">Comma-separated cylinders. Values are rounded and clamped to 0–' + (state.max || 0) + '.</p>' +
      '<div class="button-row">' +
      '<button class="run-button" data-action="run" type="button">▶ Run animation</button>' +
      '<button class="reset-button" data-action="reset" type="button">↺ Reset sample</button>' +
      '<span class="direction-readout">Moving <strong>' + (state.direction === 'right' ? 'rightward →' : 'leftward ←') + '</strong></span>' +
      '</div>' +
      '</section>' +
      '<section class="metric-grid">' +
      '<article class="metric primary"><span>Total Head Movement</span><strong>' + result.total + '</strong><small>cylinders</small></article>' +
      '<article class="metric order"><span>Service Order</span><strong>' + result.order.join(' → ') + '</strong><small>' + state.algorithm + ' • ' + result.requestCount + ' request' + (result.requestCount === 1 ? '' : 's') + '</small></article>' +
      '<article class="metric"><span>Final Head Position</span><strong>' + result.final + '</strong><small>cylinder</small></article>' +
      '</section>' +
      '<section class="visual-card">' +
      '<div class="section-title"><div><p class="eyebrow">LIVE PATH</p><h2>' + state.algorithm + ' disk head movement</h2></div><div>' + note + '</div></div>' +
      '<div class="track-scroll">' + buildTrackSvg(result) + '</div>' +
      '<div class="legend"><span><i class="legend-request"></i>Request</span><span><i class="legend-head"></i>Start head</span><span><i class="legend-path"></i>Service path</span><span><i class="legend-wrap"></i>Wrap</span></div>' +
      '</section>' +
      '<section class="lower-grid">' +
      '<section class="table-card">' +
      '<div class="section-title"><div><p class="eyebrow">STEP TRACE</p><h2>Movement table</h2></div><span class="progress">' + state.step + ' / ' + result.steps.length + ' revealed</span></div>' +
      '<div class="table-scroll"><table><thead><tr><th>Step</th><th>From</th><th>To</th><th>Movement</th><th>Cumulative</th></tr></thead><tbody>' +
      (result.steps.length ? result.steps.map(function (step, index) {
        var rowClass = index === state.step - 1 ? 'current' : '';
        if (index < state.step) {
          rowClass += ' done';
        }
        var label = step.wrap ? '<span class="wrap-badge">WRAP</span> ' : '';
        return '<tr class="' + rowClass.trim() + '"><td>' + label + (index + 1) + '</td><td>' + step.from + '</td><td>' + step.to + '</td><td>' + step.move + '</td><td>' + step.cumulative + '</td></tr>';
      }).join('') : '<tr><td colspan="5" class="empty">No valid requests available.</td></tr>') +
      '</tbody></table></div>' +
      '</section>' +
      '</section>' +
      '</section>';

    host.querySelectorAll('[data-field]').forEach(function (field) {
      field.onchange = function (event) {
        handleFieldInput(event.target, true);
      };
      field.oninput = function (event) {
        var fieldName = event.target.getAttribute('data-field');
        if (fieldName === 'requests') {
          handleFieldInput(event.target, false);
          return;
        }
        handleFieldInput(event.target, false);
      };
    });

    var runButton = host.querySelector('[data-action="run"]');
    var resetButton = host.querySelector('[data-action="reset"]');
    if (runButton) {
      runButton.onclick = runAnimation;
    }
    if (resetButton) {
      resetButton.onclick = reset;
    }
  }

  function handleFieldInput(target, shouldRender) {
    stopAnimation();
    var fieldName = target.getAttribute('data-field');
    var renderAfterUpdate = shouldRender !== false;

    if (fieldName === 'algorithm') {
      state.algorithm = target.value;
    }
    if (fieldName === 'direction') {
      state.direction = target.value;
    }
    if (fieldName === 'head') {
      if (target.value === '') {
        state.head = '';
      } else if (state.max !== '') {
        state.head = safeNumber(target.value, state.head, 0, state.max);
      } else {
        state.head = Number(target.value) || '';
      }
    }
    if (fieldName === 'max') {
      if (target.value === '') {
        state.max = '';
        state.head = '';
        state.requests = [];
      } else {
        state.max = safeNumber(target.value, defaults.max, 1, 100000);
        // While the user is still typing a multi-digit cylinder limit, keep the
        // current head value. Clamp it only once the field is committed; otherwise
        // typing a limit such as 199 briefly clamps the head to 1.
        if (state.head !== '' && renderAfterUpdate) {
          state.head = clamp(Number(state.head) || 0, 0, state.max);
        }
        state.requests = state.requests.map(function (request) { return clamp(request, 0, state.max); });
      }
    }
    if (fieldName === 'requests') {
      state.requests = parseRequests(target.value, state.max || 100000);
    }

    state.step = 0;
    if (renderAfterUpdate) {
      renderState();
    }
  }

  function runAnimation() {
    stopAnimation();
    var result = schedule();
    state.step = 0;
    if (!result.steps.length) {
      renderState();
      return;
    }

    state.animating = true;
    renderState();

    timer = setInterval(function () {
      state.step += 1;
      if (state.step >= result.steps.length) {
        stopAnimation();
      }
      renderState();
    }, 700);
  }

  function reset() {
    stopAnimation();
    state = Object.assign({}, defaults, {
      requests: defaults.requests.slice(),
      step: 0,
      animating: false
    });
    renderState();
  }

  function getMetrics() {
    var result = schedule();
    return {
      primaryMetricLabel: 'Total Head Movement',
      primaryMetricValue: result.total,
      unit: 'cylinders'
    };
  }

  window.OSDashboard.modules['team12_disk_look'] = {
    title: 'Disk Scheduling III — LOOK & C-LOOK',
    render: function (container) {
      host = container;
      if (!host) {
        return;
      }
      stopAnimation();
      reset();
    },
    reset: reset,
    getMetrics: getMetrics
  };
}());
