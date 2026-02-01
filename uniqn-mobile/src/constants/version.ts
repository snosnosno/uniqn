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
 * 이 값들은 Firebase Remote Config로 동적 관리 가능
 */
export const UPDATE_POLICY = {
  /**
   * 강제 업데이트 필요 최소 버전
   * 이 버전보다 낮으면 앱 사용 불가
   * 출시 후: Firebase Remote Config에서 동적 관리 가능
   * @see featureFlagService.ts
   */
  MINIMUM_VERSION: '1.0.0',

  /**
   * 권장 업데이트 버전
   * 이 버전보다 낮으면 업데이트 권장 팝업 표시
   * 출시 후: Firebase Remote Config에서 동적 관리 가능
   * @see featureFlagService.ts
   */
  RECOMMENDED_VERSION: '1.0.0',

  /**
   * 권장 업데이트 팝업 다시 보지 않기 기간 (일)
   */
  RECOMMENDED_DISMISS_DAYS: 3,

  /**
   * 앱스토어 링크
   * 스토어 등록 후 실제 ID로 교체 필요
   */
  STORE_URLS: {
    ios: 'https://apps.apple.com/app/uniqn/idXXXXXXXXXX', // 스토어 등록 후 실제 앱 ID로 교체
    android: 'https://play.google.com/store/apps/details?id=com.uniqn.mobile', // 스토어 등록 후 확인
    web: 'https://uniqn.app',
  },
} as const;

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
export function getStoreUrl(): string {
  return Platform.select({
    ios: UPDATE_POLICY.STORE_URLS.ios,
    android: UPDATE_POLICY.STORE_URLS.android,
    default: UPDATE_POLICY.STORE_URLS.web,
  });
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

export default versionInfo;
