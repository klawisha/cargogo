# CargoGo v1.1.0 — Marketplace Economics

Current focus: low-margin marketplace economics on top of the Payment/Payout Core. The accepted offer is the sender total; CargoGo snapshots estimated provider costs and target net margin at Deal acceptance, then records actual provider costs during settlement.

Recommended local economics:

```env
PAYMENTS_MODE=mock
PAYOUTS_MODE=sandbox
TARGET_NET_MARGIN_BPS=150
ACQUIRING_FEE_ESTIMATE_BPS=130
PAYOUT_FEE_ESTIMATE_BPS=30
MIN_MARKETPLACE_FEE_MINOR=0
PAYOUT_SANDBOX_ACTUAL_FEE_BPS=30
```

For 1000.00 UAH this produces a 31.00 UAH gross marketplace fee and 969.00 UAH carrier payout. With simulated actual costs of 13.00 UAH acquiring + 2.91 UAH payout, CargoGo net is 15.09 UAH (~1.50%).

Validate after update:

```powershell
npm install
npm run typecheck
npm run verify:modules
npm run db:migrate
```

Expected migration: `014_marketplace_economics.sql`. Then run `scripts\smoke-finance.ps1`. See `MARKETPLACE_ECONOMICS_1.1.md`.

---

# CargoGo v0.8.0 — Trust & Safety Core

Current focus: marketplace reliability, identity lifecycle, notifications and disputes. Maps remain intentionally deferred.

Quick validation after update:

```powershell
npm install
npm run typecheck
npm run verify:modules
npm run db:migrate
```

Then run `npm run dev:api`, followed by `scripts\smoke-marketplace.ps1` and `scripts\smoke-trust-safety.ps1`.

---

# CargoGo v0.5.0 — Marketplace Core

CargoGo is a P2P marketplace for moving cargo with people who are already traveling in the same direction. v0.5 deliberately keeps routing simple and strengthens the main marketplace flow: matching, offers, negotiation, atomic deal creation, privacy gates and deal-scoped chat.

## Stack

- Mobile: Expo SDK 57 + React Native 0.86 + Expo Router.
- API: NestJS 11 + TypeScript.
- Primary DB: PostgreSQL + PostGIS.
- Cache/queues foundation: Redis.
- Object-storage development target: MinIO / S3-compatible API.
- Local infrastructure: Docker Compose.

## Main v0.5 flow

```text
Cargo published
   ↓
Trip published
   ↓
rough A→B PostGIS match
   ↓
Driver offer / counter-price
   ↓
Cargo owner accepts
   ↓
Atomic Deal (awaiting_payment)
   ↓
Deal-only chat
```

Exact addresses remain locked at `awaiting_payment`. There is intentionally no client-side or fake “mark paid” action.

## Routing scope for now

We intentionally do **not** integrate maps or detailed road routing yet. The system keeps a pair of route points and a rough line/corridor sufficient for discovery. `RoutingService` remains a provider boundary for later map/road integration.

Do not present current route metrics as exact driving ETA/detour.

## New backend modules

- `offers` — driver offers tied to a real `trip_match`, price replacement, withdraw/reject/expiry.
- `deals` — atomic offer acceptance, one-live-deal-per-cargo invariant, deal timeline, payment/privacy state foundation.
- `chats` — REST deal-only chat; no arbitrary direct messages.

Read `MARKETPLACE_CORE.md`, `SECURITY.md` and `CARGO_SECURITY.md` before changing authorization/privacy behavior.

## Recommended Windows location

Keep the project at a short path:

```text
C:\cg
```

## Upgrade from v0.4.0

Keep your existing Docker volumes.

```powershell
cd C:\cg
npm install
npm run typecheck

cd infra
docker compose up -d
cd ..

npm run db:migrate
```

New migration:

```text
007_marketplace_core.sql
```

It adds offers, deals, append-only deal events and deal chat tables.

## Run API

```powershell
cd C:\cg
npm run dev:api
```

Check:

```text
http://localhost:3000/v1/health/live
http://localhost:3000/v1/health/ready
```

## Run Android over USB

```powershell
cd C:\cg
adb devices
adb reverse tcp:3000 tcp:3000
adb reverse tcp:8081 tcp:8081
npm run dev:mobile
```

Open the already installed CargoGo development build. v0.5 adds no new native dependency, so a rebuild should normally not be required. If needed:

```powershell
npm run android -w @cargogo/mobile
```

## Deep smoke test

With Docker and API running:

```powershell
.\scripts\smoke-marketplace.ps1
```

The test verifies:

- sender/driver isolation;
- private cargo DTO authorization;
- PostGIS match creation;
- offer creation only for a matched driver trip;
- driver cannot accept own offer;
- atomic owner acceptance;
- exact addresses stay hidden before secured payment;
- no new offer after cargo becomes matched;
- deal chat is participant-only;
- outsider cannot read chat;
- unpaid cancellation republishes cargo and recomputes matches;
- cancelled deal chat is read-only.

## Intentionally deferred

- map UI and address search;
- real road polyline / ETA / detailed detour;
- KYC provider;
- marketplace payment provider;
- pickup/delivery OTP codes;
- WebSocket/push realtime;
- disputes and evidence workflow.

The next iterations should continue strengthening trust, payment-state handling, notifications and transaction safety before investing in maps.

## v0.7.0 — Editable marketplace + structured locations

Before starting this version run:

```powershell
npm install
npm run typecheck
npm run db:migrate
```

Expected latest migration: `010_editable_locations_matching.sql`.

New user flow no longer asks for latitude/longitude. A place is `country → city → optional street`; the server resolves the current alpha city catalog to a centre point for rough matching. Cargo and trips can be edited or deleted only before any Deal has ever been accepted for that entity. Editing a published object supersedes pending offers and recomputes matches.

Regression tests:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\smoke-marketplace.ps1
.\scripts\smoke-editability.ps1
```


## v0.9 payment preview

CargoGo can now use LiqPay Hosted Checkout in sandbox mode. This is the recommended way to test the real payment form without real money:

```env
PUBLIC_BASE_URL=http://localhost:3000
PAYMENTS_MODE=liqpay_sandbox
LIQPAY_PUBLIC_KEY=sandbox_...
LIQPAY_PRIVATE_KEY=sandbox_...
LIQPAY_ACTION=hold
ENABLE_REAL_PAYMENTS=false
```

Keep `adb reverse tcp:3000 tcp:3000` active when testing on a physical Android device. Production payment mode is intentionally locked behind `ENABLE_REAL_PAYMENTS=true` and is not considered launch-ready until hold/refund/payout/legal review is complete. See `PAYMENTS_LIQPAY_0.9.md`.

## v1.0 Payment/Payout
See `PAYMENT_PAYOUT_CORE_1.0.md`.

For local full-flow testing:
```env
PAYMENTS_MODE=mock
PAYOUTS_MODE=sandbox
TARGET_NET_MARGIN_BPS=150
ACQUIRING_FEE_ESTIMATE_BPS=130
PAYOUT_FEE_ESTIMATE_BPS=30
MIN_MARKETPLACE_FEE_MINOR=0
PAYOUT_SANDBOX_ACTUAL_FEE_BPS=30
PAYOUT_DATA_SECRET=change-this-development-secret-at-least-32-chars
```
For LiqPay sandbox checkout use `PAYMENTS_MODE=liqpay_sandbox`, sandbox keys, and `LIQPAY_ACTION=hold`.
