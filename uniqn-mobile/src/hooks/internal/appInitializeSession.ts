import { Platform } from 'react-native';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useAuthStore, waitForHydration } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { validateEnv } from '@/lib/env';
import { isCurrentAutoLoginSession } from '@/lib/autoLoginSession';
import { migrateFromAsyncStorage } from '@/lib/mmkvStorage';
import { purgeLegacyLoginAttemptKeys } from '@/lib/secureStorage';
import { signOut as authSignOut } from '@/services/auth';
import { getProtectedAuthFlowKind } from '@/shared/auth/protectedAuthFlow';
import { logger } from '@/utils/logger';
import { trackLogout, setUserId } from '@/services/observability/analyticsService';
import { toStoreProfile } from '@/utils/profileConverter';
import {
  checkForceUpdate,
  ForceUpdateError,
  MaintenanceError,
  type VersionCheckResult,
} from '@/services/versionService';
import { checkAutoLoginEnabled } from '../useAutoLogin';
import { isNetworkError, toError } from '@/errors';
import {
  getCurrentAuthUserAsync,
  waitForInitialAuthUser,
  type InitialAuthResolution,
} from './appInitializeAuthSession';
import { describeError, importWithFallback } from './appInitializeImports';
import {
  getRoleFromUser,
  initializeUnreadCount,
  isFatalAuthError,
  loadLatestProfile,
  shouldSynchronizeClaims,
} from './appInitializeProfile';

export interface DeferredInitContext {
  authUser: SupabaseUser;
  profile: Awaited<ReturnType<typeof loadLatestProfile>>;
}

export interface BootstrapResult {
  authUser: SupabaseUser | null;
  authResolutionSource: InitialAuthResolution['source'];
  autoLoginEnabled: boolean;
  versionCheckResult: VersionCheckResult;
}

export interface OfflineBootstrapState {
  source: 'none' | 'cache' | 'server';
  needsServerReconcile: boolean;
}

export interface ResolveSessionResult {
  deferredInitContext: DeferredInitContext | null;
  offlineBootstrap: OfflineBootstrapState;
}

const AUTH_STORE_HYDRATION_TIMEOUT_MS = Platform.OS === 'web' ? 5000 : 5000;

export async function bootstrapCore(): Promise<BootstrapResult> {
  const envResult = validateEnv();
  if (!envResult.success) {
    throw new Error(envResult.error);
  }

  await migrateFromAsyncStorage();

  // 한시 코드 (2026-11 이후 제거) — PR#406 이 남긴 평문 이메일 키를 웹에서 소거한다.
  // 동기·불throw 라 부팅을 막지 않는다. 네이티브에서는 즉시 no-op.
  purgeLegacyLoginAttemptKeys();

  const hydrated = await waitForHydration(AUTH_STORE_HYDRATION_TIMEOUT_MS);
  if (!hydrated) {
    const log = Platform.OS === 'web' ? logger.info : logger.warn;
    log('Auth store hydration timed out, continuing with diagnostic-only fallback', {
      component: 'useAppInitialize',
      timeoutMs: AUTH_STORE_HYDRATION_TIMEOUT_MS,
      platform: Platform.OS,
    });
  }

  // Supabase auto-initializes, no tryInitializeFirebase needed

  const versionCheckResult = await checkForceUpdate();
  if (versionCheckResult.isMaintenanceMode) {
    throw new MaintenanceError(
      versionCheckResult.maintenanceMessage ?? '서버 점검 중입니다. 잠시 후 다시 시도해 주세요.'
    );
  }

  if (versionCheckResult.mustUpdate) {
    throw new ForceUpdateError(
      '앱을 최신 버전으로 업데이트해 주세요.',
      versionCheckResult.latestVersion,
      versionCheckResult.releaseNotes
    );
  }

  // Supabase uses single SDK, no dual SDK sync needed
  await useAuthStore.getState().initialize();

  const autoLoginEnabled = await checkAutoLoginEnabled();
  const authResolution = await waitForInitialAuthUser();
  const authUser = authResolution.user;

  return {
    authUser,
    authResolutionSource: authResolution.source,
    autoLoginEnabled,
    versionCheckResult,
  };
}

export async function applyLogoutObservabilityFallback() {
  trackLogout();
  await setUserId(null);
}

export async function signOutAndResetSession(options?: {
  preserveOnFailure?: boolean;
  preservedUserId?: string | null;
}) {
  const authStore = useAuthStore.getState();

  try {
    await authSignOut();
    authStore.clearAuthState();
  } catch (error) {
    logger.warn(
      'Failed to sign out during app initialization, falling back to local auth cleanup',
      {
        component: 'useAppInitialize',
        preservedUserId: options?.preservedUserId ?? null,
        error: describeError(error),
      }
    );

    await applyLogoutObservabilityFallback();

    if (options?.preserveOnFailure) {
      authStore.clearAuthUiState(options.preservedUserId ?? null);
      return;
    }

    authStore.clearAuthState();
  }
}

export function commitBootstrapSource(
  source: OfflineBootstrapState['source'],
  needsServerReconcile: boolean
) {
  useAuthStore.getState().setBootstrapSource(source);
  useAuthStore.getState().setNeedsServerReconcile(needsServerReconcile);

  logger.info('bootstrap_source', {
    component: 'useAppInitialize',
    source,
    needsServerReconcile,
  });
}

export async function resolveSession({
  authUser,
  authResolutionSource,
  autoLoginEnabled,
}: Pick<
  BootstrapResult,
  'authUser' | 'authResolutionSource' | 'autoLoginEnabled'
>): Promise<ResolveSessionResult> {
  const authStore = useAuthStore.getState();
  const persistedUser = authStore.user;
  const persistedProfile = authStore.profile;
  const preservedUserId = authUser?.id ?? persistedUser?.uid ?? persistedProfile?.uid ?? null;
  const currentSessionUserId = authUser?.id ?? persistedUser?.uid ?? persistedProfile?.uid ?? null;
  const allowCurrentSessionContinuation =
    !!currentSessionUserId && isCurrentAutoLoginSession(currentSessionUserId);

  if (!autoLoginEnabled && !allowCurrentSessionContinuation) {
    if (
      authUser ||
      authResolutionSource === 'timeout' ||
      authStore.status === 'authenticated' ||
      persistedUser ||
      persistedProfile
    ) {
      await signOutAndResetSession({
        preserveOnFailure: true,
        preservedUserId,
      });
    }

    commitBootstrapSource('none', false);
    return {
      deferredInitContext: null,
      offlineBootstrap: { source: 'none', needsServerReconcile: false },
    };
  }

  if (
    !autoLoginEnabled &&
    allowCurrentSessionContinuation &&
    !authUser &&
    persistedUser?.uid &&
    persistedProfile?.uid === persistedUser.uid
  ) {
    commitBootstrapSource('cache', true);
    return {
      deferredInitContext: null,
      offlineBootstrap: { source: 'cache', needsServerReconcile: true },
    };
  }

  if (!authUser) {
    if (
      authResolutionSource === 'timeout' &&
      persistedUser?.uid &&
      persistedProfile?.uid === persistedUser.uid
    ) {
      logger.info('Preserved cached session while waiting for Firebase auth restoration', {
        component: 'useAppInitialize',
        uid: persistedUser.uid,
      });
      commitBootstrapSource('cache', true);
      return {
        deferredInitContext: null,
        offlineBootstrap: { source: 'cache', needsServerReconcile: true },
      };
    }

    if (authStore.status === 'authenticated' || persistedUser || persistedProfile) {
      authStore.clearAuthState();
    }

    commitBootstrapSource('none', false);
    return {
      deferredInitContext: null,
      offlineBootstrap: { source: 'none', needsServerReconcile: false },
    };
  }

  let tokenRole: string | null = null;
  let tokenNeedsReconcile = false;

  try {
    // Supabase: role comes from app_metadata in the JWT
    tokenRole = getRoleFromUser(authUser);

    logger.info('Token role resolved during app initialization', {
      component: 'useAppInitialize',
      uid: authUser.id,
      hasRole: Boolean(tokenRole),
    });
  } catch (error) {
    if (isFatalAuthError(error)) {
      logger.warn('Fatal auth error during initialization, signing user out', {
        component: 'useAppInitialize',
        error: describeError(error),
      });
      await signOutAndResetSession();
      commitBootstrapSource('none', false);
      return {
        deferredInitContext: null,
        offlineBootstrap: { source: 'none', needsServerReconcile: false },
      };
    }

    tokenNeedsReconcile = true;
    logger.warn('Token role resolution will be retried after initialization', {
      component: 'useAppInitialize',
      uid: authUser.id,
      error: describeError(error),
    });
  }

  try {
    const freshProfile = await loadLatestProfile(authUser.id);
    const storeProfile = toStoreProfile(freshProfile);

    authStore.setUser(authUser);
    authStore.setProfile(storeProfile);

    const needsServerReconcile =
      tokenNeedsReconcile || shouldSynchronizeClaims(freshProfile.role, tokenRole);

    commitBootstrapSource('server', needsServerReconcile);

    if (shouldSynchronizeClaims(freshProfile.role, tokenRole)) {
      logger.info('Deferred claims reconciliation scheduled', {
        component: 'useAppInitialize',
        uid: authUser.id,
        expectedRole: freshProfile.role,
        tokenRole,
      });
    }

    return {
      deferredInitContext: {
        authUser,
        profile: freshProfile,
      },
      offlineBootstrap: {
        source: 'server',
        needsServerReconcile,
      },
    };
  } catch (error) {
    const resolvedError = toError(error);

    logger.warn('Failed to load latest profile during initialization', {
      component: 'useAppInitialize',
      uid: authUser.id,
      error: resolvedError.message,
    });

    if (isNetworkError(resolvedError) && persistedProfile?.uid === authUser.id) {
      authStore.setUser(authUser);
      authStore.setProfile(persistedProfile);
      commitBootstrapSource('cache', true);

      return {
        deferredInitContext: null,
        offlineBootstrap: {
          source: 'cache',
          needsServerReconcile: true,
        },
      };
    }

    if (isNetworkError(resolvedError)) {
      throw resolvedError;
    }

    const protectedAuthFlowKind = getProtectedAuthFlowKind(authUser.id);
    if (protectedAuthFlowKind) {
      logger.info('Preserving protected auth flow session during initialization', {
        component: 'useAppInitialize',
        uid: authUser.id,
        flowKind: protectedAuthFlowKind,
      });

      authStore.setUser(authUser);
      authStore.setProfile(null);
      commitBootstrapSource('none', false);

      return {
        deferredInitContext: null,
        offlineBootstrap: { source: 'none', needsServerReconcile: false },
      };
    }

    logger.warn('Profile document missing or invalid during initialization, signing user out', {
      component: 'useAppInitialize',
      uid: authUser.id,
      error: resolvedError.message,
    });
    await signOutAndResetSession();
    commitBootstrapSource('none', false);

    return {
      deferredInitContext: null,
      offlineBootstrap: { source: 'none', needsServerReconcile: false },
    };
  }
}

export async function runPostLoginTasks(
  context: DeferredInitContext
): Promise<{ needsRetry: boolean }> {
  const activeUser = await getCurrentAuthUserAsync();

  if (!activeUser || activeUser.id !== context.authUser.id) {
    return { needsRetry: false };
  }

  let needsRetry = false;

  try {
    // Supabase: role is in app_metadata, set by server-side.
    // No client-side claims refresh needed (unlike Firebase custom claims).
    const currentRole = getRoleFromUser(activeUser);
    const expectedRole = (context.profile as { role?: string | null }).role;
    if (shouldSynchronizeClaims(expectedRole, currentRole)) {
      logger.info('Role mismatch detected, will reconcile on next session refresh', {
        component: 'useAppInitialize',
        uid: activeUser.id,
        expectedRole,
        currentRole,
      });
      needsRetry = true;
    }

    // Supabase: profile metadata reconciliation via updateUser
    const profileNickname =
      (context.profile as { nickname?: string | null }).nickname ??
      (activeUser.user_metadata?.name as string | null);
    const profilePhotoURL = (context.profile as { photoURL?: string | null }).photoURL ?? null;
    const currentName = (activeUser.user_metadata?.name as string | null) ?? null;
    const currentAvatar = (activeUser.user_metadata?.avatar_url as string | null) ?? null;
    const needsProfileReconciliation =
      profileNickname !== currentName || profilePhotoURL !== currentAvatar;

    if (needsProfileReconciliation) {
      try {
        const { supabase: sb } = await importWithFallback(
          () => import('@/lib/supabase'),
          '@/lib/supabase'
        );
        await sb.auth.updateUser({
          data: {
            name: profileNickname || currentName,
            avatar_url: profilePhotoURL ?? undefined,
          },
        });
        logger.info('Deferred auth profile reconciliation completed', {
          component: 'useAppInitialize',
          uid: activeUser.id,
        });
      } catch (error) {
        needsRetry = true;
        logger.warn('Deferred auth profile reconciliation failed', {
          component: 'useAppInitialize',
          uid: activeUser.id,
          error: describeError(error),
        });
      }
    }

    if ((context.profile as { phoneVerified?: boolean }).phoneVerified) {
      const unreadCount = await initializeUnreadCount(activeUser.id);
      const { useNotificationStore } = await importWithFallback(
        () => import('@/stores/notificationStore'),
        '@/stores/notificationStore'
      );
      useNotificationStore.getState().setUnreadCount(unreadCount);
    }
  } catch (error) {
    needsRetry = true;
    logger.warn('Deferred initialization failed', {
      component: 'useAppInitialize',
      error: describeError(error),
    });
  }

  return { needsRetry };
}

export async function reconcileSessionFromServer(authUser: SupabaseUser): Promise<void> {
  const authStore = useAuthStore.getState();

  try {
    // 🔑 프로필보다 **세션(JWT)을 먼저** 재발급한다 (감사 auth-F1).
    //
    // 이 함수는 `shouldSynchronizeClaims(profile.role, tokenRole)` 가 불일치를 잡았을 때
    // 불린다 — 즉 DB 의 역할과 JWT 의 `app_metadata.role` 이 갈린 상태다. 그런데 예전에는
    // 여기서 `loadLatestProfile` 로 **store 의 profile.role 만** 갱신했다. 서버 RLS 는
    // `get_my_role()` = JWT 클레임을 보므로, 화면은 새 역할로 열리는데 서버 쓰기는
    // stale 토큰으로 42501 에 막히는 창이 생긴다.
    //
    // 같은 배선이 `authStore.refreshProfile()` 에는 이미 있었다(주석까지 달려서).
    // 자동 재조정 체인만 그 교훈을 재사용하지 못하고 있었다.
    try {
      const { error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError) {
        logger.warn('reconcile_session_refresh_failed', {
          component: 'useAppInitialize',
          uid: authUser.id,
          error: sessionError.message,
        });
      }
    } catch (sessionError) {
      // 재발급 실패로 재조정 전체를 포기하지는 않는다 — 프로필 갱신만이라도 진행하고,
      // 다음 부팅에서 `needsServerReconcile` 이 다시 시도한다.
      logger.warn('reconcile_session_refresh_threw', {
        component: 'useAppInitialize',
        uid: authUser.id,
        error: describeError(sessionError),
      });
    }

    const latestProfile = await loadLatestProfile(authUser.id);
    const storeProfile = toStoreProfile(latestProfile);

    authStore.setUser(authUser);
    authStore.setProfile(storeProfile);

    const result = await runPostLoginTasks({
      authUser,
      profile: latestProfile,
    });

    authStore.setNeedsServerReconcile(result.needsRetry);
    authStore.setBootstrapSource('server');

    logger.info('reconcile_success', {
      component: 'useAppInitialize',
      uid: authUser.id,
      needsRetry: result.needsRetry,
    });
  } catch (error) {
    const resolvedError = toError(error);

    if (!isNetworkError(resolvedError)) {
      logger.warn('Server rejected reconciled session, signing out', {
        component: 'useAppInitialize',
        uid: authUser.id,
        error: resolvedError.message,
      });
      await signOutAndResetSession();
      return;
    }

    logger.warn('reconcile_failure', {
      component: 'useAppInitialize',
      uid: authUser.id,
      error: resolvedError.message,
    });
  }
}
