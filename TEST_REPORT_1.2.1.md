# TEST REPORT — CargoGo v1.2.1

Verified in packaging environment:
- `node scripts/verify-verification.mjs` — PASS.
- `node scripts/verify-economics.mjs` — PASS (`31.00 / 969.00 / 15.09` fixture unchanged).
- `node scripts/verify-liqpay-signature.mjs` — PASS.
- Migration ordering includes `016_manual_verification_pipeline.sql` after v1.2.0 core.
- No `.env`, private keys, uploaded documents or `node_modules` are included in the archive.

A complete `npm install` in the packaging environment timed out before dependencies were available, so a full workspace `tsc --noEmit` could not be truthfully completed here. Run `npm install` and `npm run typecheck` first on the target machine. `expo-document-picker` is new in v1.2.1 and will be installed from the mobile workspace dependency list.

Device regression checklist:
1. `adb reverse tcp:3000 tcp:3000`, `tcp:8081`, and `tcp:9000` for local API/Metro/MinIO.
2. Upload ID/passport + selfie; confirm file status becomes validated.
3. Submit identity; status becomes UNDER_REVIEW, never VERIFIED automatically.
4. Promote a dedicated test reviewer in DB, log in again, open staff queue.
5. Open every document; verify short-lived URL works and queue does not expose object keys.
6. Approve identity; user becomes verified.
7. Repeat licence and vehicle flows.
8. Test RESUBMIT and REJECT with required reasons.
9. Verify normal users receive 403 on all `/verification/review/*` endpoints.
10. Set an expired retention row in test DB and run purge; verify object is deleted from MinIO.
