$ErrorActionPreference = "Stop"
Write-Host "Checking Android device..."
adb devices
Write-Host "Forwarding Metro (8081) and API (3000) over USB..."
adb reverse tcp:8081 tcp:8081
adb reverse tcp:3000 tcp:3000
Write-Host "Starting CargoGo mobile..."
npm run dev:mobile
