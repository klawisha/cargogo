# E2E Test Matrix

| Area | Happy path | Negative/abuse path | Required evidence |
|---|---|---|---|
| Auth | phone register/login/refresh | duplicate phone, weak password, refresh reuse | audit_event |
| Legal | accept current version | stale version / unchecked checkbox | legal_acceptance |
| KYC | submit → reviewer verify | wrong MIME, oversized, unauthorized access | access log |
| Cargo | create/edit/publish | publish unverified, mutate after deal | audit + 403/409 |
| Trip | verified driver/current trip | unverified, casual limits, edit after deal | audit + policy snapshot |
| Matching | routed corridor | reverse direction, capacity/time miss | score breakdown |
| Offer | create/withdraw/accept | outsider, over casual cap, duplicate | atomic status |
| Payment | hold/capture | bad signature, replay callback, duplicate capture | idempotency ledger |
| Pickup | photo + code | no photo, 4th photo, wrong code ×5 | GPS/time/hash |
| Delivery | synchronized evidence + code | recipient missing/refuses code | handover session |
| Dispute | reviewer resolution | participant self-resolution / outsider access | reviewer audit |
| Payout | provider success | provider fail/retry/manual review | payout ledger |
| Notifications | event + push | failed push retry/archive cleanup | outbox |
| Privacy | access/delete request | repeated duplicate request | privacy_request |
| Crash | captured error | telemetry unavailable | local fallback UX |
