$ErrorActionPreference = "Stop"
Write-Host "Liveness"
Invoke-RestMethod http://localhost:3000/v1/health/live | ConvertTo-Json
Write-Host "Readiness"
Invoke-RestMethod http://localhost:3000/v1/health/ready | ConvertTo-Json
