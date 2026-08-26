const base = require('./app.json');

module.exports = () => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();
  return {
    ...base.expo,
    android: {
      ...base.expo.android,
      ...(googleMapsApiKey
        ? { config: { ...(base.expo.android?.config ?? {}), googleMaps: { apiKey: googleMapsApiKey } } }
        : {}),
    },
  };
};
