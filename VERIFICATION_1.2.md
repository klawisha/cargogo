# CargoGo v1.2.0 — Verification Core

## Model
CargoGo uses a hybrid verification architecture. The application owns the business state machine and permissions; an external KYC provider or a manual reviewer produces verification decisions.

### Identity
Detailed states: `not_started → submitted/under_review → verified`, with `rejected`, `needs_resubmission`, `expired`, and `suspended` branches.

CargoGo stores only minimum verification metadata: document type, country, masked/last characters, provider/reference, status, timestamps and reason codes. Raw document photos and full document numbers are intentionally not part of the v1.2 database model.

### Driver licence
Separate from identity. Stores country, last characters, categories, expiry and provider result. A verified identity does not automatically make a user a verified driver.

### Vehicle
Every vehicle has an independent verification record. The model includes masked registration number, VIN last 4–6, make/model/year/color, registration-document status and insurance status.

### Enforcement
`VERIFICATION_ENFORCEMENT=off` keeps existing alpha/smoke workflows compatible.
`VERIFICATION_ENFORCEMENT=on` enables server-side policy checks:
- publishing cargo requires verified identity;
- creating/updating a trip requires verified identity + driver licence + selected vehicle;
- sending an offer requires the same driver readiness policy.

Production configuration is rejected unless enforcement is `on`.

## Modes
`KYC_MODE=mock`: local development. The app exposes DEV review actions; forbidden in production.
`KYC_MODE=manual`: submission goes to `under_review`; intended for a future admin/reviewer queue.
`KYC_MODE=disabled`: new submissions are blocked.

## Provider integration boundary
The next production integration should implement a provider adapter/session that sends document/selfie data directly to a KYC provider. CargoGo should receive only provider reference, normalized status, expiry and reason codes via signed webhook/API reconciliation.

## Security properties
- no full document number field in verification tables;
- no raw document image column in PostgreSQL;
- masked vehicle registration data;
- separate identity/licence/vehicle decisions;
- server-side enforcement rather than UI-only checks;
- development resolver hard-disabled in production;
- immutable-style verification event trail for submissions/reviews;
- production cannot run mock KYC or verification enforcement off.
