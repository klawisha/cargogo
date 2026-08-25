# v1.1.0 — Marketplace Economics

- Replaced fixed `PLATFORM_FEE_BPS` profit assumption with target-net-margin economics.
- Added `TARGET_NET_MARGIN_BPS`, acquiring/payout cost estimates, optional minimum fee, and sandbox actual payout fee.
- Added `EconomicsService` with integer-only basis-point calculations.
- Added authenticated `/v1/economics/quote` so drivers can see expected payout before sending an offer.
- Deal acceptance now snapshots fee policy, target margin, cost estimates and carrier payout immutably.
- Settlement stores actual acquiring fee, actual payout fee, CargoGo net revenue and actual net margin.
- LiqPay `receiver_commission` is consumed when returned by the provider.
- Finance ledger now records acquiring fee, payout fee and platform net revenue separately.
- Driver offer screen displays client total, service fee and expected carrier payout.
- Deal detail shows financial breakdown and actual net economics after completion.
- Updated finance smoke test: 1000.00 UAH -> 969.00 UAH carrier payout, simulated 13.00 UAH acquiring cost, 2.91 UAH payout cost, 15.09 UAH CargoGo net.
- Added migration `014_marketplace_economics.sql`.
