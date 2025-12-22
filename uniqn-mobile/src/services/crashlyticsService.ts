/**
 * UNIQN Mobile - Crashlytics 서비스
 *
 * @description 앱 크래시 및 에러 리포팅 관리
 * @version 1.0.0
 *
 * 구현 상태:
 * - 웹: 지원되지 않음 (콘솔 로깅으로 대체)
 * - 네이티브: @react-native-firebase/crashlytics 필요 (TODO [출시 전])
 *
 * 주요 기능:
 * - 에러/예외 기록
 * - 사용자 정보 연결
 * - 커스텀 속성/로그 추가
 * - 치명적/비치명적 에러 구분
 */

import { Platform } from 'react-native';
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
const crashlyticsInstance: unknown = null;
let currentUser: CrashlyticsUser = {};
const customAttributes: CrashlyticsAttributes = {};
const breadcrumbs: string[] = [];
const MAX_BREADCRUMBS = 50;

// ============================================================================
// Initialization
// ============================================================================

/**
 * Crashlytics 초기화
 * 웹에서는 지원되지 않음
 */
async function initialize(): Promise<boolean> {
  if (isInitialized) return true;

  try {
    if (Platform.OS === 'web') {
      // 웹: Crashlytics 미지원, 콘솔 로깅으로 대체
      logger.info('Crashlytics는 웹에서 지원되지 않습니다. 콘솔 로깅으로 대체합니다.');
      isInitialized = true;
      return true;
    }

    // 네이티브: @react-native-firebase/crashlytics 필요
    // TODO [출시 전]: EAS Build 설정 후 아래 주석 해제
    /*
    try {
      const crashlytics = (await import('@react-native-firebase/crashlytics')).default;
      crashlyticsInstance = crashlytics();
      isInitialized = true;
      logger.info('Firebase Crashlytics 초기화 완료');
      return true;
    } catch (error) {
      logger.warn('Crashlytics 모듈 로드 실패', { error });
    }
    */

    // 개발 환경: 콘솔 로깅으로 대체
    logger.info('Crashlytics 네이티브 SDK 연동 필요', { platform: Platform.OS });
    isInitialized = true;
    return true;
  } catch (error) {
    logger.error('Crashlytics 초기화 실패', error as Error);
    return false;
  }
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Crashlytics 활성화/비활성화
 */
export function setEnabled(enabled: boolean): void {
  isEnabled = enabled;
  logger.info('Crashlytics 상태 변경', { enabled });

  // 네이티브에서 실제 비활성화
  // TODO [출시 전]: 아래 주석 해제
  /*
  if (crashlyticsInstance && Platform.OS !== 'web') {
    crashlyticsInstance.setCrashlyticsCollectionEnabled(enabled);
  }
  */
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

    // 에러 정보 추출
    const errorInfo = extractErrorInfo(error);
    const fullContext = {
      ...context,
      ...errorInfo.attributes,
    };

    if (Platform.OS === 'web' || !crashlyticsInstance) {
      // 웹 또는 개발 환경: 콘솔 로깅
      logger.error('Crashlytics Error', error, {
        severity: 'non-fatal',
        ...fullContext,
      });

      if (__DEV__) {
        console.error('[Crashlytics]', error.name, error.message, fullContext);
      }
    } else {
      // 네이티브: 실제 Crashlytics 전송
      // TODO [출시 전]: 아래 주석 해제
      /*
      // 커스텀 속성 설정
      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          if (value !== undefined) {
            crashlyticsInstance.setAttribute(key, String(value));
          }
        });
      }

      crashlyticsInstance.recordError(error);
      */
    }
  } catch (_err) {
    // Crashlytics 에러는 조용히 처리
    if (__DEV__) {
      console.error('[Crashlytics] recordError failed', _err);
    }
  }
}

/**
 * 치명적 에러 기록 (앱 크래시)
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

    if (Platform.OS === 'web' || !crashlyticsInstance) {
      logger.error('Crashlytics Fatal Error', error, {
        severity: 'fatal',
        ...context,
        ...errorInfo.attributes,
      });

      if (__DEV__) {
        console.error('[Crashlytics FATAL]', error.name, error.message, context);
      }
    } else {
      // 네이티브: 실제 Crashlytics 전송
      // TODO [출시 전]: crash() 메서드는 앱을 강제 종료하므로 주의
      /*
      crashlyticsInstance.log('FATAL ERROR: ' + error.message);
      crashlyticsInstance.recordError(error);
      */
    }
  } catch (_err) {
    if (__DEV__) {
      console.error('[Crashlytics] recordFatalError failed', _err);
    }
  }
}

/**
 * 로그 메시지 추가
 * 크래시 발생 시 로그도 함께 전송됨
 */
export async function log(message: string): Promise<void> {
  if (!isEnabled) return;

  try {
    // Breadcrumb 저장
    addBreadcrumb(message);

    if (Platform.OS === 'web' || !crashlyticsInstance) {
      if (__DEV__) {
        logger.debug('[Crashlytics Log]', { message });
      }
    } else {
      // TODO [출시 전]: 아래 주석 해제
      // crashlyticsInstance.log(message);
    }
  } catch (_err) {
    // 조용히 처리
  }
}

/**
 * 커스텀 속성 설정
 */
export async function setAttribute(key: string, value: string): Promise<void> {
  if (!isEnabled) return;

  try {
    customAttributes[key] = value;

    if (Platform.OS !== 'web' && crashlyticsInstance) {
      // TODO [출시 전]: 아래 주석 해제
      // crashlyticsInstance.setAttribute(key, value);
    }
  } catch (_err) {
    // 조용히 처리
  }
}

/**
 * 여러 커스텀 속성 설정
 */
export async function setAttributes(attributes: CrashlyticsAttributes): Promise<void> {
  if (!isEnabled) return;

  try {
    Object.entries(attributes).forEach(([key, value]) => {
      customAttributes[key] = value;
    });

    if (Platform.OS !== 'web' && crashlyticsInstance) {
      // TODO [출시 전]: 아래 주석 해제
      // crashlyticsInstance.setAttributes(attributes);
    }
  } catch (_err) {
    // 조용히 처리
  }
}

/**
 * 사용자 ID 설정
 */
export async function setUserId(userId: string | null): Promise<void> {
  try {
    currentUser.id = userId || undefined;

    if (Platform.OS !== 'web' && crashlyticsInstance) {
      // TODO [출시 전]: 아래 주석 해제
      // crashlyticsInstance.setUserId(userId || '');
    }

    if (__DEV__) {
      logger.debug('Crashlytics User ID 설정', { userId: userId ?? undefined });
    }
  } catch (_err) {
    // 조용히 처리
  }
}

/**
 * 사용자 정보 설정
 */
export async function setUser(user: CrashlyticsUser): Promise<void> {
  try {
    currentUser = { ...user };

    if (Platform.OS !== 'web' && crashlyticsInstance) {
      // TODO [출시 전]: 아래 주석 해제
      /*
      if (user.id) crashlyticsInstance.setUserId(user.id);
      if (user.email) crashlyticsInstance.setAttribute('user_email', user.email);
      if (user.name) crashlyticsInstance.setAttribute('user_name', user.name);
      */
    }

    if (__DEV__) {
      logger.debug('Crashlytics User 설정', { user });
    }
  } catch (_err) {
    // 조용히 처리
  }
}

/**
 * 사용자 정보 초기화 (로그아웃 시)
 */
export async function clearUser(): Promise<void> {
  try {
    currentUser = {};

    if (Platform.OS !== 'web' && crashlyticsInstance) {
      // TODO [출시 전]: 아래 주석 해제
      // crashlyticsInstance.setUserId('');
    }

    if (__DEV__) {
      logger.debug('Crashlytics User 초기화');
    }
  } catch (_err) {
    // 조용히 처리
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Breadcrumb 추가
 */
function addBreadcrumb(message: string): void {
  const timestamp = new Date().toISOString();
  breadcrumbs.push(`[${timestamp}] ${message}`);

  // 최대 개수 유지
  while (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs.shift();
  }
}

/**
 * 에러 정보 추출
 */
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

/**
 * 현재 Breadcrumbs 가져오기
 */
export function getBreadcrumbs(): string[] {
  return [...breadcrumbs];
}

/**
 * Breadcrumbs 초기화
 */
export function clearBreadcrumbs(): void {
  breadcrumbs.length = 0;
}

// ============================================================================
// Integration Helpers
// ============================================================================

/**
 * AppError 자동 기록
 * ErrorBoundary 또는 전역 에러 핸들러에서 사용
 */
export async function recordAppError(
  error: AppError,
  context?: CrashContext
): Promise<void> {
  // 심각도에 따라 처리
  const isFatal =
    error.severity === 'critical' || error.category === 'unknown';

  if (isFatal) {
    await recordFatalError(error, context);
  } else {
    await recordError(error, context);
  }

  // Analytics 에러 이벤트도 함께 전송
  try {
    const { trackError } = await import('./analyticsService');
    trackError(error.code, error.message, error.category);
  } catch {
    // Analytics 실패는 무시
  }
}

/**
 * React ErrorBoundary 연동
 */
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
    componentStack: errorInfo.componentStack?.slice(0, 500) || undefined, // 길이 제한
  });
}

/**
 * 네트워크 에러 기록
 */
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

/**
 * 화면 컨텍스트 설정
 * 네비게이션 변경 시 호출
 */
export async function setScreen(screenName: string): Promise<void> {
  await log(`Screen: ${screenName}`);
  await setAttribute('current_screen', screenName);
}

/**
 * Breadcrumb 남기기 (이벤트 추적용)
 * 크래시 발생 시 최근 이벤트 목록도 함께 전송됨
 */
export async function leaveBreadcrumb(
  event: string,
  data?: Record<string, string | number | boolean | undefined>
): Promise<void> {
  if (!isEnabled) return;

  try {
    // 데이터 직렬화
    const dataStr = data
      ? Object.entries(data)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')
      : '';

    const message = dataStr ? `${event}: ${dataStr}` : event;
    addBreadcrumb(message);

    if (Platform.OS !== 'web' && crashlyticsInstance) {
      // TODO [출시 전]: 아래 주석 해제
      // crashlyticsInstance.log(message);
    }

    if (__DEV__) {
      logger.debug('[Crashlytics Breadcrumb]', { event, data });
    }
  } catch (_err) {
    // 조용히 처리
  }
}

// ============================================================================
// Export
// ============================================================================

export const crashlyticsService = {
  // 초기화
  initialize,
  setEnabled,

  // 에러 기록
  recordError,
  recordFatalError,
  recordAppError,
  recordComponentError,
  recordNetworkError,

  // 로깅
  log,
  leaveBreadcrumb,
  getBreadcrumbs,
  clearBreadcrumbs,

  // 속성
  setAttribute,
  setAttributes,

  // 사용자
  setUserId,
  setUser,
  clearUser,

  // 화면
  setScreen,
};

export default crashlyticsService;
