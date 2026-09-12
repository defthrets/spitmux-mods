@echo off
rem  The bug chat's warden, as a desktop window.
rem
rem  The page itself lives on the homelab and is served by the chat service, so
rem  there is nothing to install and nothing to keep in step -- this only opens
rem  it in a browser window with no browser furniture, which is all a desktop
rem  app is once you take the chrome off.
rem
rem  The warden answers on the house network only -- the service tells anything
rem  arriving through the tunnel that there is nothing there. So this looks for
rem  the homelab, and says so plainly if it cannot see it, rather than opening a
rem  window onto a 404.

setlocal
set "LAN=http://192.168.1.253:8712"
set "URL=%LAN%/admin"

curl -s -m 3 -o nul "%LAN%/api/health"
if errorlevel 1 (
  echo.
  echo   The homelab is not answering on this network.
  echo.
  echo   The warden is deliberately not on the internet: it only listens at
  echo   %LAN% . Get on the house wifi, or bring up whatever
  echo   VPN you use, and run this again.
  echo.
  pause
  exit /b 1
)

set "APP="
if exist "%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe" set "APP=%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"
if not defined APP if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "APP=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined APP if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "APP=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined APP if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "APP=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined APP if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "APP=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"

if defined APP (
  start "" "%APP%" --app=%URL% --window-size=1280,860 --user-data-dir="%LOCALAPPDATA%\spitmux-warden"
) else (
  rem no chromium about; the ordinary browser will do
  start "" %URL%
)
endlocal
