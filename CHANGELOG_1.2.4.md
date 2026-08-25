# CargoGo 1.2.4

- Fixed Expo SDK 57 / React Native 0.86 verification uploads.
- Replaced the legacy React Native FormData `{ uri, name, type }` part with `expo-file-system` `File`.
- Routes multipart requests through the supported `expo/fetch` implementation.
- No `Response.blob()` conversion and no direct phone-to-MinIO upload.
- Added `verify:verification-mobile` regression fixture.
- Verification readiness semantics from 1.2.3 remain unchanged.
