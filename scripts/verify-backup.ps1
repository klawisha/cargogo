param([Parameter(Mandatory=$true)][string]$BackupDir)
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$compose=Join-Path $root 'infra/docker-compose.yml'
$dir=(Resolve-Path $BackupDir).Path
$manifestPath=Join-Path $dir 'manifest.json'
if(!(Test-Path $manifestPath)){throw 'manifest.json is missing'}
$m=Get-Content $manifestPath|ConvertFrom-Json
$pg=Join-Path $dir $m.postgres
$minio=Join-Path $dir $m.minio
if(!(Test-Path $pg)){throw 'PostgreSQL dump is missing'}
if(!(Test-Path $minio)){throw 'MinIO archive is missing'}
if((Get-FileHash $pg -Algorithm SHA256).Hash -ne $m.postgresSha256){throw 'PostgreSQL SHA256 mismatch'}
if((Get-FileHash $minio -Algorithm SHA256).Hash -ne $m.minioSha256){throw 'MinIO SHA256 mismatch'}

$pgContainer=(docker compose -f $compose ps -q postgres).Trim()
if(!$pgContainer){throw 'PostgreSQL container is not running'}
$tmp='cargogo_restore_check_'+(Get-Date -Format 'yyyyMMddHHmmss')
Write-Host '[1/2] Verifying PostgreSQL restore into disposable database...'
docker cp $pg "${pgContainer}:/tmp/cargogo-verify.dump"
if($LASTEXITCODE -ne 0){throw 'Could not copy PostgreSQL dump for verification'}
docker compose -f $compose exec -T postgres createdb -U cargogo $tmp
if($LASTEXITCODE -ne 0){throw 'Could not create disposable verification database'}
try {
  docker compose -f $compose exec -T postgres pg_restore -U cargogo -d $tmp --no-owner --no-privileges /tmp/cargogo-verify.dump
  if($LASTEXITCODE -ne 0){throw 'PostgreSQL verification restore failed'}
  docker compose -f $compose exec -T postgres psql -U cargogo -d $tmp -tAc 'SELECT count(*) FROM app_user; SELECT count(*) FROM deal;'
  if($LASTEXITCODE -ne 0){throw 'PostgreSQL verification queries failed'}
}
finally {
  docker compose -f $compose exec -T postgres dropdb -U cargogo --if-exists $tmp | Out-Null
  docker compose -f $compose exec -T postgres rm -f /tmp/cargogo-verify.dump | Out-Null
}

Write-Host '[2/2] Verifying MinIO archive integrity...'
docker run --rm -v "${dir}:/backup:ro" alpine sh -c 'tar -tzf /backup/minio-data.tar.gz >/dev/null'
if($LASTEXITCODE -ne 0){throw 'MinIO archive integrity check failed'}
Write-Host 'BACKUP VERIFY PASS'
