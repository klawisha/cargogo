# CargoGo v1.2.6 — Expo Go verification upload hardening

- Removed the redundant `FileSystem.copyAsync` step after `DocumentPicker`.
- The URI materialized by `DocumentPicker(copyToCacheDirectory: true)` is passed directly to the native `FileSystem.uploadAsync` transport.
- Keeps binary data out of JS `Blob`/base64 bridges.
- Adds client-side empty/size/MIME guards before upload.
- Raw native/Java file exceptions are logged only in development; users receive a stable localized error.
- Server-side multipart, magic-byte, authorization, ownership, private-storage and moderation protections remain unchanged.
