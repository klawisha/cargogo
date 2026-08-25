# CargoGo Architecture v0.2

## Runtime
`mobile -> HTTPS API -> modular NestJS -> PostgreSQL/PostGIS` with Redis for ephemeral coordination and S3-compatible object storage for private media. KYC, payments, maps/routing and push are provider adapters added behind interfaces rather than embedded across product modules.

## Current modules
- Health: liveness/readiness.
- Database: one bounded `pg` pool plus explicit transaction helper.
- Auth: register/login, opaque access/refresh sessions, rotation/revocation/reuse guard, authenticated `me`.
- Users: trust/profile projection.
- Identity: DB state exists; real provider integration is intentionally deferred until a provider is selected.

## Source of truth
- PostgreSQL: users, sessions, cargo/trips/deals and audit state.
- Payment provider (future): money status, synchronized by verified webhooks.
- KYC provider (future): identity verification result.
- Object storage: private binary objects.
- Redis: never the only copy of durable business state.
- Mobile: never authoritative.

## Environments
Development is Docker-backed locally. Staging and production must have independent DBs, secrets, buckets and provider credentials. Production DB/Redis are not internet-exposed.

## Geo
PostGIS stores `GEOGRAPHY(Point,4326)` pickup/delivery points and trip routes as `GEOGRAPHY(LineString,4326)`. Matching will first use indexed corridor filtering, then a routing provider to calculate real detour time/distance.
