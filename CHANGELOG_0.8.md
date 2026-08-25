# v0.8.0

- Fixed Nest DI graph around LocationService/AuthGuard.
- Added `011_trust_safety_notifications.sql`.
- Added NotificationModule and mobile notification center.
- Added VerificationModule and mobile verification lifecycle screen.
- Added DisputeModule, evidence notes, dispute UI, and frozen dispute state.
- Added marketplace and trust/safety smoke coverage.
- Added `npm run verify:modules` to catch UnknownDependenciesException before normal API startup.
