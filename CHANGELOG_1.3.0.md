# CargoGo 1.3.0 — Handover Evidence

Pickup and delivery now require driver-captured photographic evidence before the corresponding six-digit handover code can be verified.

## Security model
- Camera-only capture in the mobile deal flow; gallery selection is not offered for handover evidence.
- JPEG/PNG only, max 10 MiB, MIME checked against magic bytes on the API.
- Files stored in the existing private S3/MinIO bucket under server-generated random object keys.
- SHA-256 fingerprint and server timestamp are persisted with every evidence record.
- Evidence rows are immutable in PostgreSQL and capped at three photos per stage, including a DB-level concurrency guard.
- Only the assigned driver can upload evidence and only while the deal is in the exact pickup/delivery state.
- Both deal participants may request a 5-minute signed read URL; every access is audited.
- Pickup/delivery codes are not revealed to the sender until the driver's evidence exists.
- Server independently rejects code confirmation if evidence is missing.
- Code hashes/ciphertexts are erased after successful use.
- Handover evidence is automatically surfaced in dispute data and cannot be silently replaced by a participant.

Migration: `017_handover_evidence.sql`.
