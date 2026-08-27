# CargoGo v1.7.2 — Form Labels & Grant Polish

## Mobile UX
- Vehicle economics inputs now keep persistent labels after values are entered.
- Units are shown independently from placeholders (`см³`, `кг`, `л / 100 км`, `кВт·год / 100 км`).
- Electric vehicles show an energy-consumption field and hide engine displacement; combustion/hybrid vehicles show fuel consumption and engine displacement.
- Fuel selector uses human-readable Ukrainian labels instead of raw enum values.
- Vehicle model, body type, route street/address, trip edit detour/capacity and cargo edit weight/price fields now have persistent labels.
- Existing example/default values remain available without sacrificing field meaning.

## EAS
- Persisted Expo owner and EAS project link in app config.
- Added `cli.appVersionSource=local` to remove the EAS future-requirement warning.

## Release
- Version bumped to 1.7.2.
- No database migration is required for this patch.
