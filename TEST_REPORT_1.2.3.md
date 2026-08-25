# CargoGo v1.2.3 verification upload reliability — test report

## Fixed regressions

1. Mobile no longer calls `Response.blob()` for verification files.
2. Mobile no longer uploads directly to MinIO using a locally signed URL; therefore local Android networking no longer decides whether user uploads succeed.
3. Verification upload uses authenticated multipart HTTP to CargoGo API, then server-side validation and private S3/MinIO storage.
4. `READY` is calculated from actual `verified` identity/license/vehicle states, not from `VERIFICATION_ENFORCEMENT=off`.

## Security invariants checked

- 10 MiB hard multipart limit plus environment-level limit.
- JPEG/PNG/PDF allow-list.
- selfie and vehicle photos cannot be PDF.
- magic-byte MIME validation before object storage.
- vehicle ownership checked server-side.
- document kind/subject association checked server-side.
- generated object keys; user filename is not used as an object key.
- private bucket remains the storage target.
- PostgreSQL stores metadata, not raw document bytes.
- reviewer role remains mandatory for review access and decisions.
- document access remains audited.
- upload abuse guard: max 20 verification document attempts/user/hour.
- storage failures return normalized service errors and trigger best-effort cleanup.

## Automated checks executed in packaging environment

- TS/TSX syntax transpilation: PASS.
- `verify:verification-upload`: PASS.
- `verify:verification`: PASS.
- `verify:economics`: PASS (31.00 UAH fee / 969.00 carrier / 15.09 UAH net fixture).
- `verify:payments`: PASS (LiqPay SHA3-256 signature fixture).
- JSON parse for workspace manifests/lock: PASS.

A full dependency-resolved `tsc --noEmit` was not executed in the packaging container because npm dependency installation timed out. No new dependency was introduced in v1.2.3; run `npm install && npm run typecheck` first on the development machine.

## Device regression checklist

- Upload a small JPEG identity-front file: no Blob warning, result becomes VALIDATED.
- Upload PNG selfie: VALIDATED.
- Attempt PDF selfie: rejected.
- Attempt renamed/non-image bytes with image/jpeg MIME: rejected.
- With identity not_started: sender readiness must show LOCKED even when enforcement is off.
- Moderator can claim the submitted case and only then review it; decision is audit logged.
