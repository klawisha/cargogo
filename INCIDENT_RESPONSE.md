# CargoGo Incident Response

Severity S1: unauthorized KYC/evidence access, payment duplication, payout to wrong recipient, credential compromise, confirmed data breach. Immediately disable affected path/provider, preserve logs, rotate credentials, stop automated payouts if relevant, identify impacted users/data, document timeline and obtain legal guidance on notifications.

Severity S2: payment callback outage, push outage, routing outage, repeated mobile crash, storage degradation. Use fallback only where it cannot create incorrect financial/trust outcomes. Road routing must not silently substitute materially wrong pricing/matching in production.

Every incident records owner, UTC start/end, affected versions, scope, evidence, containment, root cause, corrective action and regression test. Never delete audit records to make an incident disappear.
