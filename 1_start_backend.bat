@echo off
cd /d "%~dp0backend"
if not exist venv (
  python -m venv venv
)
call venv\Scripts\activate
pip install -r requirements.txt
set PLC_CONTROL_PIN=4821
uvicorn main:app --port 8000
pause
