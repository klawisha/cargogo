# CargoGo v0.9.0

- Added PaymentProvider boundary and LiqPay hosted checkout integration.
- Added `liqpay_sandbox` and `liqpay_production` payment modes.
- Added payment_attempt persistence and deal payment provider/reference fields.
- Added local sandbox flow that does not require a public webhook: result page + server-side status sync.
- Added signed LiqPay callback endpoint for future public deployments.
- Added mobile hosted-checkout launch, foreground status sync, and manual payment sync.
- Hosted provider status, not mobile state, unlocks private locations.
- Retained mock payment mode for deterministic automated smoke tests.
