const base = require('./app.json');

module.exports = () => {
  // Keep the Maps key outside the repository. Expo loads apps/mobile/.env.local
  // for local builds; EAS receives the same variable from its environment/secret store.
  const googleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();
  const buildProfile = process.env.EAS_BUILD_PROFILE?.trim();

  if (buildProfile === 'production' && !googleMapsApiKey) {
    throw new Error(
      'GOOGLE_MAPS_ANDROID_API_KEY is required for the production Android build. ' +
      'Configure it in EAS before building the Google Play AAB.',
    );
  }

  return {
    ...base.expo,
    android: {
      ...base.expo.android,
      config: {
        ...(base.expo.android?.config ?? {}),
        ...(googleMapsApiKey ? { googleMaps: { apiKey: googleMapsApiKey } } : {}),
      },
    },
  };
};
