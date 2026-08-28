# CargoGo v1.8.7 — Role readiness & sender verification UX

## Mobile UX

- Home readiness is split into two independent user intents:
  - **Send cargo**: only verified identity (ID card/passport) is required to publish cargo.
  - **Drive**: verified identity, driver licence, at least one verified vehicle/registration document, and carrier mode readiness are required.
- The home screen explicitly says that a sender does not need a driver licence or vehicle.
- Cargo creation now reads `/verification/me` when the screen gains focus.
- If identity is not verified, cargo creation shows a prominent explanatory card with a direct link to the Verification Center.
- If identity is already submitted/under review, the message explains that the cargo can be prepared now and will remain a draft until verification succeeds.
- While identity is not verified, the primary cargo CTA is labelled **СТВОРИТИ ЧЕРНЕТКУ** instead of promising publication.
- After returning from successful verification, the screen refreshes automatically and the CTA becomes **СТВОРИТИ Й ОПУБЛІКУВАТИ**.
- Removed the stale "matching uses city center" copy: v1.8.6 address geocoding is now reflected in cargo-creation help text.

## Enforcement

No backend trust requirements were weakened. Publishing cargo still requires verified identity; creating a driver trip still uses the full driver readiness requirements.
