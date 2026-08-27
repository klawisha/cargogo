# CargoGo local backup / restore

No paid backup provider is required for grant-stage testing. The repository contains scripts for PostgreSQL and the private MinIO object store.

Create a timestamped backup:

```powershell
npm run backup:local
```

Verify a backup without touching the live CargoGo database. The script restores PostgreSQL into a disposable database and validates the MinIO tar archive:

```powershell
npm run backup:verify -- -BackupDir .\backups\YYYYMMDD-HHMMSS
```

A real restore is destructive and therefore requires an explicit `-Force`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\restore-local.ps1 -BackupDir .\backups\YYYYMMDD-HHMMSS -Force
npm run db:migrate
```

Keep backup folders outside Git. For real production, copies must also be stored off the application server and encrypted; these local scripts are a grant/staging safety baseline, not a production disaster-recovery substitute.
