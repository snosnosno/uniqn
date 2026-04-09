import { getCurrentAuthUser } from './appInitializeAuthSession';

/**
 * AuthStore가 아직 hydration/초기화를 끝내지 못한 순간에만 currentUser를 보조적으로 사용한다.
 * 초기화 이후에는 store를 단일 소스로 유지해 비반응성 direct access를 피한다.
 */
export function resolveSessionUserId(
  storeUserId: string | null | undefined,
  isAuthInitialized: boolean | undefined
): string | null {
  if (storeUserId) {
    return storeUserId;
  }

  if (isAuthInitialized) {
    return null;
  }

  return getCurrentAuthUser()?.uid ?? null;
}
