# CargoGo 1.1.3 — Android bottom inset & tab-bar reliability

## Fixed
- Removed the unsupported `NavigationBar.setBehaviorAsync()` call that could abort the rest of immersive-mode setup on the installed Expo Navigation Bar version.
- Android system navigation operations are now isolated, so an unsupported position/background/style call cannot prevent `setVisibilityAsync('hidden')`.
- Navigation bar is requested as absolute + transparent and re-hidden after the app returns from browser/modal flows such as LiqPay.
- Root application surface now explicitly paints the active theme background to the bottom edge.
- Home feed bottom scroll padding increased from 26 to 124 px so the floating tab bar no longer covers the secondary “СТВОРИТИ ВАНТАЖ” action.
- UI build marker bumped to `UI 1.1.3`.

## Not changed
Payment, settlement, payout, marketplace economics, matching and backend state machines are unchanged from 1.1.2/1.1.0 economics.
