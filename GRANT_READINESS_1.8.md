# CargoGo v1.8 Grant Readiness

## Finance / FOP management view

The reviewer Finance Ops screen separates customer transaction volume (GMV) from money attributable to carriers and from CargoGo economics. It exposes gross platform fee, acquiring cost, payout cost, platform net revenue, recorded operating expenses, management net platform profit, refunded transaction value and currently disputed transaction value. CSV and XLSX exports contain monthly and lifetime summaries plus the operating-expense ledger.

`TAX BASE · DRAFT` remains intentionally indicative. It is not an automatic Ukrainian tax declaration and must later be reconciled against actual bank/PSP statements and the final legal/payment model used by the FOP.

## Self-hosted diagnostics

Client errors and unhandled API 5xx failures are stored in PostgreSQL. Reviewer/admin can inspect recurring fingerprints, 24-hour counts, individual events and mark an event reviewed. Resolutions are audit logged. This replaces the immediate need for a paid Sentry subscription during grant-stage testing.

## Demo / staging

After migrations, a deterministic presentation dataset can be recreated at any time:

```powershell
npm run demo:reset
npm run demo:seed
```

It creates a reviewer, verified sender, verified casual driver, verified demo van and three financial scenarios: completed, refunded and disputed. The command prints the demo credentials. Demo commands refuse to execute with `NODE_ENV=production`.

## Backup baseline

Use `npm run backup:local` and verify the result with `npm run backup:verify -- -BackupDir <folder>`. Verification restores PostgreSQL to a disposable database and checks the MinIO archive without replacing current application data. See `BACKUP_RESTORE.md`.
