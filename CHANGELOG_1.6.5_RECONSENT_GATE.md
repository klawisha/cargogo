# CargoGo 1.6.5 — Legal re-consent gate

- Existing non-staff users are checked against the current required Terms of Use and Privacy Policy revisions.
- A dedicated blocking re-consent screen appears when either required document is stale.
- Users can open and read both current documents before confirming.
- Acceptance is recorded per document/version through the existing audited legal_acceptance workflow.
- Marketplace mutations are additionally protected server-side and return HTTP 428 LEGAL_RECONSENT_REQUIRED until both current revisions are accepted.
- Read-only access remains available; staff accounts are not blocked by consumer marketplace re-consent.
