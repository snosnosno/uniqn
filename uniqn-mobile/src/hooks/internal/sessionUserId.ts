import { useAuthStore } from '@/stores/authStore';

/**
 * AuthStore가 아직 hydration/초기화를 끝내지 못한 순간에만 store를 보조적으로 사용한다.
 * Supabase는 동기적 currentUser가 없으므로 store만 참조한다.
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

  // Fallback: store에서 직접 읽기 (hydration 전 단계)
  return useAuthStore.getState().user?.uid ?? null;
}
