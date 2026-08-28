# CargoGo 1.8.10 — API file proxy / mobile access hotfix

- Removed browser/mobile exposure of MinIO/S3 `:9000` URLs for verification, handover and dispute evidence reads.
- Existing `access-url` endpoints now return a short-lived HMAC-signed URL on the same public CargoGo API origin (`/v1/files/object`).
- The API retrieves the object from private S3/MinIO and streams it to the caller; only the API tunnel/host must be public.
- Uploads already use authenticated multipart API endpoints and continue to reach MinIO only server-side.
- Added expiring signed file tokens, `no-store` responses and MIME preservation.
- Kept compatibility with existing mobile clients that already call `access-url` and then open the returned `url`.
- Synchronized Expo SDK 57 dependency versions, added `expo-linking`, removed duplicate root native dependencies, consolidated Expo config into `app.config.js`, and added the TypeScript 6 deprecation compatibility flag.
