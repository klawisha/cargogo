# CargoGo v0.8 — Trust & Safety Core

This release intentionally keeps routing/map work frozen and strengthens the marketplace lifecycle.

## Added
- In-app durable notifications stored in PostgreSQL.
- Verification request lifecycle with an explicit provider boundary. Development-only resolution exists for Alpha testing; production provider integration is still intentionally absent.
- Deal disputes with participant-only access, append-only evidence notes, frozen deal state, and development-only resolution.
- Schema readiness now requires migration 011 and all trust/safety tables.
- `verify:modules` creates the full Nest application context to catch DI/module-graph failures before runtime.
- Location DI graph fixed explicitly: LocationModule imports AuthModule; CargoModule and TripModule import LocationModule.

## Important production boundary
No actual passport image ingestion is implemented. No real payment dispute/refund API is implemented. Development resolution endpoints are forbidden by NODE_ENV=production checks. Production must use a real KYC provider, real payment provider webhooks, admin authorization, and object-storage evidence uploads.
