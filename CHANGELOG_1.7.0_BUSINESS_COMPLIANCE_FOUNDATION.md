# CargoGo 1.7.0 — Business & Compliance Foundation

- Phone-first registration now accepts an optional email.
- Added verified primary email, backup phone and backup email recovery workflow with auditable verification challenges. Development returns a local code; production deliberately requires an SMS/email delivery provider instead of pretending a message was sent.
- Vehicle profile now captures fuel type, engine displacement, curb/gross mass, payload and actual fuel/energy consumption.
- Casual carrier compensation ceiling v2 is calculated from routed distance, energy cost, vehicle/load factor, maintenance, depreciation and a safety reserve. Professional carriers remain market-priced after business verification.
- Target marketplace economics prepared for ~4.5% gross fee (2.90% target net + configured acquiring/payout estimates).
- Finance Ops separates GMV, carrier principal, marketplace revenue, recorded operating expenses and management net platform profit. Added audited operating-expense ledger endpoints.
- Legal revision advanced to `2026-08-26-r3`; liability language consistently states that CargoGo is a marketplace, not the carrier/forwarder/warehouse/insurer, and CargoGo does not insure cargo value. Any platform-side remedy is limited to the trip/platform-service amount where legally permitted.
- Existing users are covered by the v1.6.5 re-consent gate for the new required legal revision.
