# CargoGo v0.4 — Trips, Vehicles, Geo and Matching

## Security invariants

- A trip belongs to one authenticated driver and cannot reference another user's vehicle.
- Exact trip addresses are returned only by owner endpoints.
- Match results expose public pickup/delivery labels, never exact cargo addresses or exact coordinates.
- Cargo belonging to the driver is excluded from that driver's matches.
- Capacity filters are enforced server-side; mobile fields are never trusted as authorization or matching truth.
- Trip cancellation and match recomputation use database transactions and row locks where state changes are involved.
- Audit events are written for trip creation, cancellation and explicit matching refresh.

## Routing quality

v0.4 uses a deliberately marked `rough` fallback route represented by a straight PostGIS LineString. It is good enough to validate the data model, spatial indexes, direction filtering and end-to-end marketplace flow. It is **not a road route and must not be shown as an ETA or exact driving distance**.

`RoutingService` is the replacement boundary. A road-routing provider can later return a detailed LineString, real route distance and duration without changing the Trip API, database shape or Matching module.

## Matching pipeline

1. PostgreSQL/PostGIS filters published cargo with `ST_DWithin` against the trip route corridor.
2. Pickup must appear before delivery along the route (`ST_LineLocatePoint`).
3. Weight and known dimensions must fit the trip's capacity snapshot.
4. Time windows must be plausibly compatible.
5. A deterministic preliminary score (0–100) ranks the candidate set.
6. Matching is recomputed when a trip is created/refreshed and when a cargo item is published.

The `estimatedExtraM` value in v0.4 is a corridor estimate, **not actual detour distance**. Production detour will be calculated by the road-routing provider using `origin → pickup → delivery → destination` versus the original route.
