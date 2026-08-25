# CargoGo v0.5.1 reliability hardening

This patch deliberately prioritizes correctness over new surface features.

## Server-authoritative quick departure

The mobile quick presets send `departureInMinutes` (60, 180, 360, ...). The API computes the absolute UTC timestamp from server time. Device clock/timezone is not trusted for this flow.

## Vehicle creation is explicit and retry-safe

Vehicle creation is a separate UI action. A stable per-form `clientReference` is sent to the API. The database has a partial unique index `(owner_id, client_reference)` so a retry after a network interruption returns the same vehicle instead of creating a duplicate.

## Schema fail-fast

The API checks the expected migration plus critical tables before listening on the network. An outdated DB therefore fails at bootstrap with a migration instruction instead of later surfacing raw `relation does not exist` errors.

`GET /v1/health/ready` performs the same schema contract check at runtime.

## Coordinate validation

Coordinates remain temporary development inputs until the map/address layer is added. Both mobile and API validate legal lat/lng ranges and reject identical origin/destination points.
