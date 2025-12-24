/**
 * UNIQN Mobile - 네트워크 상태 훅
 *
 * @description 네트워크 연결 상태 감지 및 관리
 * @version 1.0.0
 *
 * TODO [출시 전]: @react-native-community/netinfo 설치 후 네이티브 구현 강화
 */

import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

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
  /** 연결 타입 (wifi, cellular, unknown) */
  connectionType: 'wifi' | 'cellular' | 'unknown';
  /** 마지막 확인 시간 */
  lastChecked: Date | null;
}

/**
 * 네트워크 상태 훅 옵션
 */
export interface UseNetworkStatusOptions {
  /** 폴링 간격 (ms, 기본: 30000) */
  pollingInterval?: number;
  /** 자동 체크 활성화 (기본: true) */
  autoCheck?: boolean;
  /** 오프라인 시 콜백 */
  onOffline?: () => void;
  /** 온라인 복구 시 콜백 */
  onOnline?: () => void;
}

const DEFAULT_OPTIONS: UseNetworkStatusOptions = {
  pollingInterval: 30000,
  autoCheck: true,
};

/**
 * 네트워크 상태 감지 훅
 *
 * @example
 * ```tsx
 * const { isOnline, isOffline } = useNetworkStatus({
 *   onOffline: () => toast.warning('인터넷 연결이 끊어졌습니다'),
 *   onOnline: () => toast.success('인터넷에 연결되었습니다'),
 * });
 *
 * if (isOffline) {
 *   return <OfflineBanner />;
 * }
 * ```
 */
export function useNetworkStatus(
  options: UseNetworkStatusOptions = {}
): NetworkStatus & { checkConnection: () => Promise<boolean> } {
  const { pollingInterval, autoCheck, onOffline, onOnline } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: true,
    isOffline: false,
    isChecking: true,
    connectionType: 'unknown',
    lastChecked: null,
  });

  const [wasOnline, setWasOnline] = useState(true);

  /**
   * 네트워크 연결 확인
   */
  const checkConnection = useCallback(async (): Promise<boolean> => {
    setStatus((prev) => ({ ...prev, isChecking: true }));

    try {
      // 웹에서는 navigator.onLine 사용
      if (Platform.OS === 'web') {
        const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
        setStatus({
          isOnline: online,
          isOffline: !online,
          isChecking: false,
          connectionType: 'unknown',
          lastChecked: new Date(),
        });
        return online;
      }

      // 네이티브에서는 실제 요청으로 확인 (간단한 구현)
      // TODO: @react-native-community/netinfo 설치 후 개선
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch('https://www.google.com/generate_204', {
          method: 'HEAD',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const online = response.ok || response.status === 204;
        setStatus({
          isOnline: online,
          isOffline: !online,
          isChecking: false,
          connectionType: 'unknown',
          lastChecked: new Date(),
        });
        return online;
      } catch {
        setStatus({
          isOnline: false,
          isOffline: true,
          isChecking: false,
          connectionType: 'unknown',
          lastChecked: new Date(),
        });
        return false;
      }
    } catch {
      setStatus({
        isOnline: false,
        isOffline: true,
        isChecking: false,
        connectionType: 'unknown',
        lastChecked: new Date(),
      });
      return false;
    }
  }, []);

  // 온라인/오프라인 상태 변경 콜백
  useEffect(() => {
    if (status.isChecking) return;

    if (wasOnline && status.isOffline) {
      onOffline?.();
    } else if (!wasOnline && status.isOnline) {
      onOnline?.();
    }

    setWasOnline(status.isOnline);
  }, [status.isOnline, status.isOffline, status.isChecking, wasOnline, onOffline, onOnline]);

  // 초기 체크 및 이벤트 리스너 설정
  useEffect(() => {
    if (!autoCheck) return;

    // 초기 체크
    checkConnection();

    // 웹에서 online/offline 이벤트 리스너
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleOnline = () => {
        setStatus((prev) => ({
          ...prev,
          isOnline: true,
          isOffline: false,
          lastChecked: new Date(),
        }));
      };

      const handleOffline = () => {
        setStatus((prev) => ({
          ...prev,
          isOnline: false,
          isOffline: true,
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

    // 폴링 (네이티브)
    if (pollingInterval && pollingInterval > 0) {
      const intervalId = setInterval(checkConnection, pollingInterval);
      return () => clearInterval(intervalId);
    }
  }, [autoCheck, pollingInterval, checkConnection]);

  return {
    ...status,
    checkConnection,
  };
}

export default useNetworkStatus;
