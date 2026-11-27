"""PLC dashboard backend: FastAPI + pymodbus.

Run:  uvicorn main:app --reload --port 8000
      (other PCs on the network: uvicorn main:app --host 0.0.0.0 --port 8000)

Output control PIN (CHANGE IT):
      Windows cmd :   set PLC_CONTROL_PIN=4821
      PowerShell  :   $env:PLC_CONTROL_PIN="4821"
      then start uvicorn in the same window.
"""
import csv
import io
import os
import random
import secrets
import threading
import time
from collections import deque
from datetime import datetime

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from serial.tools import list_ports
from pymodbus.client import ModbusSerialClient, ModbusTcpClient
from openpyxl import Workbook
from openpyxl.styles import Font

app = FastAPI(title="PLC Dashboard API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ---- Network PLC (Modbus TCP) -----------------------------------------------
# Delixi CDC5 over the LAN port. Change the IP / port here if the PLC changes.
TCP_PLC_IP = "192.168.1.200"
TCP_PLC_PORT = 2000
TCP_PORT_ID = f"TCP:{TCP_PLC_IP}:{TCP_PLC_PORT}"

# ---- Models shown in the dropdown -------------------------------------------
# d_base / y_base are added to the register numbers below to get the real
# Modbus address.
#   Delta DVP : D0 = 0x1000 (4096), Y0 = 0x0500 (1280)
#   Delixi CDC5: D0 = 40000 (verified: D100 -> address 40100).
#               y_base is NOT verified yet (output coils).
MODELS = [
    {"id": "delixi-cdc5", "name": "Delixi CDC5 series", "baud": 9600, "parity": "N", "d_base": 40000, "y_base": 0},
    {"id": "delixi-cdi-e", "name": "Delixi CDI-E series", "baud": 9600, "parity": "N", "d_base": 0, "y_base": 0},
    {"id": "delixi-cdi-s", "name": "Delixi CDI-S series", "baud": 9600, "parity": "N", "d_base": 0, "y_base": 0},
    {"id": "delta-dvp", "name": "Delta DVP series", "baud": 9600, "parity": "E", "d_base": 0x1000, "y_base": 0x0500},
    {"id": "generic", "name": "Generic Modbus RTU", "baud": 9600, "parity": "N", "d_base": 0, "y_base": 0},
]

# ---- Register map: PLC name -> register number (before the base is added) ----
D_MAP = {"D10": 10, "D15": 15, "D20": 20, "D90": 90}
Y_MAP = {"Y000": 0, "Y001": 1, "Y002": 2, "Y003": 3}   # must stay contiguous

state = {"connected": False, "demo": False, "error": None, "model": None,
         "d": {k: 0 for k in D_MAP}, "y": {k: False for k in Y_MAP}, "updated": None}
_client = None
_stop = threading.Event()
_thread = None
_io_lock = threading.Lock()                      # only one Modbus request at a time (poll + write)
_conn = {"slave": 1, "y_base": 0, "demo": False}  # settings of the current connection


class ConnectRequest(BaseModel):
    model: str
    port: str            # e.g. "COM3", "/dev/ttyUSB0", "TCP:192.168.1.200:2000" or "DEMO"
    baud: int = 9600
    parity: str = "N"    # N / E / O
    slave: int = 1


def _call(fn, *args, slave, **kwargs):
    """pymodbus 3.10+ uses device_id=, older versions use slave=."""
    try:
        return fn(*args, device_id=slave, **kwargs)
    except TypeError:
        return fn(*args, slave=slave, **kwargs)


def poll_loop(slave, client, stop, demo, d_base, y_base):
    """Reads all registers once per second and stores the result in `state`."""
    y_names = list(Y_MAP)
    while not stop.is_set():
        try:
            if demo:
                # demo: D values wander, Y outputs only change when you switch them
                for k in D_MAP:
                    state["d"][k] = max(0, state["d"][k] + random.randint(-2, 2)) or 50
            else:
                with _io_lock:
                    # make sure the link is up (TCP can drop; this reconnects)
                    if not client.connected:
                        client.connect()
                    for name, reg in D_MAP.items():
                        r = _call(client.read_holding_registers, d_base + reg, count=1, slave=slave)
                        if r.isError():
                            raise IOError(f"{name}: {r}")
                        state["d"][name] = r.registers[0]
                    # Y000..Y003 are contiguous -> one request for all coils.
                    # If the coil address is not right yet, skip it instead of
                    # stopping the whole dashboard.
                    first = y_base + Y_MAP[y_names[0]]
                    r = _call(client.read_coils, first, count=len(y_names), slave=slave)
                    if not r.isError():
                        for i, name in enumerate(y_names):
                            state["y"][name] = bool(r.bits[i])
            state["error"] = None
            state["updated"] = time.strftime("%H:%M:%S")
        except Exception as e:  # keep running, show the error on the dashboard
            state["error"] = str(e)
        stop.wait(1)


@app.get("/api/models")
def models():
    return MODELS


@app.get("/api/ports")
def ports():
    found = [{"port": p.device, "label": f"{p.device} - {p.description}"} for p in list_ports.comports()]
    found.append({"port": TCP_PORT_ID, "label": f"Network - Delixi PLC ({TCP_PLC_IP}:{TCP_PLC_PORT})"})
    found.append({"port": "DEMO", "label": "DEMO (test without a PLC)"})
    return found


@app.post("/api/connect")
def connect(req: ConnectRequest):
    global _client, _thread, _stop
    disconnect()
    m = next((x for x in MODELS if x["id"] == req.model), None)
    d_base = m["d_base"] if m else 0
    y_base = m["y_base"] if m else 0
    state["model"] = req.model
    demo = req.port == "DEMO"
    client = None
    if not demo:
        if req.port.startswith("TCP:"):
            try:
                _, host, tcp_port = req.port.split(":")
                client = ModbusTcpClient(host, port=int(tcp_port), timeout=2)
            except ValueError:
                raise HTTPException(400, f"Bad network port '{req.port}'. Use TCP:IP:PORT, e.g. {TCP_PORT_ID}")
            if not client.connect():
                raise HTTPException(
                    400,
                    f"Cannot reach {host}:{tcp_port}. Check: ping {host}, Wi-Fi off, "
                    "cable plugged in, and no other program (test scripts, PLC software) holding the PLC connection.",
                )
        else:
            client = ModbusSerialClient(port=req.port, baudrate=req.baud, parity=req.parity,
                                        stopbits=1, bytesize=8, timeout=1)
            if not client.connect():
                raise HTTPException(400, f"Cannot open {req.port}. Is another program (such as the PLC software) using it?")
    else:
        state["y"] = {k: random.random() > 0.5 for k in Y_MAP}   # demo starting point
    _client = client
    _conn.update(slave=req.slave, y_base=y_base, demo=demo)
    state.update(connected=True, demo=demo, error=None, updated=None)
    _stop = threading.Event()
    _thread = threading.Thread(target=poll_loop, args=(req.slave, client, _stop, demo, d_base, y_base), daemon=True)
    _thread.start()
    return {"ok": True}


@app.post("/api/disconnect")
def disconnect():
    global _client, _thread
    _tokens.clear()               # output control locks whenever the link is closed
    _stop.set()
    if _thread:
        _thread.join(timeout=3)   # wait for the old poll thread to finish
        _thread = None
    if _client:
        _client.close()
        _client = None
    state.update(connected=False, demo=False, error=None, updated=None)
    return {"ok": True}


@app.get("/api/data")
def data():
    return state


# ---- Output control (write coil) ---------------------------------------------
# Safety rules:
#   1. PIN needed to unlock; the unlock gives a token that expires after 5 minutes without use.
#   2. 5 wrong PINs -> locked out for 60 seconds.
#   3. After every write the output is READ BACK from the PLC and compared.
#   4. Every attempt (OK / FAIL / MISMATCH) is saved in logs/control_audit.csv.
CONTROL_PIN = os.environ.get("PLC_CONTROL_PIN", "1234")
CONTROL_IDLE_S = 300
if CONTROL_PIN == "1234":
    print("[WARNING] Output control is using the default PIN 1234. Set PLC_CONTROL_PIN to change it.")

_tokens = {}                 # token -> time it expires
_fails = deque()             # times of wrong PIN attempts
_audit_lock = threading.Lock()
AUDIT_FILE = None            # set below (after LOG_DIR exists)


class UnlockRequest(BaseModel):
    pin: str


class OutputRequest(BaseModel):
    name: str
    value: bool


def _audit(ip, output, requested, result, detail=""):
    try:
        with _audit_lock:
            new = not os.path.exists(AUDIT_FILE) or os.path.getsize(AUDIT_FILE) == 0
            with open(AUDIT_FILE, "a", newline="", encoding="utf-8") as f:
                w = csv.writer(f)
                if new:
                    w.writerow(["Time", "Client", "Output", "Requested", "Result", "Detail"])
                w.writerow([time.strftime("%Y-%m-%d %H:%M:%S"), ip, output, requested, result, detail])
    except OSError as e:
        print(f"[audit] could not write: {e}")


def _ip(request: Request):
    return request.client.host if request.client else "?"


def _require_token(tok):
    now = time.time()
    exp = _tokens.get(tok)
    if not tok or exp is None or exp < now:
        _tokens.pop(tok, None)
        raise HTTPException(401, "Output control is locked. Enter the PIN to unlock.")
    _tokens[tok] = now + CONTROL_IDLE_S     # idle timer restarts on every use


@app.post("/api/control/unlock")
def control_unlock(req: UnlockRequest, request: Request):
    now = time.time()
    while _fails and now - _fails[0] > 60:
        _fails.popleft()
    if len(_fails) >= 5:
        raise HTTPException(429, "Too many wrong PINs. Wait 60 seconds and try again.")
    if not secrets.compare_digest(req.pin.encode(), CONTROL_PIN.encode()):
        _fails.append(now)
        _audit(_ip(request), "-", "-", "UNLOCK FAIL", "wrong PIN")
        raise HTTPException(403, "Wrong PIN.")
    for t in [t for t, e in _tokens.items() if e < now]:
        _tokens.pop(t, None)
    token = secrets.token_hex(16)
    _tokens[token] = now + CONTROL_IDLE_S
    _audit(_ip(request), "-", "-", "UNLOCK OK", "")
    return {"token": token, "idle_seconds": CONTROL_IDLE_S}


@app.post("/api/control/lock")
def control_lock(request: Request, x_control_token: str = Header(default="")):
    if _tokens.pop(x_control_token, None) is not None:
        _audit(_ip(request), "-", "-", "LOCK", "")
    return {"ok": True}


@app.post("/api/output")
def write_output(req: OutputRequest, request: Request, x_control_token: str = Header(default="")):
    ip = _ip(request)
    _require_token(x_control_token)
    if req.name not in Y_MAP:
        raise HTTPException(400, f"Unknown output {req.name}.")
    if not state["connected"]:
        raise HTTPException(409, "PLC is not connected.")

    try:
        if _conn["demo"]:
            state["y"][req.name] = req.value
            confirmed = req.value
        else:
            addr = _conn["y_base"] + Y_MAP[req.name]
            slave = _conn["slave"]
            with _io_lock:
                if _client is None:
                    raise IOError("PLC is not connected")
                r = _call(_client.write_coil, addr, req.value, slave=slave)
                if r.isError():
                    raise IOError(f"PLC rejected the write: {r}")
                time.sleep(0.05)
                rb = _call(_client.read_coils, addr, count=1, slave=slave)   # read-back verify
                if rb.isError():
                    raise IOError(f"read-back failed: {rb}")
                confirmed = bool(rb.bits[0])
            state["y"][req.name] = confirmed
    except Exception as e:
        _audit(ip, req.name, "ON" if req.value else "OFF", "FAIL", str(e))
        raise HTTPException(502, f"PLC write failed: {e}")

    if confirmed != req.value:
        _audit(ip, req.name, "ON" if req.value else "OFF", "MISMATCH",
               f"PLC read back {'ON' if confirmed else 'OFF'}")
        raise HTTPException(
            409,
            f"{req.name} did not change (PLC read back {'ON' if confirmed else 'OFF'}). "
            "The PLC program may be controlling this output.",
        )
    _audit(ip, req.name, "ON" if req.value else "OFF", "OK", "")
    return {"ok": True, "name": req.name, "value": confirmed}


# ---- Data logging to CSV / Excel --------------------------------------------
LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
LOG_FILE = os.path.join(LOG_DIR, "plc_log.csv")
AUDIT_FILE = os.path.join(LOG_DIR, "control_audit.csv")
os.makedirs(LOG_DIR, exist_ok=True)

log_state = {"active": False, "interval": 5}
_log_stop = threading.Event()
_log_thread = None
_file_lock = threading.Lock()


class LogRequest(BaseModel):
    interval: int = 5   # seconds between saved rows


def _header():
    return ["Time", "Model"] + list(D_MAP) + list(Y_MAP)


def _row_count():
    if not os.path.exists(LOG_FILE):
        return 0
    with open(LOG_FILE, encoding="utf-8") as f:
        return max(0, sum(1 for _ in f) - 1)


def _rotate_if_header_changed():
    """If D_MAP / Y_MAP changed, keep the old file under another name."""
    if not os.path.exists(LOG_FILE) or os.path.getsize(LOG_FILE) == 0:
        return
    with open(LOG_FILE, newline="", encoding="utf-8") as f:
        first = next(csv.reader(f), [])
    if first != _header():
        os.replace(LOG_FILE, os.path.join(LOG_DIR, f"plc_log_old_{time.strftime('%Y%m%d_%H%M%S')}.csv"))


def _log_loop(interval, stop):
    """Appends one row to the CSV every `interval` seconds while a PLC is connected."""
    while not stop.is_set():
        if state["connected"] and state["updated"] and not state["error"]:
            try:
                with _file_lock:
                    _rotate_if_header_changed()
                    new = not os.path.exists(LOG_FILE) or os.path.getsize(LOG_FILE) == 0
                    with open(LOG_FILE, "a", newline="", encoding="utf-8") as f:
                        w = csv.writer(f)
                        if new:
                            w.writerow(_header())
                        w.writerow([time.strftime("%Y-%m-%d %H:%M:%S"), state["model"]]
                                   + [state["d"][k] for k in D_MAP]
                                   + [int(state["y"][k]) for k in Y_MAP])
            except OSError as e:
                print(f"[log] row skipped (file busy?): {e}")
        stop.wait(interval)


@app.get("/api/log/status")
def log_status():
    return {**log_state, "rows": _row_count(), "file": LOG_FILE}


@app.get("/api/log/preview")
def log_preview(limit: int = 15):
    """Last `limit` logged rows, newest first (for the table on the dashboard)."""
    limit = max(1, min(limit, 200))
    header, rows = _header(), []
    with _file_lock:
        if os.path.exists(LOG_FILE):
            with open(LOG_FILE, newline="", encoding="utf-8") as f:
                reader = csv.reader(f)
                header = next(reader, header)
                rows = list(deque(reader, maxlen=limit))   # keeps only the last rows in memory
    rows.reverse()
    return {"header": header, "rows": rows}


@app.post("/api/log/start")
def log_start(req: LogRequest):
    global _log_stop, _log_thread
    _log_stop.set()
    _log_stop = threading.Event()
    interval = max(1, min(req.interval, 3600))
    log_state.update(active=True, interval=interval)
    _log_thread = threading.Thread(target=_log_loop, args=(interval, _log_stop), daemon=True)
    _log_thread.start()
    return log_status()


@app.post("/api/log/stop")
def log_stop():
    _log_stop.set()
    log_state["active"] = False
    return log_status()


@app.post("/api/log/clear")
def log_clear():
    with _file_lock:
        if os.path.exists(LOG_FILE):
            os.remove(LOG_FILE)
    return log_status()


def _to_number(x):
    try:
        return int(x)
    except ValueError:
        return x


@app.get("/api/log/download")
def log_download(format: str = "xlsx"):
    if _row_count() == 0:
        raise HTTPException(404, "No logged data yet. Connect a PLC (or DEMO) and start logging first.")
    stamp = time.strftime("%Y%m%d_%H%M%S")
    if format == "csv":
        return FileResponse(LOG_FILE, media_type="text/csv", filename=f"plc_log_{stamp}.csv")

    wb = Workbook()
    ws = wb.active
    ws.title = "PLC Log"
    with _file_lock, open(LOG_FILE, newline="", encoding="utf-8") as f:
        for i, row in enumerate(csv.reader(f)):
            if i == 0:
                ws.append(row)
                continue
            try:
                t = datetime.strptime(row[0], "%Y-%m-%d %H:%M:%S")   # real Excel datetime
            except ValueError:
                t = row[0]
            ws.append([t, row[1]] + [_to_number(x) for x in row[2:]])
    for cell in ws[1]:
        cell.font = Font(bold=True)
    for c in ws["A"][1:]:
        c.number_format = "yyyy-mm-dd hh:mm:ss"
    ws.freeze_panes = "A2"
    ws.column_dimensions["A"].width = 20
    ws.column_dimensions["B"].width = 24
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="plc_log_{stamp}.xlsx"'},
    )