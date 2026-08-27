# Updating to CargoGo 1.7.0

1. Replace the previous source tree with this archive while keeping your local secrets in `.env`.
2. Run `npm install`.
3. Run `npm run db:migrate` to apply migration `032_business_compliance_foundation.sql`.
4. Run `npm run economics:v1.7` once to update an existing local `.env` to the v1.7 marketplace target and reference energy prices. Review those reference prices before production deployment.
5. Run `npm run typecheck`, `npm run verify:business-foundation`, `npm run verify:reconsent`, and `npm run verify:production-readiness`.
6. Restart the API. Existing users that accepted `2026-08-26-r2` will receive the re-consent gate for `2026-08-26-r3`.

Production note: contact verification currently returns the OTP only in non-production environments. CargoGo intentionally refuses to pretend that an SMS/email was delivered in production until a delivery provider is integrated.
