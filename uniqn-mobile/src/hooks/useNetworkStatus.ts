/**
 * UNIQN Mobile - 네트워크 상태 훅
 *
 * @description 네트워크 연결 상태 감지 및 관리
 * @version 2.0.0 - @react-native-community/netinfo 연동
 *
 * 기능:
 * - 네이티브: NetInfo 이벤트 기반 실시간 감지
 * - 웹: navigator.onLine 기반 감지
 * - 연결 타입 구분 (wifi, cellular, ethernet, none)
 * - 인터넷 도달 가능 여부 확인
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import NetInfo, { type NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';

// ============================================================================
// Types
// ============================================================================

/**
 * 연결 타입
 */
export type ConnectionType = 'wifi' | 'cellular' | 'ethernet' | 'none' | 'unknown';

/**
 * 네트워크 상태 타입
 */
export interface NetworkStatus {
  /** 온라인 여부 */
  isOnline: boolean;
  /** 오프라인 여부 */
  isOffline: boolean;
  /** 상태 확인 중 */
  isChecking: boolean;
  /** 연결 타입 */
  connectionType: ConnectionType;
  /** 인터넷 도달 가능 여부 (null = 확인 중) */
  isInternetReachable: boolean | null;
  /** 마지막 확인 시간 */
  lastChecked: Date | null;
  /** NetInfo 상세 정보 (네이티브 전용) */
  details: NetInfoState | null;
}

/**
 * 네트워크 상태 훅 옵션
 */
export interface UseNetworkStatusOptions {
  /** 자동 체크 활성화 (기본: true) */
  autoCheck?: boolean;
  /** 오프라인 시 콜백 */
  onOffline?: () => void;
  /** 온라인 복구 시 콜백 */
  onOnline?: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * NetInfo 타입을 ConnectionType으로 변환
 */
function mapConnectionType(type: NetInfoStateType): ConnectionType {
  switch (type) {
    case NetInfoStateType.wifi:
      return 'wifi';
    case NetInfoStateType.cellular:
      return 'cellular';
    case NetInfoStateType.ethernet:
      return 'ethernet';
    case NetInfoStateType.none:
      return 'none';
    default:
      return 'unknown';
  }
}

/**
 * NetInfoState에서 온라인 여부 판단
 */
function isOnlineFromState(state: NetInfoState): boolean {
  // isConnected가 true이고, isInternetReachable이 false가 아닌 경우
  // (null인 경우는 아직 확인 중이므로 일단 연결된 것으로 간주)
  return state.isConnected === true && state.isInternetReachable !== false;
}

// ============================================================================
// Initial State
// ============================================================================

const INITIAL_STATUS: NetworkStatus = {
  isOnline: true, // 초기값은 온라인으로 가정
  isOffline: false,
  isChecking: true,
  connectionType: 'unknown',
  isInternetReachable: null,
  lastChecked: null,
  details: null,
};

// ============================================================================
// Hook
// ============================================================================

/**
 * 네트워크 상태 감지 훅
 *
 * @description
 * - 네이티브: NetInfo.addEventListener()로 실시간 상태 변경 감지
 * - 웹: navigator.onLine + online/offline 이벤트 리스너
 *
 * @example
 * ```tsx
 * const { isOnline, isOffline, connectionType } = useNetworkStatus({
 *   onOffline: () => toast.warning('인터넷 연결이 끊어졌습니다'),
 *   onOnline: () => toast.success('인터넷에 연결되었습니다'),
 * });
 *
 * if (isOffline) {
 *   return <OfflineBanner />;
 * }
 *
 * // 연결 타입에 따른 처리
 * if (connectionType === 'cellular') {
 *   // 모바일 데이터 사용 시 경고
 * }
 * ```
 */
export function useNetworkStatus(
  options: UseNetworkStatusOptions = {}
): NetworkStatus & { checkConnection: () => Promise<boolean> } {
  const { autoCheck = true, onOffline, onOnline } = options;

  const [status, setStatus] = useState<NetworkStatus>(INITIAL_STATUS);
  const wasOnlineRef = useRef(true);
  const isInitializedRef = useRef(false);

  // 콜백을 ref로 캡처하여 useEffect 의존성에서 제거 (불필요한 재구독 방지)
  const onOfflineRef = useRef(onOffline);
  const onOnlineRef = useRef(onOnline);
  useEffect(() => {
    onOfflineRef.current = onOffline;
  }, [onOffline]);
  useEffect(() => {
    onOnlineRef.current = onOnline;
  }, [onOnline]);

  /**
   * 네트워크 연결 수동 확인
   */
  const checkConnection = useCallback(async (): Promise<boolean> => {
    setStatus((prev) => ({ ...prev, isChecking: true }));

    try {
      if (Platform.OS === 'web') {
        // 웹: navigator.onLine 사용
        const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
        setStatus({
          isOnline: online,
          isOffline: !online,
          isChecking: false,
          connectionType: 'unknown',
          isInternetReachable: online,
          lastChecked: new Date(),
          details: null,
        });
        return online;
      }

      // 네이티브: NetInfo.fetch() 사용
      const state = await NetInfo.fetch();
      const online = isOnlineFromState(state);

      setStatus({
        isOnline: online,
        isOffline: !online,
        isChecking: false,
        connectionType: mapConnectionType(state.type),
        isInternetReachable: state.isInternetReachable,
        lastChecked: new Date(),
        details: state,
      });

      return online;
    } catch (error) {
      logger.error('네트워크 상태 확인 실패', toError(error), {
        component: 'useNetworkStatus',
      });

      setStatus({
        isOnline: false,
        isOffline: true,
        isChecking: false,
        connectionType: 'unknown',
        isInternetReachable: false,
        lastChecked: new Date(),
        details: null,
      });

      return false;
    }
  }, []);

  // 온라인/오프라인 상태 변경 콜백
  useEffect(() => {
    // 초기 로딩 중이거나 아직 초기화되지 않은 경우 스킵
    if (status.isChecking || !isInitializedRef.current) return;

    const wasOnline = wasOnlineRef.current;

    if (wasOnline && status.isOffline) {
      logger.info('네트워크 상태 변경: 오프라인', {
        component: 'useNetworkStatus',
        connectionType: status.connectionType,
      });
      onOfflineRef.current?.();
    } else if (!wasOnline && status.isOnline) {
      logger.info('네트워크 상태 변경: 온라인', {
        component: 'useNetworkStatus',
        connectionType: status.connectionType,
      });
      onOnlineRef.current?.();
    }

    wasOnlineRef.current = status.isOnline;
  }, [status.isOnline, status.isOffline, status.isChecking, status.connectionType]);

  // 네트워크 상태 구독
  useEffect(() => {
    if (!autoCheck) return;

    // 웹 환경
    if (Platform.OS === 'web') {
      // 초기 상태 설정
      const initialOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      setStatus({
        isOnline: initialOnline,
        isOffline: !initialOnline,
        isChecking: false,
        connectionType: 'unknown',
        isInternetReachable: initialOnline,
        lastChecked: new Date(),
        details: null,
      });
      isInitializedRef.current = true;

      if (typeof window === 'undefined') return;

      const handleOnline = () => {
        setStatus((prev) => ({
          ...prev,
          isOnline: true,
          isOffline: false,
          isInternetReachable: true,
          lastChecked: new Date(),
        }));
      };

      const handleOffline = () => {
        setStatus((prev) => ({
          ...prev,
          isOnline: false,
          isOffline: true,
          isInternetReachable: false,
          lastChecked: new Date(),
        }));
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    // 네이티브 환경: NetInfo 이벤트 구독
    logger.debug('NetInfo 구독 시작', { component: 'useNetworkStatus' });

    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = isOnlineFromState(state);

      logger.debug('NetInfo 상태 변경', {
        component: 'useNetworkStatus',
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      });

      setStatus({
        isOnline: online,
        isOffline: !online,
        isChecking: false,
        connectionType: mapConnectionType(state.type),
        isInternetReachable: state.isInternetReachable,
        lastChecked: new Date(),
        details: state,
      });

      // 초기화 완료 표시 (첫 번째 이벤트 수신 후)
      if (!isInitializedRef.current) {
        isInitializedRef.current = true;
      }
    });

    return () => {
      logger.debug('NetInfo 구독 해제', { component: 'useNetworkStatus' });
      unsubscribe();
    };
  }, [autoCheck]);

  return {
    ...status,
    checkConnection,
  };
}

export default useNetworkStatus;
