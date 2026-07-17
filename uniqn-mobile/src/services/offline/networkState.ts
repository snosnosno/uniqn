import { AppState, Platform } from 'react-native';
import NetInfo, { type NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';

export type ConnectionType = 'wifi' | 'cellular' | 'ethernet' | 'none' | 'unknown';

export interface NetworkState {
  isOnline: boolean;
  isOffline: boolean;
  isChecking: boolean;
  connectionType: ConnectionType;
  isInternetReachable: boolean | null;
  lastChecked: Date | null;
  details: NetInfoState | null;
}

const INITIAL_NETWORK_STATE: NetworkState = {
  isOnline: true,
  isOffline: false,
  isChecking: true,
  connectionType: 'unknown',
  isInternetReachable: null,
  lastChecked: null,
  details: null,
};

type Listener = () => void;

let currentState: NetworkState = INITIAL_NETWORK_STATE;
let initialized = false;
let unsubscribeMonitoring: (() => void) | null = null;
const listeners = new Set<Listener>();

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

function isOnlineFromState(state: NetInfoState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function commitState(nextState: NetworkState) {
  currentState = nextState;
  onlineManager.setOnline(nextState.isOnline);
  notifyListeners();
}

function toWebState(isOnline: boolean): NetworkState {
  return {
    isOnline,
    isOffline: !isOnline,
    isChecking: false,
    connectionType: 'unknown',
    isInternetReachable: isOnline,
    lastChecked: new Date(),
    details: null,
  };
}

function toNativeState(state: NetInfoState): NetworkState {
  const isOnline = isOnlineFromState(state);

  return {
    isOnline,
    isOffline: !isOnline,
    isChecking: false,
    connectionType: mapConnectionType(state.type),
    isInternetReachable: state.isInternetReachable,
    lastChecked: new Date(),
    details: state,
  };
}

export function getNetworkState(): NetworkState {
  return currentState;
}

export function subscribeToNetworkState(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function checkNetworkConnection(): Promise<boolean> {
  commitState({
    ...currentState,
    isChecking: true,
  });

  try {
    if (Platform.OS === 'web') {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      commitState(toWebState(isOnline));
      return isOnline;
    }

    const state = await NetInfo.fetch();
    const nextState = toNativeState(state);
    commitState(nextState);
    return nextState.isOnline;
  } catch (error) {
    logger.error('Network status check failed', toError(error), {
      component: 'networkState',
    });

    commitState({
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
}

export function initializeNetworkState(): () => void {
  if (initialized && unsubscribeMonitoring) {
    return unsubscribeMonitoring;
  }

  initialized = true;

  if (Platform.OS === 'web') {
    const syncOnlineState = () => {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      commitState(toWebState(isOnline));
    };

    syncOnlineState();

    if (typeof window === 'undefined') {
      unsubscribeMonitoring = () => undefined;
      return unsubscribeMonitoring;
    }

    window.addEventListener('online', syncOnlineState);
    window.addEventListener('offline', syncOnlineState);

    unsubscribeMonitoring = () => {
      window.removeEventListener('online', syncOnlineState);
      window.removeEventListener('offline', syncOnlineState);
      unsubscribeMonitoring = null;
      initialized = false;
    };

    logger.info('Initialized global network monitoring', {
      component: 'networkState',
      platform: Platform.OS,
    });

    return unsubscribeMonitoring;
  }

  const unsubscribe = NetInfo.addEventListener((state) => {
    commitState(toNativeState(state));
  });

  // iOS 에서 NetInfo 의 isInternetReachable 이 네트워크 복구 후에도 stale false 로
  // 남는 경우가 있다. 배너의 재시도 버튼을 제거하면서 수동 재평가 경로가 사라졌으므로,
  // 앱이 포그라운드로 복귀(active)할 때마다 NetInfo 를 강제 재평가한다.
  // (웹 분기는 window 'online'/'offline' 이벤트가 복구를 즉시 반영하므로 불필요 →
  //  네이티브 분기에만 추가한다.)
  const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
    if (nextAppState === 'active') {
      void checkNetworkConnection();
    }
  });

  void checkNetworkConnection();

  unsubscribeMonitoring = () => {
    unsubscribe();
    appStateSubscription.remove();
    unsubscribeMonitoring = null;
    initialized = false;
  };

  logger.info('Initialized global network monitoring', {
    component: 'networkState',
    platform: Platform.OS,
  });

  return unsubscribeMonitoring;
}

export function isNetworkAvailableForMutation(): boolean {
  const state = getNetworkState();
  return state.isOnline && state.isInternetReachable !== false;
}

export function resetNetworkStateForTests() {
  currentState = INITIAL_NETWORK_STATE;
  listeners.clear();
  unsubscribeMonitoring?.();
  unsubscribeMonitoring = null;
  initialized = false;
}
