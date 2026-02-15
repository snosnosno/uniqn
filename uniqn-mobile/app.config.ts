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
// 상수
// ============================================================================

const VERSION = '1.0.0';
const SLUG = 'uniqn';
const DOMAIN = 'uniqn.app';
const EAS_PROJECT_ID = '9bca3314-2a12-4654-ad9c-3ae43f8cf125';

const BRAND_BG_COLOR = '#1a1625';
const BRAND_ACCENT_COLOR = '#A855F7';
const APP_ICON = './assets/1024.png';

const PERMISSION_MESSAGES = {
  camera: 'QR 코드 스캔을 위해 카메라 접근이 필요합니다.',
  photoLibrary: '프로필 사진 등록을 위해 사진 라이브러리 접근이 필요합니다.',
  faceId: '빠른 로그인을 위해 Face ID를 사용합니다.',
} as const;

// ============================================================================
// 환경 설정
// ============================================================================

type Environment = 'development' | 'staging' | 'production';

const getEnvironment = (): Environment => {
  // eas.json의 env.APP_ENV을 우선 참조 (로컬 config 해석 시에도 확실히 전달됨)
  const appEnv = process.env.APP_ENV;
  if (appEnv === 'production') return 'production';
  if (appEnv === 'staging') return 'staging';

  // EAS Build 서버 환경 fallback
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
    appName: 'UNIQN Dev',
    bundleIdentifier: 'com.uniqn.mobile.dev',
    androidPackage: 'com.uniqn.mobile.dev',
    // Firebase: tholdem-ebc18 사용 (환경 분리 시 별도 프로젝트 생성 권장)
  },
  staging: {
    appName: 'UNIQN Staging',
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
  slug: SLUG,
  version: VERSION,
  orientation: 'portrait',
  icon: APP_ICON,
  userInterfaceStyle: 'automatic',
  scheme: SLUG,

  // iOS 설정
  ios: {
    supportsTablet: true,
    bundleIdentifier: envConfig.bundleIdentifier,
    googleServicesFile: './GoogleService-Info.plist',
    infoPlist: {
      UIBackgroundModes: ['remote-notification'],
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription: PERMISSION_MESSAGES.camera,
      NSPhotoLibraryUsageDescription: PERMISSION_MESSAGES.photoLibrary,
      NSFaceIDUsageDescription: PERMISSION_MESSAGES.faceId,
    },
    // Universal Links (production 빌드에서만 활성화 - AASA에 production bundleID만 등록)
    ...(environment === 'production' ? {
      associatedDomains: [
        `applinks:${DOMAIN}`,
        `webcredentials:${DOMAIN}`,
      ],
    } : {}),
  },

  // Android 설정
  android: {
    adaptiveIcon: {
      foregroundImage: APP_ICON,
      backgroundColor: BRAND_BG_COLOR,
    },
    package: envConfig.androidPackage,
    googleServicesFile: './google-services.json',
    permissions: [
      'android.permission.CAMERA',
      'android.permission.VIBRATE',
    ],
    // App Links (production 빌드에서만 활성화 - assetlinks.json에 production 패키지만 등록)
    ...(environment === 'production' ? {
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: DOMAIN,
              pathPrefix: '/',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    } : {}),
  },

  // 웹 설정
  web: {
    favicon: './assets/play_store_512.png',
    bundler: 'metro',
    name: 'UNIQN',
    shortName: 'UNIQN',
    themeColor: BRAND_BG_COLOR,
    backgroundColor: BRAND_BG_COLOR,
  },

  // 플러그인
  plugins: [
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    'expo-router',
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        image: APP_ICON,
        imageWidth: 200,
        backgroundColor: BRAND_BG_COLOR,
        dark: {
          backgroundColor: BRAND_BG_COLOR,
          image: APP_ICON,
        },
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: PERMISSION_MESSAGES.camera,
      },
    ],
    [
      'expo-local-authentication',
      {
        faceIDPermission: PERMISSION_MESSAGES.faceId,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: PERMISSION_MESSAGES.photoLibrary,
      },
    ],
    '@react-native-community/datetimepicker',
    [
      'expo-notifications',
      {
        icon: APP_ICON,
        color: BRAND_ACCENT_COLOR,
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
    // 네이티브 빌드 속성 (ProGuard, 디버그 심볼, New Architecture, iOS 배포 대상)
    [
      'expo-build-properties',
      {
        android: {
          enableProguardInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          includeNativeDebugSymbols: true,
          newArchEnabled: true,
        },
        ios: {
          deploymentTarget: '16.0',
          newArchEnabled: true,
        },
      },
    ],
  ],

  // 추가 설정
  extra: {
    // EAS 설정
    eas: {
      projectId: process.env.EAS_PROJECT_ID || EAS_PROJECT_ID,
    },
    // 앱 버전 정보
    version: VERSION,
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
    url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID || EAS_PROJECT_ID}`,
  },

  // 런타임 버전 (EAS Update 호환)
  runtimeVersion: {
    policy: 'sdkVersion',
  },
});
