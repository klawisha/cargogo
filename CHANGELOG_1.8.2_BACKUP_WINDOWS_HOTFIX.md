# CargoGo v1.8.2 — Windows Backup/Restore Hotfix

## Fixed

- Replaced fragile `docker inspect -f` Go-template parsing for MinIO `/data` mounts. Windows PowerShell could strip quotes around `/data`, causing Docker to fail with `template parsing error: unexpected "/" in operand`.
- Backup now uses Docker `--volumes-from <minio-container>:ro`, which works for both Docker named volumes and bind mounts without parsing mount metadata.
- Restore uses `--volumes-from` as well and stops MinIO only while its data is replaced.
- Incomplete backups are now written to a `.partial` directory and automatically removed on failure, so a PostgreSQL-only partial backup cannot be mistaken for a complete recovery point.
- Added explicit `$LASTEXITCODE` checks around PostgreSQL, Docker copy, MinIO tar, restore and verify commands.
- Backup manifest format bumped to `2` and records the MinIO backup method.
- Backup verification now validates required files before SHA256 and restore checks.

No database migration is required for v1.8.2.
