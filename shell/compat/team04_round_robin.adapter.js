/*
 * Sandbox · Team 4 adapter (written by Team 15)
 *
 * Team 4 (RoundRobin-Team-4) submitted a page script, not a module: module.js
 * declares global functions, binds them to hard-coded element IDs the moment it
 * loads, and never registers with window.OSDashboard. Their files stay untouched.
 * This adapter supplies the Section 2.3 interface around them:
 *
 *   render(container)  injects Team 4's own markup (copied verbatim from their
 *                      demo.html by tools/extract-compat.mjs), then re-binds
 *                      their global handlers exactly as their module.js does
 *                      on load.
 *   reset()            restores that markup, which carries their shipped sample
 *                      (P1-P4, time quantum 2).
 *   getMetrics()       reads the Average Waiting Time their code writes into
 *                      #avgWaiting. Before any run it reports the value their own
 *                      runRoundRobin() produces for the shipped sample, computed
 *                      once in a hidden copy of the markup at startup.
 *
 * Team 4's code finds elements with document.getElementById, so only one copy of
 * the markup may be in the document at a time. The shell guarantees that.
 */
(function () {
  "use strict";

  var KEY = "team04_round_robin";
  var SCRIPT = "modules/team04_round_robin/module.js";
  var TITLE = "CPU Scheduling IV — Round Robin";

  var mounted = null;        // container currently holding Team 4's markup
  var sampleMetric = 0;      // Avg Waiting Time of the shipped sample, from Team 4's code
  var ready = false;         // true once Team 4's module.js has executed

  function markup() {
    return (window.Sandbox && window.Sandbox.compat && window.Sandbox.compat.team04Markup) || "";
  }

  // The same three assignments and initial call Team 4's module.js makes on load.
  function bind() {
    var g = window;
    var byId = function (id) { return document.getElementById(id); };
    if (typeof g.createProcesses !== "function") return;
    var update = byId("updateProcessesButton");
    var run = byId("runButton");
    var resetButton = byId("resetButton");
    if (update) update.onclick = g.createProcesses;
    if (run) run.onclick = g.runRoundRobin;
    if (resetButton) resetButton.onclick = g.reset;
    if (typeof g.showInitialQueue === "function") g.showInitialQueue();
  }

  function readAverage(root) {
    var el = root && root.querySelector("#avgWaiting");
    if (!el) return null;
    var value = parseFloat(String(el.textContent).trim());
    return isFinite(value) ? value : null;
  }

  // Load Team 4's module.js once, against a hidden copy of their markup, and
  // let their own algorithm compute the sample's average waiting time.
  function prepare() {
    return new Promise(function (resolve) {
      if (ready) return resolve();
      var host = document.createElement("div");
      host.setAttribute("aria-hidden", "true");
      host.style.display = "none";
      host.innerHTML = markup();
      document.body.appendChild(host);

      var script = document.createElement("script");
      script.src = SCRIPT;
      script.async = false;
      script.onload = function () {
        ready = typeof window.runRoundRobin === "function";
        try {
          if (ready) {
            window.runRoundRobin();
            var value = readAverage(host);
            if (value !== null) sampleMetric = value;
          }
        } catch (e) {
          // Keep the sample metric at 0; render() still works if the functions exist.
        }
        host.remove();
        resolve();
      };
      script.onerror = function () {
        host.remove();
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  function render(container) {
    if (!container) return;
    container.innerHTML = markup();
    mounted = container;
    bind();
  }

  function reset() {
    if (mounted && mounted.isConnected) {
      mounted.innerHTML = markup();
      bind();
    } else {
      mounted = null;
    }
  }

  function getMetrics() {
    var live = mounted && mounted.isConnected ? readAverage(mounted) : null;
    return {
      primaryMetricLabel: "Avg Waiting Time",
      primaryMetricValue: live !== null ? live : sampleMetric,
      unit: "units"
    };
  }

  window.OSDashboard = window.OSDashboard || { modules: {} };
  window.OSDashboard.modules[KEY] = {
    title: TITLE,
    render: render,
    reset: reset,
    getMetrics: getMetrics
  };

  window.Sandbox = window.Sandbox || {};
  window.Sandbox.compat = window.Sandbox.compat || {};
  window.Sandbox.compat.team04 = { prepare: prepare, isReady: function () { return ready; } };
})();
