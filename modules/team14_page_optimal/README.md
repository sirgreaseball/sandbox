# OS Concepts Visualization Dashboard: Team 14

**Module:** Page Replacement II — Optimal Algorithm & Comparison Chart  
**Team:** Team 14  
**Category:** Memory Management  

## Overview
This module visualizes the **Optimal Page Replacement Algorithm** and provides a comparison chart against FIFO and LRU algorithms based on a given reference string and memory frame count.

## Technologies Used
- HTML5
- CSS3
- Vanilla JavaScript ES6
- Chart.js v4 (via CDN)

No additional frameworks or libraries were used. The module is entirely self-contained.

## Installation & How to Run
1. Clone the repository or download the source code.
2. Navigate to the project directory: `cd team14_page_optimal`
3. Simply open `demo.html` in any modern web browser. No server, build tools, or configuration are required.

## Default Sample Input
- **Reference String:** `7 0 1 2 0 3 0 4 2 1 0`
- **Frames:** `3`

## Algorithms Included

### Optimal Page Replacement
When a page fault occurs and memory is full, the Optimal algorithm looks ahead into the future references and replaces the page whose next use is farthest away.
- **Tie-Breaking Rule:** If multiple pages are never used again (distance = Infinity), the algorithm breaks ties deterministically by selecting the first matching frame in frame order (e.g., Frame 1 over Frame 2).

### FIFO (First-In-First-Out)
Replaces the page that was added to memory the earliest. Used for background comparison.

### LRU (Least Recently Used)
Replaces the page that has not been referenced for the longest time in the past. Used for background comparison.

## Interface & Usage
- **Apply & Restart**: Loads the current input and restarts the simulation.
- **Play**: Automatically steps through the reference string at the selected speed.
- **Pause**: Pauses playback.
- **Step**: Manually advances the simulation by one reference.
- **Reset**: Restores the default sample input and resets all module states.

The **Algorithm Comparison** chart will dynamically update based on the given reference string and frames, recalculating the total faults for FIFO, LRU, and Optimal independently.
