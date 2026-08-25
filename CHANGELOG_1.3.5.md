# CargoGo 1.3.5 — Handover participant limits fix

- Fixes delivery evidence counters remaining `0/3` after successful uploads.
- Stores `participant_role`, `handover_session_id`, and synchronization grade on every new evidence row.
- Delivery photo limits are now independent: up to 3 driver photos and up to 3 sender photos.
- Pickup remains up to 3 driver photos.
- Migration 021 backfills role/session/synchronization metadata for already uploaded evidence.
- Concurrent fourth uploads return `EVIDENCE_LIMIT_REACHED` instead of leaking a PostgreSQL 500 error.
- Includes the DisputeService query-executor compile fix from 1.3.4 hotfix.
