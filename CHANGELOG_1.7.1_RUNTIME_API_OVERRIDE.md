# CargoGo 1.7.1 — Runtime API Override

Internal Android builds can now switch the API endpoint at runtime without rebuilding the APK. The override is stored in device SecureStore, validated and health-checked before activation, and is disabled in the production EAS profile.

## Internal connection workflow

- Open the hidden connection screen by tapping the build/version label five times on the login screen or profile.
- Paste an ngrok origin such as `https://example.ngrok-free.app`; CargoGo normalizes it to `/v1`.
- `TEST CONNECTION` calls `/v1/health/ready` with an 8 second timeout.
- `SAVE & RECONNECT` is enabled only after the exact candidate endpoint passes the health probe.
- Changing or resetting the endpoint logs out the current local session first so credentials from one backend are not reused on another backend.
- ngrok development endpoints receive the `ngrok-skip-browser-warning` request header.

## Build isolation

`development` and `preview` EAS profiles enable `EXPO_PUBLIC_ENABLE_API_OVERRIDE=1`. The `production` profile explicitly sets it to `0`; production users cannot open or use the runtime server switcher.

## API client

All JSON requests, refreshes and native multipart uploads now resolve the active endpoint dynamically. A restarted ngrok tunnel therefore requires only changing the endpoint inside the installed internal APK, not rebuilding the app.

## Typecheck hotfix

The v1.7.0 trip policy integration passed a nullable fallback route duration into functions expecting a number. Fallback route duration now uses `0` only for the duration-dependent cost adjustment; the stored route duration remains nullable and is not fabricated.
