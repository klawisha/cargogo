# Google Maps Android build key

CargoGo never stores the real Google Maps Android API key in `app.json` or `app.config.js`.

## Local Android build
Create `apps/mobile/.env.local` (it is intentionally not shipped with the project archive) and add:

```env
GOOGLE_MAPS_ANDROID_API_KEY=YOUR_REAL_KEY
```

Then verify Expo sees it:

```powershell
cd C:\cargogo\apps\mobile
npx expo config --type public
```

Under `android.config.googleMaps` an API key configuration must be present.

## EAS / Google Play AAB
The local `.env.local` is not your production secret store. Configure `GOOGLE_MAPS_ANDROID_API_KEY` in the EAS environment used by the production build. The production app config now fails fast when the variable is absent, so CargoGo cannot silently produce an AAB with a missing Maps key.

Do not put the real key into Git, screenshots, changelogs, or support messages. Restrict the Google Cloud key to the Android application package/signing certificate as appropriate before production.
