/*
 * Sandbox · static integration audit (Team 15, Section 5.3)
 *
 * Findings from reading every submitted file and from opening each team's own
 * demo.html in Chrome before integration (screenshots in integration/isolation/).
 * Loaded as a classic script because fetch() of local files fails on file://.
 * The Integration log view adds live checks on top of these.
 *
 * level: "warn" = breaks a Section 2 rule or a Section 4 requirement
 *        "info" = worth knowing, not a contract violation
 *        "ok"   = checked and fine
 * Text in `backticks` is shown as code.
 */
window.SandboxAudit = {
  generated: "2026-09-30",
  method: [
    "Every submission was copied into `modules/` byte for byte by `tools/intake.mjs`, which records a SHA-256 hash per file; `tools/verify.mjs` re-checks them against the files and the original submissions.",
    "Each team's own `demo.html` was opened from `file://` in Chrome 154 with Playwright before integration, driven through its controls, and screenshotted at the start, mid-run and end.",
    "`module.js` was also loaded alone in a blank page to check the registration key, the three functions, `getMetrics()` before `render()`, and a render, reset, remove and render cycle.",
    "Stylesheets were parsed through the browser's CSSOM to count unscoped selectors, `!important` declarations, `@import` rules and `:root` variables.",
    "Teams 5 and 8 were missing or outdated locally; their folders came from the class Google Drive folder \"OS Projects\" as zip archives, CRC-checked before extraction."
  ],
  teams: {
    team01_fcfs_sjf: {
      findings: [
        { level: "warn", text: "`module.js` is a one-line comment. The whole module lives in an inline `<script>` in `demo.html`, so loading `module.js` registers nothing (Section 2.2)." },
        { level: "warn", text: "Ships an empty default dataset: five rows with blank arrival and burst times, so the metric is 0 until the user types values (Section 2.5)." },
        { level: "warn", text: "`getMetrics()` returns label \"Average Waiting Time\" and unit \"time units\"; Section 4 specifies \"Avg Waiting Time\" and \"units\"." },
        { level: "warn", text: "The Gantt chart is drawn in one go; Section 4 asks for one built time unit by time unit." },
        { level: "warn", text: "`style.css` has 8 unscoped selectors (`:root`, `*`, `html`, `body`, `button`, `input`, `#module-root`) and 6 `!important` declarations (Section 2.4). It also redefines the five theme variables at `:root`." },
        { level: "info", text: "The inline script renders into `#module-root` as soon as it loads. Team 15 supplies a hidden, throwaway `#module-root` during startup so that call succeeds, then removes it." }
      ],
      isolation: { summary: "Own demo: 0 console errors. Values typed in, SJF selected, Calculate pressed." }
    },
    team02_srtf: {
      findings: [
        { level: "ok", text: "Correct key, all three functions, scoped CSS (91 rules, 0 unscoped, 0 `!important`) and a sample dataset." },
        { level: "info", text: "The README lists a `screenshots/` folder that was not included in the submission (Section 2.6)." }
      ],
      isolation: { summary: "Own demo: 0 console errors. Calculate, then Start; playback captured mid-run and at the end." }
    },
    team03_priority: {
      findings: [
        { level: "warn", text: "`style.css` is not prefixed with `.os-team03`: 260 unscoped selectors, 10 on page-wide elements (`:root`, `html` with smooth scrolling and scroll padding, `*`, `::before`, `::after`, `body`, `code`, `pre`, `a`, `a:hover`) and 250 on `.edu-*` classes (Section 2.4). It also has 4 `!important` declarations." },
        { level: "warn", text: "The default process list is empty, and `reset()` returns to that empty list. The sample only appears after pressing Load Example (Section 2.5)." },
        { level: "warn", text: "Sets `window.PriorityEngine`, outside the assigned namespace (Section 2.3)." },
        { level: "info", text: "`render()` overwrites the container's `className` with `edu-page-root`. The shell's container carries no classes, so nothing breaks." },
        { level: "info", text: "In-page links such as `href=\"#simulator\"` would change the dashboard route; the shell intercepts them and scrolls instead." },
        { level: "info", text: "`demo.html` contains its own inline copy of `module.js` rather than loading it, and the README refers to a `tests.html` that was not submitted. `G3_PRIORITY SCHEDULING.html` is a byte-identical copy of this `demo.html`." }
      ],
      isolation: { summary: "Own demo: 0 console errors. Example loaded, preemptive mode, Start, then Run all." }
    },
    team04_round_robin: {
      findings: [
        { level: "warn", text: "Does not register with `window.OSDashboard` and has no `render()`, `reset()` or `getMetrics()` (Section 2.3). `module.js` is a page script that binds to fixed element IDs as soon as it loads." },
        { level: "warn", text: "Declares globals `$`, `createProcesses`, `getProcesses`, `runRoundRobin`, `showResults`, `showGantt`, `showQueue`, `showInitialQueue`, `clearResults`, `reset` and `format` (Section 2.3)." },
        { level: "warn", text: "Folder named `RoundRobin-Team-4` and stylesheet named `styleos.css`, instead of `team04_round_robin` and `style.css`. No `README.md` (Section 2.2)." },
        { level: "warn", text: "`styleos.css` hard-codes 38 hex colours and uses none of the theme variables (Section 2.4)." },
        { level: "warn", text: "Changing the time quantum does not recompute anything until Run is pressed; Section 4 asks for a live recompute." },
        { level: "info", text: "Their Reset button rebuilds four processes with burst time 1, not the P1 to P4 sample the page ships with. Invalid input is reported with `alert()`." }
      ],
      isolation: { summary: "Own demo: 0 console errors. Run with quantum 2, then quantum 3." }
    },
    team05_allocation: {
      findings: [
        { level: "ok", text: "Correct key and interface, scoped CSS (66 rules, 0 unscoped, 0 `!important`), sample blocks and processes present." },
        { level: "info", text: "Not in the shared folder; taken from `team05_allocation.zip` in the class Google Drive." },
        { level: "info", text: "`reset()` writes four `console.log` debug lines each time it runs. The shell mutes `console.log` only while it is calling into a module itself." },
        { level: "info", text: "Redefines the theme variables inside `.os-team05` (with `--dashboard-*` fallbacks), so the shared `theme.css` colours do not reach it. Also ships an extra `test.js`." }
      ],
      isolation: { summary: "Own demo: 0 console errors. Allocate with First Fit, then Allocate with the next strategy." }
    },
    team06_bankers: {
      findings: [
        { level: "ok", text: "Correct key and interface, scoped CSS (80 rules, 0 unscoped, 0 `!important`), sample matrices present, `getMetrics()` returns \"Safe\" as specified." },
        { level: "info", text: "Submitted as `team06_banker's_algorithm`; the contract name is `team06_bankers`." }
      ],
      isolation: { summary: "Own demo: 0 console errors. Safety animation started, then a resource request submitted." }
    },
    team07_prod_cons: {
      findings: [
        { level: "warn", text: "`title` is an empty string." },
        { level: "warn", text: "`style.css` imports a font from `fonts.googleapis.com`, an external dependency beyond Chart.js (Section 2.5), and has 17 `!important` declarations (Section 2.4)." },
        { level: "info", text: "Starts two background loops at load that poll every 100 ms, whether or not the module is on screen." }
      ],
      isolation: { summary: "Own demo: 0 console errors. Started, captured while producing and consuming, then stopped." }
    },
    team08_readers_writers: {
      findings: [
        { level: "ok", text: "Correct key and interface, scoped CSS (43 rules, 0 unscoped, 0 `!important`)." },
        { level: "info", text: "The shared folder only had `Team-08_Readers&writers.html`, a single-file export. The `team08_readers_writers` folder in the class Google Drive is newer and is what the dashboard loads." }
      ],
      isolation: { summary: "Own demo: 0 console errors. Two readers and a writer arrive, then another reader after the lock clears." }
    },
    team09_dining_phil: {
      findings: [
        { level: "warn", text: "`style.css` carries the demo's cover-page styles unprefixed: 588 selectors on `.dp-*`, `.step-*` and `:root`, and 140 `!important` declarations (Section 2.4). They only match classes that `demo.html` adds, so they never apply inside the dashboard." },
        { level: "ok", text: "The module itself is scoped to `.os-team09`, registers correctly, and ships the naive and fixed modes." }
      ],
      isolation: { summary: "Own demo: 0 console errors. Cover page dismissed, simulation started." }
    },
    team10_disk_fcfs_sstf: {
      findings: [
        { level: "warn", text: "Registers as `disk_fcfs_sstf` instead of `team10_disk_fcfs_sstf`, so a loader keyed to Section 4 finds nothing (Section 2.3). Team 15 adds an alias." },
        { level: "warn", text: "Folder named `team 10 fcfs sstf` (spaces). The stylesheet is `Style.css` while `demo.html` links `style.css`, which only works on case-insensitive file systems (Section 2.2)." },
        { level: "info", text: "The README documents the sample 98, 183, 37, 122, 14, 124, 65, 67 with head 53, but the code ships 2069, 1212, 2296, 2800, 544, 1618, 356, 1523 with head 2150 on cylinders 0 to 4999." },
        { level: "info", text: "Redefines the theme variables inside `.os-team10`." }
      ],
      isolation: { summary: "Own demo: 0 console errors. Animation started, then Run Simulation." }
    },
    team11_disk_scan: {
      findings: [
        { level: "ok", text: "Correct key and interface, scoped CSS (131 rules, 0 unscoped, 0 `!important`), Chart.js used as allowed." },
        { level: "info", text: "`reset()` replaces its chart reference without calling `destroy()`, so each reset leaves one Chart.js instance in memory. Harmless over a session, and Team 15 does not touch a module's charts." },
        { level: "info", text: "Every re-render calls `window.scrollTo` to hold the scroll position. Ships an extra `server.js`. Redefines the theme variables inside `.os-team11`." }
      ],
      isolation: { summary: "Own demo: 0 console errors. Run, then Play; trajectory chart captured at the end." }
    },
    team12_disk_look: {
      findings: [
        { level: "warn", text: "Ships no default data: head, maximum cylinder and request queue start empty, so the metric is 0. The README describes a sample that the code does not contain (Section 2.5)." },
        { level: "warn", text: "4 `!important` declarations (Section 2.4)." },
        { level: "info", text: "Each change event re-renders the whole form, so typing a value and clicking straight into the next field loses that click. Tabbing between fields works." }
      ],
      isolation: { summary: "Own demo: 0 console errors. README sample typed in, Run animation, captured mid-run and at the end." }
    },
    team13_page_fifo_lru: {
      findings: [
        { level: "warn", text: "No `title` property (Section 2.3)." },
        { level: "warn", text: "`reset()` throws a `TypeError` if called before `render()`. The shell only resets modules it has rendered." },
        { level: "warn", text: "`style.css` has an unscoped `html, body` rule (`overflow-x: hidden`, `width: 100%`) and 10 `!important` declarations (Section 2.4). The shell sets those `html` and `body` properties itself." }
      ],
      isolation: { summary: "Own demo: 0 console errors. Loaded, stepped four references, then eight more." }
    },
    team14_page_optimal: {
      findings: [
        { level: "warn", text: "`getMetrics()` label is \"Page Faults\"; Section 4 specifies \"Page Faults (Optimal)\"." },
        { level: "info", text: "Exposes an extra `_setSpeed` member besides the three functions. Finds its own elements with `document.getElementById`, so its container must be in the document before `render()` and while `reset()` runs; the shell guarantees both." },
        { level: "info", text: "`getMetrics()` reports 0 until the module has rendered once. Redefines the theme variables inside `.os-team14`." }
      ],
      isolation: { summary: "Own demo: 0 console errors. Applied, stepped through the reference string; comparison chart at the end." }
    }
  }
};
