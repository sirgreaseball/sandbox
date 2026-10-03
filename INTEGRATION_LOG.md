# Integration log (Section 5.3)

Team 15, Dashboard Integration. OS 702CO1C002. Last run 30 September 2026.

This log records how each of the fourteen submissions was received, tested on its own, and merged into the dashboard. It also lists every place where a submission broke the Section 2 technical contract. Nothing in any team folder was edited. Where a submission could not load as-is, Team 15 wrote a separate adapter in `shell/compat/`. The same information, with live re-checks, is in the dashboard at `index.html#/integration`.

## Summary

| Team | Submitted as | Folder in `modules/` | Registers as | How it is loaded | Contract notes |
| --- | --- | --- | --- | --- | --- |
| 01 | `Team01_FCFS_SJF` | `team01_fcfs_sjf` | `team01_fcfs_sjf` (from demo.html) | Adapter: inline script extracted byte for byte | module.js empty; no default data; metric label and unit differ; static Gantt; unscoped CSS |
| 02 | `team02_srtf` | `team02_srtf` | `team02_srtf` | As submitted | Clean |
| 03 | `team03_priority` | `team03_priority` | `team03_priority` | As submitted | 260 unscoped selectors; no default data; leaks `window.PriorityEngine` |
| 04 | `RoundRobin-Team-4` | `team04_round_robin` | nothing | Adapter: Team 15 interface around Team 4's code | No registration or interface; global functions; wrong folder, file names and no README; hard-coded colours |
| 05 | `team05_allocation` (Drive) | `team05_allocation` | `team05_allocation` | As submitted | Clean (debug logging, local theme variables) |
| 06 | `team06_banker's_algorithm` | `team06_bankers` | `team06_bankers` | As submitted | Clean (folder name) |
| 07 | `team07_prod_cons` | `team07_prod_cons` | `team07_prod_cons` | As submitted | Empty title; Google Fonts `@import`; 17 `!important` |
| 08 | `team08_readers_writers` (Drive) | `team08_readers_writers` | `team08_readers_writers` | As submitted | Clean |
| 09 | `team09_dining_phil` | `team09_dining_phil` | `team09_dining_phil` | As submitted | Cover-page CSS unscoped, 140 `!important` (never matches in the dashboard) |
| 10 | `team 10 fcfs sstf` | `team10_disk_fcfs_sstf` | `disk_fcfs_sstf` | Alias to the correct key | Wrong key; folder name with spaces; `Style.css` vs `style.css` |
| 11 | `team11_disk_scan` | `team11_disk_scan` | `team11_disk_scan` | As submitted | Clean (extra server.js) |
| 12 | `team12_disk_look` | `team12_disk_look` | `team12_disk_look` | As submitted | No default data; 4 `!important` |
| 13 | `team13_page_fifo_lru` | `team13_page_fifo_lru` | `team13_page_fifo_lru` | As submitted | No title; `reset()` throws before `render()`; unscoped `html, body` |
| 14 | `team14_page_optimal` | `team14_page_optimal` | `team14_page_optimal` | As submitted | Metric label differs; extra `_setSpeed` member |

None of the fourteen submissions included the three screenshots that Section 2.6 asks for. Team 15's isolation screenshots in `integration/isolation/<key>/` (initial, mid-run, final) serve as that record.

## How each module was tested before integration

1. **Intake.** `tools/intake.mjs` copied each submission into `modules/` under its canonical name, byte for byte, and recorded a SHA-256 hash for every file (listed at the end). Team 5 was missing from the shared folder, and Team 8's folder there was an older single-file export. Both came from the class Google Drive folder "OS Projects" as zip archives, which were CRC-checked before extraction.
2. **Own demo, in isolation.** Each team's `demo.html` was opened from `file://` in Chrome 154 with Playwright. It was driven through its own controls and screenshotted at the start, mid-run and end, and all console output was recorded. Every demo ran with **0 console errors**. Teams 3 and 12 ship no default data, so their sample input was typed in to reach a mid-run state.
3. **Contract probe.** Each `module.js` was loaded alone in a blank page. The probe checked the registration key, the three functions, `getMetrics()` before any render, and then a render, reset, remove and render cycle.
4. **Stylesheet audit.** Each stylesheet was parsed through the browser's CSSOM. The audit counted selectors not prefixed with `.os-teamNN`, `!important` declarations, `@import` rules and `:root` variables.

## Findings and what Team 15 did, per team

### Team 01, CPU Scheduling I: FCFS & SJF (Non-Preemptive)
- `module.js` contains one comment line. The working module, including its `window.OSDashboard` registration, is an inline `<script>` in `demo.html` (Section 2.2).
- The default dataset is five rows with blank arrival and burst times, so the metric is 0 until values are typed in (Section 2.5).
- `getMetrics()` returns label "Average Waiting Time" and unit "time units"; Section 4 specifies "Avg Waiting Time" and "units". The Overview shows the module's own values and flags the difference.
- The Gantt chart is drawn all at once rather than time unit by time unit (Section 4).
- `style.css` has 8 unscoped selectors (`:root`, `*`, `html`, `body`, `button`, `input`, `#module-root`) and 6 `!important` declarations, and it redefines the theme variables at `:root`.
- **Team 15:** `tools/extract-compat.mjs` copies the inline script, bytes 290 to 18564 of `demo.html`, into `shell/compat/team01_fcfs_sjf.inline.js` unchanged. The script ends by rendering into `#module-root`, so during startup the shell provides a hidden, throwaway `#module-root` and removes it afterwards. `tools/verify.mjs` confirms the extraction is identical to the source bytes.

### Team 02, CPU Scheduling II: Shortest Remaining Time First (SRTF)
- Correct key, all three functions, scoped CSS (91 rules, 0 unscoped, 0 `!important`) and a sample dataset.
- The README lists a `screenshots/` folder that was not submitted.

### Team 03, CPU Scheduling III: Priority Scheduling (Non-Preemptive & Preemptive)
- `style.css` is not prefixed with `.os-team03`: 260 unscoped selectors. Ten of them target the whole page (`:root`, `html` with smooth scrolling and scroll padding, `*`, `::before`, `::after`, `body`, `code`, `pre`, `a`, `a:hover`), and 250 target `.edu-*` classes. It also has 4 `!important` declarations (Section 2.4).
- The process list starts empty and `reset()` returns to that empty list. The sample appears only after pressing Load Example (Section 2.5).
- The module sets `window.PriorityEngine`, outside its namespace (Section 2.3).
- `render()` overwrites the container's `className`. `demo.html` inlines a copy of `module.js` instead of loading it. The README mentions a `tests.html` that was not submitted.
- `G3_PRIORITY SCHEDULING.html` in the shared folder is byte-identical to this team's `demo.html`, so it was not copied.
- **Team 15:** the module's stylesheet sits in its own cascade layer and is active only while Team 3 is on screen. Its `html` and `body` rules cannot affect the shell, because the shell sets those properties unlayered. Links inside the module such as `href="#simulator"` would otherwise replace the dashboard route; the shell intercepts them and scrolls within the page.

### Team 04, CPU Scheduling IV: Round Robin
- Never registers with `window.OSDashboard`, and has no `render()`, `reset()` or `getMetrics()` (Section 2.3). `module.js` is a page script: it binds to fixed element IDs as soon as it loads.
- Declares globals `$`, `createProcesses`, `getProcesses`, `runRoundRobin`, `showResults`, `showGantt`, `showQueue`, `showInitialQueue`, `clearResults`, `reset` and `format`.
- Folder `RoundRobin-Team-4` and stylesheet `styleos.css` instead of `team04_round_robin` and `style.css`. No `README.md` (Section 2.2).
- `styleos.css` hard-codes 38 hex colours and uses none of the theme variables (Section 2.4).
- The time quantum only takes effect when Run is pressed; Section 4 asks for a live recompute. Their Reset button rebuilds four processes with burst time 1 instead of the page's sample, and invalid input is reported with `alert()`.
- **Team 15:** `tools/extract-compat.mjs` copies Team 4's `<div class="os-team04">` markup verbatim, bytes 274 to 15404 of `demo.html`, into `shell/compat/team04_round_robin.markup.js`. `shell/compat/team04_round_robin.adapter.js` then registers `team04_round_robin` with:
  - `render(container)`: injects that markup, then repeats the three `onclick` bindings and the `showInitialQueue()` call that Team 4's `module.js` makes on load;
  - `reset()`: restores the original markup, which carries the P1 to P4 sample with quantum 2;
  - `getMetrics()`: returns the Average Waiting Time that Team 4's code writes into `#avgWaiting`. Before any run, it returns the value Team 4's own `runRoundRobin()` computes for the shipped sample (7 units), measured once in a hidden copy at startup.

### Team 05, Contiguous Memory / Process Allocation: First Fit, Best Fit, Worst Fit
- Not present in the shared folder; taken from `team05_allocation.zip` in the class Google Drive.
- Correct key and interface, scoped CSS (66 rules, 0 unscoped, 0 `!important`) and sample data.
- `reset()` writes four `console.log` debug lines each time. The shell mutes `console.log`, `console.info` and `console.debug` only while it is calling into a module itself, so these do not repeat on every metric poll. Warnings and errors are never muted.
- Redefines the theme variables inside `.os-team05`, so the shared colours do not reach it. Ships an extra `test.js`.

### Team 06, Banker's Algorithm: Safety Algorithm & Resource-Request Algorithm
- Correct key and interface, scoped CSS (80 rules, 0 unscoped, 0 `!important`) and sample matrices. `getMetrics()` returns "Safe", as specified.
- Submitted as `team06_banker's_algorithm`; the contract name is `team06_bankers`.

### Team 07, Classical Synchronization I: Producer-Consumer Problem
- `title` is an empty string.
- `style.css` imports a font from `fonts.googleapis.com`, an external dependency beyond Chart.js (Section 2.5), and has 17 `!important` declarations (Section 2.4).
- Starts two background loops at load that poll every 100 ms, whether or not the module is on screen.
- **Team 15:** module stylesheets load the first time a module is opened, so Team 7's font request only happens if Team 7 is opened.

### Team 08, Classical Synchronization II: Readers-Writers Problem
- The shared folder only had `Team-08_Readers&writers.html`, a single-file export. The `team08_readers_writers` folder from the class Google Drive is newer and complete, and is what the dashboard uses.
- Correct key and interface, scoped CSS (43 rules, 0 unscoped, 0 `!important`).

### Team 09, Classical Synchronization III: Dining Philosophers Problem
- `style.css` carries the demo's cover-page styles unprefixed: 588 selectors on `.dp-*`, `.step-*` and `:root`, and 140 `!important` declarations (Section 2.4). They only match classes that `demo.html` adds, so they never apply inside the dashboard.
- The module itself is scoped, registers correctly and has both the naive and the fixed modes.

### Team 10, Disk Scheduling I: FCFS & SSTF
- Registers as `disk_fcfs_sstf` instead of `team10_disk_fcfs_sstf`, so a loader keyed to Section 4 finds nothing (Section 2.3).
- Folder `team 10 fcfs sstf` contains spaces. The stylesheet is `Style.css` while `demo.html` links `style.css`, which only works on case-insensitive file systems (Section 2.2).
- The README's sample (98, 183, 37, 122, 14, 124, 65, 67, head 53) is not the one in the code (2069, 1212, 2296, 2800, 544, 1618, 356, 1523, head 2150, cylinders 0 to 4999).
- **Team 15:** `shell/compat/aliases.js` points `team10_disk_fcfs_sstf` at the object Team 10 registered. The original key stays in place.

### Team 11, Disk Scheduling II: SCAN & C-SCAN
- Correct key and interface, scoped CSS (131 rules, 0 unscoped, 0 `!important`); uses Chart.js as allowed.
- `reset()` replaces its chart reference without calling `destroy()`, so each reset leaves one Chart.js instance in memory. Harmless over a session. Every re-render calls `window.scrollTo` to hold the scroll position. Ships an extra `server.js`, and redefines the theme variables inside `.os-team11`.

### Team 12, Disk Scheduling III: LOOK & C-LOOK
- No default data: head, maximum cylinder and request queue start empty, so the metric is 0. The README describes a sample the code does not contain (Section 2.5).
- 4 `!important` declarations (Section 2.4).
- Each change event re-renders the whole form, so typing a value and clicking straight into the next field loses that click. Tabbing between fields works.

### Team 13, Page Replacement I: FIFO & LRU
- No `title` property (Section 2.3).
- `reset()` throws a `TypeError` if called before `render()`. **Team 15:** the shell only resets modules it has rendered, and wraps every call in `try/catch`.
- Unscoped `html, body` rule (`overflow-x: hidden`, `width: 100%`) and 10 `!important` declarations (Section 2.4). The shell sets those properties itself, so the rule has no effect on the page.

### Team 14, Page Replacement II: Optimal Algorithm & Comparison Chart
- `getMetrics()` label is "Page Faults"; Section 4 specifies "Page Faults (Optimal)".
- Exposes an extra `_setSpeed` member besides the three functions.
- Finds its own elements with `document.getElementById`, so its container must be in the document before `render()` and while `reset()` runs. The shell attaches each container before rendering and resets the outgoing module before removing it.
- `getMetrics()` reports 0 until the module has rendered once. Redefines the theme variables inside `.os-team14`.

## Received but not copied into `modules/`

| File | Reason |
| --- | --- |
| `G3_PRIORITY SCHEDULING.html` | Byte-identical to `team03_priority/demo.html` (same SHA-256). |
| `Team-08_Readers&writers.html` | Earlier single-file export of Team 8, superseded by the `team08_readers_writers` folder. |

## Shell behaviour, verified

Checked with Playwright in Chrome 154 against `index.html`, from `file://` and from a local static server:

- **Every module through the lifecycle.** All 14 modules were rendered, driven through their own controls, and switched away from. Each switch called `reset()` and left exactly one container on the page, with only the active module's stylesheet enabled. **0 console errors or warnings**, and 0 exceptions caught by the shell.
- **Rapid switching.** 30 presses of `]` at 40 ms intervals left one container and one active stylesheet. So did twelve back-to-back switches between the two Chart.js modules with their animations running.
- **Style isolation.** The computed styles of the page, the sidebar, navigation and search field were identical with each of the 14 modules active.
- **Overview.** All 14 modules returned a metric without throwing; 12 of 14 match the Section 4 label and unit (Teams 1 and 14 differ, as above). The value from before each reset is kept on the card.
- **Fallbacks.** With `?nogl`, with WebGL disabled, with a software renderer (SwiftShader) and with reduced motion, the landing switches to still frames and the dashboard works normally, all without console errors.
- **Layout.** At 375 × 812 there is no horizontal page scroll. Teams 11, 13 and 14 are wider than a phone, so their container scrolls sideways inside the page instead.
- **Frame time while scrolling the landing.** Measured at 1440 × 900 with the mouse wheel, Lenis smoothing, the WebGL scene live and the gallery pinned: median 6.9 ms, 95th percentile 7.3 ms, 99th percentile 7.5 ms, on a 145 Hz display. Every shader program compiles behind the loader, so no compile happens mid-scroll. The scene's interactions were also checked without console errors: dragging, a click ripple, and hovering a module link to lift its part of the object.
- **Lighthouse 12.8.2.**

  | Page | Performance | Accessibility | Best practices | SEO | Other |
  | --- | ---: | ---: | ---: | ---: | --- |
  | Landing, mobile | 95 | 95 | 100 | 100 | FCP 1.4 s, LCP 2.2 s, TBT 200 ms, CLS 0.002 |
  | Landing, desktop | 100 | 95 | 100 | 100 | FCP 0.3 s, LCP 0.5 s, TBT 30 ms |
  | Index (`#/overview`), mobile | 95 | 100 | 100 | 100 | |

  The landing's remaining accessibility items are white text drawn over the dark WebGL frame. The checker measures that text against the light page behind the frame, because the frame is clipped with `clip-path`.

### Lighthouse on each module page

Mobile preset, opening `index.html#/m/<key>` directly. The dashboard's own interface passes every accessibility audit. Every item counted below is inside the team's module: text colours with too little contrast, and form fields without a label. Team 13's best-practices score of 96 comes from 11px text in its stylesheet. None of the 14 pages logged a console error.

| Module | Performance | Accessibility | Best practices | LCP | TBT | CLS | Accessibility items inside the module |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| team01_fcfs_sjf | 98 | 91 | 100 | 2.4 s | 80 ms | 0 | colour contrast 30, heading order 1, labels 15 |
| team02_srtf | 97 | 96 | 100 | 2.4 s | 100 ms | 0 | colour contrast 10 |
| team03_priority | 91 | 95 | 100 | 2.4 s | 300 ms | 0 | colour contrast 37, heading order 2 |
| team04_round_robin | 98 | 92 | 100 | 2.4 s | 40 ms | 0 | colour contrast 1, labels 12 |
| team05_allocation | 98 | 92 | 100 | 2.4 s | 60 ms | 0 | colour contrast 3, labels 18 |
| team06_bankers | 97 | 93 | 100 | 2.4 s | 0 ms | 0 | colour contrast 1, labels 30 |
| team07_prod_cons | 98 | 92 | 100 | 2.4 s | 30 ms | 0.006 | colour contrast 2, labels 3 |
| team08_readers_writers | 98 | 96 | 100 | 2.4 s | 20 ms | 0 | colour contrast 1 |
| team09_dining_phil | 97 | 91 | 100 | 2.4 s | 0 ms | 0 | colour contrast 2, select name 1 |
| team10_disk_fcfs_sstf | 97 | 89 | 100 | 2.4 s | 0 ms | 0 | colour contrast 13, labels 2, select name 1 |
| team11_disk_scan | 79 | 92 | 100 | 3.5 s | 470 ms | 0 | colour contrast 27, labels 1 |
| team12_disk_look | 97 | 96 | 100 | 2.4 s | 0 ms | 0 | colour contrast 1 |
| team13_page_fifo_lru | 98 | 96 | 96 | 2.3 s | 30 ms | 0 | colour contrast 37 |
| team14_page_optimal | 93 | 96 | 100 | 3.1 s | 70 ms | 0 | colour contrast 17 |

Team 11's lower performance score comes from its own first render: it builds the whole module and a Chart.js chart in one long task. The stage the modules sit on is white, so a module with a transparent background keeps the contrast it had in its own demo. That choice removed 13 of Team 3's contrast failures compared with a light grey stage.

## File hashes

SHA-256 of every file copied into `modules/`, as recorded by `tools/intake.mjs`. Run `node tools/verify.mjs` to re-check them against the files and against the original submissions.

| Folder | File | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `modules/team01_fcfs_sjf` | `README.md` | 263 | `7ba4ee9ee9ecfd06c5a0d8e6b264bee743da24482c5e75d826a8e7a06dc5b6a8` |
| `modules/team01_fcfs_sjf` | `demo.html` | 18625 | `cb0683b94747926066e09a6cafdb0c57505e8248933f7776e5b5c76d8d6f10e3` |
| `modules/team01_fcfs_sjf` | `module.js` | 62 | `9c88b58bbc562bb7dd96529183da5487d90f0885fd7f1634fc9b4b4040bce89c` |
| `modules/team01_fcfs_sjf` | `style.css` | 10108 | `e5e82bd876fc4f674e38719244f3564718807093dadb5e2ac327e9d15380ff11` |
| `modules/team02_srtf` | `README.md` | 2000 | `ab05b4e1733b05df6ff0d2651d112b618cff15dfaf5c596816c4477bf229a4b6` |
| `modules/team02_srtf` | `demo.html` | 616 | `f10fa430c52ee033d871be89c2de2622acfda9e8e0d72c9629e6a204d15aca66` |
| `modules/team02_srtf` | `module.js` | 26551 | `cf13b827588c46b28a9a76ea0f064e75ae9583b1c4d775ddc2de54b07ecb4b8c` |
| `modules/team02_srtf` | `style.css` | 12412 | `b06ebce8f01db8fe5edee69ced7bfae8aaba6df991807046a183d2ae34f20477` |
| `modules/team03_priority` | `README.md` | 9238 | `0ea634fbe02a8ab84cd3f66de4759e17f95076975185aa2a17d65316354e2793` |
| `modules/team03_priority` | `demo.html` | 130337 | `a3a3fda0bc1d50e67211337fc76359518af29a38e848a29c4e482444421d50cc` |
| `modules/team03_priority` | `module.js` | 87610 | `bf7f8e748c813828262718d15ffb4ee85d61dc481a9a5e74f11638619e8e4cf8` |
| `modules/team03_priority` | `style.css` | 38565 | `bc8a6d8de89352a67082436fb4c241806d37d1364772d16e39dccfe717eba3aa` |
| `modules/team04_round_robin` | `demo.html` | 15463 | `b55cb4a27abcdfc15c4d214e377b2f5569cc7a0ded3a252519de9a34c031a209` |
| `modules/team04_round_robin` | `module.js` | 15565 | `f7324c6ca131c3e868356b438d57fb09b317f70531f9cc897e0c391f97ec8398` |
| `modules/team04_round_robin` | `styleos.css` | 6310 | `7f24b6f648258d8858ab24cf20daee64a157e54adce1d0616940509b8a914f43` |
| `modules/team05_allocation` | `README.md` | 1306 | `9463605dcd2b4697f01a09954d729b72cd601f1cea006bc6285861358f3d7ff8` |
| `modules/team05_allocation` | `demo.html` | 1310 | `c6c16b83b69e5bcecbf472360568f7c8f4cdfdd0f0ab87b8d4514811953cc126` |
| `modules/team05_allocation` | `module.js` | 28759 | `a0327efdccdf9154222ab5df85e09a96b46274b3ff706840c6ed4d980c1bef96` |
| `modules/team05_allocation` | `style.css` | 10433 | `80c0523c360863e1192e8a2a677bfffd849d0e6c2f17bbf124d3b765495f2722` |
| `modules/team05_allocation` | `test.js` | 464 | `f779a76e099288b0d3a75098010bad7d858b8b1e3a7b35bde234f30777d2dc84` |
| `modules/team06_bankers` | `README.md` | 1672 | `a14588c08a002f28a19dc0250fece852be601fe41bd3ba6fadffcbf3312a7dfa` |
| `modules/team06_bankers` | `demo.html` | 1128 | `fc46d9c723005dab973f2cc53a8e8f78e9e56059106b2c44ddfe2199183072a8` |
| `modules/team06_bankers` | `module.js` | 46968 | `84b63e2248769dcd73820e9b92f6c69d7bb79012f7dbe85497f26d152b42700f` |
| `modules/team06_bankers` | `style.css` | 9471 | `50685b6cba67f5c7e3373a3a61aad2b525218f79da57456d837d82a838892b1a` |
| `modules/team07_prod_cons` | `README.md` | 562 | `e86b4c2e78e471796a9d048a89303d7d8f37dc62819be1d1a4bd420463639130` |
| `modules/team07_prod_cons` | `demo.html` | 1688 | `393383226f6ab78d0dce31cc61e20ed10c42bb09bcb8102c60a52fdd9869bec8` |
| `modules/team07_prod_cons` | `module.js` | 17854 | `f639d6684706d1a189560e346b4a786ce87121f2d96abf704595dda64c86b21f` |
| `modules/team07_prod_cons` | `style.css` | 8485 | `0a32036a60fcabdebc3428606122727da6b09a489a87a6af5b923b189cdbabba` |
| `modules/team08_readers_writers` | `README.md` | 2748 | `c562816622b22998a0e0d363dc5edb03ff0991387599bc65bb43c067aefb5ff0` |
| `modules/team08_readers_writers` | `demo.html` | 1928 | `e9654c10f1fe6259dad28291ce87c9f95859aaf4541440605e536ddc995c056b` |
| `modules/team08_readers_writers` | `module.js` | 12036 | `86cf6849a9380cdad2a8b651518110b163d3ca1fbba099e281303914dd75e743` |
| `modules/team08_readers_writers` | `standalone_demo.html` | 19561 | `b2bb437c0e3f9def28948bebf2bf1c2c5b6eec44d2f2a5ab6a41fb6764c33e64` |
| `modules/team08_readers_writers` | `style.css` | 5636 | `2a0a837172ed3b135b21bdb43e220fb2a87bd684a381c896eb88fe0dec56b6c8` |
| `modules/team09_dining_phil` | `README.md` | 2183 | `749831de6644e1859166c58a9a281c81f9b7412fefa2ddb19dbe4f32da2dd6c4` |
| `modules/team09_dining_phil` | `demo.html` | 9716 | `4af8de7bb93c983fb8ef8563a3d0afe967bf868bebc6274fd3cbaff6050a5460` |
| `modules/team09_dining_phil` | `module.js` | 15941 | `b3a5d38623f4abfda22d444645aca543eba6533e9a11198033fe93ac049df414` |
| `modules/team09_dining_phil` | `style.css` | 55792 | `d75b43a9091ceadc286a0dbd7489343ed40eb5bbda38d194fb7a179a9fce070a` |
| `modules/team10_disk_fcfs_sstf` | `README.md` | 2352 | `284dbaab714f292b1e608ed6c5f785b7d8a0f2f337c3d4bc85b0ddaa972b7e11` |
| `modules/team10_disk_fcfs_sstf` | `Style.css` | 15078 | `05dd0c9d806a9ed406de37d1ddbb967c790640ddca4209e918c0a6a4a7810de7` |
| `modules/team10_disk_fcfs_sstf` | `demo.html` | 1130 | `aaec6c9df8fbe05225f74c1af16cff0db1336c210fa694487d9d80fb069f32e4` |
| `modules/team10_disk_fcfs_sstf` | `module.js` | 37034 | `2191bae8d17d7519a39e65cb4dd6296c3f3e9d543c99831538a03522ae12dd94` |
| `modules/team11_disk_scan` | `README.md` | 969 | `851367e1904be126f982dc1fc0f61ffb442f2f19a1b9a0189e8be969436321a3` |
| `modules/team11_disk_scan` | `demo.html` | 1740 | `47dfaecf2e02879af01a420a0a5ca8d02d79e5658906336ed322df2ee3e4c6bd` |
| `modules/team11_disk_scan` | `module.js` | 47653 | `f0eeffad9364cec4df91dfc10a5e1abb239a48f8b3b27eb74668e9aa696b390c` |
| `modules/team11_disk_scan` | `server.js` | 1140 | `f5f6bb6c85096041d84a1a1f4e0d5ca54615b3d0de75f736a1c8ae33c008a2ee` |
| `modules/team11_disk_scan` | `style.css` | 20041 | `e3ecf7636ea782bd08dcb0fa0d4c6d3f82a2880994cb4cc0c2ee13d58bbcfcb6` |
| `modules/team12_disk_look` | `README.md` | 786 | `bd64e59ab10d7aae9cea9082d8189914d99595a53f0f705bb953919a57c72f08` |
| `modules/team12_disk_look` | `demo.html` | 1039 | `b100ec07243a7e3e63f4e4752e077ebf698e4188958d0539d2bc73954674db09` |
| `modules/team12_disk_look` | `module.js` | 20558 | `a3393dc169ecca07c49b0e5ff6bd2b4effed8c61f37e3198def5c4eda930e8b5` |
| `modules/team12_disk_look` | `style.css` | 10080 | `14b356844933c42586d44ccd6d61cea4ab4a4f423548b99ae336607ce23b84ac` |
| `modules/team13_page_fifo_lru` | `README.md` | 1341 | `293920fd21553cff4ac5afed12b2a3beaaadd4d50c92a1197ffd3bc49c2f9c6d` |
| `modules/team13_page_fifo_lru` | `demo.html` | 566 | `07ee37b0a09f4bba6b9bd990ec594007d70cfa794d24f5e7e355f2362ab47467` |
| `modules/team13_page_fifo_lru` | `module.js` | 43019 | `f29d4865ec10f16be4c5c314d3895bff35b6b3ada2544432a2830d1173cb2e31` |
| `modules/team13_page_fifo_lru` | `style.css` | 35228 | `e803c8554c74998b0c60b98eb7a3dc888c8727ebea1ebae0d01bc4a6f1eeb118` |
| `modules/team14_page_optimal` | `README.md` | 2125 | `f262c279a8097bb6f27418a5a1573c33a9077a4e0c4f940ce8a1fd78b1fd1778` |
| `modules/team14_page_optimal` | `demo.html` | 1679 | `be704cefd8a3b505e4ffe17a8286fbff04b8e0bfdc7e3463b7c3bf9670cbc7c7` |
| `modules/team14_page_optimal` | `module.js` | 40828 | `7985e10e128ffdd95e93d51beb9d3040105aa4aa9566a43897f58446d580db85` |
| `modules/team14_page_optimal` | `style.css` | 9941 | `1418ab4adabbd071e789935fdc28311fa496753253202a7bd67e2fdd2d6374dd` |

Archives from the class Google Drive, before extraction:

- `team05_allocation.zip` (Drive file id `142O_J2cAec2tEQM8K9t05mYbbUMrpB32`): `962c566c68639f513ddbcf6d865a6c291ce78aab6719b558301f94f4a71a9ba8`
- `team08_readers_writers.zip` (Drive file id `1NcDb2wMqcPkFrd1dQ1P9XmIb-udpz0Dm`): `a7a5f124f9e6dd7ff9d6521a68811766f68cb1eef23ed1e12fb5012edd2b9adc`

Not copied:

- `G3_PRIORITY SCHEDULING.html`: `a3a3fda0bc1d50e67211337fc76359518af29a38e848a29c4e482444421d50cc`
- `Team-08_Readers&writers.html`: `2293df36bfe96e52e6ffa6f316b4ab6b2d7be442624ee8ae6eb251a1a4f6bc79`
