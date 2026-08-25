# CargoGo 1.3.10 — verification gate + cargo insert hotfix

- Fixed cargo creation SQL: `delivery_until` now has its missing `$34` value expression. This removes PostgreSQL `INSERT has more target columns than expressions`.
- Driver trip creation is now always server-gated by verified identity + verified driver licence + verified selected vehicle. The old development enforcement bypass no longer applies to these safety-critical assertions.
- Cargo publishing remains always identity-gated.
- Mobile trip creation shows a verification gate and disables publishing for an unverified identity.
- Removed explicit Android notification channel `sound: default` to avoid Expo treating `default` as a missing custom sound; Android uses the channel/default notification behavior instead.
- Default verification enforcement is now `on`.
