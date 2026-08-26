# CargoGo Production Readiness v1.6.0

## Release gate
Run `npm run release:gate`. Production deploy is blocked while any critical TypeScript/security/contract check fails.

## Canonical E2E scenarios
1. Registration → versioned Terms/Privacy acceptance → login/refresh/logout/reuse detection.
2. Sender KYC → cargo draft → publish only after identity verification → live discovery refresh.
3. Driver KYC + licence + vehicle verification → casual policy acceptance → trip → current matching context.
4. Road route → Mapbox geometry/distance/duration → cached DB geometry → match recomputation.
5. Offer → accept atomically → economics snapshot → payment hold → private address unlock.
6. Pickup: 1–3 evidence photos → GPS/server time/hash → wrong code lockout → correct code → transit.
7. Delivery: driver arrived → recipient present → synchronized photo session → both evidence streams → code unlock → settlement.
8. Recipient refuses code / unavailable → evidence + GPS → automatic dispute/manual review → payout frozen.
9. Damage dispute → pickup/delivery comparison → reviewer-only resolution → refund/release → audit trail.
10. Chat/live/push → message event → live invalidation → push outbox retry → chat closes after retention window.
11. Payout failure → manual-review queue; no off-ledger money movement.
12. Privacy request → reviewer queue → resolution audit; deletion deferred where active deal/retention prevents immediate erasure.
13. Client crash → root boundary → client_error_event → reviewer readiness dashboard.
14. Finance → GMV/platform fee/acquiring/payout/net revenue → API free-tier usage → monthly burn.
15. Production config → no mock KYC/payments/payouts, HTTPS base URL, legal operator fields, approved legal pack and unique secrets.

## Go-live blockers
- Written PSP confirmation for intended marketplace/casual payout model.
- Legal operator data filled; legal documents approved by Ukrainian counsel.
- Production domain + HTTPS + private object storage + tested restore from backup.
- Real OTP provider and abuse/rate-limit policy.
- Closed Google Play test requirements completed for the actual developer-account type.
- At least one full real-device E2E rehearsal with tiny/sandbox financial amounts.
