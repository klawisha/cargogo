# CargoGo v1.6.2 update

This archive is packaged with `package.json` at the archive root. Extract it directly into `C:\cargogo`.

## Verification enforcement
Your existing `.env` is intentionally not shipped or overwritten. If Staff Readiness shows `Verification enforcement = FAIL / off`, run:

```powershell
npm run verification:on
```

Then stop the currently running API process and start it again:

```powershell
npm run dev:api
```

Equivalent manual setting in `C:\cargogo\.env`:

```env
VERIFICATION_ENFORCEMENT=on
KYC_MODE=manual
```

## Validation

```powershell
npm install
npm run typecheck
npm run verify:modules
npm run dev:api
```
