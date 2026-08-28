module.exports = () => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();
  const buildProfile = process.env.EAS_BUILD_PROFILE?.trim();

  if (buildProfile === 'production' && !googleMapsApiKey) {
    throw new Error(
      'GOOGLE_MAPS_ANDROID_API_KEY is required for the production Android build. ' +
      'Configure it in EAS before building the Google Play AAB.',
    );
  }

  return {
    name: 'CargoGo',
    slug: 'cargogo',
    version: '1.8.10',
    orientation: 'portrait',
    scheme: 'cargogo',
    icon: './assets/brand/app-icon.png',
    userInterfaceStyle: 'automatic',
    plugins: ['expo-router', 'expo-secure-store'],
    android: {
      package: 'com.klawisha.cargogo',
      adaptiveIcon: {
        foregroundImage: './assets/brand/app-icon.png',
        backgroundColor: '#081016',
      },
      ...(googleMapsApiKey ? { config: { googleMaps: { apiKey: googleMapsApiKey } } } : {}),
    },
    owner: 'probel',
    extra: { eas: { projectId: '2ca05cd4-e779-4ad5-998d-4e3c07809ea0' } },
  };
};
