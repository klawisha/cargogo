# CargoGo v1.3.7 — Reviewer Workspace

- Added unified `reviewer` staff role with verification + dispute + payout-issue visibility.
- Existing specialized reviewer roles remain compatible.
- Staff accounts are routed to a dedicated Trust Workspace instead of customer tabs.
- Dedicated queues for verification and disputes are surfaced directly from staff home.
- Added read-only problematic payout queue; no unsafe manual balance/status mutation.
- Added `/v1/staff/overview` and `/v1/staff/payout-issues`.
- Added migration `023_combined_reviewer_role.sql`.
