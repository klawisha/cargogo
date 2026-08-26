# CargoGo v1.6.2 — Legal UI & Readiness polish

- Replaced raw Markdown legal-document output with native React Native rendering for headings, legal notices, bold text, bullets and numbered clauses.
- Redesigned Legal Center with document numbering, version badge, required-at-registration badges and clearer summaries.
- Added reusable CargoGo footer with product version and credits: Vladyslav Kosianenko — Founder & CEO, Product Owner, Lead Full-Stack Engineer, Software Architect, DevOps Engineer, Business Analyst.
- Improved Production Readiness: PASS/WARN/BLOCKING counters, refresh action, explicit verification blocker guidance and Legal Center shortcut.
- Verification readiness now makes an API environment override obvious instead of showing only `off`.
- `.env.example` remains secure-by-default with `VERIFICATION_ENFORCEMENT=on`.

Important: a user's existing `.env` is intentionally not overwritten by release archives. If readiness reports verification `off`, change the actual API `.env` to `VERIFICATION_ENFORCEMENT=on` and fully restart the API process.
