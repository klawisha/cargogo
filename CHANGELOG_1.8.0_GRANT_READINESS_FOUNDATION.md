# CargoGo v1.8.0 — Grant Readiness Foundation

- Reviewer Finance Ops now separates GMV, carrier principal, CargoGo gross fee, acquiring, payout fees, platform net revenue, recorded OPEX, net platform profit, refunds and disputed value.
- Free CSV and XLSX exports are produced by CargoGo itself; XLSX generation has no external SaaS dependency.
- Added self-hosted diagnostics: client and server error journal, fingerprints, unresolved counters, reviewer resolution and audit trail.
- Added deterministic DEMO/STAGING seed/reset commands with reviewer, sender, verified driver, vehicle and completed/refunded/disputed financial fixtures.
- Added local PostgreSQL + MinIO backup, non-destructive restore verification and explicit destructive restore tooling.
- No paid infrastructure is required for these grant-stage features.
