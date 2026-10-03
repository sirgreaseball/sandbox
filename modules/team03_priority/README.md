# Team 3: Priority Scheduling — Non-Preemptive & Preemptive

CPU Scheduling Visualization Module for the Operating Systems Dashboard.

## Module Overview

- **Team**: Team 3
- **Module**: Priority Scheduling — Non-Preemptive & Preemptive
- **Namespace**: `window.OSDashboard.modules["team03_priority"]`
- **Stack**: Vanilla JavaScript (ES6+), HTML5, CSS3 (No frameworks, no build tools, zero npm dependencies)

---

## Priority Convention

This module strictly implements the standard operating systems priority convention:

> **LOWER NUMERIC VALUE = HIGHER PRIORITY**
>
> • Smaller priority number = higher priority  
> • Larger priority number = lower priority  
> • Priority 1 is higher than Priority 2 (`1 > 2`)  
> • Priority 2 is higher than Priority 3 (`2 > 3`)  
> • Priority 3 is higher than Priority 4 (`3 > 4`)  

This convention is maintained across all scheduling engines, comparative operations, user interface elements, step explanations, and automated tests.

### Tie-Breaking Rule
When multiple processes have identical priority:
1. **Earlier Arrival Time (AT)** is selected first.
2. If Arrival Times are also identical, **original input order** is used deterministically.

---

## Core Features

- **Interactive Process Input**: Add, edit, or remove processes dynamically with instant inline input validation.
- **Input Validation**:
  - **PID**: Non-empty, unique across all processes.
  - **Arrival Time (AT)**: Integer $\ge 0$.
  - **Burst Time (BT)**: Integer $> 0$.
  - **Priority**: Positive integer $\ge 1$.
- **Dual Scheduling Modes**:
  - **Non-Preemptive Priority Scheduling**
  - **Preemptive Priority Scheduling**
- **Live Ready Queue Visualization**: Displays only arrived and unfinished processes waiting for the CPU, dynamically sorted by `Priority ASC → AT ASC → Input Order ASC`. In preemptive mode, remaining burst times are displayed.
- **Real Event-Driven Gantt Chart**: Generated directly from scheduling events (never hardcoded or parsed from DOM), including accurate CPU idle periods and multi-segment process runs.
- **Preemption Analysis Panel**: In preemptive mode, documents exact preemption triggers (time, preempted PID, arriving PID with strictly higher priority). If no preemption occurs, clearly explains why.
- **Step-by-Step Discrete Simulation**:
  - Controls: `Start`, `Pause`, `Next Step`, `Run to End`, `Reset`.
  - Adjustable speed slider (100 ms to 1500 ms per tick).
  - Synchronized state indicators (Current Time, CPU State, Completed Count, Dynamic Educational Explanations).
- **Comprehensive Process Metrics**:
  - First CPU Start Time
  - Completion Time (CT)
  - Turnaround Time (TAT)
  - Waiting Time (WT)
  - Response Time (RT)
  - Summary cards for Average WT, Average TAT, Average RT, and CPU Utilization (%).

---

## Scheduling Algorithms

### 1. Non-Preemptive Priority Scheduling

1. At time $t$, identify all processes that have arrived and are not finished ($AT \le t$).
2. If no processes are ready, the CPU enters the **IDLE** state until the earliest future arrival time.
3. From the ready set, select the process with the smallest priority number (highest priority). Apply arrival time and input order tie-breaking if priorities are equal.
4. Once allocated, the process runs uninterrupted until its entire burst time is satisfied:
   $$\text{Start Time} = t$$
   $$t \leftarrow t + BT$$
   $$\text{Completion Time} = t$$
5. Any higher-priority processes arriving during this window are queued in the ready queue and must wait until the current process completes.

### 2. Preemptive Priority Scheduling

1. The simulation advances in discrete time units ($t = 0, 1, 2, \dots$).
2. At time $t$, identify all processes with $AT \le t$ that are unfinished.
3. If a process is currently executing:
   - Check if any arrived unfinished process has a **strictly higher priority** (strictly smaller numeric value).
   - If yes: **Preempt** the currently running process, return it to the ready queue, record a preemption event, and allocate the CPU to the higher-priority process.
   - If a newly arrived process has the **same priority** as the currently running process: **Do NOT preempt**. The running process continues to avoid unnecessary context switches.
4. If the CPU was idle or preempted, select the ready process with the smallest priority number.
5. Execute the selected process for 1 time unit:
   $$\text{remainingBt} \leftarrow \text{remainingBt} - 1$$
6. If `remainingBt == 0`:
   - Mark process as finished.
   - Set $\text{Completion Time} = t + 1$.
7. Repeat until all processes are complete.

---

## Metric Formulas

- **Completion Time (CT)**: The exact time at which the process finishes its total burst time.
- **Turnaround Time (TAT)**: Total elapsed time from arrival to completion.
  $$\text{TAT} = \text{CT} - \text{AT}$$
- **Waiting Time (WT)**: Total time spent waiting in the ready queue without CPU execution.
  $$\text{WT} = \text{TAT} - \text{BT}$$
  *(For preemptive scheduling, accurately accounts for all intermediate waiting intervals).*
- **Response Time (RT)**: Time from process arrival to its **first** allocation of CPU.
  $$\text{RT} = \text{First CPU Start Time} - \text{AT}$$
  *(Does not change after preemption).*
- **Averages**:
  $$\text{Average WT} = \frac{\sum \text{WT}}{N}$$
  $$\text{Average TAT} = \frac{\sum \text{TAT}}{N}$$
  $$\text{Average RT} = \frac{\sum \text{RT}}{N}$$

---

## Module Contract & API

```javascript
window.OSDashboard = window.OSDashboard || { modules: {} };

window.OSDashboard.modules["team03_priority"] = {
  title: "Priority Scheduling",
  render: function(container) {
    // Mounts complete UI into container element
  },
  reset: function() {
    // Restores default sample data, resets mode to Non-Preemptive,
    // clears simulation state, timers, Gantt chart, and results.
  },
  getMetrics: function() {
    // Always returns:
    return {
      primaryMetricLabel: "Avg Waiting Time",
      primaryMetricValue: 6.20, // number, 0 if simulation not yet complete
      unit: "units"
    };
  }
};
```

---

## Default Sample Data Verification

### Input Data
| PID | Arrival Time (AT) | Burst Time (BT) | Priority |
| :---: | :---: | :---: | :---: |
| **P1** | 0 | 4 | 2 |
| **P2** | 1 | 3 | 1 |
| **P3** | 2 | 6 | 3 |
| **P4** | 3 | 2 | 4 |
| **P5** | 4 | 5 | 2 |

### Execution Trace (Non-Preemptive)
1. **$t = 0$**: Only P1 has arrived. P1 runs from $0 \to 4$.
2. **$t = 4$**: P1 completes. Arrived: P2 (P=1), P3 (P=3), P4 (P=4), P5 (P=2). P2 has smallest priority number (1). P2 runs from $4 \to 7$.
3. **$t = 7$**: P2 completes. Ready: P5 (P=2), P3 (P=3), P4 (P=4). P5 has highest priority (2). P5 runs from $7 \to 12$.
4. **$t = 12$**: P5 completes. Ready: P3 (P=3), P4 (P=4). P3 has highest priority (3). P3 runs from $12 \to 18$.
5. **$t = 18$**: P3 completes. Ready: P4 (P=4). P4 runs from $18 \to 20$.

### Non-Preemptive Results Table
| PID | AT | BT | Priority | Start | CT | TAT | WT | RT |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **P1** | 0 | 4 | 2 | 0 | 4 | 4 | 0 | 0 |
| **P2** | 1 | 3 | 1 | 4 | 7 | 6 | 3 | 3 |
| **P5** | 4 | 5 | 2 | 7 | 12 | 8 | 3 | 3 |
| **P3** | 2 | 6 | 3 | 12 | 18 | 16 | 10 | 10 |
| **P4** | 3 | 2 | 4 | 18 | 20 | 17 | 15 | 15 |

- **Average Waiting Time**: **6.20 units**
- **Average Turnaround Time**: **10.20 units**
- **Average Response Time**: **6.20 units**

---

## Automated Test Cases

The test suite in `tests.html` verifies 11 comprehensive automated tests:

1. **Test 1 - Default Non-Preemptive**: Execution order `P1 -> P2 -> P5 -> P3 -> P4`, `Avg WT = 6.20`, `Avg TAT = 10.20`, `Avg RT = 6.20`.
2. **Test 2 - Preemption**: P1 (AT=0, BT=8, P=3) and P2 (AT=2, BT=3, P=1) produces Gantt `P1(0-2) -> P2(2-5) -> P1(5-11)` with P1 CT=11 WT=3 RT=0, P2 CT=5 WT=0 RT=0, and 1 preemption event.
3. **Test 3 - Same Priority Non-Preemption**: P1 (AT=0, BT=5, P=2) and P2 (AT=2, BT=2, P=2) confirms P1 continues uninterrupted to $t=5$ without fake preemption.
4. **Test 4 - CPU Idle Time**: P1 (AT=3, BT=2, P=1) confirms Gantt `IDLE(0-3) -> P1(3-5)` with CT=5, TAT=2, WT=0, RT=0.
5. **Test 5 - Priority Ordering**: P1 (P=4), P2 (P=1), P3 (P=3) all arriving at $t=0$ execute in order `P2 -> P3 -> P1`.
6. **Test 6 - Equal Priority & Arrival**: P1 (AT=0, BT=2, P=2) and P2 (AT=0, BT=3, P=2) tie-break by original input order: `P1 -> P2`.
7. **Test 7 - PID Validation**: Rejects duplicate PIDs and empty PIDs with explicit error messages.
8. **Test 8 - Burst Time Validation**: Rejects $BT = 0$ and $BT < 0$.
9. **Test 9 - Priority Validation**: Rejects $Priority = 0$ and $Priority < 0$.
10. **Test 10 - Arrival Time Validation**: Rejects $AT < 0$.
11. **Test 11 - Module Contract**: Verifies `window.OSDashboard.modules["team03_priority"]` adheres strictly to `title`, `render`, `reset`, and `getMetrics` without throwing.

---

## How to Run

1. Open `demo.html` directly in any modern web browser:
   ```
   file:///c:/Users/rishi/Downloads/OS-MINI/team03_priority/demo.html
   ```
2. Or run a local static HTTP server:
   ```bash
   npx serve .
   # or
   python -m http.server 8000
   ```
3. Open `tests.html` to run the automated test suite with real-time pass/fail reports.
