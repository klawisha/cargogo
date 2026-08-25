# CargoGo 1.4.3 — Carrier Modes

- Added `casual` and `professional` carrier profiles.
- Casual mode is designed as a non-professional, pre-planned trip cost-sharing mode: policy acceptance, route deviation cap, future/monthly activity caps, and an aggregate per-trip compensation ceiling derived from route distance.
- Professional mode requires business details and manual staff verification; changing details returns the profile to `pending`.
- Enforcement is server-side on trip publication and offer creation. UI restrictions are not trusted for security/compliance.
- Trip, offer and deal keep a carrier-mode snapshot for audit/disputes.
- Added `/carrier-mode/me`, `/carrier-mode/policy` and staff professional-review endpoints.
- Added mobile Carrier Profile screen and Profile entry.

Important: these product controls reduce obvious commercial use of casual mode; they do not themselves determine a user's legal/tax status. Production thresholds must be validated against the final Ukrainian legal/PSP model.
