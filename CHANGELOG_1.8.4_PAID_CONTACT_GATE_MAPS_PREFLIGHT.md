# CargoGo 1.8.4 — Paid Contact Gate & Maps Preflight

- Chat discovery, state, history and sending are server-gated until deal payment is secured.
- Counterparty phone numbers are returned only after payment status is secured/captured/released.
- Deal DTO exposes `contactsAvailable` so mobile UI can explain the lock without leaking contact data.
- EAS build profiles now explicitly bind to development/preview/production environments.
- Added local and EAS-production Google Maps key preflight. It validates that the environment key reaches dynamic `app.config.js` and prints only a SHA-256 fingerprint, never the key itself.
