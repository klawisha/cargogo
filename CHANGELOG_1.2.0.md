# v1.2.0 — Identity & Vehicle Verification Core

- Added migration `015_verification_core.sql`.
- Added rich state machines for identity, driver licence and vehicle verification.
- Added verification event audit trail.
- Added privacy-minimized document metadata model (no raw photos/full document numbers in PostgreSQL).
- Added `/verification/identity/submit`, `/verification/driver-license/submit`, `/verification/vehicles/:id/submit`.
- Extended `/verification/me` into a complete trust-center summary with capabilities.
- Reworked mock resolver to resolve identity/licence/vehicle independently; mock resolver remains forbidden in production.
- Added optional server-side enforcement for cargo publish, trip create/update and offers.
- Production refuses to boot with verification enforcement disabled.
- Added mobile Trust Center for identity, driver licence and every vehicle.
- Added `verify:verification` architecture fixture and `smoke-verification.ps1`.
- Existing payments/economics logic is unchanged.
