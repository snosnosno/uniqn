import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tholdem.app',
  appName: 'T-HOLDEM',
  webDir: 'build',
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor'
  },
  ios: {
    contentInset: 'automatic'
  },
  android: {
    webContentsDebuggingEnabled: false
  }
};

export default config;
