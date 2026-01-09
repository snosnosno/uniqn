/**
 * UNIQN Mobile - Session Management Service
 *
 * @description 세션 관리 및 토큰 로테이션 서비스
 * @version 1.0.0
 *
 * 주요 기능:
 * - 세션 타임아웃 관리 (30분)
 * - 토큰 자동 갱신
 * - 로그인 시도 횟수 추적 및 잠금
 * - 앱 상태 기반 세션 체크
 */

import { AppState, type AppStateStatus } from 'react-native';
import { getFirebaseAuth } from '@/lib/firebase';
import { authStorage, sessionStorage } from '@/lib/secureStorage';
import { logger } from '@/utils/logger';
import { crashlyticsService } from './crashlyticsService';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { router } from 'expo-router';
import { AppError, AuthError, ERROR_CODES } from '@/errors';

// sessionStorage는 향후 세션 관리 확장 시 활용
void sessionStorage;

// ============================================================================
// Constants
// ============================================================================

/** 세션 타임아웃 (30분) */
const SESSION_TIMEOUT = 30 * 60 * 1000;

/** 토큰 갱신 간격 (50분 - Firebase ID 토큰은 1시간 유효) */
const TOKEN_REFRESH_INTERVAL = 50 * 60 * 1000;

/** 최대 로그인 시도 횟수 */
const MAX_LOGIN_ATTEMPTS = 5;

/** 로그인 잠금 시간 (15분) */
const LOCKOUT_DURATION = 15 * 60 * 1000;

/** 토큰 갱신 최소 남은 시간 (5분 미만이면 갱신) */
const TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000;

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// State
// ============================================================================

let isInitialized = false;
let lastActivity: number = Date.now();
let sessionTimeoutId: ReturnType<typeof setTimeout> | null = null;
let tokenRefreshIntervalId: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let authUnsubscribe: (() => void) | null = null;

// ============================================================================
// Initialization
// ============================================================================

/**
 * 세션 매니저 초기화
 */
export function initialize(): void {
  if (isInitialized) return;

  // 앱 상태 변경 리스너
  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

  // Firebase Auth 상태 변경 리스너
  authUnsubscribe = getFirebaseAuth().onAuthStateChanged(handleAuthStateChange);

  isInitialized = true;
  logger.info('세션 매니저 초기화 완료');
}

/**
 * 세션 매니저 정리
 */
export function cleanup(): void {
  clearSessionTimeout();
  clearTokenRefreshInterval();

  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }

  if (authUnsubscribe) {
    authUnsubscribe();
    authUnsubscribe = null;
  }

  isInitialized = false;
  logger.info('세션 매니저 정리 완료');
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * 앱 상태 변경 핸들러
 */
function handleAppStateChange(state: AppStateStatus): void {
  if (state === 'active') {
    // 포그라운드로 돌아왔을 때 세션 체크
    checkSession();
    logger.debug('앱 포그라운드 복귀 - 세션 체크');
  } else if (state === 'background') {
    // 백그라운드로 갈 때 타이머 정지
    clearSessionTimeout();
    logger.debug('앱 백그라운드 전환 - 세션 타이머 중지');
  }
}

/**
 * Firebase Auth 상태 변경 핸들러
 */
async function handleAuthStateChange(user: unknown): Promise<void> {
  if (user) {
    // Custom Claims 갱신을 위해 토큰 강제 새로고침
    // 웹앱에서 가입한 계정도 모바일앱에서 최신 권한 정보를 가져옴
    try {
      const currentUser = getFirebaseAuth().currentUser;
      if (currentUser) {
        await currentUser.getIdToken(true);
        logger.debug('토큰 강제 갱신 완료 (Custom Claims 로드)');
      }
    } catch (error) {
      logger.warn('토큰 갱신 실패', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // 로그인됨 - 세션 타이머 시작
    resetActivityTimer();
    startTokenRefreshInterval();
    logger.info('인증 상태 변경 - 세션 시작');
  } else {
    // 로그아웃됨 - 타이머 정지
    clearSessionTimeout();
    clearTokenRefreshInterval();
    logger.info('인증 상태 변경 - 세션 종료');
  }
}

/**
 * 사용자 활동 기록
 * @description 사용자가 앱과 상호작용할 때마다 호출
 */
export function recordActivity(): void {
  lastActivity = Date.now();
  resetActivityTimer();
}

/**
 * 세션 체크
 */
function checkSession(): void {
  const currentUser = getFirebaseAuth().currentUser;
  if (!currentUser) return;

  const inactive = Date.now() - lastActivity;

  if (inactive > SESSION_TIMEOUT) {
    // 세션 만료
    expireSession('세션이 만료되었습니다');
  } else {
    // 타이머 재설정
    resetActivityTimer();

    // 토큰 유효성 체크
    checkAndRefreshToken();
  }
}

/**
 * 세션 타이머 리셋
 */
function resetActivityTimer(): void {
  clearSessionTimeout();

  sessionTimeoutId = setTimeout(() => {
    expireSession('비활성으로 인해 세션이 만료되었습니다');
  }, SESSION_TIMEOUT);
}

/**
 * 세션 타이머 클리어
 */
function clearSessionTimeout(): void {
  if (sessionTimeoutId) {
    clearTimeout(sessionTimeoutId);
    sessionTimeoutId = null;
  }
}

/**
 * 세션 만료 처리
 */
async function expireSession(message: string): Promise<void> {
  logger.warn('세션 만료', { message });

  // 토스트 알림
  useToastStore.getState().addToast({
    type: 'warning',
    message: message + ' 다시 로그인해주세요.',
  });

  // 로그아웃
  try {
    await getFirebaseAuth().signOut();
    useAuthStore.getState().reset();
  } catch (error) {
    logger.error('세션 만료 - 로그아웃 실패', error as Error);
  }

  // 로그인 페이지로 이동
  router.replace('/(auth)/login');
}

// ============================================================================
// Token Management
// ============================================================================

/**
 * 토큰 갱신 인터벌 시작
 */
function startTokenRefreshInterval(): void {
  clearTokenRefreshInterval();

  // 초기 토큰 체크
  checkAndRefreshToken();

  // 주기적 갱신
  tokenRefreshIntervalId = setInterval(() => {
    checkAndRefreshToken();
  }, TOKEN_REFRESH_INTERVAL);
}

/**
 * 토큰 갱신 인터벌 정지
 */
function clearTokenRefreshInterval(): void {
  if (tokenRefreshIntervalId) {
    clearInterval(tokenRefreshIntervalId);
    tokenRefreshIntervalId = null;
  }
}

/**
 * 토큰 체크 및 갱신
 */
async function checkAndRefreshToken(): Promise<void> {
  const currentUser = getFirebaseAuth().currentUser;
  if (!currentUser) return;

  try {
    // 토큰 결과 가져오기
    const tokenResult = await currentUser.getIdTokenResult();
    const expirationTime = new Date(tokenResult.expirationTime).getTime();
    const now = Date.now();

    // 만료 임박 또는 이미 만료된 경우 갱신
    if (expirationTime - now < TOKEN_EXPIRY_BUFFER) {
      await refreshToken();
    }
  } catch (error) {
    logger.error('토큰 체크 실패', error as Error);
    crashlyticsService.recordError(error as Error, {
      component: 'sessionService',
      action: 'checkAndRefreshToken',
    });
  }
}

/**
 * 토큰 강제 갱신
 */
export async function refreshToken(): Promise<string | null> {
  const currentUser = getFirebaseAuth().currentUser;
  if (!currentUser) {
    logger.warn('토큰 갱신 실패 - 로그인 필요');
    return null;
  }

  try {
    // 토큰 강제 갱신 (true = force refresh)
    const newToken = await currentUser.getIdToken(true);

    // SecureStore에 저장 (중앙화된 secureStorage 사용)
    await authStorage.setAuthToken(newToken);

    logger.info('토큰 갱신 성공');
    return newToken;
  } catch (error) {
    logger.error('토큰 갱신 실패', error as Error);

    crashlyticsService.recordError(error as Error, {
      component: 'sessionService',
      action: 'refreshToken',
    });

    // 토큰 갱신 실패 시 세션 만료 처리
    await expireSession('인증 토큰 갱신에 실패했습니다');
    return null;
  }
}

/**
 * 현재 유효한 토큰 가져오기
 */
export async function getValidToken(): Promise<string | null> {
  const currentUser = getFirebaseAuth().currentUser;
  if (!currentUser) return null;

  try {
    // 토큰 결과 확인
    const tokenResult = await currentUser.getIdTokenResult();
    const expirationTime = new Date(tokenResult.expirationTime).getTime();
    const now = Date.now();

    // 만료 임박이면 갱신
    if (expirationTime - now < TOKEN_EXPIRY_BUFFER) {
      return await refreshToken();
    }

    return tokenResult.token;
  } catch (error) {
    logger.error('토큰 가져오기 실패', error as Error);
    return null;
  }
}

// ============================================================================
// Login Attempt Management
// ============================================================================

/**
 * 로그인 시도 횟수 확인
 * @throws AppError 잠금 상태인 경우
 */
export async function checkLoginAttempts(email: string): Promise<void> {
  const key = `login_attempts_${email.toLowerCase()}`;

  try {
    const { getItem, deleteItem } = await import('@/lib/secureStorage');
    const attempts = await getItem<LoginAttempts>(key);
    if (!attempts) return;

    // 잠금 상태 확인
    if (attempts.lockUntil && Date.now() < attempts.lockUntil) {
      const remainingTime = Math.ceil((attempts.lockUntil - Date.now()) / 60000);
      throw new AuthError(ERROR_CODES.AUTH_RATE_LIMITED, {
        userMessage: `로그인 시도 횟수를 초과했습니다. ${remainingTime}분 후에 다시 시도해주세요.`,
        metadata: { remainingMinutes: remainingTime },
      });
    }

    // 잠금 해제됨 - 초기화
    if (attempts.lockUntil && Date.now() >= attempts.lockUntil) {
      await deleteItem(key);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('로그인 시도 횟수 확인 실패', error as Error);
  }
}

/**
 * 로그인 시도 횟수 증가
 */
export async function incrementLoginAttempts(email: string): Promise<void> {
  const key = `login_attempts_${email.toLowerCase()}`;

  try {
    const { getItem, setItem } = await import('@/lib/secureStorage');
    const current = await getItem<LoginAttempts>(key) ?? { count: 0, lockUntil: null, lastAttempt: 0 };

    const newCount = current.count + 1;
    const shouldLock = newCount >= MAX_LOGIN_ATTEMPTS;

    const newAttempts: LoginAttempts = {
      count: newCount,
      lockUntil: shouldLock ? Date.now() + LOCKOUT_DURATION : null,
      lastAttempt: Date.now(),
    };

    await setItem(key, newAttempts);

    if (shouldLock) {
      logger.warn('로그인 시도 횟수 초과 - 계정 잠금', { email: email.substring(0, 3) + '***' });
    }
  } catch (error) {
    logger.error('로그인 시도 횟수 증가 실패', error as Error);
  }
}

/**
 * 로그인 시도 횟수 초기화 (로그인 성공 시)
 */
export async function resetLoginAttempts(email: string): Promise<void> {
  const key = `login_attempts_${email.toLowerCase()}`;

  try {
    const { deleteItem } = await import('@/lib/secureStorage');
    await deleteItem(key);
    logger.debug('로그인 시도 횟수 초기화', { email: email.substring(0, 3) + '***' });
  } catch (error) {
    logger.error('로그인 시도 횟수 초기화 실패', error as Error);
  }
}

/**
 * 남은 로그인 시도 횟수 확인
 */
export async function getRemainingLoginAttempts(email: string): Promise<number> {
  const key = `login_attempts_${email.toLowerCase()}`;

  try {
    const { getItem } = await import('@/lib/secureStorage');
    const attempts = await getItem<LoginAttempts>(key);
    if (!attempts) return MAX_LOGIN_ATTEMPTS;

    return Math.max(0, MAX_LOGIN_ATTEMPTS - attempts.count);
  } catch {
    return MAX_LOGIN_ATTEMPTS;
  }
}

// ============================================================================
// Session State
// ============================================================================

/**
 * 현재 세션 상태 가져오기
 */
export function getSessionState(): SessionState {
  const currentUser = getFirebaseAuth().currentUser;

  return {
    isActive: !!currentUser,
    lastActivity,
    tokenExpiresAt: null, // async로 가져와야 함
  };
}

/**
 * 세션이 활성 상태인지 확인
 */
export function isSessionActive(): boolean {
  const currentUser = getFirebaseAuth().currentUser;
  if (!currentUser) return false;

  const inactive = Date.now() - lastActivity;
  return inactive < SESSION_TIMEOUT;
}

// ============================================================================
// Export
// ============================================================================

export const sessionService = {
  // 초기화
  initialize,
  cleanup,

  // 세션 관리
  recordActivity,
  isSessionActive,
  getSessionState,

  // 토큰 관리
  refreshToken,
  getValidToken,

  // 로그인 시도 관리
  checkLoginAttempts,
  incrementLoginAttempts,
  resetLoginAttempts,
  getRemainingLoginAttempts,
};

export default sessionService;
