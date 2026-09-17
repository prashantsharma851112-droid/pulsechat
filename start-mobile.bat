@echo off
echo Starting PulseChat React Native (Expo) Mobile App...
cd /d %~dp0mobile
set EXPO_HOME=%~dp0mobile\.expo_home
set EXPO_CACHE_DIR=%~dp0mobile\.expo_cache
set XDG_CACHE_HOME=%~dp0mobile\.cache
set USERPROFILE=%~dp0mobile\.userprofile

if not exist "%EXPO_HOME%" mkdir "%EXPO_HOME%"
if not exist "%EXPO_CACHE_DIR%" mkdir "%EXPO_CACHE_DIR%"
if not exist "%XDG_CACHE_HOME%" mkdir "%XDG_CACHE_HOME%"
if not exist "%USERPROFILE%" mkdir "%USERPROFILE%"

echo Installing / Syncing Expo SDK Packages...
call npm install

echo.
echo Launching Expo in Tunnel Mode for Mobile Phone connection...
npx expo start --tunnel
pause