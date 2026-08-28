# CargoGo v1.8.6 — Draft recovery & address-aware intracity matching

- Draft cargo that previously failed publication because identity verification was incomplete is now re-published from the edit flow after a successful save, once verification permits it.
- Same-city cargo and trips are allowed when origin/pickup and destination/delivery addresses differ.
- Exact same city + normalized street/address remains rejected.
- Server-side Mapbox address geocoding now resolves street + city + country into real coordinates; cargo/trip points and route matching no longer have to collapse to the city centroid.
- For same-city flows, CargoGo requires both addresses to resolve to real map points; it does not silently treat the city centre as both endpoints.
- Geocoding usage is counted separately under `osm_nominatim` in `service_usage_counter`.
- Mobile create forms no longer reject same-city routes and explain address-aware matching.
- Matching version bumped to v5. The direction gate now allows short urban legs on a long intercity route instead of requiring ~0.5% of the entire route length between pickup and delivery.
- Cargo detail now exposes a clear `ОПУБЛІКУВАТИ ВАНТАЖ` recovery CTA for drafts.
- If initial publication fails after cargo creation, the app opens the saved draft instead of leaving the user on a form while a hidden draft already exists.
- Publishing an older draft now re-resolves its stored addresses before matching, so drafts created before v1.8.6 do not keep stale city-centre coordinates.
- Address coordinates are resolved through OpenStreetMap Nominatim for the zero-cost MVP path, with a strict <=1 request/sec application throttle and persisted results to avoid duplicate requests.
