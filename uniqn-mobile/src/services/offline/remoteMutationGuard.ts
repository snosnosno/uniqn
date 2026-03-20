import { ERROR_CODES, NetworkError } from '@/errors';
import { logger } from '@/utils/logger';
import { getNetworkState, isNetworkAvailableForMutation, type NetworkState } from './networkState';

export interface OfflineGuardResult {
  allowed: boolean;
  state: NetworkState;
}

export function getOfflineGuardResult(): OfflineGuardResult {
  const state = getNetworkState();
  return {
    allowed: isNetworkAvailableForMutation(),
    state,
  };
}

export function requireOnlineForMutation(context: string): OfflineGuardResult {
  const result = getOfflineGuardResult();

  if (!result.allowed) {
    logger.info('offline_blocked_mutation', {
      component: 'remoteMutationGuard',
      context,
      isOnline: result.state.isOnline,
      isInternetReachable: result.state.isInternetReachable,
    });

    throw new NetworkError(ERROR_CODES.NETWORK_OFFLINE, {
      userMessage:
        '오프라인에서는 이 작업을 진행할 수 없습니다. 인터넷 연결 후 다시 시도해 주세요.',
      metadata: {
        context,
        isOnline: result.state.isOnline,
        isInternetReachable: result.state.isInternetReachable,
      },
    });
  }

  return result;
}

export function shouldApplyOptimisticUpdate(): boolean {
  return isNetworkAvailableForMutation();
}
