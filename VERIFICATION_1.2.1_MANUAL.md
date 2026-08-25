# CargoGo v1.2.1 — Manual Verification Pipeline

## Decision model
CargoGo v1.2.1 never auto-approves a user or vehicle in `KYC_MODE=manual`. Valid files and metadata only place the case in `under_review`; a staff member with `verification_reviewer` or `admin` role must resolve it.

UI copy intentionally says review usually takes up to 48 hours and can take longer; this is not a hard SLA.

## Storage security
Raw verification documents are stored only in a private S3-compatible bucket. PostgreSQL stores an opaque generated object key and validation metadata, not document bytes. Upload URLs expire after 10 minutes by default. Reviewer read URLs expire after 5 minutes by default and every issuance is written to `verification_document_access_log`.

The API accepts JPEG, PNG and PDF up to 10 MiB, checks the object after upload, compares size and magic bytes, and rejects content that does not match the declared MIME type. Selfies and vehicle photos cannot be PDF.

Object names are generated server-side and never contain the user's original filename. Ordinary user APIs never expose S3 object keys or reviewer URLs.

## Required evidence
Identity: passport front + selfie, or ID-card front + back + selfie.
Driver licence: front + back.
Vehicle: registration front + back, front + rear photo and insurance document (when insurance is required).

## Manual queue
Review endpoints require a database-backed staff role. There is no API that lets a user grant themselves a staff role.

For a local reviewer account only:
```sql
UPDATE app_user SET staff_role='verification_reviewer' WHERE email='reviewer@example.test';
```
Log out and back in after changing the role so the new authenticated RequestUser contains it.

Reviewer decisions are `verified`, `needs_resubmission`, or `rejected`, require a reason, update the appropriate verification state, and create a `verification_event` audit entry.

## Retention
After a review decision, raw documents receive `retention_until = now + VERIFICATION_DOCUMENT_RETENTION_DAYS` (30 days by default). A protected purge operation deletes expired S3 objects and only then marks their database rows deleted. The production retention period must be reviewed against the actual legal/privacy requirements before launch.

## Local MinIO
`docker compose up -d` now includes `minio-init`, which creates `cargogo-local` and explicitly keeps it private.

Because local signed URLs point at `localhost:9000`, physical Android testing over USB also needs:
```powershell
adb reverse tcp:9000 tcp:9000
```
In production `S3_ENDPOINT` must be HTTPS.
