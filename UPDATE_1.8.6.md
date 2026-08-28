# CargoGo 1.8.6

This release fixes draft recovery after KYC and replaces city-centre-only location handling with address-aware matching.

## User flow
- Cargo created before identity verification can remain a draft.
- After verification, the cargo detail screen exposes `ОПУБЛІКУВАТИ ВАНТАЖ`.
- Editing a draft performs save + publish when verification now allows publication.
- Publishing an old draft re-geocodes its stored pickup/delivery addresses before matching.

## Same-city deliveries
- Same city is now allowed for both cargo and trips when addresses differ.
- Same city + same normalized address is rejected.
- Server-side OpenStreetMap Nominatim resolves street + city + country to real coordinates for the zero-cost MVP path.
- Same-city flows fail explicitly when an address cannot be resolved; CargoGo does not silently use the same city-centre point twice.
- Matching v5 permits short urban cargo legs along long routes while preserving forward direction checks.

## Operations
- Geocoding requests are recorded as `osm_nominatim` usage.
- Address geocoding uses the public OpenStreetMap Nominatim endpoint for the zero-cost MVP path. Calls are user-triggered, serialized to <=1 request/sec and coordinates are persisted to avoid repeat lookups. The provider is backend-configurable so it can be switched without a mobile app update.
