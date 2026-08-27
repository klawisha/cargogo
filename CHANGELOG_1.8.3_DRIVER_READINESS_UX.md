# CargoGo 1.8.3 — Driver Readiness UX & Maps Key Guard

- Added a reusable driver-readiness model combining identity, driver licence, verified vehicle and carrier-mode prerequisites.
- Home now shows an actionable readiness card while driver prerequisites are incomplete.
- `Я ЇДУ` routes incomplete users to a dedicated readiness checklist instead of letting them fill a long trip form first.
- Direct access to `create-trip` is also guarded before the form renders; backend enforcement remains unchanged.
- Added persistent Profile entries for `Готовність до перевезень` and `Режим перевізника та правила` with live state.
- Casual mode now links directly to the full `casual-carrier-policy` before acceptance.
- Restored/clarified secure Google Maps key injection. Local key goes in `apps/mobile/.env.local`; EAS gets the same environment variable from its secret/environment store.
- Production EAS build fails fast if `GOOGLE_MAPS_ANDROID_API_KEY` is missing, preventing a broken Google Play AAB.
- Version: 1.8.3. No database migration.
