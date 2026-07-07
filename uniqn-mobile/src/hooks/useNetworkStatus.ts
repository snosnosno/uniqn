import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import {
  checkNetworkConnection,
  getNetworkState,
  initializeNetworkState,
  subscribeToNetworkState,
  type ConnectionType,
  type NetworkState,
} from '@/services/offline/networkState';
import { logger } from '@/utils/logger';

export type { ConnectionType, NetworkState };

export interface UseNetworkStatusOptions {
  autoCheck?: boolean;
  onOffline?: () => void;
  onOnline?: () => void;
}

export function useNetworkStatus(
  options: UseNetworkStatusOptions = {}
): NetworkState & { checkConnection: () => Promise<boolean> } {
  const { autoCheck = true, onOffline, onOnline } = options;
  const status = useSyncExternalStore(subscribeToNetworkState, getNetworkState, getNetworkState);
  const onOfflineRef = useRef(onOffline);
  const onOnlineRef = useRef(onOnline);
  const wasOnlineRef = useRef(status.isOnline);
  const hasSeenStableStateRef = useRef(false);

  useEffect(() => {
    onOfflineRef.current = onOffline;
  }, [onOffline]);

  useEffect(() => {
    onOnlineRef.current = onOnline;
  }, [onOnline]);

  useEffect(() => {
    if (!autoCheck) {
      return;
    }

    initializeNetworkState();
  }, [autoCheck]);

  useEffect(() => {
    if (status.isChecking) {
      return;
    }

    if (!hasSeenStableStateRef.current) {
      hasSeenStableStateRef.current = true;
      wasOnlineRef.current = status.isOnline;
      return;
    }

    if (wasOnlineRef.current && status.isOffline) {
      logger.info('Network transitioned to offline', {
        component: 'useNetworkStatus',
        connectionType: status.connectionType,
      });
      onOfflineRef.current?.();
    } else if (!wasOnlineRef.current && status.isOnline) {
      logger.info('Network transitioned to online', {
        component: 'useNetworkStatus',
        connectionType: status.connectionType,
      });
      onOnlineRef.current?.();
    }

    wasOnlineRef.current = status.isOnline;
  }, [status.connectionType, status.isChecking, status.isOffline, status.isOnline]);

  const checkConnection = useCallback(() => checkNetworkConnection(), []);

  return {
    ...status,
    checkConnection,
  };
}
