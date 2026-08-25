# CargoGo v1.1.5 — Android system-bar compatibility

- Migrated `expo-navigation-bar` config from deprecated `barStyle`/`visibility` to SDK 57 `style`/`hidden`.
- Replaced deprecated imperative `setVisibilityAsync` lifecycle calls with the SDK 57 declarative `<NavigationBar hidden style={...} />` API.
- Removed stale `applyAndroidImmersive(mode)` call and all removed navigation-bar APIs.
- Preserved bottom content spacing from v1.1.3 so the floating tab bar no longer covers the cargo CTA.
- Updated visible UI build marker to `UI 1.1.5`.
- No payment, ledger, marketplace-economics, deal-state, or LiqPay business logic changed.

Note: native config-plugin changes are applied only in a development/production build generated after this version. Expo Go runs inside Expo's native host application and cannot fully reproduce every native window/inset setting of CargoGo.
