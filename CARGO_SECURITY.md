# Cargo security invariants

1. Mobile is never authoritative. Cargo ownership and state transitions are checked by API.
2. Exact addresses are private fields. `GET /v1/cargo/discover` never returns exact addresses or exact coordinates.
3. Draft mutation and state changes use a DB transaction and `SELECT ... FOR UPDATE`.
4. Only `draft` cargo is editable. Only `draft` cargo can be published. Only `draft`/`published` cargo can be cancelled directly.
5. Every create/update/publish/cancel event writes to `audit_event` with actor and session IDs.
6. Discovery is bounded and excludes the current user's own cargo.
7. User-supplied values are validated with Zod before SQL. SQL uses parameters only.
8. Photo binary upload is intentionally not accepted through arbitrary public file paths. `cargo_photo` stores metadata/object keys; S3 signed-upload flow follows in the storage module.
