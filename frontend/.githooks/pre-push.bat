@echo off
rem Windows fallback pre-push hook for Git for Windows
setlocal enabledelayedexpansion
set ALLOWED_EMAIL=it25100142@my.sliit.lk

for /f "usebackq tokens=*" %%a in (`git config user.email 2^>nul`) do set LOCAL_EMAIL=%%a
if "%LOCAL_EMAIL%"=="" (
  echo ERROR: local git user.email is not set. Set it to %ALLOWED_EMAIL% or configure hooks accordingly.
  exit /b 1
)
if not "%LOCAL_EMAIL%"=="%ALLOWED_EMAIL%" (
  echo ERROR: local git user.email (%LOCAL_EMAIL%) does not match required %ALLOWED_EMAIL%
  exit /b 1
)

rem Read stdin lines describing refs to be pushed
:readloop
set "line="
set /p line=
if "%line%"=="" goto :eof
for /f "tokens=1,2,3,4" %%r in ("%line%") do (
  set local_ref=%%r
  set local_sha=%%s
  set remote_ref=%%t
  set remote_sha=%%u
)

if "%local_sha%"=="0000000000000000000000000000000000000000" goto readloop

if "%remote_sha%"=="0000000000000000000000000000000000000000" (
  set commit_range=%local_sha%
) else (
  set commit_range=%remote_sha%..%local_sha%
)

for /f "delims=" %%c in ('git rev-list %commit_range% 2^>nul') do (
  for /f "usebackq tokens=*" %%a in (`git show -s --format^=%%ae %%c 2^>nul`) do set author_email=%%a
  for /f "usebackq tokens=*" %%b in (`git show -s --format^=%%ce %%c 2^>nul`) do set committer_email=%%b

  if not "!author_email!"=="" if not "!author_email!"=="%ALLOWED_EMAIL%" (
    echo ERROR: commit %%c author email (!author_email!) is not allowed. All commits must use %ALLOWED_EMAIL%
    exit /b 1
  )
  if not "!committer_email!"=="" if not "!committer_email!"=="%ALLOWED_EMAIL%" (
    echo ERROR: commit %%c committer email (!committer_email!) is not allowed. All commits must use %ALLOWED_EMAIL%
    exit /b 1
  )
)

goto readloop

