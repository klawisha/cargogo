# CargoGo 1.5.0 — Road Routing + Real Map

- Added Mapbox Directions-backed road routing on API with a safe straight-line fallback.
- Trip route geometry is persisted in PostGIS and returned as coordinates to mobile.
- Replaced schematic RoutePreview with an interactive native map, road polyline, start/end markers, fit-to-route, distance and ETA.
- Matching now automatically benefits from real road geometry because the existing PostGIS corridor/direction pipeline works against `trip.route`.
- Existing current-trip/live matching behavior is preserved.
- Routing calls happen only when a trip is created/edited, not every time a screen opens.

## Setup
1. `npm install`
2. Add `MAPBOX_ACCESS_TOKEN=<public token>` and `ROUTING_PROVIDER=auto` to root `.env`.
3. Start API and edit/recreate old trips once so their old rough geometry is replaced by a routed geometry.
4. For native Android production builds, configure the Google Maps SDK key required by `react-native-maps`; Expo Go can be used for development without additional setup.

If Mapbox is unavailable in `auto`, the API remains functional and stores `quality=rough` rather than failing trip creation.
