## v1.2.5
- Android-safe native verification upload transport; see CHANGELOG_1.2.5.md.

# v1.2.3

See `CHANGELOG_1.2.3.md`.

# CargoGo changelog

## 1.2.0
Identity, driver licence and vehicle verification core. See `CHANGELOG_1.2.0.md`.

# v0.5.2 — Type Safety Hotfix

- Fixed `DatabaseService.schemaReadiness()` strict TypeScript narrowing for missing-table checks.
- Removed unsupported `backgroundColor` and `translucent` props from Expo SDK 57 `StatusBar`.
- No database migration or native dependency changes.

# Changelog

## 0.5.0 — Marketplace Core
- Added secure offers and negotiation foundation.
- Added atomic offer acceptance and one-live-deal-per-cargo database invariant.
- Added deal state/payment state foundation and append-only deal timeline.
- Added privacy gate for exact addresses until future secured-payment state.
- Added unpaid-deal cancellation with cargo republish and match recomputation.
- Added real mobile offer, cargo-offers, deal list and deal-detail flows.
- Added participant-only deal-scoped REST chat with read-only cancellation state.
- Kept routing intentionally rough; maps/road routing are deferred.

# Changelog

## 0.4.0 — Trips + Geo + Matching Foundation

- Added persistent Vehicles with ownership and capacity.
- Added real Trips API with private/public location separation.
- Added `RoutingService` boundary and explicitly marked straight-line fallback routing.
- Added PostGIS-backed `trip_match` model and indexed corridor matching.
- Matching filters direction, weight, known dimensions, time windows and self-owned cargo.
- Matching recomputes both when a trip is created/refreshed and when cargo is published.
- Added trip detail mobile screen with real match results and privacy messaging.
- Home now displays persisted trips and links to their matches.
- Rebuilt create-trip flow: vehicle, route, departure, capacity and detour corridor.
- Removed runtime `expo-navigation-bar` calls that caused Android Activity errors.
- Replaced deprecated React Native SafeAreaView usage in auth.
- Fixed the confirmed create-cargo JSX quote parsing error.
- Added `scripts/smoke-marketplace.ps1` to exercise auth, authorization, cargo, vehicles, trips and matching end-to-end.

## 0.7.0
- Structured country/city/street locations; lat/lng removed from mobile forms.
- Ukraine-first city catalog and location API.
- Published cargo/trips editable until first accepted Deal; pending offers become superseded after an edit.
- Hard delete before any Deal; mutation is locked forever after first Deal creation.
- Matching v2 with score breakdown and exact/nearby/corridor classification.
- Legacy v0.6 coordinates are backfilled to nearest catalog city when possible.

- v1.3.2: delivery confirmation refusal protection + geolocated handover evidence.
