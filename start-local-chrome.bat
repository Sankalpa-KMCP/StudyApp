@echo off
setlocal DisableDelayedExpansion

if "%~1"=="__WAIT_AND_LAUNCH__" goto WaitAndLaunch

cd /d "%~dp0"

:: 1. Check for npm
where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Error: npm is not available on PATH.
    exit /b 1
)

:: 2. Discover Chrome
set "CHROME_EXE="
for /f "tokens=2*" %%A in ('reg query "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" /ve 2^>nul') do set "CHROME_EXE=%%B"
if not defined CHROME_EXE (
    for /f "tokens=2*" %%A in ('reg query "HKEY_CURRENT_USER\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" /ve 2^>nul') do set "CHROME_EXE=%%B"
)
if not defined CHROME_EXE (
    if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
)
if not defined CHROME_EXE (
    if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)
if not defined CHROME_EXE (
    for /f "delims=" %%I in ('where chrome 2^>nul') do (
        set "CHROME_EXE=%%I"
        goto :ChromeFound
    )
)
:ChromeFound
if not defined CHROME_EXE (
    echo Error: Google Chrome cannot be found.
    exit /b 1
)
if not exist "%CHROME_EXE%" (
    echo Error: Discovered Google Chrome path does not exist: %CHROME_EXE%
    exit /b 1
)

:: 3. Select Port
set "SELECTED_PORT="
for %%P in (40173 40174 40175 40176 40177 40178 40179 40180 40181 40182) do (
    netstat -ano | findstr /R /C:":%%P .*[A-Z]*LISTENING" >nul 2>&1
    if errorlevel 1 (
        set "SELECTED_PORT=%%P"
        goto PortSelected
    )
)

echo Error: All candidate ports (40173-40182) are occupied.
exit /b 1

:PortSelected
set "URL=http://127.0.0.1:%SELECTED_PORT%/"
echo [Launcher] Selected port: %SELECTED_PORT%
echo [Launcher] Local URL: %URL%
echo [Launcher] Press Ctrl+C or close this window to stop the server.
echo.

:: 4. Start background waiter with a lockfile
set "LOCKFILE=%TEMP%\study-launcher-%SELECTED_PORT%-%RANDOM%-%RANDOM%.lock"
type nul > "%LOCKFILE%"
start /B "" cmd /c ""%~f0" __WAIT_AND_LAUNCH__ %SELECTED_PORT% "%CHROME_EXE%" "%LOCKFILE%""

:: 5. Start dev server in foreground
call npm run dev -- --host 127.0.0.1 --port %SELECTED_PORT% --strictPort
if exist "%LOCKFILE%" del "%LOCKFILE%"
exit /b %ERRORLEVEL%

:WaitAndLaunch
set "PORT=%~2"
set "CHROME_BIN=%~3"
set "LOCKFILE=%~4"
set "WAIT_URL=http://127.0.0.1:%PORT%/"
set MAX_RETRIES=45
set RETRY_COUNT=0

:waitLoop
if not exist "%LOCKFILE%" exit /b 1
timeout /t 1 /nobreak >nul
powershell -NoProfile -Command "try { $response = Invoke-WebRequest -Uri '%WAIT_URL%' -UseBasicParsing -TimeoutSec 1; if ($response.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if %ERRORLEVEL% equ 0 (
    echo.
    echo [Launcher] App is ready! Opening Chrome...
    if exist "%LOCKFILE%" del "%LOCKFILE%"
    start "" "%CHROME_BIN%" --new-window "%WAIT_URL%"
    exit /b 0
)

set /a RETRY_COUNT+=1
if %RETRY_COUNT% lss %MAX_RETRIES% goto waitLoop

echo.
echo [Launcher] Error: Dev server did not become reachable within %MAX_RETRIES% seconds.
if exist "%LOCKFILE%" del "%LOCKFILE%"
exit /b 1
