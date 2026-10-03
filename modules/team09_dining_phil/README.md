# Dining Philosophers Simulator

An interactive Operating Systems teaching demo for exploring process synchronization, shared resources, and deadlock through the Dining Philosophers Problem.

## Overview

Five philosophers sit around a circular table with one fork between each neighboring pair. A philosopher needs both adjacent forks to eat. The simulator makes their states, fork ownership, and resource allocation decisions visible.

The landing page introduces the problem, presents a Python example of asymmetric fork acquisition, shows a live table diagram, and explains both the process lifecycle and circular wait. **Start Simulation** opens the interactive simulator.

## Features

- Live table with five philosophers and five forks
- Philosopher states: Thinking, Hungry, and Eating
- Fork ownership display, meal counts, step counter, and event history
- Automatic run, pause, single-step, and reset controls
- Two selectable strategies:
  - **Fixed — Resource Hierarchy:** acquire forks in a consistent order to prevent circular wait.
  - **Naive — Deadlock Prone:** demonstrates how circular wait can block progress.
- Responsive, scrollable cover page with an illustrated deadlock scenario

## Run locally

This is a static web project and does not require a package manager or build step.

1. Download or clone the project.
2. Open `demo.html` in a modern browser.
3. Select an algorithm and use **Start**, **Pause**, **Next Step**, or **Reset** to control the simulation.

For local hosting, serve the project directory with any static HTTP server and open `demo.html` from that server.

## Project files

- `demo.html` — cover page markup and startup wiring for the simulator.
- `module.js` — simulation state, algorithm behavior, controls, and rendered interface.
- `style.css` — cover page and simulator styles.

## Simulation notes

The fixed strategy orders fork acquisition by fork number, removing circular wait in this model. The naive demonstration deliberately reaches a deadlock state to show the consequences of circular resource dependencies. The simulator is an educational visualization; its scheduling policy is simplified for clarity.
