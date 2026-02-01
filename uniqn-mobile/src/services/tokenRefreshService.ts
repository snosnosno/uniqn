/**
 * UNIQN Mobile - Token Refresh Service
 *
 * @description FCM 토큰 갱신 서비스 (Exponential Backoff 기반)
 * @version 1.0.0
 *
 * 기능:
 * - Exponential Backoff 재시도 (30초 → 30분 max)
 * - 네트워크 상태 연동 (오프라인 시 갱신 중단)
 * - 앱 상태 기반 갱신 최적화 (백그라운드 시 갱신 안 함)
 * - 갱신 상태 MMKV 영구 저장 (앱 재시작 시 복원)
 */

import { Platform, AppState, type AppStateStatus } from 'react-native';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { mmkvStorage, STORAGE_KEYS } from '@/lib/mmkvStorage';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';

// ============================================================================
// Types
// ============================================================================

export interface TokenRefreshConfig {
  /** 기본 갱신 주기 (밀리초, 기본: 12시간) */
  baseInterval: number;
  /** 최대 재시도 횟수 (기본: 5) */
  maxRetries: number;
  /** 초기 백오프 (밀리초, 기본: 30초) */
  initialBackoff: number;
  /** 최대 백오프 (밀리초, 기본: 30분) */
  maxBackoff: number;
  /** 백오프 승수 (기본: 2) */
  backoffMultiplier: number;
  /** 포그라운드 복귀 시 갱신 임계값 (0-1, 기본: 0.8) */
  foregroundRefreshThreshold: number;
}

export interface TokenRefreshState {
  /** 마지막 갱신 성공 시간 (timestamp) */
  lastRefreshAt: number | null;
  /** 연속 실패 횟수 */
  failureCount: number;
  /** 다음 재시도 예정 시간 (timestamp) */
  nextRetryAt: number | null;
  /** 현재 갱신 진행 중 */
  isRefreshing: boolean;
  /** 다음 정기 갱신 시간 (timestamp) */
  nextScheduledAt: number | null;
}

export interface StartOptions {
  /** 사용자 ID */
  userId: string;
  /** 갱신 함수 */
  onRefresh: () => Promise<boolean>;
  /** 실패 콜백 */
  onFailure?: (failureCount: number) => void;
  /** 성공 콜백 */
  onSuccess?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: TokenRefreshConfig = {
  baseInterval: 12 * 60 * 60 * 1000, // 12시간
  maxRetries: 5,
  initialBackoff: 30 * 1000, // 30초
  maxBackoff: 30 * 60 * 1000, // 30분
  backoffMultiplier: 2,
  foregroundRefreshThreshold: 0.8, // 80% 경과 시 포그라운드 복귀 시 갱신
};

const INITIAL_STATE: TokenRefreshState = {
  lastRefreshAt: null,
  failureCount: 0,
  nextRetryAt: null,
  isRefreshing: false,
  nextScheduledAt: null,
};

// ============================================================================
// Module State
// ============================================================================

let config: TokenRefreshConfig = { ...DEFAULT_CONFIG };
let state: TokenRefreshState = { ...INITIAL_STATE };
let options: StartOptions | null = null;
let isRunning = false;
let isOnline = true;
let appState: AppStateStatus = AppState.currentState;

// Timers
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

// Subscriptions
let netInfoUnsubscribe: (() => void) | null = null;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

// ============================================================================
// Persistence
// ============================================================================

/**
 * 상태를 MMKV에 저장
 */
function persistState(): void {
  try {
    const persistData = {
      lastRefreshAt: state.lastRefreshAt,
      failureCount: state.failureCount,
      nextScheduledAt: state.nextScheduledAt,
    };
    mmkvStorage.set(STORAGE_KEYS.TOKEN_REFRESH_STATE, JSON.stringify(persistData));
  } catch (error) {
    logger.warn('토큰 갱신 상태 저장 실패', { error: toError(error).message });
  }
}

/**
 * MMKV에서 상태 복원
 */
function restoreState(): void {
  try {
    const stored = mmkvStorage.getString(STORAGE_KEYS.TOKEN_REFRESH_STATE);
    if (stored) {
      const parsed = JSON.parse(stored);
      state.lastRefreshAt = parsed.lastRefreshAt ?? null;
      state.failureCount = parsed.failureCount ?? 0;
      state.nextScheduledAt = parsed.nextScheduledAt ?? null;
      logger.info('토큰 갱신 상태 복원', {
        lastRefreshAt: state.lastRefreshAt
          ? new Date(state.lastRefreshAt).toISOString()
          : null,
        failureCount: state.failureCount,
      });
    }
  } catch (error) {
    logger.warn('토큰 갱신 상태 복원 실패', { error: toError(error).message });
  }
}

// ============================================================================
// Core Logic
// ============================================================================

/**
 * 백오프 시간 계산
 */
function calculateBackoff(attempt: number): number {
  const backoff = config.initialBackoff * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(backoff, config.maxBackoff);
}

/**
 * sleep 유틸리티
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 토큰 갱신 (재시도 로직 포함)
 */
async function refreshTokenWithRetry(): Promise<boolean> {
  if (!options) {
    logger.warn('토큰 갱신 서비스 미초기화');
    return false;
  }

  if (state.isRefreshing) {
    logger.info('토큰 갱신 이미 진행 중');
    return false;
  }

  // 오프라인 상태면 갱신 중단
  if (!isOnline) {
    logger.info('오프라인 상태로 토큰 갱신 연기');
    return false;
  }

  // 백그라운드 상태면 갱신 중단
  if (appState !== 'active') {
    logger.info('백그라운드 상태로 토큰 갱신 연기');
    return false;
  }

  state.isRefreshing = true;
  let attempt = 0;

  while (attempt < config.maxRetries) {
    // 재시도 전 온라인/포그라운드 상태 재확인
    if (!isOnline || appState !== 'active') {
      logger.info('상태 변경으로 토큰 갱신 중단', { isOnline, appState });
      state.isRefreshing = false;
      return false;
    }

    try {
      logger.info('토큰 갱신 시도', { attempt: attempt + 1, maxRetries: config.maxRetries });

      const success = await options.onRefresh();

      if (success) {
        // 성공
        state.failureCount = 0;
        state.lastRefreshAt = Date.now();
        state.nextRetryAt = null;
        state.isRefreshing = false;
        persistState();
        scheduleNextRefresh();
        options.onSuccess?.();

        logger.info('토큰 갱신 성공', {
          nextScheduledAt: state.nextScheduledAt
            ? new Date(state.nextScheduledAt).toISOString()
            : null,
        });

        return true;
      }

      // 실패 (재시도 가능)
      throw new Error('토큰 갱신 실패');
    } catch (error) {
      attempt++;
      state.failureCount++;

      logger.warn('토큰 갱신 실패', {
        attempt,
        failureCount: state.failureCount,
        error: toError(error).message,
      });

      if (attempt < config.maxRetries) {
        // 백오프 후 재시도
        const backoff = calculateBackoff(attempt - 1);
        state.nextRetryAt = Date.now() + backoff;

        logger.info('백오프 후 재시도 예정', {
          backoffMs: backoff,
          nextRetryAt: new Date(state.nextRetryAt).toISOString(),
        });

        await sleep(backoff);
      }
    }
  }

  // 최대 재시도 초과
  state.isRefreshing = false;
  state.nextRetryAt = null;
  persistState();

  logger.error('토큰 갱신 최종 실패', {
    attempts: attempt,
    failureCount: state.failureCount,
  });

  options.onFailure?.(state.failureCount);

  // 다음 정기 갱신 스케줄
  scheduleNextRefresh();

  return false;
}

/**
 * 다음 정기 갱신 스케줄
 */
function scheduleNextRefresh(): void {
  // 기존 타이머 정리
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  if (!isRunning) return;

  const now = Date.now();
  const nextTime = now + config.baseInterval;
  state.nextScheduledAt = nextTime;
  persistState();

  refreshTimer = setTimeout(() => {
    refreshTokenWithRetry();
  }, config.baseInterval);

  logger.info('다음 토큰 갱신 스케줄', {
    intervalMs: config.baseInterval,
    nextScheduledAt: new Date(nextTime).toISOString(),
  });
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * 네트워크 상태 변경 핸들러
 */
function handleNetworkChange(netState: NetInfoState): void {
  const wasOnline = isOnline;
  isOnline = netState.isConnected === true && netState.isInternetReachable !== false;

  if (!wasOnline && isOnline) {
    // 오프라인 → 온라인
    logger.info('네트워크 복귀 감지 - 토큰 갱신 확인');
    onNetworkReconnect();
  } else if (wasOnline && !isOnline) {
    // 온라인 → 오프라인
    logger.info('네트워크 끊김 감지');
    cancelPendingRetry();
  }
}

/**
 * 앱 상태 변경 핸들러
 */
function handleAppStateChange(nextAppState: AppStateStatus): void {
  const wasBackground = appState.match(/inactive|background/);
  const isNowActive = nextAppState === 'active';

  appState = nextAppState;

  if (wasBackground && isNowActive) {
    // 백그라운드 → 포그라운드
    logger.info('앱 포그라운드 복귀');

    if (shouldRefreshOnForeground()) {
      logger.info('포그라운드 복귀 시 토큰 갱신 시작');
      triggerRefresh();
    }
  }
}

/**
 * 대기 중인 재시도 취소
 */
function cancelPendingRetry(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  state.nextRetryAt = null;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * 서비스 시작
 */
export function start(startOptions: StartOptions, customConfig?: Partial<TokenRefreshConfig>): void {
  if (Platform.OS === 'web') {
    logger.info('웹 환경에서는 토큰 갱신 서비스 비활성화');
    return;
  }

  if (isRunning) {
    logger.warn('토큰 갱신 서비스 이미 실행 중');
    return;
  }

  // 설정 초기화
  config = { ...DEFAULT_CONFIG, ...customConfig };
  options = startOptions;
  isRunning = true;

  // 상태 복원
  restoreState();

  // 이벤트 리스너 등록
  netInfoUnsubscribe = NetInfo.addEventListener(handleNetworkChange);
  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

  // 초기 네트워크 상태 확인
  NetInfo.fetch().then((netState) => {
    isOnline = netState.isConnected === true && netState.isInternetReachable !== false;
  });

  // 초기 앱 상태
  appState = AppState.currentState;

  // 마지막 갱신 이후 시간 확인
  const now = Date.now();
  const timeSinceLastRefresh = state.lastRefreshAt ? now - state.lastRefreshAt : Infinity;

  if (timeSinceLastRefresh >= config.baseInterval) {
    // 갱신 주기 초과 - 즉시 갱신
    logger.info('갱신 주기 초과로 즉시 갱신 시작', {
      timeSinceLastRefreshMs: timeSinceLastRefresh,
    });
    refreshTokenWithRetry();
  } else {
    // 남은 시간 후 갱신 스케줄
    const remainingTime = config.baseInterval - timeSinceLastRefresh;
    state.nextScheduledAt = now + remainingTime;
    persistState();

    refreshTimer = setTimeout(() => {
      refreshTokenWithRetry();
    }, remainingTime);

    logger.info('토큰 갱신 서비스 시작', {
      userId: startOptions.userId,
      nextRefreshIn: Math.round(remainingTime / 1000 / 60) + '분',
      nextScheduledAt: new Date(state.nextScheduledAt).toISOString(),
    });
  }
}

/**
 * 서비스 중지
 */
export function stop(): void {
  if (!isRunning) return;

  isRunning = false;
  options = null;

  // 타이머 정리
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  cancelPendingRetry();

  // 이벤트 리스너 해제
  netInfoUnsubscribe?.();
  netInfoUnsubscribe = null;

  appStateSubscription?.remove();
  appStateSubscription = null;

  // 상태 초기화 (저장은 유지)
  state.isRefreshing = false;
  state.nextRetryAt = null;

  logger.info('토큰 갱신 서비스 중지');
}

/**
 * 즉시 갱신 트리거
 */
export async function triggerRefresh(): Promise<boolean> {
  if (!isRunning) {
    logger.warn('토큰 갱신 서비스 미실행');
    return false;
  }

  return refreshTokenWithRetry();
}

/**
 * 포그라운드 복귀 시 갱신 필요 여부
 */
export function shouldRefreshOnForeground(): boolean {
  if (!isRunning || !state.lastRefreshAt) return true;

  const now = Date.now();
  const elapsed = now - state.lastRefreshAt;
  const threshold = config.baseInterval * config.foregroundRefreshThreshold;

  return elapsed >= threshold;
}

/**
 * 네트워크 복귀 시 호출
 */
export function onNetworkReconnect(): void {
  if (!isRunning) return;

  // 대기 중인 재시도가 있었으면 즉시 실행
  if (state.nextRetryAt && state.nextRetryAt > Date.now()) {
    logger.info('네트워크 복귀로 대기 중 갱신 즉시 실행');
    cancelPendingRetry();
    triggerRefresh();
    return;
  }

  // 갱신 주기 초과 시 즉시 갱신
  if (shouldRefreshOnForeground()) {
    logger.info('네트워크 복귀 시 갱신 필요');
    triggerRefresh();
  }
}

/**
 * 현재 상태 조회
 */
export function getState(): TokenRefreshState {
  return { ...state };
}

/**
 * 설정 업데이트
 */
export function updateConfig(updates: Partial<TokenRefreshConfig>): void {
  config = { ...config, ...updates };
}

/**
 * 상태 초기화 (테스트용)
 */
export function resetState(): void {
  state = { ...INITIAL_STATE };
  try {
    mmkvStorage.delete(STORAGE_KEYS.TOKEN_REFRESH_STATE);
  } catch {
    // 무시
  }
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  start,
  stop,
  triggerRefresh,
  shouldRefreshOnForeground,
  onNetworkReconnect,
  getState,
  updateConfig,
  resetState,
};
