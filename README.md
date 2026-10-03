# sandbox · OS Concepts Visualization Dashboard

Team 15, Dashboard Integration. Operating Systems 702CO1C002.

sandbox merges the fourteen concept modules built by Teams 1 to 14 into one dashboard, as described in Section 5 of the project guidelines:

- a navigation list with one entry per module, labelled with the Section 4 titles;
- switching modules resets the one you leave, then renders the next into a freshly cleared container;
- the Index (the Overview tab from Section 5.2) reads every module's `getMetrics()` live;
- an integration log records each submission's contract status.

A scroll-driven landing page introduces all of it.

## How to open it

**Double-click `index.html`.** No server, no install and no build step are needed. Every library is bundled in `vendor/`, so it also works offline.

- Tested in Chrome 154 on Windows (desktop and phone sizes), both from `file://` and from a static web server.
- It needs a browser from 2022 or later: Chrome or Edge 108+, Firefox 110+, or Safari 16+. It uses CSS cascade layers and WebGL2.
- Deep links work, for example `index.html#/overview`, `index.html#/m/team04_round_robin` and `index.html#/integration`.

### Live site

- **https://sandbox-os.vercel.app**, deployed on Vercel from the private GitHub repository `sirgreaseball/sandbox` (branch `main`). Every push to `main` redeploys it.
- It is a plain static site: no framework, no build step. `vercel.json` only adds cache and security headers.
- `.vercelignore` keeps this README, the integration log and `tools/` out of the public site.
- `.gitattributes` stores every file byte for byte, so the team folders on the site match the submissions exactly.

## Using the dashboard

| Where | What it does |
| --- | --- |
| Landing (`#/`) | Scroll through the five topic areas while the WebGL scene changes shape, then pick a module from the gallery. |
| Index (`#/overview`) | Every module's metric label, value and unit, exactly as `getMetrics()` returns them. Rows are flagged where the label or unit differs from Section 4, and the value from before the last reset stays visible. Filter by topic with the pills. On a computer, hovering a row previews the module and lights its core on the turning die at the top; on a phone, each row shows a thumbnail. |
| A module (`#/m/<key>`) | The module renders on its own white stage. The header shows its live `getMetrics()` value, **Reset** (calls `reset()`, then renders fresh) and **Standalone**, which opens the team's own `demo.html`. |
| Integration log (`#/integration`) | Per-team contract checks, some re-run live in the browser. Also what Team 15 adapted, the SHA-256 hash of every submitted file, and screenshots from testing each team's demo on its own. |

Keyboard: **Ctrl K** (**⌘K** on a Mac) opens a quick switcher. **[** and **]** step to the previous or next module. **Esc** closes the switcher or the menu. Switches made from the keyboard are instant; mouse and touch switches animate.

## What is in this folder

```
index.html            the shell and the landing page; its first script is the Section 5.1 registry
theme.css             --os-navy, --os-teal, --os-orange, --os-bg, --os-text (Section 5.1)
modules/              the 14 team folders, byte-identical to what each team submitted (Section 5.4)
shell/
  registry.js         one entry per module: Section 4 key and title, files, expected metric
  lifecycle.js        loading, cascade layers, the reset/render cycle, metric checks
  app.js              navigation, Index, integration log, quick switcher, routing, view transitions
  sandbox.css         all Team 15 styles (every selector is a Team 15 class)
  compat/             Team 15's adapters for submissions that did not load as they were (see below)
landing/              landing script, the hand-written WebGL2 scene, still posters, module previews
integration/          audit data, the file manifest with SHA-256 hashes, isolation screenshots
assets/               embedded fonts (data URIs, because browsers block font files on file://), licences
vendor/               Chart.js 4.4.2, GSAP 3.13 with ScrollTrigger and SplitText, Lenis 1.3.4
tools/                maintainer scripts (Node 18+), not needed to run anything
vercel.json           cache headers for static hosting
INTEGRATION_LOG.md    the Section 5.3 integration log in full
```

Team folders were renamed to the canonical `team<NN>_<shortname>` form when they were copied in; for example `RoundRobin-Team-4` became `modules/team04_round_robin`. Their contents were not changed. [INTEGRATION_LOG.md](INTEGRATION_LOG.md) has the full mapping and the hashes.

## How the integration works

- **Registry.** The first script in `index.html` creates `window.OSDashboard = { modules: {} }`. Every module script registers itself there under its Section 4 key.
- **Lifecycle (Section 5.2).** Switching from module A to module B runs five steps in order:
  1. The shell records A's metric.
  2. It calls `A.reset()` while A is still on the page.
  3. It removes A's container.
  4. It creates a new, empty container, 100% wide and at least 480px tall.
  5. It calls `B.render(container)`.

  `render()` never runs twice on the same container. Every call into a module is wrapped in `try/catch`. If a module fails, the stage shows an inline message with a link to that team's demo, and the failure is recorded in the integration log.
- **Style isolation.** Each module stylesheet is imported into its own CSS cascade layer, and is switched on only while that module is on screen. Team 15's styles are unlayered, so they always win. One module's global selectors therefore can't restyle another module or the dashboard.
- **Chart.js.** It loads only when a module that draws charts (Team 11 or 14) is opened. The bundled copy is used, and jsDelivr is the fallback.
- **Adapters.** Three submissions needed Team 15 code to load. None of it edits a team file.
  - Team 1's `module.js` is empty, and its module lives in `demo.html`. `tools/extract-compat.mjs` copies that inline script byte for byte.
  - Team 4 never registers with `window.OSDashboard`. `shell/compat/team04_round_robin.adapter.js` provides `render`, `reset` and `getMetrics` around Team 4's own markup and functions.
  - Team 10 registers under the wrong key. `shell/compat/aliases.js` adds the correct one.

## The landing page

- **Scrolling:** Lenis smooths the scroll, and every scroll animation is a GSAP ScrollTrigger linked to it. After the first load, every animation is scrubbed by the scroll, so scrolling back plays it backwards. Nothing pins or snaps: chapter text scrolls past at reading speed, its heading rising word by word.
- **The scene:** a WebGL2 scene written by hand (`landing/gl/engine.js`) that draws up to 32,000 particles in one draw call.
  - It sits in a dark rounded frame that opens to full width as you scroll.
  - The particles form one 3D object per chapter, and the object turns as you scroll:
    - a processor die whose fourteen module cores boot around one kernel core;
    - a helix of CPU bursts, one strand per scheduler;
    - a trefoil knot, a circular wait that can't be undone;
    - three gears turning in lockstep;
    - three disk platters with seek arms;
    - a lattice of page frames loading and evicting;
    - the die again, every core wired to the kernel.
  - Between chapters the object turns and re-forms into the next one, sweeping from one end to the other.
  - Every formation lays its particles out in the same order, so neighbouring particles travel together.
  - It responds to the pointer:
    - particles under it part and brighten;
    - dragging turns the object, with momentum;
    - a click sends a ripple through it;
    - hovering a module link lifts that module's part of the object.
  - Post-processing adds bloom, a faint chromatic aberration, a vignette and film grain.
- **First load:** a loader covers the page while the fonts load, every shader program compiles and the first frames render. Nothing compiles during scrolling. The loader shows once per browser session.
- **Quality** adapts to the device: particle count, pixel ratio and bloom step down if frames run slow.
- **Fallbacks:** without WebGL2, with a software renderer, or with reduced motion requested, the page cross-fades still frames rendered from the same scene (`landing/posters/`) and turns off smooth scrolling. Add `?nogl` to the URL to see this mode.

## Checking the work

- `node tools/verify.mjs` checks that all 58 files in `modules/` are byte-identical to the original submissions. It also checks that the Team 1 and Team 4 extractions match their source bytes.
- `integration/isolation/` holds the evidence for Section 5.3. Each team's own `demo.html` was opened and driven before integration, with screenshots at the start, mid-run and end.
- End-to-end runs logged zero console errors or warnings. They rendered every module, used its controls, reset it and switched away, and included rapid keyboard switching. Results are in INTEGRATION_LOG.md.

## Team 15


## Credits and licences

- Chart.js 4.4.2, MIT licence (`vendor/chart.js.LICENSE.md`).
- GSAP 3.13 with ScrollTrigger and SplitText, © GreenSock, used under the GSAP Standard "no charge" licence (https://gsap.com/standard-license).
- Lenis 1.3.4 by darkroom.engineering, MIT licence (`vendor/lenis.LICENSE.md`).
- Sandbox Sans is a Latin subset of Mona Sans by the Mona Sans Project Authors, under the SIL Open Font License 1.1. It was renamed because "Mona" is a Reserved Font Name (`assets/fonts/LICENSE-MonaSans.txt`).
- Sandbox Mono is a Latin subset of Geist Mono by the Geist Project Authors, SIL Open Font License 1.1 (`assets/fonts/LICENSE-GeistMono.txt`).
- Icons: Phosphor Icons, MIT licence (`assets/LICENSE-Phosphor.txt`).
- The fourteen modules in `modules/` belong to Teams 1 to 14.

Section 2.1 limits the fourteen content modules to Chart.js. GSAP and Lenis are used only by Team 15's own shell and landing page; no module depends on them.

## Use of generative AI (Section 6)

The course allows generative AI for this component if it is cited. Team 15 used **Claude Code (Anthropic), model Claude Opus 5.5**, in September and October 2026. It was used to:

- read the guidelines and all fourteen submissions, and draft the contract audit;
- write the dashboard shell, the Team 1, 4 and 10 adapters, the landing page and its WebGL scene, the Node tools and this documentation;
- run the browser tests, isolation screenshots and Lighthouse checks.

Team 15 reviewed and tested the output. No team module was edited, and `tools/verify.mjs` checks this against the original files.
