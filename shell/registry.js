/*
 * Sandbox · module manifest (Team 15)
 *
 * One entry per content team, keyed by the exact namespace string from Section 4
 * of the guidelines. Titles are copied verbatim from Section 4; the navigation
 * shows them as `series` + `algorithm`, which together are the full title.
 *
 * Paths are relative to index.html. Team folders under modules/ are untouched
 * copies of each submission; anything Team 15 wrote to make a submission load
 * lives in shell/compat/.
 */
(function () {
  "use strict";

  var categories = [
    { id: "cpu", name: "CPU Scheduling", icon: "cpu" },
    { id: "deadlock", name: "Deadlock Handling", icon: "shield-check" },
    { id: "sync", name: "Process Synchronization", icon: "intersect-three" },
    { id: "disk", name: "Disk Scheduling", icon: "disc" },
    { id: "memory", name: "Memory Management", icon: "memory" }
  ];

  // integration: "direct" = loaded as submitted, "alias" = registered under the wrong
  // key and aliased, "adapter" = Team 15 code provides the contract interface.
  var modules = [
    {
      team: 1, key: "team01_fcfs_sjf", category: "cpu",
      title: "CPU Scheduling I — FCFS & SJF (Non-Preemptive)",
      series: "CPU Scheduling I", algorithm: "FCFS & SJF (Non-Preemptive)", short: "FCFS & SJF",
      folder: "modules/team01_fcfs_sjf", submittedAs: "Team01_FCFS_SJF",
      css: ["style.css"], scripts: ["shell/compat/team01_fcfs_sjf.inline.js"], sink: "module-root",
      metric: { label: "Avg Waiting Time", unit: "units", type: "number" },
      integration: "adapter",
      adapterNote: "`module.js` is a one-line stub; the working module is the inline script in `demo.html`. Team 15 loads a byte-identical extraction of that script."
    },
    {
      team: 2, key: "team02_srtf", category: "cpu",
      title: "CPU Scheduling II — Shortest Remaining Time First (SRTF)",
      series: "CPU Scheduling II", algorithm: "Shortest Remaining Time First (SRTF)", short: "SRTF",
      folder: "modules/team02_srtf", submittedAs: "team02_srtf",
      css: ["style.css"], scripts: ["modules/team02_srtf/module.js"],
      metric: { label: "Avg Waiting Time", unit: "units", type: "number" },
      integration: "direct"
    },
    {
      team: 3, key: "team03_priority", category: "cpu",
      title: "CPU Scheduling III — Priority Scheduling (Non-Preemptive & Preemptive)",
      series: "CPU Scheduling III", algorithm: "Priority Scheduling (Non-Preemptive & Preemptive)", short: "Priority",
      folder: "modules/team03_priority", submittedAs: "team03_priority",
      css: ["style.css"], scripts: ["modules/team03_priority/module.js"],
      metric: { label: "Avg Waiting Time", unit: "units", type: "number" },
      integration: "direct"
    },
    {
      team: 4, key: "team04_round_robin", category: "cpu",
      title: "CPU Scheduling IV — Round Robin",
      series: "CPU Scheduling IV", algorithm: "Round Robin", short: "Round Robin",
      folder: "modules/team04_round_robin", submittedAs: "RoundRobin-Team-4",
      css: ["styleos.css"], scripts: ["shell/compat/team04_round_robin.markup.js", "shell/compat/team04_round_robin.adapter.js"],
      metric: { label: "Avg Waiting Time", unit: "units", type: "number" },
      integration: "adapter",
      adapterNote: "No `window.OSDashboard` registration and no `render()`, `reset()` or `getMetrics()`. Team 15's adapter injects Team 4's own markup (copied verbatim from their `demo.html`), runs their `module.js` once, and re-binds their global handlers on every render."
    },
    {
      team: 5, key: "team05_allocation", category: "memory",
      title: "Contiguous Memory / Process Allocation — First Fit, Best Fit, Worst Fit",
      series: "Contiguous Memory / Process Allocation", algorithm: "First Fit, Best Fit, Worst Fit", short: "Allocation",
      folder: "modules/team05_allocation", submittedAs: "team05_allocation",
      css: ["style.css"], scripts: ["modules/team05_allocation/module.js"],
      metric: { label: "Total Internal Fragmentation", unit: "KB", type: "number" },
      integration: "direct"
    },
    {
      team: 6, key: "team06_bankers", category: "deadlock",
      title: "Banker's Algorithm — Safety Algorithm & Resource-Request Algorithm",
      series: "Banker's Algorithm", algorithm: "Safety Algorithm & Resource-Request Algorithm", short: "Banker's Algorithm",
      folder: "modules/team06_bankers", submittedAs: "team06_banker's_algorithm",
      css: ["style.css"], scripts: ["modules/team06_bankers/module.js"],
      metric: { label: "System State", unit: "", type: "state", values: ["Safe", "Unsafe"] },
      integration: "direct"
    },
    {
      team: 7, key: "team07_prod_cons", category: "sync",
      title: "Classical Synchronization I — Producer-Consumer Problem",
      series: "Classical Synchronization I", algorithm: "Producer-Consumer Problem", short: "Producer-Consumer",
      folder: "modules/team07_prod_cons", submittedAs: "team07_prod_cons",
      css: ["style.css"], scripts: ["modules/team07_prod_cons/module.js"],
      metric: { label: "Buffer Utilization", unit: "%", type: "number" },
      integration: "direct"
    },
    {
      team: 8, key: "team08_readers_writers", category: "sync",
      title: "Classical Synchronization II — Readers-Writers Problem",
      series: "Classical Synchronization II", algorithm: "Readers-Writers Problem", short: "Readers-Writers",
      folder: "modules/team08_readers_writers", submittedAs: "team08_readers_writers",
      css: ["style.css"], scripts: ["modules/team08_readers_writers/module.js"],
      metric: { label: "Active Readers", unit: "", type: "number" },
      integration: "direct"
    },
    {
      team: 9, key: "team09_dining_phil", category: "sync",
      title: "Classical Synchronization III — Dining Philosophers Problem",
      series: "Classical Synchronization III", algorithm: "Dining Philosophers Problem", short: "Dining Philosophers",
      folder: "modules/team09_dining_phil", submittedAs: "team09_dining_phil",
      css: ["style.css"], scripts: ["modules/team09_dining_phil/module.js"],
      metric: { label: "Meals Served", unit: "", type: "number" },
      integration: "direct"
    },
    {
      team: 10, key: "team10_disk_fcfs_sstf", category: "disk",
      title: "Disk Scheduling I — FCFS & SSTF",
      series: "Disk Scheduling I", algorithm: "FCFS & SSTF", short: "FCFS & SSTF",
      folder: "modules/team10_disk_fcfs_sstf", submittedAs: "team 10 fcfs sstf",
      css: ["Style.css"], scripts: ["modules/team10_disk_fcfs_sstf/module.js", "shell/compat/aliases.js"],
      metric: { label: "Total Head Movement", unit: "cylinders", type: "number" },
      integration: "alias", registeredAs: "disk_fcfs_sstf",
      adapterNote: "Registers under `disk_fcfs_sstf` instead of `team10_disk_fcfs_sstf`. `shell/compat/aliases.js` points the correct key at the same object."
    },
    {
      team: 11, key: "team11_disk_scan", category: "disk",
      title: "Disk Scheduling II — SCAN & C-SCAN",
      series: "Disk Scheduling II", algorithm: "SCAN & C-SCAN", short: "SCAN & C-SCAN",
      folder: "modules/team11_disk_scan", submittedAs: "team11_disk_scan",
      css: ["style.css"], scripts: ["modules/team11_disk_scan/module.js"], needsChart: true,
      metric: { label: "Total Head Movement", unit: "cylinders", type: "number" },
      integration: "direct"
    },
    {
      team: 12, key: "team12_disk_look", category: "disk",
      title: "Disk Scheduling III — LOOK & C-LOOK",
      series: "Disk Scheduling III", algorithm: "LOOK & C-LOOK", short: "LOOK & C-LOOK",
      folder: "modules/team12_disk_look", submittedAs: "team12_disk_look",
      css: ["style.css"], scripts: ["modules/team12_disk_look/module.js"],
      metric: { label: "Total Head Movement", unit: "cylinders", type: "number" },
      integration: "direct"
    },
    {
      team: 13, key: "team13_page_fifo_lru", category: "memory",
      title: "Page Replacement I — FIFO & LRU",
      series: "Page Replacement I", algorithm: "FIFO & LRU", short: "FIFO & LRU",
      folder: "modules/team13_page_fifo_lru", submittedAs: "team13_page_fifo_lru",
      css: ["style.css"], scripts: ["modules/team13_page_fifo_lru/module.js"],
      metric: { label: "Page Faults", unit: "faults", type: "number" },
      integration: "direct"
    },
    {
      team: 14, key: "team14_page_optimal", category: "memory",
      title: "Page Replacement II — Optimal Algorithm & Comparison Chart",
      series: "Page Replacement II", algorithm: "Optimal Algorithm & Comparison Chart", short: "Optimal",
      folder: "modules/team14_page_optimal", submittedAs: "team14_page_optimal",
      css: ["style.css"], scripts: ["modules/team14_page_optimal/module.js"], needsChart: true,
      metric: { label: "Page Faults (Optimal)", unit: "faults", type: "number" },
      integration: "direct"
    }
  ];

  // Navigation order: grouped by category, team order inside each group.
  var order = ["cpu", "deadlock", "sync", "disk", "memory"];
  var navOrder = [];
  order.forEach(function (cat) {
    modules.filter(function (m) { return m.category === cat; })
      .sort(function (a, b) { return a.team - b.team; })
      .forEach(function (m) { navOrder.push(m.key); });
  });

  var byKey = {};
  modules.forEach(function (m) {
    m.teamLabel = "Team " + (m.team < 10 ? "0" : "") + m.team;
    m.demo = m.folder + "/demo.html";
    byKey[m.key] = m;
  });

  window.Sandbox = window.Sandbox || {};
  window.Sandbox.registry = {
    categories: categories,
    modules: modules,
    navOrder: navOrder,
    byKey: byKey,
    category: function (id) {
      for (var i = 0; i < categories.length; i++) if (categories[i].id === id) return categories[i];
      return null;
    },
    chartJs: {
      cdn: "https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.js",
      local: "vendor/chart.umd.js"
    }
  };
})();
