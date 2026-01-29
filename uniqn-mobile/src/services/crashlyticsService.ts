/**
 * UNIQN Mobile - 에러 모니터링 서비스
 *
 * @description Sentry 기반 에러 모니터링
 * @version 2.0.0
 *
 * 구현 상태:
 * - Sentry: 크래시 리포팅, 에러 추적
 * - 웹: 콘솔 로깅으로 대체
 *
 * 주요 기능:
 * - 에러/예외 기록
 * - 사용자 정보 연결
 * - 커스텀 컨텍스트 추가
 * - Breadcrumb 추적
 */

import { Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { logger } from '@/utils/logger';
import { AppError } from '@/errors/AppError';

// ============================================================================
// Types
// ============================================================================

/**
 * 크래시 심각도
 */
export type CrashSeverity = 'fatal' | 'non-fatal' | 'warning';

/**
 * 크래시 컨텍스트
 */
export interface CrashContext {
  /** 화면 이름 */
  screen?: string;
  /** 컴포넌트 이름 */
  component?: string;
  /** 액션 */
  action?: string;
  /** 사용자 ID */
  userId?: string;
  /** 추가 데이터 */
  [key: string]: string | number | boolean | undefined;
}

/**
 * 커스텀 속성
 */
export interface CrashlyticsAttributes {
  [key: string]: string;
}

/**
 * 사용자 정보
 */
export interface CrashlyticsUser {
  id?: string;
  email?: string;
  name?: string;
}

// ============================================================================
// State
// ============================================================================

let isInitialized = false;
let isEnabled = true;
let currentUser: CrashlyticsUser = {};
const breadcrumbs: string[] = [];
const MAX_BREADCRUMBS = 50;

// ============================================================================
// Initialization
// ============================================================================

/**
 * 에러 모니터링 초기화
 */
async function initialize(): Promise<boolean> {
  if (isInitialized) return true;

  try {
    if (Platform.OS === 'web') {
      logger.info('Sentry 웹 환경: 콘솔 로깅으로 대체');
      isInitialized = true;
      return true;
    }

    // Sentry는 app/_layout.tsx에서 초기화됨
    isInitialized = true;
    logger.info('Sentry 에러 모니터링 연동 완료');
    return true;
  } catch (error) {
    logger.error('에러 모니터링 초기화 실패', error as Error);
    return false;
  }
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * 에러 모니터링 활성화/비활성화
 */
export function setEnabled(enabled: boolean): void {
  isEnabled = enabled;
  logger.info('에러 모니터링 상태 변경', { enabled });
}

/**
 * 치명적이지 않은 에러 기록
 */
export async function recordError(
  error: Error | AppError,
  context?: CrashContext
): Promise<void> {
  if (!isEnabled) return;

  try {
    if (!isInitialized) {
      await initialize();
    }

    const errorInfo = extractErrorInfo(error);
    const fullContext = {
      ...context,
      ...errorInfo.attributes,
    };

    if (Platform.OS === 'web') {
      logger.error('Error recorded', error, {
        severity: 'non-fatal',
        ...fullContext,
      });

      if (__DEV__) {
        console.error('[ErrorMonitor]', error.name, error.message, fullContext);
      }
    } else {
      // Sentry로 에러 전송
      Sentry.withScope((scope) => {
        if (context) {
          Object.entries(context).forEach(([key, value]) => {
            if (value !== undefined) {
              scope.setTag(key, String(value));
            }
          });
        }
        scope.setLevel('error');
        Sentry.captureException(error);
      });
    }
  } catch (_err) {
    if (__DEV__) {
      console.error('[ErrorMonitor] recordError failed', _err);
    }
  }
}

/**
 * 치명적 에러 기록
 */
export async function recordFatalError(
  error: Error | AppError,
  context?: CrashContext
): Promise<void> {
  if (!isEnabled) return;

  try {
    if (!isInitialized) {
      await initialize();
    }

    const errorInfo = extractErrorInfo(error);

    if (Platform.OS === 'web') {
      logger.error('Fatal Error recorded', error, {
        severity: 'fatal',
        ...context,
        ...errorInfo.attributes,
      });

      if (__DEV__) {
        console.error('[ErrorMonitor FATAL]', error.name, error.message, context);
      }
    } else {
      Sentry.withScope((scope) => {
        if (context) {
          Object.entries(context).forEach(([key, value]) => {
            if (value !== undefined) {
              scope.setTag(key, String(value));
            }
          });
        }
        scope.setLevel('fatal');
        Sentry.captureException(error);
      });
    }
  } catch (_err) {
    if (__DEV__) {
      console.error('[ErrorMonitor] recordFatalError failed', _err);
    }
  }
}

/**
 * 로그 메시지 추가
 */
export async function log(message: string): Promise<void> {
  if (!isEnabled) return;

  try {
    addBreadcrumb(message);

    if (Platform.OS !== 'web') {
      Sentry.addBreadcrumb({
        message,
        level: 'info',
      });
    }

    if (__DEV__) {
      logger.debug('[ErrorMonitor Log]', { message });
    }
  } catch {
    // 조용히 처리
  }
}

/**
 * 커스텀 속성 설정
 */
export async function setAttribute(key: string, value: string): Promise<void> {
  if (!isEnabled) return;

  try {
    if (Platform.OS !== 'web') {
      Sentry.setTag(key, value);
    }
  } catch {
    // 조용히 처리
  }
}

/**
 * 여러 커스텀 속성 설정
 */
export async function setAttributes(attributes: CrashlyticsAttributes): Promise<void> {
  if (!isEnabled) return;

  try {
    if (Platform.OS !== 'web') {
      Object.entries(attributes).forEach(([key, value]) => {
        Sentry.setTag(key, value);
      });
    }
  } catch {
    // 조용히 처리
  }
}

/**
 * 사용자 ID 설정
 */
export async function setUserId(userId: string | null): Promise<void> {
  try {
    currentUser.id = userId || undefined;

    if (Platform.OS !== 'web') {
      Sentry.setUser(userId ? { id: userId } : null);
    }

    if (__DEV__) {
      logger.debug('User ID 설정', { userId: userId ?? undefined });
    }
  } catch {
    // 조용히 처리
  }
}

/**
 * 사용자 정보 설정
 */
export async function setUser(user: CrashlyticsUser): Promise<void> {
  try {
    currentUser = { ...user };

    if (Platform.OS !== 'web') {
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.name,
      });
    }

    if (__DEV__) {
      logger.debug('User 설정', { user });
    }
  } catch {
    // 조용히 처리
  }
}

/**
 * 사용자 정보 초기화
 */
export async function clearUser(): Promise<void> {
  try {
    currentUser = {};

    if (Platform.OS !== 'web') {
      Sentry.setUser(null);
    }

    if (__DEV__) {
      logger.debug('User 초기화');
    }
  } catch {
    // 조용히 처리
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function addBreadcrumb(message: string): void {
  const timestamp = new Date().toISOString();
  breadcrumbs.push(`[${timestamp}] ${message}`);

  while (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs.shift();
  }
}

function extractErrorInfo(error: Error | AppError): {
  name: string;
  message: string;
  stack?: string;
  attributes: Record<string, string>;
} {
  const attributes: Record<string, string> = {};

  if (error instanceof AppError) {
    attributes.error_code = error.code;
    attributes.error_category = error.category;
    attributes.error_severity = error.severity;
    attributes.is_retryable = String(error.isRetryable);

    if (error.metadata) {
      Object.entries(error.metadata).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          attributes[`metadata_${key}`] = String(value);
        }
      });
    }
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    attributes,
  };
}

export function getBreadcrumbs(): string[] {
  return [...breadcrumbs];
}

export function clearBreadcrumbs(): void {
  breadcrumbs.length = 0;
}

// ============================================================================
// Integration Helpers
// ============================================================================

export async function recordAppError(
  error: AppError,
  context?: CrashContext
): Promise<void> {
  const isFatal = error.severity === 'critical' || error.category === 'unknown';

  if (isFatal) {
    await recordFatalError(error, context);
  } else {
    await recordError(error, context);
  }

  try {
    const { trackError } = await import('./analyticsService');
    trackError(error.code, error.message, error.category);
  } catch {
    // Analytics 실패는 무시
  }
}

export async function recordComponentError(
  error: Error,
  errorInfo: { componentStack?: string }
): Promise<void> {
  await log(`Component Error: ${error.message}`);

  if (errorInfo.componentStack) {
    await log(`Component Stack: ${errorInfo.componentStack}`);
  }

  await recordError(error, {
    component: 'ErrorBoundary',
    componentStack: errorInfo.componentStack?.slice(0, 500) || undefined,
  });
}

export async function recordNetworkError(
  error: Error,
  request?: { url?: string; method?: string }
): Promise<void> {
  await recordError(error, {
    action: 'network_request',
    url: request?.url,
    method: request?.method,
  });
}

export async function setScreen(screenName: string): Promise<void> {
  await log(`Screen: ${screenName}`);
  await setAttribute('current_screen', screenName);
}

export async function leaveBreadcrumb(
  event: string,
  data?: Record<string, string | number | boolean | undefined>
): Promise<void> {
  if (!isEnabled) return;

  try {
    const dataStr = data
      ? Object.entries(data)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')
      : '';

    const message = dataStr ? `${event}: ${dataStr}` : event;
    addBreadcrumb(message);

    if (Platform.OS !== 'web') {
      Sentry.addBreadcrumb({
        message,
        data: data as Record<string, string>,
        level: 'info',
      });
    }

    if (__DEV__) {
      logger.debug('[Breadcrumb]', { event, data });
    }
  } catch {
    // 조용히 처리
  }
}

// ============================================================================
// Export
// ============================================================================

export const crashlyticsService = {
  initialize,
  setEnabled,
  recordError,
  recordFatalError,
  recordAppError,
  recordComponentError,
  recordNetworkError,
  log,
  leaveBreadcrumb,
  getBreadcrumbs,
  clearBreadcrumbs,
  setAttribute,
  setAttributes,
  setUserId,
  setUser,
  clearUser,
  setScreen,
};

export default crashlyticsService;
