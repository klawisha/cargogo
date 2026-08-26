# CargoGo 1.5.1 — Finance Ops + route refresh

- Fixes native MapView/Polyline stale reconciliation by remounting route layer from a geometry signature.
- Adds reviewer/admin Finance & Resources Control Center.
- Monthly/lifetime GMV, platform fee, carrier payable, acquiring/payout costs, net platform revenue, deal counts and risk counters.
- Adds internal Mapbox Directions request/error counters.
- Adds free-tier radar for Mapbox, R2 storage/operations, Google Maps SDK and future SMS OTP.
- Adds operating-cost registry for VPS, domain, Apple Developer, Google Play and usage-based services.
- Migration: `028_staff_finance_usage.sql`.

Provider dashboards remain the source of truth for billing; CargoGo counters are operational observability.
