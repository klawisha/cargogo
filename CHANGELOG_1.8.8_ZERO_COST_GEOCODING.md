# CargoGo 1.8.8 — zero-cost geocoding

- Removed Mapbox Geocoding v6 `permanent=true` completely.
- Address geocoding now uses the public OpenStreetMap Nominatim search endpoint for the zero-cost MVP path.
- Added a strict serialized throttle of at most one Nominatim request per second per API process, per OSMF public-service policy.
- Requests are triggered only by cargo/trip publish/update flows; coordinates are persisted so the same record does not need background re-geocoding.
- `GEOCODING_PROVIDER`, `NOMINATIM_BASE_URL`, and `NOMINATIM_USER_AGENT` are server-side settings, allowing the provider/endpoint to be switched without a mobile release.
- Finance/Ops now reports `osm_nominatim` as a free external service rather than paid Mapbox Permanent Geocoding.
- Added OpenStreetMap attribution near address-aware UI.
- Mapbox remains used only for route/directions functionality under the separately tracked Mapbox Directions quota.

Public Nominatim is appropriate only for modest MVP traffic and requires <=1 request/sec, a valid identifying User-Agent, attribution, caching, and the ability to switch providers. For larger production traffic, self-host Nominatim or replace the backend provider.
