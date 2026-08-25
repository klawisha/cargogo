# CargoGo Marketplace Core v0.5.0

This iteration intentionally keeps routing rough. A trip is represented by a simple PostGIS line/corridor; road maps and precise detour routing remain deferred.

## Core flow

1. A sender publishes cargo.
2. A driver publishes a trip.
3. PostGIS creates an eligible `trip_match`.
4. Only the driver who owns that matched trip may create/update an offer.
5. The cargo owner may accept or reject an offer.
6. Accepting an offer atomically creates one live deal, supersedes competing offers, marks cargo `matched`, and removes discovery matches for that cargo.
7. The initial deal state is `awaiting_payment`. Exact addresses remain locked.
8. Before payment is secured, either participant may cancel; cargo returns to `published` and matching is recomputed.

## Security invariants

- A driver cannot offer on arbitrary cargo IDs; a current `trip_match` is required.
- A driver cannot offer on their own cargo.
- Only the cargo owner can accept/reject incoming offers.
- Only the driver can withdraw their offer.
- One pending offer per `(cargo, trip, driver)`; a repeated submit updates the same pending offer.
- One live deal per cargo is also enforced by a partial unique PostgreSQL index.
- Marketplace write paths lock cargo before trip to reduce deadlock risk.
- Offer acceptance re-validates cargo, trip, match and expiry while rows are locked.
- Private pickup/delivery addresses are not returned by deal APIs until a future server-confirmed secured-payment transition.
- Every material offer/deal mutation writes an `audit_event`; deal lifecycle additionally has append-only `deal_event` records.
- Deal chat is created only with a deal, is accessible only to its two participants, and becomes read-only when the deal is cancelled/refunded.

## Deliberately not implemented yet

- real payment provider / escrow-like marketplace payment flow;
- pickup and delivery code issuance;
- realtime WebSocket/push delivery (REST deal chat is implemented);
- disputes;
- KYC provider integration;
- road-routing provider and maps.

Those features must extend the state machine; the mobile client must never be allowed to directly set deal/payment states.
