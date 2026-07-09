/**
 * UNIQN Mobile - 버전 관리 상수
 *
 * @description 앱 버전 정보 및 업데이트 관련 상수
 * @version 1.0.0
 *
 * 버전 규칙:
 * - MAJOR: 하위 호환되지 않는 API 변경
 * - MINOR: 하위 호환되는 기능 추가
 * - PATCH: 하위 호환되는 버그 수정
 *
 * 빌드 번호:
 * - iOS: CFBundleVersion (정수만)
 * - Android: versionCode (정수만)
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

// ============================================================================
// 버전 정보
// ============================================================================

/**
 * 현재 앱 버전 (시맨틱 버전)
 * app.config.ts의 VERSION과 동기화
 */
export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

/**
 * 현재 빌드 번호
 * iOS: buildNumber, Android: versionCode
 */
export const BUILD_NUMBER = Platform.select({
  ios: Constants.expoConfig?.ios?.buildNumber ?? '1',
  android: String(Constants.expoConfig?.android?.versionCode ?? 1),
  default: '1',
});

/**
 * 환경 정보
 */
export const ENVIRONMENT = (Constants.expoConfig?.extra?.environment ?? 'development') as
  | 'development'
  | 'staging'
  | 'production';

/**
 * 빌드 일시
 */
export const BUILD_DATE = Constants.expoConfig?.extra?.buildDate ?? new Date().toISOString();

/**
 * 런타임 버전 (EAS Update 호환)
 */
export const RUNTIME_VERSION = Constants.expoConfig?.runtimeVersion ?? APP_VERSION;

// ============================================================================
// 업데이트 정책
// ============================================================================

/**
 * 업데이트 타입
 */
export type UpdateType = 'none' | 'optional' | 'recommended' | 'required';

/**
 * 업데이트 정책 설정
 * 이 값들은 원격 설정 시스템으로 동적 관리 예정
 */
export const UPDATE_POLICY = {
  /**
   * 강제 업데이트 필요 최소 버전
   * 이 버전보다 낮으면 앱 사용 불가
   * 출시 후: 원격 설정 시스템에서 동적 관리 예정
   * @see featureFlagService.ts
   */
  MINIMUM_VERSION: '1.0.0',

  /**
   * 권장 업데이트 버전
   * 이 버전보다 낮으면 업데이트 권장 팝업 표시
   * 출시 후: 원격 설정 시스템에서 동적 관리 예정
   * @see featureFlagService.ts
   */
  RECOMMENDED_VERSION: '1.0.0',

  /**
   * 권장 업데이트 팝업 다시 보지 않기 기간 (일)
   */
  RECOMMENDED_DISMISS_DAYS: 3,

  /**
   * 앱스토어 링크 (출시 완료 — 실제 스토어 ID)
   * iOS App Store ID: 6758857038 / Android package: com.uniqn.mobile
   */
  STORE_URLS: {
    ios: 'https://apps.apple.com/kr/app/uniqn/id6758857038',
    android: 'https://play.google.com/store/apps/details?id=com.uniqn.mobile',
    web: 'https://uniqn.app',
  },
} as const;

function isStoreUrlConfigured(url?: string): boolean {
  if (!url) {
    return false;
  }

  return !url.includes('XXXXXXXXXX');
}

// ============================================================================
// 버전 비교 유틸리티
// ============================================================================

/**
 * 시맨틱 버전 파싱
 */
export function parseVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
} {
  const [major = 0, minor = 0, patch = 0] = version.split('.').map((n) => parseInt(n, 10) || 0);

  return { major, minor, patch };
}

/**
 * 버전 비교
 * @returns -1: a < b, 0: a === b, 1: a > b
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const versionA = parseVersion(a);
  const versionB = parseVersion(b);

  if (versionA.major !== versionB.major) {
    return versionA.major > versionB.major ? 1 : -1;
  }

  if (versionA.minor !== versionB.minor) {
    return versionA.minor > versionB.minor ? 1 : -1;
  }

  if (versionA.patch !== versionB.patch) {
    return versionA.patch > versionB.patch ? 1 : -1;
  }

  return 0;
}

/**
 * 현재 버전이 최소 버전 이상인지 확인
 */
export function isVersionAtLeast(currentVersion: string, minimumVersion: string): boolean {
  return compareVersions(currentVersion, minimumVersion) >= 0;
}

/**
 * 업데이트 필요 여부 확인
 */
export function checkUpdateRequired(currentVersion: string): UpdateType {
  // 강제 업데이트 필요
  if (!isVersionAtLeast(currentVersion, UPDATE_POLICY.MINIMUM_VERSION)) {
    return 'required';
  }

  // 권장 업데이트
  if (!isVersionAtLeast(currentVersion, UPDATE_POLICY.RECOMMENDED_VERSION)) {
    return 'recommended';
  }

  // 최신 버전 (옵셔널 업데이트가 있을 수 있음)
  if (compareVersions(currentVersion, UPDATE_POLICY.RECOMMENDED_VERSION) < 0) {
    return 'optional';
  }

  return 'none';
}

/**
 * 앱스토어 URL 가져오기
 */
export function getStoreUrl(platform: typeof Platform.OS = Platform.OS): string {
  const selectedUrl =
    platform === 'ios'
      ? UPDATE_POLICY.STORE_URLS.ios
      : platform === 'android'
        ? UPDATE_POLICY.STORE_URLS.android
        : UPDATE_POLICY.STORE_URLS.web;

  return isStoreUrlConfigured(selectedUrl) ? selectedUrl : UPDATE_POLICY.STORE_URLS.web;
}

/**
 * 앱 설치용 스토어 URL 해석
 *
 * @description 공유 링크는 카톡/SNS → 모바일 웹브라우저로 열리므로 `Platform.OS`가
 * 'web'이 된다. 이때 `getStoreUrl`은 디바이스를 구분하지 못하고 웹 URL을 반환한다.
 * 비로그인 사용자가 "앱 설치"를 눌렀을 때 기기에 맞는 스토어로 보내기 위해
 * 웹에서는 userAgent로 iOS/Android를 판별한다(데스크톱은 웹사이트로 폴백).
 * 네이티브 앱에서는 `Platform.OS` 기반 `getStoreUrl`을 그대로 사용한다.
 *
 * iPadOS 13+ Safari는 기본 UA를 'iPad'가 아닌 'Macintosh'(데스크톱)로 보고하므로
 * 터치 지원(maxTouchPoints)을 함께 보고 iPad를 App Store로 라우팅한다.
 */
export function resolveInstallStoreUrl(
  platform: typeof Platform.OS = Platform.OS,
  userAgent: string = typeof navigator !== 'undefined' ? (navigator.userAgent ?? '') : '',
  maxTouchPoints: number = typeof navigator !== 'undefined' ? (navigator.maxTouchPoints ?? 0) : 0
): string {
  if (platform === 'web') {
    if (/android/i.test(userAgent)) {
      return getStoreUrl('android');
    }

    const isIpadOsDesktopUa = /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
    if (/iphone|ipad|ipod/i.test(userAgent) || isIpadOsDesktopUa) {
      return getStoreUrl('ios');
    }

    return UPDATE_POLICY.STORE_URLS.web;
  }

  return getStoreUrl(platform);
}

// ============================================================================
// 버전 정보 객체
// ============================================================================

/**
 * 버전 정보 통합 객체
 */
export const versionInfo = {
  version: APP_VERSION,
  buildNumber: BUILD_NUMBER,
  environment: ENVIRONMENT,
  buildDate: BUILD_DATE,
  runtimeVersion: RUNTIME_VERSION,

  /**
   * 표시용 버전 문자열
   * 예: "1.0.0 (1)"
   */
  get displayVersion(): string {
    return `${APP_VERSION} (${BUILD_NUMBER})`;
  },

  /**
   * 상세 버전 문자열
   * 예: "1.0.0 (1) - development"
   */
  get fullVersion(): string {
    return `${APP_VERSION} (${BUILD_NUMBER}) - ${ENVIRONMENT}`;
  },

  /**
   * 업데이트 필요 여부
   */
  get updateRequired(): UpdateType {
    return checkUpdateRequired(APP_VERSION);
  },

  /**
   * 앱스토어 URL
   */
  get storeUrl(): string {
    return getStoreUrl();
  },
} as const;
