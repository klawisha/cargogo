# CargoGo v1.2.0 test report

## Completed in packaging environment
- `node scripts/verify-verification.mjs` — PASS.
- `node scripts/verify-economics.mjs` — PASS (`31.00 / 969.00 / 15.09`, 150 bps fixture).
- `node scripts/verify-liqpay-signature.mjs` — PASS.
- TypeScript changed-core syntax parse — no syntax diagnostics.
- ZIP integrity check — required before delivery.

## Full typecheck note
A clean `npm install` could not be completed in the packaging environment before timeout, so full dependency-backed `npm run typecheck` must be run after extraction. No `node_modules` is shipped.

## Required local regression
1. Preserve `.env`; add `VERIFICATION_ENFORCEMENT=off` for current alpha testing.
2. `npm install`
3. `npm run typecheck`
4. `npm run verify:modules`
5. `npm run verify:verification`
6. `npm run verify:economics`
7. `npm run verify:payments`
8. `npm run db:migrate`
9. Start API with `KYC_MODE=mock`.
10. `Set-ExecutionPolicy -Scope Process Bypass; .\scripts\smoke-verification.ps1`
11. Re-run existing `smoke-finance.ps1` with enforcement OFF.
12. Set `VERIFICATION_ENFORCEMENT=on`, restart API, confirm unverified users cannot publish cargo/create trips/offers; then verify identity/licence/vehicle and confirm actions unlock.
