# CargoGo v1.2.3 — Verification Upload Reliability

- Replaced mobile direct-to-MinIO presigned uploads with authenticated multipart upload through the CargoGo API.
- Removed React Native `Response.blob()` from verification uploads.
- API validates ownership, document kind, declared MIME, size, and magic bytes before storing the object.
- Verification objects remain private in S3/MinIO; PostgreSQL stores metadata only.
- Added a per-user verification-upload abuse guard (20 uploads/hour) in addition to the 10 MiB hard file limit.
- Storage failures are normalized to explicit 503 errors and orphaned objects/rows are cleaned up best-effort.
- Added verification `readiness` separate from enforcement-driven operation capabilities. The UI can no longer show READY for an unverified identity just because enforcement is disabled in development.
- Legacy presigned endpoints remain temporarily for alpha compatibility, but v1.2.3 mobile does not use them.
