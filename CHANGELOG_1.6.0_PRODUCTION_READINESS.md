# CargoGo v1.6.0 — Production Readiness

- Versioned Terms + Privacy acceptance during registration with IP/user-agent audit.
- Legal Center: Terms, Privacy, Payments/Refunds, Disputes/Evidence, Casual, Professional, Prohibited Cargo, Retention/Deletion.
- Privacy Center: access/correction/deletion/restriction requests with reviewer-ready queue storage.
- Production env gate now requires operator identity, legal/privacy contacts and explicit legal approval.
- Root mobile ErrorBoundary reports authenticated crash telemetry to the API.
- Reviewer Production Readiness dashboard: release checks, marketplace funnel, crash/push/privacy signals and recent audit trail.
- DB migration 030_release_readiness.sql.
- Canonical E2E matrix, incident response, production readiness checklist.
- `npm run release:gate` orchestrates the critical automated verification suite.

Legal texts are production-oriented drafts, not a substitute for final review by a Ukrainian lawyer after the operator/PSP/tax structure is fixed.
