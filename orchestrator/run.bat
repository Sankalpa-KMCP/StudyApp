@echo off
REM Dual-Hermes Orchestrator Runner (Windows CMD / PowerShell)
setlocal

set "ORCH_DIR=%~dp0"
cd /d "%ORCH_DIR%"

if exist "%USERPROFILE%\AppData\Local\hermes\hermes-agent\venv\Scripts\python.exe" (
    set "PYTHON=%USERPROFILE%\AppData\Local\hermes\hermes-agent\venv\Scripts\python.exe"
) else (
    set "PYTHON=python"
)

"%PYTHON%" orchestrator.py %*
endlocal
