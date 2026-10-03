# Team 6 - Banker's Algorithm

This module visualizes the Banker's Algorithm for Operating Systems, including the Safety Algorithm and Resource-Request Algorithm. It provides editable Allocation and Maximum matrices, an automatically calculated Need matrix, a live Available resource vector, step-by-step Safety Algorithm execution with process highlighting and Safe Sequence construction, and a PASS/FAIL result for submitted resource requests. The default sample contains five processes (P0–P4), three resource types (A, B, C), Allocation = [[0,1,0],[2,0,0],[3,0,2],[2,1,1],[0,0,2]], Maximum = [[7,5,3],[3,2,2],[9,0,2],[2,2,2],[4,3,3]], and Available = [3,3,2].

## Files

- module.js - Banker's Algorithm logic and module interface
- style.css - Team 6 scoped styling
- demo.html - Standalone module testing page

## Module Namespace

window.OSDashboard.modules["team06_bankers"]

## Interface

The module exposes exactly:

- render(container)
- reset()
- getMetrics()

## Metrics

getMetrics() returns:

{
    primaryMetricLabel: "System State",
    primaryMetricValue: "Safe" or "Unsafe",
    unit: ""
}

## Theory Included

The module UI includes a Theory & Algorithms section containing:

- Safe State and Unsafe State explanations
- Need, Work, and resource-release calculations
- Step-by-step Safety Algorithm
- Step-by-step Resource-Request Algorithm
- Conditions `Request <= Need` and `Request <= Available`
- Tentative allocation, safety checking, PASS, FAIL, and rollback behavior

The theory is placed before the interactive Safety Algorithm and Resource-Request sections so the evaluator can read the algorithm and immediately observe its implementation.
