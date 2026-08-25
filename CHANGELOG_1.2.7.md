# CargoGo v1.2.7 — registration contract + dependency lock

- Registration UI now validates the same password contract as the API: 10–128 characters, at least one Latin letter and one digit.
- Registration trims email/display name before sending.
- API validation errors are surfaced to the mobile UI instead of only showing `Invalid request payload`.
- Password schema now returns precise validation messages.
- Mobile Expo/Router/Reanimated/Worklets versions are pinned to the dependency set confirmed on the Android development machine: Expo 57.0.16, Router 57.0.16, Reanimated 4.5.0, Worklets 0.10.1.
- Verification upload pipeline from v1.2.6 is preserved.
