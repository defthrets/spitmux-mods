@echo off
rem  The bug chat's warden, as a desktop window.
rem
rem  The page itself lives on the homelab and is served by the chat service, so
rem  there is nothing to install and nothing to keep in step -- this only opens
rem  it in a browser window with no browser furniture, which is all a desktop
rem  app is once you take the chrome off.
rem
rem  It prefers the homelab directly when this machine can see it: no round trip
rem  through Cloudflare, and it still works if the tunnel is down. Otherwise it
rem  goes the way everyone else does.

setlocal
set "LAN=http://192.168.1.253:8712"
set "FAR=https://chat.spitmux.me"
set "URL=%FAR%/admin"

curl -s -m 2 -o nul "%LAN%/api/health" && set "URL=%LAN%/admin"

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
