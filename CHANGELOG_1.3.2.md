# CargoGo v1.3.2 — Delivery confirmation protection

- Handover photos now record best-effort foreground geolocation metadata (lat/lng, accuracy, client timestamp) plus server timestamp and SHA-256.
- Driver can report a delivery-confirmation problem only after arrival and after at least one delivery evidence photo exists.
- Reporting refusal never auto-pays the driver: it creates/uses a dispute and freezes unsettled settlement for manual review.
- Supported reasons: recipient refuses code, recipient claims damage, recipient unavailable, other.
- Server stores a dedicated immutable delivery confirmation problem record with server timestamp and optional device location evidence.
- Sender is explicitly told not to share the delivery code when cargo is damaged and to open a dispute with photos instead.
- Added migration 019_delivery_confirmation_evidence.sql and verification fixture.
