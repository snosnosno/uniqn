/**
 * UNIQN Mobile - 버전 체크 훅
 *
 * @description 앱 버전 확인 및 업데이트 관리
 * @version 1.0.0
 *
 * 주요 기능:
 * - 앱 시작 시 버전 체크
 * - 강제/권장 업데이트 모달 표시
 * - Firebase Remote Config 연동 준비
 * - 앱스토어 링크 연결
 */

import { useState, useEffect, useCallback } from 'react';
import { Linking, Platform } from 'react-native';
import { getMMKVInstance } from '@/lib/mmkvStorage';
import { logger } from '@/utils/logger';
import {
  APP_VERSION,
  UPDATE_POLICY,
  checkUpdateRequired,
  getStoreUrl,
  type UpdateType,
} from '@/constants/version';
import { checkForceUpdate as checkRemoteVersion } from '@/services/versionService';

// ============================================================================
// Types
// ============================================================================

export interface VersionCheckResult {
  /** 업데이트 타입 */
  updateType: UpdateType;
  /** 현재 버전 */
  currentVersion: string;
  /** 최소 지원 버전 */
  minimumVersion: string;
  /** 권장 버전 */
  recommendedVersion: string;
  /** 스토어 URL */
  storeUrl: string;
}

export interface UseVersionCheckReturn {
  /** 버전 체크 결과 */
  result: VersionCheckResult | null;
  /** 로딩 상태 */
  isLoading: boolean;
  /** 에러 */
  error: Error | null;
  /** 업데이트 모달 표시 여부 */
  showUpdateModal: boolean;
  /** 모달 닫기 (권장 업데이트만 가능) */
  dismissModal: () => Promise<void>;
  /** 스토어로 이동 */
  goToStore: () => Promise<void>;
  /** 버전 재확인 */
  recheckVersion: () => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

const DISMISS_KEY_PREFIX = '@uniqn:update_dismissed_';
const DAY_IN_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// Hook
// ============================================================================

/**
 * 앱 버전 체크 훅
 *
 * @example
 * ```tsx
 * function App() {
 *   const { showUpdateModal, result, dismissModal, goToStore } = useVersionCheck();
 *
 *   if (showUpdateModal && result) {
 *     return (
 *       <UpdateModal
 *         type={result.updateType}
 *         onDismiss={result.updateType === 'recommended' ? dismissModal : undefined}
 *         onUpdate={goToStore}
 *       />
 *     );
 *   }
 *
 *   return <MainApp />;
 * }
 * ```
 */
export function useVersionCheck(): UseVersionCheckReturn {
  const [result, setResult] = useState<VersionCheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  /**
   * 권장 업데이트 무시 여부 확인
   */
  const checkDismissed = useCallback((): boolean => {
    try {
      const storage = getMMKVInstance();
      const key = `${DISMISS_KEY_PREFIX}${UPDATE_POLICY.RECOMMENDED_VERSION}`;
      const dismissedAt = storage.getString(key);

      if (!dismissedAt) return false;

      const dismissedTime = parseInt(dismissedAt, 10);
      const expiryTime = dismissedTime + UPDATE_POLICY.RECOMMENDED_DISMISS_DAYS * DAY_IN_MS;

      // 무시 기간이 지났으면 다시 표시
      if (Date.now() > expiryTime) {
        storage.delete(key);
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }, []);

  /**
   * 버전 체크 실행
   *
   * versionService를 통해 Firestore에서 원격 버전 정보를 가져옵니다.
   * 실패 시 로컬 상수로 폴백합니다.
   */
  const checkVersion = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // versionService를 통해 원격 버전 정보 가져오기
      const remoteResult = await checkRemoteVersion();

      // 점검 모드 확인
      if (remoteResult.isMaintenanceMode) {
        logger.info('점검 모드 활성화', {
          message: remoteResult.maintenanceMessage,
        });
        // 점검 모드일 때도 결과 설정 (별도 UI 처리 가능)
      }

      // 원격 설정 또는 로컬 폴백
      const minimumVersion = UPDATE_POLICY.MINIMUM_VERSION;
      const recommendedVersion = remoteResult.latestVersion ?? UPDATE_POLICY.RECOMMENDED_VERSION;

      const checkResult: VersionCheckResult = {
        updateType: remoteResult.updateType,
        currentVersion: remoteResult.currentVersion,
        minimumVersion,
        recommendedVersion,
        storeUrl: getStoreUrl(),
      };

      setResult(checkResult);

      // 업데이트 모달 표시 여부 결정
      if (remoteResult.mustUpdate) {
        // 강제 업데이트: 항상 표시
        setShowUpdateModal(true);
        logger.info('강제 업데이트 필요', {
          currentVersion: remoteResult.currentVersion,
          latestVersion: remoteResult.latestVersion,
        });
      } else if (remoteResult.shouldUpdate) {
        // 권장 업데이트: 무시하지 않았으면 표시
        const isDismissed = checkDismissed();
        setShowUpdateModal(!isDismissed);

        if (!isDismissed) {
          logger.info('권장 업데이트 가능', {
            currentVersion: remoteResult.currentVersion,
            latestVersion: remoteResult.latestVersion,
          });
        }
      } else {
        setShowUpdateModal(false);
      }
    } catch (err) {
      // 에러 시 로컬 상수로 폴백
      const updateType = checkUpdateRequired(APP_VERSION);
      const checkResult: VersionCheckResult = {
        updateType,
        currentVersion: APP_VERSION,
        minimumVersion: UPDATE_POLICY.MINIMUM_VERSION,
        recommendedVersion: UPDATE_POLICY.RECOMMENDED_VERSION,
        storeUrl: getStoreUrl(),
      };
      setResult(checkResult);

      // 폴백 결과에 따라 모달 표시
      if (updateType === 'required') {
        setShowUpdateModal(true);
      } else if (updateType === 'recommended') {
        const isDismissed = checkDismissed();
        setShowUpdateModal(!isDismissed);
      } else {
        setShowUpdateModal(false);
      }

      logger.warn('원격 버전 체크 실패, 로컬 폴백 사용', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [checkDismissed]);

  /**
   * 권장 업데이트 모달 닫기
   */
  const dismissModal = useCallback(async () => {
    if (result?.updateType !== 'recommended') {
      // 강제 업데이트는 닫을 수 없음
      logger.warn('강제 업데이트 모달은 닫을 수 없습니다');
      return;
    }

    try {
      const storage = getMMKVInstance();
      const key = `${DISMISS_KEY_PREFIX}${UPDATE_POLICY.RECOMMENDED_VERSION}`;
      storage.set(key, Date.now().toString());
      setShowUpdateModal(false);

      logger.info('권장 업데이트 무시', {
        dismissDays: UPDATE_POLICY.RECOMMENDED_DISMISS_DAYS,
      });
    } catch (err) {
      logger.error('업데이트 무시 저장 실패', err as Error);
    }
  }, [result?.updateType]);

  /**
   * 앱스토어로 이동
   */
  const goToStore = useCallback(async () => {
    const storeUrl = getStoreUrl();

    try {
      const canOpen = await Linking.canOpenURL(storeUrl);

      if (canOpen) {
        await Linking.openURL(storeUrl);
        logger.info('앱스토어 이동', { platform: Platform.OS, url: storeUrl });
      } else {
        // 웹 URL로 폴백
        const webUrl = UPDATE_POLICY.STORE_URLS.web;
        await Linking.openURL(webUrl);
        logger.info('웹사이트로 이동', { url: webUrl });
      }
    } catch (err) {
      logger.error('스토어 이동 실패', err as Error, { storeUrl });
      throw err;
    }
  }, []);

  /**
   * 버전 재확인
   */
  const recheckVersion = useCallback(async () => {
    await checkVersion();
  }, [checkVersion]);

  // 초기 버전 체크
  useEffect(() => {
    checkVersion();
  }, [checkVersion]);

  return {
    result,
    isLoading,
    error,
    showUpdateModal,
    dismissModal,
    goToStore,
    recheckVersion,
  };
}

export default useVersionCheck;
