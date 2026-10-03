# FIFO & LRU Page Replacement Simulator

An interactive Operating Systems learning module for FIFO and LRU page replacement.

## Features

- Enter a page reference string using commas or spaces.
- Select 1–6 memory frames.
- Switch between FIFO and LRU.
- Step forward and backward through every reference.
- Auto Play animation.
- Shows HIT / PAGE FAULT.
- Shows running page-fault and page-hit counts.
- Shows hit ratio and fault ratio.
- Shows execution history.
- Includes definitions and manual notebook/exam-solving instructions.
- Theory and manual-solving notes are shown before the interactive simulator so learners can read first and practice second.
- Includes a worked example for:
  `7, 0, 1, 2, 0, 3, 0, 4, 2, 3`
  with 3 frames.
- Responsive light UI.

## Files

- `module.js` — simulator logic and UI rendering
- `style.css` — scoped styling
- `demo.html` — standalone test page
- `README.md` — documentation

## Namespace

```text
window.OSDashboard.modules["team13_page_fifo_lru"]
```

## Public interface

```js
render(container)
reset()
getMetrics()
```

## Run

Open `demo.html` in a browser.

No build tool is required.


### Theory-first navigation
The page presents the learning/theory notes before the interactive simulator, and a clear “Simulation” heading marks where the interactive section begins.
