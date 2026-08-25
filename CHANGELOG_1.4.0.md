# CargoGo 1.4.0 — Badger Brand & Edit Reliability

- Fixed PostgreSQL trip editing lock: `FOR UPDATE OF t` prevents locking the nullable vehicle side of the LEFT JOIN.
- Cargo editing path audited: it locks only the cargo row and does not use a nullable outer join.
- Added third `BADGER` theme with muted graphite / sand palette.
- Added reusable geometric CargoGo honey-badger mark built from React Native primitives.
- Added brand mark to authentication and home surfaces.
- Upgraded waiting interaction into Badger Run with moving runner, beacons, streak, best score and adaptive speed.
- Added regression fixture `verify:trip-edit-brand`.
