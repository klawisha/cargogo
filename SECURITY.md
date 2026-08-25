# CargoGo Security Baseline v0.2

CargoGo treats the mobile client as untrusted. Authorization and state transitions must be enforced by the API.

## Implemented in v0.2
- Opaque 256-bit access and refresh tokens; only SHA-256 token hashes are stored server-side.
- Access TTL defaults to 15 minutes; refresh TTL defaults to 30 days.
- Refresh rotation on every use. The immediately previous refresh token is remembered to detect common replay/reuse and revoke that session.
- Passwords are derived with Node.js `scrypt` and a unique 128-bit salt; passwords are never logged or returned.
- Server-side revocation supports current-device and all-device logout.
- Authentication events are persisted in an audit log.
- Parameterized `pg` queries are used for user-controlled values.
- Helmet, a CORS allow-list, global rate limiting, environment validation, and private DB/Redis/MinIO host bindings are enabled.
- Verification status is a server-side trust state; no client can self-mark `verified`. Real KYC provider integration is intentionally not faked.

## Rules for later modules
1. No ownership check may exist only in mobile UI.
2. Payment and KYC webhooks are authoritative only after signature + idempotency verification.
3. Exact private locations are returned only to authorized deal participants at the required stage.
4. Uploaded files use private object storage and short-lived signed URLs.
5. Deal states change only through explicit server commands, never arbitrary status PATCHes.
6. Secrets never enter the repository or mobile bundle.

## Before public beta
Independent security review, API authorization test suite, dependency/SAST/secrets scanning, backup restore drill, abuse/fraud testing, KYC/payment provider review, and production secret rotation are required.
