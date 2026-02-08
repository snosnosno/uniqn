/**
 * UNIQN Mobile - 버전 관리 서비스
 *
 * @description 앱 버전 확인 및 강제 업데이트 체크
 * @version 1.0.0
 *
 * Firestore 문서 구조 (appVersions/{platform}):
 * {
 *   minVersion: "1.0.0",     // 강제 업데이트 필요 최소 버전
 *   latestVersion: "1.0.0",  // 최신 버전
 *   recommendedVersion: "1.0.0", // 권장 버전
 *   releaseNotes: "...",     // 릴리즈 노트
 *   maintenanceMode: false,  // 점검 모드
 *   maintenanceMessage: "",  // 점검 메시지
 * }
 */

import { Platform } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { APP_VERSION, compareVersions, type UpdateType } from '@/constants/version';

// ============================================================================
// Types
// ============================================================================

export interface RemoteVersionConfig {
  /** 강제 업데이트 필요 최소 버전 */
  minVersion: string;
  /** 최신 버전 */
  latestVersion: string;
  /** 권장 버전 */
  recommendedVersion?: string;
  /** 릴리즈 노트 */
  releaseNotes?: string;
  /** 점검 모드 */
  maintenanceMode?: boolean;
  /** 점검 메시지 */
  maintenanceMessage?: string;
}

export interface VersionCheckResult {
  /** 업데이트 타입 */
  updateType: UpdateType;
  /** 강제 업데이트 필요 여부 */
  mustUpdate: boolean;
  /** 권장 업데이트 여부 */
  shouldUpdate: boolean;
  /** 점검 모드 여부 */
  isMaintenanceMode: boolean;
  /** 점검 메시지 */
  maintenanceMessage?: string;
  /** 최신 버전 */
  latestVersion?: string;
  /** 릴리즈 노트 */
  releaseNotes?: string;
  /** 현재 앱 버전 */
  currentVersion: string;
}

// ============================================================================
// Service
// ============================================================================

/**
 * Firestore에서 원격 버전 설정 가져오기
 */
export async function getRemoteVersionConfig(): Promise<RemoteVersionConfig | null> {
  try {
    const db = getFirebaseDb();
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const docRef = doc(db, 'appVersions', platform);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      logger.warn('원격 버전 설정 문서 없음', {
        component: 'versionService',
        platform,
      });
      return null;
    }

    const data = docSnap.data() as RemoteVersionConfig;

    logger.debug('원격 버전 설정 로드', {
      component: 'versionService',
      platform,
      minVersion: data.minVersion,
      latestVersion: data.latestVersion,
    });

    return data;
  } catch (error) {
    logger.error(
      '원격 버전 설정 로드 실패',
      error instanceof Error ? error : new Error(String(error)),
      {
        component: 'versionService',
      }
    );
    return null;
  }
}

/**
 * 강제 업데이트 체크
 *
 * @returns 업데이트 체크 결과
 */
export async function checkForceUpdate(): Promise<VersionCheckResult> {
  const currentVersion = APP_VERSION;

  // 기본 결과 (원격 설정 없을 때)
  const defaultResult: VersionCheckResult = {
    updateType: 'none',
    mustUpdate: false,
    shouldUpdate: false,
    isMaintenanceMode: false,
    currentVersion,
  };

  try {
    const remoteConfig = await getRemoteVersionConfig();

    // 원격 설정이 없으면 업데이트 불필요로 처리
    if (!remoteConfig) {
      logger.info('원격 버전 설정 없음 - 업데이트 체크 스킵', {
        component: 'versionService',
        currentVersion,
      });
      return defaultResult;
    }

    // 점검 모드 확인
    if (remoteConfig.maintenanceMode) {
      logger.info('점검 모드 활성화', {
        component: 'versionService',
        message: remoteConfig.maintenanceMessage,
      });
      return {
        ...defaultResult,
        isMaintenanceMode: true,
        maintenanceMessage: remoteConfig.maintenanceMessage,
      };
    }

    // 버전 비교
    const { minVersion, latestVersion, recommendedVersion, releaseNotes } = remoteConfig;

    // 강제 업데이트 필요 여부 확인
    const mustUpdate = compareVersions(currentVersion, minVersion) < 0;

    // 권장 업데이트 여부 확인
    const shouldUpdate = recommendedVersion
      ? compareVersions(currentVersion, recommendedVersion) < 0
      : compareVersions(currentVersion, latestVersion) < 0;

    // 업데이트 타입 결정
    let updateType: UpdateType = 'none';
    if (mustUpdate) {
      updateType = 'required';
    } else if (shouldUpdate) {
      updateType = 'recommended';
    } else if (compareVersions(currentVersion, latestVersion) < 0) {
      updateType = 'optional';
    }

    const result: VersionCheckResult = {
      updateType,
      mustUpdate,
      shouldUpdate,
      isMaintenanceMode: false,
      latestVersion,
      releaseNotes,
      currentVersion,
    };

    logger.info('버전 체크 완료', {
      component: 'versionService',
      currentVersion,
      minVersion,
      latestVersion,
      updateType,
      mustUpdate,
    });

    return result;
  } catch (error) {
    logger.error('버전 체크 실패', error instanceof Error ? error : new Error(String(error)), {
      component: 'versionService',
      currentVersion,
    });

    // 에러 발생 시 업데이트 불필요로 처리 (앱 사용 가능하게)
    return defaultResult;
  }
}

/**
 * 강제 업데이트 에러
 */
export class ForceUpdateError extends Error {
  constructor(
    message: string,
    public readonly latestVersion?: string,
    public readonly releaseNotes?: string
  ) {
    super(message);
    this.name = 'ForceUpdateError';
    Object.setPrototypeOf(this, ForceUpdateError.prototype);
  }
}

/**
 * 점검 모드 에러
 */
export class MaintenanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MaintenanceError';
    Object.setPrototypeOf(this, MaintenanceError.prototype);
  }
}

/**
 * Babel wrapNativeSuper 환경에서 instanceof 대신 name으로 판별
 */
export const isForceUpdateError = (error: unknown): error is ForceUpdateError => {
  return error instanceof ForceUpdateError || (error instanceof Error && error.name === 'ForceUpdateError');
};

export const isMaintenanceError = (error: unknown): error is MaintenanceError => {
  return error instanceof MaintenanceError || (error instanceof Error && error.name === 'MaintenanceError');
};

export default {
  getRemoteVersionConfig,
  checkForceUpdate,
};
