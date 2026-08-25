# CargoGo v0.3.2 mobile navigation fix

- Replaced state-only fake navigation with Expo Router file routes.
- Bottom navigation is now an actual Expo Router Tabs navigator.
- Header profile button navigates to profile; only profile logout button revokes the session.
- Create cargo and create trip are real Stack routes with Android back-stack behavior.
- Added expo-navigation-bar SDK 57 configuration; Android system navigation starts hidden in a native development build.
- For SDK 57 physical-device testing, prefer `npx expo run:android` / development build rather than relying on Expo Go.
