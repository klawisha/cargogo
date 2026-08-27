param([string]$OutputRoot = "backups")
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$compose = Join-Path $root 'infra/docker-compose.yml'
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$finalOut = Join-Path (Join-Path $root $OutputRoot) $stamp
$workingOut = "$finalOut.partial"

if (Test-Path $workingOut) { Remove-Item -Recurse -Force $workingOut }
New-Item -ItemType Directory -Force -Path $workingOut | Out-Null

try {
  $pgContainer = (docker compose -f $compose ps -q postgres).Trim()
  $minioContainer = (docker compose -f $compose ps -q minio).Trim()
  if (!$pgContainer) { throw 'PostgreSQL container is not running' }
  if (!$minioContainer) { throw 'MinIO container is not running' }

  Write-Host '[1/3] PostgreSQL logical backup...'
  docker compose -f $compose exec -T postgres sh -c 'rm -f /tmp/cargogo-backup.dump && pg_dump -U cargogo -d cargogo -Fc -f /tmp/cargogo-backup.dump'
  if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed' }
  docker cp "${pgContainer}:/tmp/cargogo-backup.dump" (Join-Path $workingOut 'postgres.dump')
  if ($LASTEXITCODE -ne 0) { throw 'docker cp of PostgreSQL backup failed' }
  docker compose -f $compose exec -T postgres rm -f /tmp/cargogo-backup.dump | Out-Null

  $pg = Join-Path $workingOut 'postgres.dump'
  if (!(Test-Path $pg) -or (Get-Item $pg).Length -lt 1024) { throw 'PostgreSQL backup looks invalid' }

  Write-Host '[2/3] MinIO volume backup...'
  # Use --volumes-from instead of parsing docker inspect Go templates. This is
  # robust on Windows PowerShell and works for both named volumes and bind mounts.
  $minio = Join-Path $workingOut 'minio-data.tar.gz'
  docker run --rm --volumes-from "${minioContainer}:ro" -v "${workingOut}:/backup" alpine sh -c 'cd /data && tar -czf /backup/minio-data.tar.gz .'
  if ($LASTEXITCODE -ne 0) { throw 'MinIO archive command failed' }
  if (!(Test-Path $minio) -or (Get-Item $minio).Length -lt 32) { throw 'MinIO backup was not created or is empty' }

  Write-Host '[3/3] Manifest + SHA256...'
  [ordered]@{
    createdAt = (Get-Date).ToUniversalTime().ToString('o')
    project = 'CargoGo'
    formatVersion = 2
    postgres = 'postgres.dump'
    minio = 'minio-data.tar.gz'
    postgresSha256 = (Get-FileHash $pg -Algorithm SHA256).Hash
    minioSha256 = (Get-FileHash $minio -Algorithm SHA256).Hash
    minioBackupMethod = 'docker-volumes-from'
  } | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $workingOut 'manifest.json')

  if (Test-Path $finalOut) { throw "Backup target already exists: $finalOut" }
  Move-Item -Path $workingOut -Destination $finalOut
  Write-Host "Backup ready: $finalOut"
}
catch {
  Write-Error $_
  if (Test-Path $workingOut) {
    Write-Warning "Removing incomplete backup: $workingOut"
    Remove-Item -Recurse -Force $workingOut
  }
  throw
}
