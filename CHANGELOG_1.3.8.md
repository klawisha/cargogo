# CargoGo v1.3.8 — Declared cargo value

- Added optional sender-entered `declaredValueMinor` in UAH when creating/editing a cargo before a deal exists.
- Value is stored as integer minor units; no floating point is used by the API/database.
- Clear UI disclosure: the value is informational for dispute review only, is not insurance and does not guarantee compensation.
- Driver can see the declared value before making/accepting an offer decision.
- The value is snapshotted into the deal when an offer is accepted and protected from later mutation.
- Trust & Safety dispute reviewer sees the snapshotted value next to evidence with an explicit non-insurance warning.
- Marketplace fee, offer amount, acquiring/payout estimates and settlement math are not derived from declared value.
- Migration: `024_cargo_declared_value.sql`.
