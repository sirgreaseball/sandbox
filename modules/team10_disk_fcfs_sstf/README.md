# Disk Scheduling I — FCFS & SSTF

## Module

Disk Scheduling — FCFS & SSTF

## Description

This interactive Operating Systems visualization module demonstrates two disk scheduling algorithms: First Come First Serve (FCFS) and Shortest Seek Time First (SSTF). Users can enter a disk request queue, specify the initial disk-head position, select an algorithm, and observe the movement of the disk head through an interactive cylinder-track visualization. The module also displays the service sequence, seek distance, cumulative head movement, and a factual FCFS versus SSTF comparison using the same input data.

## Algorithms

### FCFS

First Come First Serve services disk requests in the same order in which they appear in the request queue.

For each movement:

Seek Distance = |Current Head Position - Requested Cylinder|

Total Head Movement is the sum of all seek distances.

### SSTF

Shortest Seek Time First selects the pending disk request with the shortest distance from the current disk-head position.

The process continues until all requests have been serviced.

## Default Sample Input

Request Queue:

98, 183, 37, 122, 14, 124, 65, 67

Initial Head Position:

53

Maximum Cylinder:

199

Default Algorithm:

FCFS

## Features

- FCFS disk scheduling
- SSTF disk scheduling
- Editable request queue
- Editable initial head position
- Editable maximum cylinder
- Interactive disk-track visualization
- Head movement path
- Step-by-step simulation
- Start animation
- Pause animation
- Next-step execution
- Reset functionality
- Movement breakdown table
- Total head movement
- FCFS vs SSTF comparison
- Input validation

## Technology

- HTML5
- CSS3
- Vanilla JavaScript ES6

No framework or build tool is required.

## How to Run

Open `demo.html` directly in a modern web browser.

No npm installation is required.

## Integration Namespace

The module registers itself using:

window.OSDashboard.modules["disk_fcfs_sstf"]

## Required Module Interface

The module exposes:

render(container)

reset()

getMetrics()

## getMetrics()

The module returns:

{
    primaryMetricLabel: "Total Head Movement",
    primaryMetricValue: number,
    unit: "cylinders"
}

## Disk Scheduling Module

Disk Scheduling I — FCFS & SSTF