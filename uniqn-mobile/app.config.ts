/**
 * UNIQN Mobile - Expo 동적 설정
 *
 * @description 환경별 설정, 버전 관리, 빌드 설정을 동적으로 관리
 * @version 1.0.2
 *
 * 사용법:
 * - EAS Build에서 EAS_BUILD_RUNNER 환경변수로 빌드 환경 자동 감지
 * - eas build --profile development|preview|production
 */

import fs from 'fs';
import { ExpoConfig, ConfigContext } from 'expo/config';

// ============================================================================
// 상수
// ============================================================================

// 버전 단일 소스: package.json. `npm version patch` 한 번으로 올리면 앱 전체가 따라온다.
const VERSION =
  (JSON.parse(fs.readFileSync(`${__dirname}/package.json`, 'utf-8')) as { version?: string })
    .version ?? '0.0.0';
const SLUG = 'uniqn';
const DOMAIN = 'uniqn.app';
const EAS_PROJECT_ID = '9bca3314-2a12-4654-ad9c-3ae43f8cf125';

// PortOne 공개 식별자 — eas.json 에도 평문 commit 되어 있는 클라이언트 공개 값.
// OTA 푸시 시 shell env 가 누락된 경우의 fallback. 진짜 시크릿(API secret)은 서버 Edge Function 에만 있음.
const PORTONE_STORE_ID_FALLBACK = 'store-c1b44e1c-7620-445b-bb6c-9b6b62e7ab93';
const PORTONE_INICIS_CHANNEL_KEY_FALLBACK = 'channel-key-2dc155c9-46a1-4710-a687-245f45497b0c';

const BRAND_BG_COLOR = '#0B0B0E';
const SPLASH_BG_COLOR = '#07070A'; // surface.dark — page 바로 아래 단계
const BRAND_ACCENT_COLOR = '#D4AF37';
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
type NativePlatform = 'android' | 'ios';

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

function getConfiguredAndroidPackages(): Set<string> {
  const configPath = `${__dirname}/google-services.json`;
  if (!fs.existsSync(configPath)) {
    return new Set();
  }

  const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as {
    client?: {
      client_info?: {
        android_client_info?: {
          package_name?: string;
        };
      };
    }[];
  };

  return new Set(
    (rawConfig.client ?? [])
      .map((client) => client.client_info?.android_client_info?.package_name)
      .filter((packageName): packageName is string => typeof packageName === 'string')
  );
}

function getConfiguredIosBundleIds(): Set<string> {
  const configPath = `${__dirname}/GoogleService-Info.plist`;
  if (!fs.existsSync(configPath)) {
    return new Set();
  }

  const matches = [
    ...fs
      .readFileSync(configPath, 'utf-8')
      .matchAll(/<key>BUNDLE_ID<\/key>\s*<string>([^<]+)<\/string>/g),
  ];

  return new Set(matches.map((match) => match[1]).filter(Boolean));
}

function getEasBuildPlatform(): NativePlatform | null {
  const platform = process.env.EAS_BUILD_PLATFORM;
  return platform === 'android' || platform === 'ios' ? platform : null;
}

function assertSupportedNativeFirebaseBuild(): void {
  const platform = getEasBuildPlatform();
  if (!platform) {
    return;
  }

  const expectedIdentifier =
    platform === 'android' ? envConfig.androidPackage : envConfig.bundleIdentifier;
  const configuredIdentifiers =
    platform === 'android' ? getConfiguredAndroidPackages() : getConfiguredIosBundleIds();

  if (configuredIdentifiers.has(expectedIdentifier)) {
    return;
  }

  const profileLabel = environment === 'staging' ? 'preview/staging' : environment;
  const fileName = platform === 'android' ? 'google-services.json' : 'GoogleService-Info.plist';

  throw new Error(
    `Firebase native config mismatch: ${profileLabel} ${platform} build expects ${expectedIdentifier}, ` +
      `but ${fileName} does not include it. Release-first policy keeps repo-tracked native configs only. ` +
      `Register a Firebase app for ${expectedIdentifier} before using this build profile.`
  );
}

assertSupportedNativeFirebaseBuild();

// ============================================================================
// Expo 설정
// ============================================================================

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: envConfig.appName,
  slug: SLUG,
  version: VERSION,
  icon: APP_ICON,
  userInterfaceStyle: 'automatic',
  scheme: SLUG,

  // iOS 설정
  ios: {
    supportsTablet: true,
    usesAppleSignIn: true,
    bundleIdentifier: envConfig.bundleIdentifier,
    googleServicesFile: './GoogleService-Info.plist',
    infoPlist: {
      CFBundleAllowMixedLocalizations: true,
      UIBackgroundModes: ['remote-notification'],
      ITSAppUsesNonExemptEncryption: false,
      UISupportedInterfaceOrientations: ['UIInterfaceOrientationPortrait'],
      'UISupportedInterfaceOrientations~ipad': [
        'UIInterfaceOrientationPortrait',
        'UIInterfaceOrientationPortraitUpsideDown',
      ],
      NSCameraUsageDescription: PERMISSION_MESSAGES.camera,
      NSPhotoLibraryUsageDescription: PERMISSION_MESSAGES.photoLibrary,
      NSFaceIDUsageDescription: PERMISSION_MESSAGES.faceId,
    },
    // Apple Required Reason API 선언 (iOS 17+, App Store 필수)
    // 각 reason code는 node_modules/*/ios/PrivacyInfo.xcprivacy에서 수집
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1', '0A2A.1', '3B52.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['E174.1', '85F4.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
      ],
    },
    // Universal Links (production 빌드에서만 활성화 - AASA에 production bundleID만 등록)
    ...(environment === 'production'
      ? {
          associatedDomains: [`applinks:${DOMAIN}`, `webcredentials:${DOMAIN}`],
        }
      : {}),
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
      'android.permission.POST_NOTIFICATIONS',
    ],
    // App Links (production 빌드에서만 활성화 - assetlinks.json에 production 패키지만 등록)
    ...(environment === 'production'
      ? {
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
        }
      : {}),
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
    'expo-apple-authentication',
    'expo-router',
    '@portone/react-native-sdk/plugin',
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        image: APP_ICON,
        imageWidth: 200,
        backgroundColor: SPLASH_BG_COLOR,
        dark: {
          backgroundColor: SPLASH_BG_COLOR,
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
    'expo-image',
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
      '@sentry/react-native',
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
        },
        ios: {
          useFrameworks: 'static',
          deploymentTarget: '16.0',
        },
      },
    ],
    // NOTE: @react-native-firebase 플러그인 제거 (Supabase 이전 완료, 네이티브 Firebase SDK 미사용)
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
    useEmulator: process.env.EXPO_PUBLIC_USE_EMULATOR === 'true',
    // ⚠️ buildDate(`new Date().toISOString()`) 제거 (2026-07-26).
    // runtimeVersion 정책이 'fingerprint'(아래 참조)가 되면서 **expoConfig 전체가 해시
    // 소스**에 포함된다. 동적 타임스탬프가 extra 에 있으면 fingerprint 가 평가할 때마다
    // 달라져, EAS Build 가 계산한 runtimeVersion 과 이후 `eas update` 가 계산한
    // runtimeVersion 이 절대 일치하지 않는다 = OTA 영구 무력화.
    // 실측(2026-07-26): 연속 2회 `expo-updates fingerprint:generate` 해시 불일치,
    // 불일치 소스는 145개 중 `expoConfig` 단 1개(내용 diff = buildDate).
    // extra 에는 평가 시점마다 달라지는 값을 절대 넣지 말 것.
    // Apple 로그인 kill switch (2026-07-25 하드 OFF 전환)
    // 2026-07-21 동결 시점엔 env opt-in(=== 'true')으로 남겨뒀으나, 07-19 빌드로 가입했던
    // Apple 계정을 전부 정리(2026-07-25 prod 삭제)했고 웹 로그인 경로도 없어 재활성 계획이
    // 없다. 배포자 shell 에 env 가 남아 있어도 켜지지 않도록 상수 false 로 고정한다.
    // 재활성하려면 이 값을 env 기반으로 되돌리는 코드 변경 + 기존 사용자 마이그레이션 계획이 필요.
    appleLoginEnabled: false,
    // PortOne KG Inicis identity verification.
    // storeId/channelKey 는 공개 식별자이므로 env 누락 시 fallback 으로 대응.
    // 2026-05-16 OTA 푸시에서 EXPO_PUBLIC_PORTONE_* 가 빈 값으로 박혀 본인인증 전면 차단된 사건 재발 방지.
    portOne: {
      storeId: process.env.EXPO_PUBLIC_PORTONE_STORE_ID || PORTONE_STORE_ID_FALLBACK,
      inicisChannelKey:
        process.env.EXPO_PUBLIC_PORTONE_INICIS_CHANNEL_KEY || PORTONE_INICIS_CHANNEL_KEY_FALLBACK,
      inicisDirectAgency: process.env.EXPO_PUBLIC_PORTONE_INICIS_DIRECT_AGENCY || '',
      inicisLogoUrl: process.env.EXPO_PUBLIC_PORTONE_INICIS_LOGO_URL || '',
      inicisFrgndInfo: process.env.EXPO_PUBLIC_PORTONE_INICIS_FRGND_INFO || 'N',
    },
  },

  // 업데이트 설정 (EAS Update)
  updates: {
    enabled: true,
    fallbackToCacheTimeout: 0,
    url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID || EAS_PROJECT_ID}`,
  },

  // 런타임 버전 (EAS Update 호환)
  //
  // ⚠️ 'sdkVersion' 에서 'fingerprint' 로 전환 (2026-07-25).
  // 'sdkVersion' 은 runtimeVersion 을 exposdk:55.x 로만 고정해 **네이티브 구성이
  // 바뀌어도 값이 그대로**다. react-native-keyboard-controller(네이티브 모듈) 도입 시
  // 구 빌드와 신 빌드가 같은 runtimeVersion 을 갖게 되어, 신 코드가 담긴 OTA 가
  // 네이티브 모듈이 없는 구 빌드로도 전달된다 → 없는 코드 호출 → 오류/롤백.
  // (Expo 공식 문서 eas-update/runtime-versions 가 경고하는 시나리오와 동일)
  //
  // 'fingerprint' 는 네이티브 런타임 구성이 바뀌면 runtimeVersion 이 자동으로 갈라져
  // 호환되지 않는 OTA 가 구 빌드에 전달되는 것을 원천 차단한다.
  // 대가: 네이티브 의존성이 바뀌면 새 빌드가 필요하다(= 올바른 동작).
  // 구 빌드 사용자는 더 이상 OTA 를 받지 않고 스토어 업데이트로 넘어와야 한다.
  runtimeVersion: {
    policy: 'fingerprint',
  },
});
