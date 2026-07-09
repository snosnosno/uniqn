/**
 * UNIQN Mobile - Session Management Service
 *
 * @description Supabase auth 이벤트를 authStore와 동기화한다.
 *
 * 책임:
 *  - `onAuthStateChange` 구독 → `authStore.checkAuthState` 호출
 *  - 부트스트랩 가드: 캐시에서 복원된 인증 상태와 SDK의 비동기 복원 사이의 race 방지
 *
 * 비책임 (의도적 제외):
 *  - 토큰 수명 관리 — Supabase SDK의 `autoRefreshToken: true`에 위임
 *  - 비활성 타임아웃 — 제거됨 (refresh token이 만료되거나 revoke될 때까지 세션 유지)
 *  - 로그인 시도 rate limiting — `@/services/auth/loginAttemptService`로 분리
 *
 * Supabase known bug 회피: `onAuthStateChange` callback 내부에서 await로
 * 다른 Supabase 호출 시 deadlock 발생 가능. `setTimeout(handler, 0)`로 다음
 * tick에 실행해 SDK 내부 락에서 빠져나오게 한다.
 * (https://supabase.com/docs/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0)
 */

import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';

const AUTH_RESTORE_SETTLE_TIMEOUT_MS = 2000;

export interface SessionState {
  isActive: boolean;
}

let isInitialized = false;
let authUnsubscribe: (() => void) | null = null;
let startupAuthRestoreGuardUntil: number | null = null;

function shouldSkipAuthStoreSync(user: SupabaseUser | null): boolean {
  if (!user) {
    return false;
  }

  const authState = useAuthStore.getState();
  return (
    authState.isInitialized &&
    authState.status === 'authenticated' &&
    authState.user?.uid === user.id &&
    authState.profile?.uid === user.id
  );
}

function armStartupAuthRestoreGuard(): void {
  const authState = useAuthStore.getState();
  const shouldGuard =
    authState.status === 'authenticated' &&
    authState.bootstrapSource === 'cache' &&
    !useAuthStore.getState().user;

  startupAuthRestoreGuardUntil = shouldGuard ? Date.now() + AUTH_RESTORE_SETTLE_TIMEOUT_MS : null;
}

function clearStartupAuthRestoreGuard(): void {
  startupAuthRestoreGuardUntil = null;
}

function shouldWaitForStartupAuthRestore(user: SupabaseUser | null): boolean {
  if (user || startupAuthRestoreGuardUntil === null) {
    return false;
  }

  if (Date.now() > startupAuthRestoreGuardUntil) {
    clearStartupAuthRestoreGuard();
    return false;
  }

  const authState = useAuthStore.getState();
  return (
    authState.status === 'authenticated' &&
    authState.bootstrapSource === 'cache' &&
    !useAuthStore.getState().user
  );
}

async function waitForRestoredAuthUser(
  timeoutMs = AUTH_RESTORE_SETTLE_TIMEOUT_MS
): Promise<SupabaseUser | null> {
  // 이 함수는 setTimeout deferral 안쪽에서 호출되므로 callback context 밖.
  // Supabase deadlock 회피 안전 영역.
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    return data.user;
  }

  return new Promise<SupabaseUser | null>((resolve) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      subscription.unsubscribe();
      resolve(session?.user ?? null);
    });

    timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      subscription.unsubscribe();
      resolve(null);
    }, timeoutMs);
  });
}

export function initialize(): void {
  if (isInitialized) {
    return;
  }

  armStartupAuthRestoreGuard();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    // Supabase known bug: callback 안에서 await로 다른 supabase 호출 시 deadlock.
    // setTimeout(0)로 다음 tick에 실행해 SDK 내부 상태 머신에서 빠져나옴.
    setTimeout(() => {
      void handleAuthStateChange(session?.user ?? null);
    }, 0);
  });
  authUnsubscribe = () => subscription.unsubscribe();

  isInitialized = true;
  logger.info('세션 매니저 초기화 완료');
}

export function cleanup(): void {
  if (!isInitialized && !authUnsubscribe) {
    return;
  }

  clearStartupAuthRestoreGuard();

  if (authUnsubscribe) {
    authUnsubscribe();
    authUnsubscribe = null;
  }

  isInitialized = false;
  logger.info('세션 매니저 정리 완료');
}

async function handleAuthStateChange(user: SupabaseUser | null): Promise<void> {
  let nextUser = user;

  if (nextUser) {
    clearStartupAuthRestoreGuard();
  } else if (shouldWaitForStartupAuthRestore(nextUser)) {
    const restoredUser = await waitForRestoredAuthUser();
    clearStartupAuthRestoreGuard();

    if (restoredUser) {
      logger.debug('Ignored transient null auth event while Supabase session restored', {
        component: 'sessionService',
        uid: restoredUser.id,
      });
      nextUser = restoredUser;
    }
  }

  try {
    if (!shouldSkipAuthStoreSync(nextUser)) {
      await useAuthStore.getState().checkAuthState(nextUser);
    }
  } catch (error) {
    logger.warn('인증 상태 변경 중 스토어 동기화에 실패했습니다', {
      component: 'sessionService',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function getSessionState(): SessionState {
  return {
    isActive: useAuthStore.getState().status === 'authenticated',
  };
}

export const sessionService = {
  initialize,
  cleanup,
  getSessionState,
};
