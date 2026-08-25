# CargoGo v0.6.0 — Full transaction flow

## Purpose

This release closes the first complete Alpha transaction loop without pretending that a real payment provider is connected.

1. Sender publishes cargo.
2. Driver creates a vehicle and trip.
3. PostGIS produces an eligible `trip_match`.
4. Driver either accepts the listed reward or sends a counter-offer.
5. Sender accepts one offer atomically.
6. Deal starts in `awaiting_payment`.
7. Development-only server mock secures payment and unlocks private addresses.
8. Sender receives a six-digit pickup code. Driver must enter it after physical handoff.
9. Driver starts transit.
10. Driver marks arrival.
11. Sender receives a separate six-digit delivery code and gives it only after inspecting the cargo.
12. Driver enters the delivery code.
13. In development mock mode the payment is marked `released`, cargo becomes `delivered`, deal becomes `completed`.
14. Each participant may leave one review.

## Security invariants

- Mobile never sets deal status directly.
- Every lifecycle command re-checks participant role and current state on the server while holding a row lock.
- Pickup and delivery codes are derived server-side using HMAC-SHA256 with `DEAL_CODE_SECRET`.
- Driver DTOs never include either valid code.
- Sender only receives the code needed for the current physical handoff phase.
- Five incorrect attempts lock the respective code verification for five minutes.
- `PAYMENTS_MODE=mock` is rejected when `NODE_ENV=production`.
- The built-in development code secret is rejected in production.
- Exact private addresses are not returned before a server-confirmed secured payment state.
- Reviews require a completed deal and are unique per `(deal, reviewer)`.

## Production payment boundary

`POST /v1/deals/:id/dev/secure-payment` exists only to test the complete flow before selecting a payment provider. Production must never call this route. A real provider will later replace it with signed provider webhooks and idempotent payment state transitions.
