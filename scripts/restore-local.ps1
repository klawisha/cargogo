param([Parameter(Mandatory=$true)][string]$BackupDir,[switch]$Force)
if(!$Force){throw 'Restore is destructive. Re-run with -Force after verifying the backup.'}
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$compose=Join-Path $root 'infra/docker-compose.yml'
$dir=(Resolve-Path $BackupDir).Path

& (Join-Path $PSScriptRoot 'verify-backup.ps1') -BackupDir $dir
$m=Get-Content (Join-Path $dir 'manifest.json')|ConvertFrom-Json
$pg=Join-Path $dir $m.postgres
$minioArchive=Join-Path $dir $m.minio

$pgContainer=(docker compose -f $compose ps -q postgres).Trim()
$minioContainer=(docker compose -f $compose ps -q minio).Trim()
if(!$pgContainer -or !$minioContainer){throw 'PostgreSQL and MinIO must be running before restore'}

Write-Host '[1/2] Restoring PostgreSQL...'
docker cp $pg "${pgContainer}:/tmp/cargogo-restore.dump"
if($LASTEXITCODE -ne 0){throw 'Could not copy PostgreSQL dump into container'}
docker compose -f $compose exec -T postgres pg_restore -U cargogo -d cargogo --clean --if-exists --no-owner --no-privileges /tmp/cargogo-restore.dump
if($LASTEXITCODE -ne 0){throw 'PostgreSQL restore failed'}
docker compose -f $compose exec -T postgres rm -f /tmp/cargogo-restore.dump | Out-Null

Write-Host '[2/2] Restoring MinIO volume...'
# Stop MinIO while replacing its underlying data. --volumes-from avoids all
# Windows-specific docker inspect template quoting issues and supports either a
# named volume or a bind mount at /data.
docker compose -f $compose stop minio minio-init | Out-Null
try {
  docker run --rm --volumes-from "$minioContainer" -v "${dir}:/backup:ro" alpine sh -c 'rm -rf /data/* /data/.[!.]* /data/..?* 2>/dev/null || true; cd /data && tar -xzf /backup/minio-data.tar.gz'
  if($LASTEXITCODE -ne 0){throw 'MinIO restore failed'}
}
finally {
  docker compose -f $compose up -d minio minio-init | Out-Null
}

Write-Host 'Restore complete. Run npm run db:migrate and API readiness checks.'
