$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'
if (!(Test-Path $envFile)) { Copy-Item (Join-Path $root '.env.example') $envFile }
$content = Get-Content $envFile -Raw
$settings = @{
  'TARGET_NET_MARGIN_BPS'='290';
  'REFERENCE_PETROL_MINOR_PER_LITER'='6000';
  'REFERENCE_DIESEL_MINOR_PER_LITER'='5800';
  'REFERENCE_LPG_MINOR_PER_LITER'='3400';
  'REFERENCE_ELECTRICITY_MINOR_PER_KWH'='500'
}
foreach ($key in $settings.Keys) {
  $value=$settings[$key]
  if ($content -match "(?m)^$key=") { $content=[regex]::Replace($content,"(?m)^$key=.*$","$key=$value") }
  else { $content += "`r`n$key=$value" }
}
Set-Content -Path $envFile -Value $content -Encoding UTF8
Write-Host 'CargoGo v1.7 economics configured: target net margin 2.90%, reference energy prices added.'
