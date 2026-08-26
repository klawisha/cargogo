# CargoGo v1.5.2 — Usage + Asset Polish

- Finance Ops no longer shows Mapbox Directions as zero when the counter table was introduced after an already-persisted routed trip. Migration 029 backfills a conservative current-month lower bound from `trip.route_source='mapbox-directions-v5'`, while all new requests continue to increment the exact backend counter.
- Routing usage-counter failures are no longer silently swallowed; a single diagnostic warning is emitted while routing itself remains available.
- Android app icon artwork was reduced into a safer adaptive-icon zone so the badger does not protrude beyond common launcher masks.
- BADGER RUN moving token was replaced with a compact branded badge and resized to remain legible without covering the track.
- Google Maps Android key is no longer stored in the portable `app.json`; `app.config.js` reads `GOOGLE_MAPS_ANDROID_API_KEY` from the local environment. Put it in `apps/mobile/.env.local` before prebuild/run.
