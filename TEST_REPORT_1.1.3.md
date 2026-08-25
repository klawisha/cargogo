# CargoGo 1.1.3 test notes

## Static checks
- Android navigation code no longer references `setBehaviorAsync`.
- Home tab reserves 124 px after its final action for the absolute floating tab bar.
- Root shell explicitly fills the window with the current theme background.
- No payment/business logic files were modified in this patch.

## Physical-device regression checklist
1. Start on three-button Android navigation and verify the white strip below CargoGo is gone or blends with the active app surface.
2. Switch DARK/LIGHT and verify the system-bottom area does not stay white in dark mode.
3. Scroll Routes to the very bottom: both “Я ЇДУ” and “СТВОРИТИ ВАНТАЖ” must be fully visible above the floating tab bar.
4. Open LiqPay/browser and return: bottom system UI should be re-hidden.
5. Open country/city picker repeatedly and ensure no raw-text React Native error appears.
6. Re-run typecheck, economics and payments fixtures after dependencies are installed.
