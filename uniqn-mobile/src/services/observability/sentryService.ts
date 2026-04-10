/**
 * UNIQN Mobile - Sentry observability service
 *
 * @description Sentry 기반 에러/telemetry 래퍼
 * @version 3.0.0
 */

import { Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';
import {
  AppError,
  getAppErrorTelemetryPolicy,
  isAppError,
  type AppErrorTelemetryChannel,
} from '@/errors/AppError';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

export type SentrySeverity = 'fatal' | 'error' | 'warning';

export interface SentryContext {
  screen?: string;
  component?: string;
  action?: string;
  domain?: string;
  userId?: string;
  handlingKind?: string;
  telemetryChannel?: AppErrorTelemetryChannel;
  [key: string]: string | number | boolean | undefined;
}

export interface SentryAttributes {
  [key: string]: string;
}

export interface SentryUser {
  id?: string;
  email?: string;
  name?: string;
}

interface SentryScopeLike {
  setUser(user: { id: string } | null): void;
  setTag(key: string, value: string): void;
  setExtra(key: string, value: string | number | boolean): void;
  setLevel(level: 'fatal' | 'error' | 'warning'): void;
}

// ============================================================================
// State
// ============================================================================

let isInitialized = false;
let isEnabled = true;
let currentUser: SentryUser = {};
const breadcrumbs: string[] = [];
const MAX_BREADCRUMBS = 50;

const TAG_KEYS = new Set([
  'screen',
  'component',
  'action',
  'domain',
  'handlingKind',
  'telemetryChannel',
  'error_code',
  'error_category',
  'error_severity',
  'is_retryable',
]);

// ============================================================================
// Initialization
// ============================================================================

export async function initialize(): Promise<boolean> {
  if (isInitialized) return true;

  try {
    if (Platform.OS === 'web') {
      logger.info('Sentry 웹 fallback 사용', { component: 'sentryService' });
      isInitialized = true;
      return true;
    }

    const sentryEnabled = Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN);
    isInitialized = true;
    logger.info('Sentry observability 상태 확인', {
      component: 'sentryService',
      enabled: sentryEnabled,
    });
    return true;
  } catch (error) {
    logger.error('Sentry initialization failed', error as Error, {
      component: 'sentryService',
    });
    return false;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function addBreadcrumb(message: string): void {
  const timestamp = new Date().toISOString();
  breadcrumbs.push(`[${timestamp}] ${message}`);

  while (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs.shift();
  }
}

function applyScopeContext(scope: SentryScopeLike, context?: SentryContext): void {
  if (!context) {
    return;
  }

  const { userId, ...rest } = context;

  if (userId) {
    scope.setUser({ id: String(userId) });
  }

  Object.entries(rest).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    if (TAG_KEYS.has(key) || key.startsWith('error_')) {
      scope.setTag(key, String(value));
      return;
    }

    scope.setExtra(key, value);
  });
}

function extractErrorAttributes(error: Error | AppError): Record<string, string> {
  const attributes: Record<string, string> = {};

  if (!isAppError(error)) {
    return attributes;
  }

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

  return attributes;
}

async function captureWithLevel(
  error: Error | AppError,
  level: SentrySeverity,
  context?: SentryContext
): Promise<void> {
  if (!isEnabled) return;

  try {
    if (!isInitialized) {
      await initialize();
    }

    const fullContext = {
      ...context,
      ...extractErrorAttributes(error),
    };

    if (Platform.OS === 'web') {
      logger.error('Sentry web fallback event', error, {
        component: 'sentryService',
        level,
        ...fullContext,
      });
      return;
    }

    Sentry.withScope((scope) => {
      applyScopeContext(scope, fullContext);
      scope.setLevel(level === 'warning' ? 'warning' : level);
      Sentry.captureException(error);
    });
  } catch (captureError) {
    logger.warn('[SentryService] capture failed', {
      component: 'sentryService',
      level,
      error: captureError instanceof Error ? captureError.message : String(captureError),
    });
  }
}

// ============================================================================
// Core API
// ============================================================================

export function setEnabled(enabled: boolean): void {
  isEnabled = enabled;
  logger.info('Sentry observability 상태 변경', {
    component: 'sentryService',
    enabled,
  });
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
    // Analytics 실패는 무시
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
      logger.debug('[Sentry Log]', { message });
    }
  } catch {
    // 조용히 처리
  }
}

export async function leaveBreadcrumb(
  event: string,
  data?: Record<string, string | number | boolean | undefined>
): Promise<void> {
  if (!isEnabled) return;

  try {
    const dataString = data
      ? Object.entries(data)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => `${key}=${value}`)
          .join(', ')
      : '';

    const message = dataString ? `${event}: ${dataString}` : event;
    addBreadcrumb(message);

    if (Platform.OS !== 'web') {
      Sentry.addBreadcrumb({
        message,
        data,
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

export async function setAttributes(attributes: SentryAttributes): Promise<void> {
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

export async function setUserId(userId: string | null): Promise<void> {
  try {
    currentUser.id = userId || undefined;

    if (Platform.OS !== 'web') {
      Sentry.setUser(userId ? { id: userId } : null);
    }

    if (__DEV__) {
      logger.debug('Sentry userId 설정', { userId: userId ?? undefined });
    }
  } catch {
    // 조용히 처리
  }
}

export async function setUser(user: SentryUser): Promise<void> {
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
      logger.debug('Sentry user 설정', { user });
    }
  } catch {
    // 조용히 처리
  }
}

export async function clearUser(): Promise<void> {
  try {
    currentUser = {};

    if (Platform.OS !== 'web') {
      Sentry.setUser(null);
    }

    if (__DEV__) {
      logger.debug('Sentry user 초기화');
    }
  } catch {
    // 조용히 처리
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

export function getBreadcrumbs(): string[] {
  return [...breadcrumbs];
}

export function clearBreadcrumbs(): void {
  breadcrumbs.length = 0;
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

export default sentryService;
