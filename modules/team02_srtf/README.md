# Team 02 — SRTF Visualizer

This module implements **Shortest Remaining Time First (SRTF)**, the preemptive form of SJF, as a self-contained vanilla HTML/CSS/JavaScript visualization for the cumulative Operating Systems dashboard; it provides editable arrival/burst times, deterministic SRTF scheduling, a live ready queue, one-time-unit stepping, autoplay controls, remaining-burst tracking, preemption explanations and markers, an animated Gantt chart, CT/TAT/WT results, average waiting/turnaround time, key formulas, and brief advantages/disadvantages. **Sample input:** P1(AT=0,BT=8), P2(AT=1,BT=4), P3(AT=2,BT=2), P4(AT=3,BT=1), P5(AT=5,BT=3).

## Integration contract

- Exact namespace: `window.OSDashboard.modules["team02_srtf"]`
- Exposes `title`, `render(container)`, `reset()`, and `getMetrics()`.
- `getMetrics()` returns exactly `{ primaryMetricLabel, primaryMetricValue, unit }` with `primaryMetricLabel: "Avg Waiting Time"` and `unit: "units"`.
- `render(container)` builds the module only inside the supplied container.
- CSS selectors are scoped under `.os-team02` and theme colors use the shared `--os-navy`, `--os-teal`, `--os-orange`, `--os-bg`, and `--os-text` variables.
- No framework, build tool, backend, local `fetch()`, image dependency, or other team's namespace/file is used. Chart.js is not required.

## Files

- `module.js` — module logic and UI.
- `style.css` — module-scoped styling.
- `demo.html` — standalone test page.
- `screenshots/` — initial, mid-simulation, and final-state screenshots for submission evidence.

## Team 15 integration

Place this folder at `/modules/team02_srtf/` without renaming the namespace. Load `module.js` and `style.css`, then call `window.OSDashboard.modules["team02_srtf"].render(container)` for the selected tab. On tab switches, Team 15 should call `reset()` on the outgoing module, clear the shared content container, and call `render(container)` on the incoming module, exactly as required by the project contract.
