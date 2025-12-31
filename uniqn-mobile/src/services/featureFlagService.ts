/**
 * UNIQN Mobile - Feature Flag Service
 *
 * @description Firebase Remote Config 기반 Feature Flag 관리
 * @version 1.0.0
 *
 * 기능:
 * - Feature Flag 조회 및 캐싱
 * - 기본값 폴백 처리
 * - 실시간 업데이트 지원
 * - 타입 안전한 Feature Flag 접근
 *
 * TODO [출시 전]: Firebase Remote Config 실제 연동
 */

import { logger } from '@/utils/logger';
import { Platform } from 'react-native';

// ============================================================================
// Feature Flag 타입 정의
// ============================================================================

/**
 * 모든 Feature Flag 정의
 * 새로운 플래그 추가 시 여기에 추가
 */
export interface FeatureFlags {
  /** 소셜 로그인 활성화 */
  enable_social_login: boolean;
  /** 생체 인증 활성화 */
  enable_biometric: boolean;
  /** 점검 모드 */
  maintenance_mode: boolean;
  /** 푸시 알림 활성화 */
  enable_push_notifications: boolean;
  /** QR 출퇴근 활성화 */
  enable_qr_checkin: boolean;
  /** 위치 기반 검색 활성화 */
  enable_location_search: boolean;
  /** 새 디자인 시스템 활성화 */
  enable_new_design: boolean;
  /** 디버그 모드 활성화 */
  enable_debug_mode: boolean;
  /** 오프라인 모드 활성화 */
  enable_offline_mode: boolean;
  /** 정산 기능 활성화 */
  enable_settlement: boolean;
  /** 공고 필터 확장 활성화 */
  enable_advanced_filters: boolean;
  /** 알림 그룹핑 활성화 */
  enable_notification_grouping: boolean;
}

/**
 * Feature Flag 키 타입
 */
export type FeatureFlagKey = keyof FeatureFlags;

// ============================================================================
// 기본값 정의
// ============================================================================

/**
 * Feature Flag 기본값
 * Remote Config 연결 실패 시 사용
 */
const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  enable_social_login: true,
  enable_biometric: false,
  maintenance_mode: false,
  enable_push_notifications: true,
  enable_qr_checkin: true,
  enable_location_search: false,
  enable_new_design: false,
  enable_debug_mode: __DEV__,
  enable_offline_mode: false,
  enable_settlement: true,
  enable_advanced_filters: false,
  enable_notification_grouping: false,
};

// ============================================================================
// Feature Flag Service
// ============================================================================

class FeatureFlagService {
  private flags: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS };
  private initialized: boolean = false;
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 12 * 60 * 60 * 1000; // 12시간

  /**
   * 서비스 초기화 - 앱 시작 시 호출
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('FeatureFlagService already initialized');
      return;
    }

    try {
      await this.fetchAndActivate();
      this.initialized = true;
      logger.info('FeatureFlagService initialized');
    } catch (error) {
      logger.warn('FeatureFlagService initialization failed, using defaults', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // 기본값으로 진행 (이미 설정됨)
      this.initialized = true;
    }
  }

  /**
   * Remote Config에서 최신 설정 가져오기
   * TODO [출시 전]: Firebase Remote Config 실제 연동
   */
  async fetchAndActivate(): Promise<boolean> {
    try {
      const now = Date.now();

      // 캐시 유효 시간 체크
      if (now - this.lastFetchTime < this.CACHE_DURATION) {
        logger.debug('Using cached feature flags');
        return true;
      }

      // TODO [출시 전]: Firebase Remote Config 연동
      // import { getRemoteConfig, fetchAndActivate, getBoolean } from 'firebase/remote-config';
      // const remoteConfig = getRemoteConfig(firebaseApp);
      // await fetchAndActivate(remoteConfig);
      //
      // Object.keys(DEFAULT_FEATURE_FLAGS).forEach((key) => {
      //   const flagKey = key as FeatureFlagKey;
      //   this.flags[flagKey] = getBoolean(remoteConfig, key);
      // });

      // 현재는 Mock 데이터 사용
      this.flags = {
        ...DEFAULT_FEATURE_FLAGS,
        // 플랫폼별 기본값 조정
        enable_biometric: Platform.OS !== 'web',
        enable_push_notifications: Platform.OS !== 'web',
      };

      this.lastFetchTime = now;
      logger.info('Feature flags fetched successfully');
      return true;
    } catch (error) {
      logger.error('Failed to fetch feature flags', error as Error);
      return false;
    }
  }

  /**
   * 특정 Feature Flag 값 조회
   */
  getFlag<K extends FeatureFlagKey>(key: K): FeatureFlags[K] {
    if (!this.initialized) {
      logger.warn('FeatureFlagService not initialized, returning default', { key });
    }
    return this.flags[key];
  }

  /**
   * 모든 Feature Flag 조회
   */
  getAllFlags(): Readonly<FeatureFlags> {
    return { ...this.flags };
  }

  /**
   * Feature Flag 활성화 여부 확인 (boolean 전용)
   */
  isEnabled(key: FeatureFlagKey): boolean {
    return this.getFlag(key) === true;
  }

  /**
   * 여러 Feature Flag 한 번에 확인
   */
  areEnabled(keys: FeatureFlagKey[]): boolean {
    return keys.every((key) => this.isEnabled(key));
  }

  /**
   * 점검 모드 확인
   */
  isMaintenanceMode(): boolean {
    return this.isEnabled('maintenance_mode');
  }

  /**
   * 디버그 모드 확인
   */
  isDebugMode(): boolean {
    return this.isEnabled('enable_debug_mode');
  }

  /**
   * 캐시 초기화 (강제 새로고침 필요 시)
   */
  clearCache(): void {
    this.lastFetchTime = 0;
    logger.info('Feature flag cache cleared');
  }

  /**
   * 개발용: 특정 플래그 강제 설정
   * 프로덕션에서는 무시됨
   */
  setFlagForTesting(key: FeatureFlagKey, value: boolean): void {
    if (!__DEV__) {
      logger.warn('setFlagForTesting is only available in development');
      return;
    }
    this.flags[key] = value;
    logger.debug('Feature flag set for testing', { key, value });
  }
}

// ============================================================================
// 싱글톤 인스턴스
// ============================================================================

export const featureFlagService = new FeatureFlagService();

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * Feature Flag 상태에 따른 조건부 렌더링 헬퍼
 */
export function whenEnabled<T>(key: FeatureFlagKey, value: T): T | null {
  return featureFlagService.isEnabled(key) ? value : null;
}

/**
 * Feature Flag 상태에 따른 값 선택 헬퍼
 */
export function selectByFlag<T>(key: FeatureFlagKey, enabled: T, disabled: T): T {
  return featureFlagService.isEnabled(key) ? enabled : disabled;
}

export default featureFlagService;
