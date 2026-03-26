/**
 * UNIQN Mobile - Session Management Service
 */

import { AppState, Platform, type AppStateStatus } from 'react-native';
import type { User as FirebaseUser } from 'firebase/auth';
import { router } from 'expo-router';
import { syncSignOut } from '@/lib/authBridge';
import { getFirebaseAuth } from '@/lib/firebase';
import { authStorage, userSessionStorage, getItem, setItem, deleteItem } from '@/lib/secureStorage';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { AuthError, ERROR_CODES, isAppError, toError } from '@/errors';
import { clearCounterSyncCache } from '@/shared/cache/counterSyncCache';
import { RealtimeManager } from '@/shared/realtime';
import { toDateValue } from '@/utils/date';
import { logger } from '@/utils/logger';
import { sentryService } from './sentryService';

void userSessionStorage;

const SESSION_TIMEOUT = 30 * 60 * 1000;
const SESSION_WARNING_BUFFER = 5 * 60 * 1000;
const TOKEN_REFRESH_INTERVAL = 50 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000;
const TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000;

export interface SessionState {
  isActive: boolean;
  lastActivity: number;
  tokenExpiresAt: number | null;
}

export interface LoginAttempts {
  count: number;
  lockUntil: number | null;
  lastAttempt: number;
}

let isInitialized = false;
let lastActivity = Date.now();
let sessionTimeoutId: ReturnType<typeof setTimeout> | null = null;
let sessionWarningTimeoutId: ReturnType<typeof setTimeout> | null = null;
let tokenRefreshIntervalId: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let authUnsubscribe: (() => void) | null = null;
let authStoreUnsubscribe: (() => void) | null = null;
let managedSessionUserId: string | null = null;

function shouldManageSessionForUser(user: FirebaseUser | null): boolean {
  if (!user) {
    return false;
  }

  const authState = useAuthStore.getState();
  return authState.status === 'authenticated' && authState.suppressedSessionUserId !== user.uid;
}

function clearSessionRuntime(): void {
  clearSessionTimeout();
  clearSessionWarning();
  clearTokenRefreshInterval();
  managedSessionUserId = null;
}

function syncManagedSessionState(): void {
  const currentUser = getFirebaseAuth().currentUser;
  const nextManagedUserId =
    currentUser && shouldManageSessionForUser(currentUser) ? currentUser.uid : null;

  if (!nextManagedUserId) {
    clearSessionRuntime();
    return;
  }

  if (managedSessionUserId === nextManagedUserId) {
    return;
  }

  managedSessionUserId = nextManagedUserId;
  lastActivity = Date.now();
  resetActivityTimer();
  startTokenRefreshInterval();
}

export function initialize(): void {
  if (isInitialized) {
    return;
  }

  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
  authUnsubscribe = getFirebaseAuth().onAuthStateChanged(handleAuthStateChange);
  authStoreUnsubscribe = useAuthStore.subscribe(() => {
    syncManagedSessionState();
  });

  isInitialized = true;
  syncManagedSessionState();
  logger.info('세션 매니저 초기화 완료');
}

export function cleanup(): void {
  clearSessionRuntime();

  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }

  if (authUnsubscribe) {
    authUnsubscribe();
    authUnsubscribe = null;
  }

  if (authStoreUnsubscribe) {
    authStoreUnsubscribe();
    authStoreUnsubscribe = null;
  }

  isInitialized = false;
  logger.info('세션 매니저 정리 완료');
}

function handleAppStateChange(state: AppStateStatus): void {
  if (state === 'active') {
    checkSession();
    logger.debug('앱 포그라운드 복귀 - 세션 체크');
    return;
  }

  if (state === 'background') {
    clearSessionTimeout();
    clearSessionWarning();
    logger.debug('앱 백그라운드 전환 - 세션 타이머 중지');
  }
}

async function handleAuthStateChange(user: FirebaseUser | null): Promise<void> {
  try {
    await useAuthStore.getState().checkAuthState(user);
  } catch (error) {
    logger.warn('인증 상태 변경 중 스토어 동기화에 실패했습니다', {
      component: 'sessionService',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  syncManagedSessionState();

  if (!shouldManageSessionForUser(user)) {
    logger.info(user ? '인증 상태 변경 - 세션 관리 보류' : '인증 상태 변경 - 세션 종료');
    return;
  }

  try {
    const currentUser = getFirebaseAuth().currentUser;
    const activeUser = user;
    if (!activeUser) {
      return;
    }
    if (currentUser && currentUser.uid === activeUser.uid) {
      if (Platform.OS === 'web') {
        await currentUser.getIdTokenResult();
      } else {
        await currentUser.getIdToken(true);
      }
      logger.debug('토큰 강제 갱신 완료 (Custom Claims 로드)');
    }
  } catch (error) {
    logger.warn('토큰 갱신 실패', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  logger.info('인증 상태 변경 - 세션 시작');
}

export function recordActivity(): void {
  lastActivity = Date.now();

  if (shouldManageSessionForUser(getFirebaseAuth().currentUser)) {
    resetActivityTimer();
  }
}

function checkSession(): void {
  const currentUser = getFirebaseAuth().currentUser;
  if (!shouldManageSessionForUser(currentUser)) {
    return;
  }

  const inactive = Date.now() - lastActivity;

  if (inactive > SESSION_TIMEOUT) {
    void expireSession('세션이 만료되었습니다.');
    return;
  }

  if (inactive > SESSION_TIMEOUT - SESSION_WARNING_BUFFER) {
    showSessionWarning();
    clearSessionTimeout();
    clearSessionWarning();
    sessionTimeoutId = setTimeout(() => {
      void expireSession('비활성 상태로 인해 세션이 만료되었습니다.');
    }, SESSION_TIMEOUT - inactive);
    return;
  }

  resetActivityTimer();
  void checkAndRefreshToken();
}

function resetActivityTimer(): void {
  clearSessionTimeout();
  clearSessionWarning();

  sessionWarningTimeoutId = setTimeout(() => {
    showSessionWarning();
  }, SESSION_TIMEOUT - SESSION_WARNING_BUFFER);

  sessionTimeoutId = setTimeout(() => {
    void expireSession('비활성 상태로 인해 세션이 만료되었습니다.');
  }, SESSION_TIMEOUT);
}

function clearSessionTimeout(): void {
  if (sessionTimeoutId) {
    clearTimeout(sessionTimeoutId);
    sessionTimeoutId = null;
  }
}

function clearSessionWarning(): void {
  if (sessionWarningTimeoutId) {
    clearTimeout(sessionWarningTimeoutId);
    sessionWarningTimeoutId = null;
  }
}

function showSessionWarning(): void {
  const currentUser = getFirebaseAuth().currentUser;
  if (!shouldManageSessionForUser(currentUser)) {
    return;
  }

  logger.info('세션 만료 경고', { component: 'sessionService' });
  useToastStore.getState().addToast({
    type: 'warning',
    message: '세션이 5분 뒤 만료됩니다. 활동을 계속하면 자동 연장됩니다.',
  });
}

async function expireSession(message: string): Promise<void> {
  logger.warn('세션 만료', { message });

  useToastStore.getState().addToast({
    type: 'warning',
    message: `${message} 다시 로그인해 주세요.`,
  });

  try {
    RealtimeManager.unsubscribeAll();
    clearCounterSyncCache();
    await syncSignOut();
    useAuthStore.getState().reset();
  } catch (error) {
    logger.error('세션 만료 처리 중 로그아웃에 실패했습니다', toError(error));
  }

  clearSessionRuntime();
  router.replace('/(auth)/login');
}

function startTokenRefreshInterval(): void {
  if (!shouldManageSessionForUser(getFirebaseAuth().currentUser)) {
    clearTokenRefreshInterval();
    return;
  }

  clearTokenRefreshInterval();
  void checkAndRefreshToken();
  tokenRefreshIntervalId = setInterval(() => {
    void checkAndRefreshToken();
  }, TOKEN_REFRESH_INTERVAL);
}

function clearTokenRefreshInterval(): void {
  if (tokenRefreshIntervalId) {
    clearInterval(tokenRefreshIntervalId);
    tokenRefreshIntervalId = null;
  }
}

async function checkAndRefreshToken(): Promise<void> {
  const currentUser = getFirebaseAuth().currentUser;
  if (!shouldManageSessionForUser(currentUser)) {
    return;
  }

  try {
    const activeUser = currentUser;
    if (!activeUser) {
      return;
    }
    const tokenResult = await activeUser.getIdTokenResult();
    const expirationTime = toDateValue(tokenResult.expirationTime);
    const now = Date.now();

    if (expirationTime === null || expirationTime - now < TOKEN_EXPIRY_BUFFER) {
      await refreshToken();
    }
  } catch (error) {
    logger.error('토큰 체크 실패', toError(error));
    void sentryService.recordError(toError(error), {
      component: 'sessionService',
      action: 'checkAndRefreshToken',
    });
  }
}

export async function refreshToken(): Promise<string | null> {
  const currentUser = getFirebaseAuth().currentUser;
  if (!currentUser) {
    logger.warn('토큰 갱신 실패 - 로그인 필요');
    return null;
  }

  try {
    const newToken = await currentUser.getIdToken(true);
    await authStorage.setAuthToken(newToken);
    logger.info('토큰 갱신 성공');
    return newToken;
  } catch (error) {
    logger.error('토큰 갱신 실패', toError(error));
    void sentryService.recordError(toError(error), {
      component: 'sessionService',
      action: 'refreshToken',
    });
    await expireSession('인증 토큰 갱신에 실패했습니다.');
    return null;
  }
}

export async function getValidToken(): Promise<string | null> {
  const currentUser = getFirebaseAuth().currentUser;
  if (!currentUser) {
    return null;
  }

  try {
    const tokenResult = await currentUser.getIdTokenResult();
    const expirationTime = toDateValue(tokenResult.expirationTime);
    const now = Date.now();

    if (expirationTime === null || expirationTime - now < TOKEN_EXPIRY_BUFFER) {
      return await refreshToken();
    }

    return tokenResult.token;
  } catch (error) {
    logger.error('유효 토큰 조회 실패', toError(error));
    return null;
  }
}

export async function checkLoginAttempts(email: string): Promise<void> {
  const key = `login_attempts_${email.toLowerCase()}`;

  try {
    const attempts = await getItem<LoginAttempts>(key);
    if (!attempts) {
      return;
    }

    if (attempts.lockUntil && Date.now() < attempts.lockUntil) {
      const remainingTime = Math.ceil((attempts.lockUntil - Date.now()) / 60000);
      throw new AuthError(ERROR_CODES.AUTH_RATE_LIMITED, {
        userMessage: `로그인 시도 횟수를 초과했습니다. ${remainingTime}분 후에 다시 시도해 주세요.`,
        metadata: { remainingMinutes: remainingTime },
      });
    }

    if (attempts.lockUntil && Date.now() >= attempts.lockUntil) {
      await deleteItem(key);
    }
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }

    logger.error('로그인 시도 횟수 확인 실패', toError(error));
  }
}

export async function incrementLoginAttempts(email: string): Promise<void> {
  const key = `login_attempts_${email.toLowerCase()}`;

  try {
    const current = (await getItem<LoginAttempts>(key)) ?? {
      count: 0,
      lockUntil: null,
      lastAttempt: 0,
    };

    const newCount = current.count + 1;
    const shouldLock = newCount >= MAX_LOGIN_ATTEMPTS;

    const nextAttempts: LoginAttempts = {
      count: newCount,
      lockUntil: shouldLock ? Date.now() + LOCKOUT_DURATION : null,
      lastAttempt: Date.now(),
    };

    await setItem(key, nextAttempts);

    if (shouldLock) {
      logger.warn('로그인 시도 횟수 초과 - 계정 잠금', {
        email: email.substring(0, 3) + '***',
      });
    }
  } catch (error) {
    logger.error('로그인 시도 횟수 증가 실패', toError(error));
  }
}

export async function resetLoginAttempts(email: string): Promise<void> {
  const key = `login_attempts_${email.toLowerCase()}`;

  try {
    await deleteItem(key);
    logger.debug('로그인 시도 횟수 초기화', { email: email.substring(0, 3) + '***' });
  } catch (error) {
    logger.error('로그인 시도 횟수 초기화 실패', toError(error));
  }
}

export async function getRemainingLoginAttempts(email: string): Promise<number> {
  const key = `login_attempts_${email.toLowerCase()}`;

  try {
    const attempts = await getItem<LoginAttempts>(key);
    if (!attempts) {
      return MAX_LOGIN_ATTEMPTS;
    }

    return Math.max(0, MAX_LOGIN_ATTEMPTS - attempts.count);
  } catch {
    return MAX_LOGIN_ATTEMPTS;
  }
}

export function getSessionState(): SessionState {
  const currentUser = getFirebaseAuth().currentUser;

  return {
    isActive: shouldManageSessionForUser(currentUser),
    lastActivity,
    tokenExpiresAt: null,
  };
}

export function isSessionActive(): boolean {
  const currentUser = getFirebaseAuth().currentUser;
  if (!shouldManageSessionForUser(currentUser)) {
    return false;
  }

  const inactive = Date.now() - lastActivity;
  return inactive < SESSION_TIMEOUT;
}

export const sessionService = {
  initialize,
  cleanup,
  recordActivity,
  isSessionActive,
  getSessionState,
  refreshToken,
  getValidToken,
  checkLoginAttempts,
  incrementLoginAttempts,
  resetLoginAttempts,
  getRemainingLoginAttempts,
};

export default sessionService;
