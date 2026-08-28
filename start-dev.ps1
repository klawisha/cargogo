$ErrorActionPreference = "Stop"
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path

Start-Process powershell.exe -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$projectPath'; Write-Host '=== CargoGo API :3000 ===' -ForegroundColor Cyan; npm run dev:api"
)

Write-Host "Waiting for CargoGo API on http://127.0.0.1:3000/v1/health/ready ..." -ForegroundColor DarkGray
$ready = $false
for ($i = 0; $i -lt 45; $i++) {
  Start-Sleep -Seconds 1
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:3000/v1/health/ready" -TimeoutSec 2
    if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { $ready = $true; break }
  } catch {}
}

if (-not $ready) {
  Write-Warning "API did not become reachable in time. ngrok will still be opened so you can inspect both windows."
}

Start-Process powershell.exe -ArgumentList @(
  "-NoExit",
  "-Command",
  "Write-Host '=== CargoGo ngrok -> API :3000 ===' -ForegroundColor Magenta; ngrok http 3000"
)

Write-Host "Started API + one ngrok tunnel. MinIO :9000 stays private behind the API file proxy." -ForegroundColor Green
