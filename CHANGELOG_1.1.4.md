# CargoGo v1.1.4

- Fixed SDK 57 `expo-navigation-bar` TypeScript incompatibility.
- Removed runtime calls unavailable in `expo-navigation-bar ~57.0.2`: `setPositionAsync`, `setBackgroundColorAsync`, `setButtonStyleAsync`.
- Kept guarded `setVisibilityAsync('hidden')` and AppState re-application.
- Native edge-to-edge/navigation settings remain in Expo config.
- No payment/economics/domain logic changes.
