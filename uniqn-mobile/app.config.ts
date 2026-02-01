/**
 * UNIQN Mobile - Expo 동적 설정
 *
 * @description 환경별 설정, 버전 관리, 빌드 설정을 동적으로 관리
 * @version 1.0.0
 *
 * 사용법:
 * - EAS Build에서 EAS_BUILD_RUNNER 환경변수로 빌드 환경 자동 감지
 * - eas build --profile development|preview|production
 */

import { ExpoConfig, ConfigContext } from 'expo/config';

// ============================================================================
// 버전 관리
// ============================================================================

const VERSION = '1.0.0';
const BUILD_NUMBER = 1;

// ============================================================================
// 환경 설정
// ============================================================================

type Environment = 'development' | 'staging' | 'production';

const getEnvironment = (): Environment => {
  // EAS Build 환경에서는 EAS_BUILD_PROFILE로 판단
  const buildProfile = process.env.EAS_BUILD_PROFILE;

  if (buildProfile === 'production') return 'production';
  if (buildProfile === 'preview') return 'staging';

  // 로컬 개발 환경
  return 'development';
};

const environment = getEnvironment();

// 환경별 설정
const ENV_CONFIG = {
  development: {
    appName: 'UNIQN (Dev)',
    bundleIdentifier: 'com.uniqn.mobile.dev',
    androidPackage: 'com.uniqn.mobile.dev',
    // Firebase: tholdem-ebc18 사용 (환경 분리 시 별도 프로젝트 생성 권장)
  },
  staging: {
    appName: 'UNIQN (Staging)',
    bundleIdentifier: 'com.uniqn.mobile.staging',
    androidPackage: 'com.uniqn.mobile.staging',
  },
  production: {
    appName: 'UNIQN',
    bundleIdentifier: 'com.uniqn.mobile',
    androidPackage: 'com.uniqn.mobile',
  },
} as const;

const envConfig = ENV_CONFIG[environment];

// ============================================================================
// Expo 설정
// ============================================================================

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: envConfig.appName,
  slug: 'uniqn',
  version: VERSION,
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  scheme: 'uniqn',

  // 스플래시 스크린
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },

  // iOS 설정
  ios: {
    supportsTablet: true,
    bundleIdentifier: envConfig.bundleIdentifier,
    buildNumber: String(BUILD_NUMBER),
    googleServicesFile: './GoogleService-Info.plist',
    infoPlist: {
      NSCameraUsageDescription: 'QR 코드 스캔을 위해 카메라 접근이 필요합니다.',
      NSPhotoLibraryUsageDescription: '프로필 사진 등록을 위해 사진 라이브러리 접근이 필요합니다.',
      NSFaceIDUsageDescription: '빠른 로그인을 위해 Face ID를 사용합니다.',
    },
    // Universal Links (uniqn.app 도메인 설정 + apple-app-site-association 파일 배포 후 활성화)
    // associatedDomains: [
    //   'applinks:uniqn.app',
    //   'webcredentials:uniqn.app',
    // ],
  },

  // Android 설정
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    package: envConfig.androidPackage,
    versionCode: BUILD_NUMBER,
    googleServicesFile: './google-services.json',
    permissions: [
      'android.permission.CAMERA',
      'android.permission.VIBRATE',
    ],
    // App Links (uniqn.app 도메인 설정 + assetlinks.json 파일 배포 후 활성화)
    // intentFilters: [
    //   {
    //     action: 'VIEW',
    //     autoVerify: true,
    //     data: [
    //       {
    //         scheme: 'https',
    //         host: 'uniqn.app',
    //         pathPrefix: '/',
    //       },
    //     ],
    //     category: ['BROWSABLE', 'DEFAULT'],
    //   },
    // ],
  },

  // 웹 설정
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },

  // 플러그인
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-camera',
      {
        cameraPermission: 'QR 코드 스캔을 위해 카메라 접근이 필요합니다.',
      },
    ],
    [
      'expo-local-authentication',
      {
        faceIDPermission: '빠른 로그인을 위해 Face ID를 사용합니다.',
      },
    ],
    '@react-native-community/datetimepicker',
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#A855F7',
        // Android 알림 채널은 pushNotificationService.ts에서 동적 생성
      },
    ],
    // Sentry - 에러 모니터링
    [
      '@sentry/react-native/expo',
      {
        organization: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
      },
    ],
  ],

  // 추가 설정
  extra: {
    // EAS 설정
    eas: {
      projectId: process.env.EAS_PROJECT_ID || '9bca3314-2a12-4654-ad9c-3ae43f8cf125',
    },
    // 앱 버전 정보
    version: VERSION,
    buildNumber: BUILD_NUMBER,
    environment,
    // 빌드 시간
    buildDate: new Date().toISOString(),
    // 소셜 로그인 활성화 여부 (SDK 구현 전까지 개발 환경에서만 활성화)
    socialLoginEnabled: environment === 'development',
  },

  // 업데이트 설정 (EAS Update)
  updates: {
    enabled: true,
    fallbackToCacheTimeout: 0,
    url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID || '9bca3314-2a12-4654-ad9c-3ae43f8cf125'}`,
  },

  // 런타임 버전 (EAS Update 호환)
  runtimeVersion: {
    policy: 'sdkVersion',
  },
});
