# CargoGo v1.7.1 update

1. Install dependencies and run `npm run typecheck`.
2. Run `npm run verify:runtime-api`.
3. For a standalone internal APK, run EAS from `apps/mobile` with the `preview` profile.
4. Start the local API and ngrok on the laptop.
5. On the installed APK, tap the build/version label five times, paste the current ngrok URL, test it, then save and reconnect.

The preview APK contains its JavaScript bundle, so Metro and USB are not required after installation. The laptop still needs to run the API and ngrok tunnel while this temporary development topology is used.
