# CargoGo v1.1 — Marketplace economics

## Goal
CargoGo targets a low net take rate. The accepted offer remains the single amount paid by the sender. Payment-provider costs are not added as a surprise surcharge at checkout; instead, CargoGo estimates those costs when the deal is accepted and reserves them inside the marketplace fee.

Default development policy:

- target net margin: 150 bps (1.50%)
- acquiring estimate: 130 bps (1.30%)
- payout estimate: 30 bps (0.30%)
- minimum marketplace fee: 0 minor units

For a 1000.00 UAH accepted offer the snapshot is therefore:

- sender total: 1000.00 UAH
- gross marketplace fee: 31.00 UAH
- carrier contractual payout: 969.00 UAH
- target CargoGo margin: 15.00 UAH
- acquiring estimate: 13.00 UAH
- payout estimate: 3.00 UAH

The payout estimate is conservative because it is calculated from the gross deal amount. In sandbox the configured actual payout fee is calculated from the actual 969.00 UAH payout, so the example actual net is 15.09 UAH / 1.50% after integer rounding.

## Immutable snapshot
At offer acceptance, the server stores the agreed amount, carrier amount, gross marketplace fee, target margin, estimated acquiring/payout costs, payout-account snapshot reference, and a JSON policy version. PostgreSQL prevents these commercial terms from being changed later.

Changing environment fee settings only affects newly accepted deals.

## Actual costs
Estimated costs are not reported as profit. During settlement CargoGo records:

- actual acquiring cost;
- actual payout cost;
- platform net revenue;
- actual net margin in basis points.

For mock payments, the configured acquiring estimate is used as the simulated actual acquiring cost. For LiqPay, `receiver_commission` is consumed when present in the provider response; if it is unavailable, the deal estimate remains the safe fallback.

## Money representation
All CargoGo money values are integer minor units. No floating-point arithmetic is used to calculate deal economics. Basis-point calculations use integer/BigInt half-up rounding.

## Small orders
`MIN_MARKETPLACE_FEE_MINOR` is configurable and defaults to zero because the current target model is percentage-driven. It should only be raised if a selected acquiring or payout provider introduces meaningful fixed per-transaction costs.

## Provider independence
The fee policy is not named after LiqPay. LiqPay is currently a payment adapter. A different acquiring or payout provider can later supply its own actual costs without rewriting Deal economics.
