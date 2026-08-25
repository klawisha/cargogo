# CargoGo 1.1.1 test report

## Passed in packaging environment
- Mobile TS/TSX syntax transpilation: PASS across `apps/mobile/app` and `apps/mobile/src`.
- Marketplace economics fixture: PASS (`3100` fee, `96900` carrier, `1509` net, `150` bps).
- LocationPicker source audit: no raw whitespace/text child pattern used between native containers.
- Theme source audit: no screen keeps the old module-level `StyleSheet.create` color freeze; no hard-coded hex colors remain in mobile TSX outside semantic tokens.
- Secret hygiene: `.env`, `.expo` and `node_modules` are excluded from the distributed archive.

## Environment limitation
A complete Expo `tsc --noEmit` could not be finished in the packaging environment because the supplied archive did not contain a complete dependency tree and a dependency install timed out. The independent TypeScript transpilation/syntax pass completed successfully. Run `npm install` and `npm run typecheck` locally before committing the release.

## Manual device regression checklist
1. Open Profile → ВИГЛЯД and switch Dark ↔ Light; reopen the app and confirm persistence.
2. Confirm Android bottom system navigation is hidden after launch and after returning from LiqPay/browser.
3. Open country/city picker repeatedly; choose a country, search city, go back to country, close and reopen; no `Text strings must be rendered within a <Text> component` redbox should occur.
4. Re-run existing cargo → trip → offer → deal → LiqPay Sandbox flow to confirm this UI-only patch did not affect payments.
