import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.uniqn.app',
  appName: 'UNIQN',
  webDir: 'build',
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
    cleartext: false,
    allowNavigation: [
      'https://tholdem-ebc18.web.app',
      'https://tholdem-ebc18.firebaseapp.com'
    ]
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true,
    allowsInlineMediaPlayback: true,
    preferredContentMode: 'mobile'
  },
  android: {
    webContentsDebuggingEnabled: false,
    allowMixedContent: false,
    captureInput: true,
    webViewPresentationStyle: 'fullscreen'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      backgroundColor: '#1f2937',
      showSpinner: false,
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'small'
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#1f2937'
    }
  }
};

export default config;
