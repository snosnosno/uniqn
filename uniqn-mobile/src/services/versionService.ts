/**
 * UNIQN Mobile - 버전 관리 서비스
 *
 * @description 앱 버전 확인 및 강제 업데이트 체크
 * @version 2.0.0
 *
 * Supabase app_config 테이블 구조:
 * - force_update_version: { ios, web, android } — 강제 업데이트 최소 버전
 * - latest_version: { ios, web, android } — 최신 버전
 * - recommended_version: { ios, web, android } — 권장 버전
 * - release_notes: { ios, web, android } — 릴리즈 노트
 * - maintenance_mode: { enabled, message } — 점검 모드
 */

import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { APP_VERSION, compareVersions, type UpdateType } from '@/constants/version';

const VERSION_CHECK_TIMEOUT_MS = Platform.OS === 'web' ? 3000 : 5000;

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
 * Supabase app_config 테이블에서 원격 버전 설정 가져오기
 */
export async function getRemoteVersionConfig(): Promise<RemoteVersionConfig | null> {
  try {
    const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

    const { data, error } = await supabase
      .from('app_config')
      .select('key, value')
      .in('key', [
        'force_update_version',
        'latest_version',
        'recommended_version',
        'release_notes',
        'maintenance_mode',
      ]);

    if (error) {
      logger.error('원격 버전 설정 쿼리 실패', new Error(error.message), {
        component: 'versionService',
        code: error.code,
      });
      return null;
    }

    if (!data || data.length === 0) {
      logger.warn('원격 버전 설정 데이터 없음', {
        component: 'versionService',
        platform,
      });
      return null;
    }

    const configMap = new Map<string, Record<string, unknown>>(
      data.map((row: { key: string; value: Record<string, unknown> }) => [row.key, row.value])
    );

    const forceUpdate = configMap.get('force_update_version') as Record<string, string> | undefined;
    const latest = configMap.get('latest_version') as Record<string, string> | undefined;
    const recommended = configMap.get('recommended_version') as Record<string, string> | undefined;
    const notes = configMap.get('release_notes') as Record<string, string> | undefined;
    const maintenance = configMap.get('maintenance_mode') as
      | { enabled?: boolean; message?: string }
      | undefined;

    const minVersion = forceUpdate?.[platform] ?? '0.0.0';
    const latestVersion = latest?.[platform] ?? '0.0.0';

    const result: RemoteVersionConfig = {
      minVersion,
      latestVersion,
      recommendedVersion: recommended?.[platform],
      releaseNotes: notes?.[platform],
      maintenanceMode: maintenance?.enabled ?? false,
      maintenanceMessage: maintenance?.message ?? '',
    };

    logger.debug('원격 버전 설정 로드', {
      component: 'versionService',
      platform,
      minVersion: result.minVersion,
      latestVersion: result.latestVersion,
    });

    return result;
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
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const remoteConfig = await Promise.race([
      getRemoteVersionConfig(),
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), VERSION_CHECK_TIMEOUT_MS);
      }),
    ]);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

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
  return (
    error instanceof ForceUpdateError ||
    (error instanceof Error && error.name === 'ForceUpdateError')
  );
};

export const isMaintenanceError = (error: unknown): error is MaintenanceError => {
  return (
    error instanceof MaintenanceError ||
    (error instanceof Error && error.name === 'MaintenanceError')
  );
};

export default {
  getRemoteVersionConfig,
  checkForceUpdate,
};
