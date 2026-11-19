# PLC Dashboard (Python + React)

## Install once
1. Python 3.10+  : https://www.python.org/downloads/  (tick "Add Python to PATH")
2. Node.js (LTS): https://nodejs.org/

## Run (Windows)
1. Double-click `1_start_backend.bat`   (leave the window open)
2. Double-click `2_start_frontend.bat`  (leave the window open)
3. Open http://localhost:5173 in Chrome or Edge

## Test without a PLC
Choose port **DEMO** and press connect.

## Real PLC
Close Delixi Visual PLC, plug in the USB-RS485 cable, press Refresh ports, choose the COM port.
Then edit `D_MAP` and `Y_MAP` in `backend/main.py` using the Modbus address table in the PLC manual.
