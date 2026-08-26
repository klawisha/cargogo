$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root '.env'
if (-not (Test-Path $envPath)) {
  Copy-Item (Join-Path $root '.env.example') $envPath
  Write-Host 'Created .env from .env.example.' -ForegroundColor Yellow
}
$content = Get-Content $envPath -Raw
if ($content -match '(?m)^VERIFICATION_ENFORCEMENT=') {
  $content = [regex]::Replace($content, '(?m)^VERIFICATION_ENFORCEMENT=.*$', 'VERIFICATION_ENFORCEMENT=on')
} else {
  $content += "`r`nVERIFICATION_ENFORCEMENT=on`r`n"
}
Set-Content -Path $envPath -Value $content -NoNewline
Write-Host 'VERIFICATION_ENFORCEMENT=on' -ForegroundColor Green
Write-Host 'Restart the API process for the change to take effect.' -ForegroundColor Cyan
