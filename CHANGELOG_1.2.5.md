# CargoGo v1.2.5 — Android verification file transport hardening

- Replaced React Native `FormData`/`File` verification upload path with Expo SDK 57 native `expo-file-system/legacy` multipart transport.
- Every DocumentPicker result is copied into the app cache first. `copyAsync` supports Android `content://`/SAF sources and yields a stable local `file://` URI for upload.
- Upload uses `FileSystem.uploadAsync(... MULTIPART)` with authenticated headers and automatic single token refresh retry.
- Temporary verification files are deleted from app cache in `finally`, successful or failed.
- Image-only verification items only allow JPEG/PNG in the picker and UI.
- Client validates local existence and size before network upload; server still independently validates MIME, magic bytes, size, ownership and document kind.
- Multer parser bounded to one file, four fields and five total multipart parts.
- No `Response.blob()`, JS base64 conversion, direct device→MinIO upload, or user-controlled storage object keys.
