# CargoGo 1.4.6 — Matching v3 & Current Trip

- Persistent driver current-trip context stored server-side.
- Last created/edited trip becomes current until another is created/selected.
- Home restores current route and links directly to its matches.
- New-trip form restores the last route as a starting template.
- Matching v3 rejects stale trips, uses route-relative ETA against cargo time windows, supports rotatable cargo dimensions, and improves direction score.
- Match API supports query/kind/reward/detour/fragile/sort filters and returns latest own offer state.
- Match UI gains cargo/city search and minimum-detour sorting.
