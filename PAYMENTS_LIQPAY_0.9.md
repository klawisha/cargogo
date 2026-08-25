# CargoGo v0.9 — LiqPay hosted checkout

## Modes

- `PAYMENTS_MODE=mock` — internal Alpha flow, no external UI.
- `PAYMENTS_MODE=liqpay_sandbox` — real LiqPay hosted checkout with sandbox keys. No real debits/credits.
- `PAYMENTS_MODE=liqpay_production` — real merchant keys + public HTTPS `PUBLIC_BASE_URL`. Do not enable before merchant/legal readiness.
- `PAYMENTS_MODE=disabled` — no payments.

## Local sandbox

1. Create/activate a LiqPay merchant profile and copy its sandbox public/private keys.
2. `.env`:

```env
NODE_ENV=development
PUBLIC_BASE_URL=http://localhost:3000
PAYMENTS_MODE=liqpay_sandbox
LIQPAY_PUBLIC_KEY=sandbox_...
LIQPAY_PRIVATE_KEY=sandbox_...
LIQPAY_ACTION=pay
```

3. Keep `adb reverse tcp:3000 tcp:3000` active. The phone browser can then open the CargoGo localhost checkout relay.
4. In a deal in `awaiting_payment`, press **ОПЛАТИТИ ЧЕРЕЗ LIQPAY · SANDBOX**.
5. LiqPay test card: see current official LiqPay testing documentation. Never use a real card for sandbox validation.
6. After returning to CargoGo, the app calls `/payments/deals/:id/sync`; backend queries LiqPay status server-to-server. A public callback is therefore not required for localhost development.

## Production boundary

Production mode requires a public HTTPS `PUBLIC_BASE_URL`, non-sandbox LiqPay keys, signed callback verification, and provider-confirmed status before CargoGo unlocks private addresses. Mobile UI is never the source of truth for payment state.

For a marketplace we will separately validate hold/settle/refund and driver payout support before launch. The sandbox integration in v0.9 is primarily for a realistic payment UI and end-to-end payment boundary testing.

Implementation follows current LiqPay API request format: API payload version 7 and base64(sha3-256(private_key + data + private_key)) signature. The Client-Server checkout endpoint remains `/api/3/checkout` per LiqPay documentation.
