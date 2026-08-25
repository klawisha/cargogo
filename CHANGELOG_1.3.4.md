# CargoGo 1.3.4 — Moderator Evidence Assessment

- Computes first-photo delta for driver vs sender from server timestamps.
- Computes phone-to-phone GPS distance with accuracy-aware tolerance.
- Grades evidence STRONG / REVIEW / WEAK for moderator triage only.
- STRONG: <=60s and location consistent. WEAK: >120s or clear location mismatch. Otherwise REVIEW.
- Missing GPS never automatically penalizes a party; it requires review.
- No automatic dispute resolution is performed from the score.
