# CargoGo 1.1.2 verification report

## Static checks performed while packaging
- JSON parsing: package.json, apps/mobile/package.json, apps/mobile/app.json.
- Searched mobile source for hard-coded six-digit hex colors outside theme tokens: none expected.
- Checked all relative mobile imports referenced by modified files.
- Verified version markers are 1.1.2 in root package, mobile package and Expo config.
- Verified LocationPicker has no direct/raw string child under View/Pressable in the rewritten picker.

## Required local/device regression before release
Run `npm install`, `npm run typecheck`, `npm run verify:economics`, then test on the physical Android device:
1. Profile shows `UI 1.1.2`.
2. Theme switches immediately between Dark and Light and survives restart.
3. Country -> city selection can be opened repeatedly without React Native raw-text errors.
4. Android system navigation hides after the CargoGo screen opens and again after returning from LiqPay/browser.
5. Cargo -> trip -> offer -> accept -> LiqPay sandbox -> pickup -> transit -> delivery still completes.

This package was not claimed as production-certified until the physical-device checks above are executed in the user's environment.
