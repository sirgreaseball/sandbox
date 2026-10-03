# Disk Scheduling — SCAN & C-SCAN (Team 11)

This module provides an interactive visualization of the **SCAN (Elevator)** and **C-SCAN (Circular SCAN)** disk head scheduling algorithms for operating systems education. It simulates disk arm movement across physical cylinder tracks, dynamically tracking head sweep directions, boundary bounces, circular wrap jumps, and running seek times with step-by-step playback controls, a dynamic Chart.js 2D trajectory graph, and live head movement metrics conforming to the class OS dashboard interface (`window.OSDashboard.modules["team11_disk_scan"]`).

### Built-in Sample Dataset
- **Initial Head Position:** `53`
- **Max Disk Cylinder:** `199` (Total cylinders: 200, tracks 0 to 199)
- **Initial Sweep Direction:** `Increasing (➔ Toward Max Cylinder 199)`
- **Request Queue:** `98, 183, 37, 122, 14, 124, 65, 67`
- **Default Algorithm:** `SCAN` (Total Head Movement: `331 cylinders`; C-SCAN comparison: `382 cylinders`)
