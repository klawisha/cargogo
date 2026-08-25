# CargoGo v1.3.3 — Synchronized Handover

- Dual arrival confirmation: driver arrival + recipient presence.
- Driver starts a server-timestamped handover session only after both are present.
- Both driver and sender capture 1–3 delivery photos.
- First evidence timing is graded STRONG <=60s, ACCEPTABLE <=120s, LATE >120s.
- Delivery code remains hidden and cannot be confirmed until both sides have at least one photo.
- GPS/accuracy and server timestamps remain supporting evidence; GPS failure does not block handover.
- Evidence remains immutable and tied to the handover session.
