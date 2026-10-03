/*
 * Sandbox · namespace aliases (written by Team 15)
 *
 * Team 10 registers as window.OSDashboard.modules["disk_fcfs_sstf"], but Section 4
 * assigns "team10_disk_fcfs_sstf". The correct key is pointed at the same module
 * object; the original key is left in place so nothing Team 10 relies on changes.
 */
(function () {
  "use strict";
  var modules = window.OSDashboard && window.OSDashboard.modules;
  if (!modules) return;
  var aliases = { team10_disk_fcfs_sstf: "disk_fcfs_sstf" };
  Object.keys(aliases).forEach(function (key) {
    var from = aliases[key];
    if (!modules[key] && modules[from]) modules[key] = modules[from];
  });
})();
