const config = {
  appId: 'com.qikki.reminders',
  appName: 'Qikki',
  webDir: 'dist',
  bundledWebRuntime: false,
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
    preferredContentMode: 'mobile',
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: false,
  },
  server: {
    iosScheme: 'https',
    androidScheme: 'https',
  },
};

export default config;
