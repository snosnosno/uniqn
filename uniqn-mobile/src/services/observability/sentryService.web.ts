/**
 * UNIQN Mobile - Sentry observability service (웹 폴백)
 *
 * 웹에는 네이티브 Sentry SDK 가 없으므로 이벤트를 `logger.observability` 싱크로 흘린다.
 * 플랫폼 분기가 없는 조각(타입·breadcrumb 링·enabled 플래그·AppError 속성 추출)은
 * `./sentryShared` 가 단독 소유한다 — 여기에 다시 구현하지 말 것.
 */

import { AppError, getAppErrorTelemetryPolicy, isAppError } from '@/errors/AppError';
import { logger } from '@/utils/logger';

import {
  addBreadcrumb,
  clearBreadcrumbs,
  extractErrorAttributes,
  getBreadcrumbs,
  isObservabilityEnabled,
  setEnabled,
  type SentryAttributes,
  type SentryContext,
  type SentrySeverity,
  type SentryUser,
} from './sentryShared';

export { clearBreadcrumbs, getBreadcrumbs, setEnabled };
export type { SentryAttributes, SentryContext, SentrySeverity, SentryUser };

let isInitialized = false;
let currentUser: SentryUser = {};

async function captureWithLevel(
  error: Error | AppError,
  level: SentrySeverity,
  context?: SentryContext
): Promise<void> {
  if (!isObservabilityEnabled()) {
    return;
  }

  if (!isInitialized) {
    await initialize();
  }

  // logger.error 가 아니라 observability 싱크로 — logger.error 는 프로덕션에서
  // 이 함수를 다시 호출해 무한 재귀한다(logger.ts observability 주석 참고).
  logger.observability('Sentry web fallback event', error, {
    component: 'sentryService',
    level,
    ...extractErrorAttributes(error),
    ...context,
  });
}

export async function initialize(): Promise<boolean> {
  isInitialized = true;
  logger.info('Sentry web fallback 사용', { component: 'sentryService' });
  return true;
}

export async function recordError(error: Error | AppError, context?: SentryContext): Promise<void> {
  await captureWithLevel(error, 'error', context);
}

export async function recordFatalError(
  error: Error | AppError,
  context?: SentryContext
): Promise<void> {
  await captureWithLevel(error, 'fatal', context);
}

export async function recordAppError(error: AppError, context?: SentryContext): Promise<void> {
  const telemetryPolicy = getAppErrorTelemetryPolicy(error);

  if (!telemetryPolicy.shouldReport) {
    return;
  }

  const fullContext = {
    ...context,
    handlingKind: telemetryPolicy.kind,
    telemetryChannel: telemetryPolicy.telemetryChannel,
  };

  if (telemetryPolicy.telemetryChannel === 'fatal') {
    await recordFatalError(error, fullContext);
    return;
  }

  await recordError(error, fullContext);

  try {
    const { trackError } = await import('./analyticsService');
    trackError(error.code, error.message, error.category);
  } catch {
    // Analytics failure is non-blocking.
  }
}

export async function recordHandledError(
  error: Error | AppError,
  context?: SentryContext
): Promise<void> {
  if (isAppError(error)) {
    await recordAppError(error, context);
    return;
  }

  await recordError(error, context);
}

export async function log(message: string): Promise<void> {
  if (!isObservabilityEnabled()) {
    return;
  }

  addBreadcrumb(message);

  if (__DEV__) {
    logger.debug('[Sentry Log]', { message });
  }
}

export async function leaveBreadcrumb(
  event: string,
  data?: Record<string, string | number | boolean | undefined>
): Promise<void> {
  if (!isObservabilityEnabled()) {
    return;
  }

  const dataString = data
    ? Object.entries(data)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}=${value}`)
        .join(', ')
    : '';

  addBreadcrumb(dataString ? `${event}: ${dataString}` : event);

  if (__DEV__) {
    logger.debug('[Breadcrumb]', { event, data });
  }
}

export async function setAttribute(key: string, value: string): Promise<void> {
  if (__DEV__) {
    logger.debug('Sentry attribute 설정', { key, value });
  }
}

export async function setAttributes(attributes: SentryAttributes): Promise<void> {
  if (__DEV__) {
    logger.debug('Sentry attributes 설정', attributes);
  }
}

export async function setUserId(userId: string | null): Promise<void> {
  currentUser.id = userId || undefined;

  if (__DEV__) {
    logger.debug('Sentry userId 설정', { userId: userId ?? undefined });
  }
}

export async function setUser(user: SentryUser): Promise<void> {
  currentUser = { ...user };

  if (__DEV__) {
    logger.debug('Sentry user 설정', { user });
  }
}

export async function clearUser(): Promise<void> {
  currentUser = {};

  if (__DEV__) {
    logger.debug('Sentry user 초기화');
  }
}

export async function recordComponentError(
  error: Error | AppError,
  errorInfo: { componentStack?: string }
): Promise<void> {
  await log(`Component Error: ${error.message}`);

  if (errorInfo.componentStack) {
    await log(`Component Stack: ${errorInfo.componentStack}`);
  }

  await recordHandledError(error, {
    component: 'ErrorBoundary',
    componentStack: errorInfo.componentStack?.slice(0, 500) || undefined,
  });
}

export async function recordNetworkError(
  error: Error | AppError,
  request?: { url?: string; method?: string }
): Promise<void> {
  await recordHandledError(error, {
    action: 'network_request',
    url: request?.url,
    method: request?.method,
  });
}

export async function setScreen(screenName: string): Promise<void> {
  await log(`Screen: ${screenName}`);
  await setAttribute('current_screen', screenName);
}

export const sentryService = {
  initialize,
  setEnabled,
  recordError,
  recordFatalError,
  recordAppError,
  recordHandledError,
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

export const crashlyticsService = sentryService;
