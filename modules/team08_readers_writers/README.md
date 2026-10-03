# Team 08 - Readers-Writers Problem

## 1. Module Name
Readers-Writers Problem

## 2. Team Number
Team 8

## 3. Problem Description
The Readers-Writers problem is a classical synchronization problem involving a shared resource that is accessed by multiple concurrent processes. The challenge is to synchronize these processes such that:
- Multiple readers can access the shared resource simultaneously.
- Any writer requires exclusive access to the resource.
- No reader or writer should access the resource when it's mutually exclusive for another.

## 4. Algorithm Implemented
This module implements the **first readers-writers solution** (readers-preference). 
- If a writer is currently writing, new readers and writers must wait.
- If readers are currently reading, new readers can join them immediately.
- If readers are currently reading, new writers must wait.
- When the shared resource becomes completely free, waiting readers are prioritized and can enter. Otherwise, the next waiting writer is allowed in.

## 5. How the Visualization Works
- **Active Readers**: Shows the numeric count of readers accessing the resource.
- **Writer Lock**: Displays `UNLOCKED` when no writer is accessing, and `LOCKED` when a writer has exclusive access.
- **Shared Resource**: Visually displays the processes (e.g., `[ R1 ]`, `[ W1 ]`) currently inside the resource.
- **Waiting Queues**: Shows processes that have arrived but are blocked by the synchronization rules. Hovering over a waiting process displays the reason it is waiting.
- **Access Timeline**: A live log of all events (arrivals, entries, departures).

## 6. Controls
- **Reader Arrives**: Simulates a new reader process arriving and attempting to access the resource.
- **Writer Arrives**: Simulates a new writer process arriving and attempting to access the resource.
- **Clear Log**: Clears the event timeline log.

## 7. Sample/Default Behavior
Initially, the resource is completely empty (`Active Readers: 0`, `Writer Lock: UNLOCKED`). 
- When a user clicks "Reader Arrives", the reader enters the resource and stays for a few seconds before automatically leaving.
- When a user clicks "Writer Arrives" while readers are active, the writer will enter the "WAITING WRITERS" queue until all readers have left, at which point it acquires the exclusive lock and enters.
- The module is configured to work automatically out of the box with zero external configuration.

## 8. How to run `demo.html`
Simply open the `demo.html` file in any modern web browser. 
No build steps, npm, or local servers are required. The module relies entirely on HTML5, CSS3, and Vanilla JavaScript ES6. 
No external libraries (including Chart.js) are used, keeping it lightweight and fully self-contained.
