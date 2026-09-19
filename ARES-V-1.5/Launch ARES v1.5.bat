@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "PORT=8787"
set "URL=http://127.0.0.1:%PORT%"
set "PYTHON_CMD="
where python >nul 2>nul
if not errorlevel 1 (python --version >nul 2>nul && set "PYTHON_CMD=python")
if not defined PYTHON_CMD (
 where py >nul 2>nul
 if not errorlevel 1 (py -3 --version >nul 2>nul && set "PYTHON_CMD=py -3")
)
if not defined PYTHON_CMD (
 echo Python not found. Opening index.html directly.
 start "" "%cd%\index.html"
 exit /b 0
)
echo Starting ARES v1.5...
start "ARES v1.5 Local Server" /min cmd /c "%PYTHON_CMD% -m http.server %PORT% --bind 127.0.0.1"
set /a tries=0
:WAIT
set /a tries+=1
powershell -NoProfile -ExecutionPolicy Bypass -Command "try{$r=Invoke-WebRequest -UseBasicParsing -Uri '%URL%/' -TimeoutSec 1;if($r.StatusCode-ge 200){exit 0}else{exit 1}}catch{exit 1}" >nul 2>nul
if not errorlevel 1 goto READY
if %tries% GEQ 20 goto FAIL
>nul 2>&1 ping 127.0.0.1 -n 2
goto WAIT
:READY
start "" "%URL%/"
exit /b 0
:FAIL
echo Server failed to start. Run manually:
echo %PYTHON_CMD% -m http.server %PORT% --bind 127.0.0.1
pause
