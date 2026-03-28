import {
  AppError,
  getAppErrorTelemetryPolicy,
  isAppError,
  type AppErrorTelemetryChannel,
} from '@/errors/AppError';
import { logger } from '@/utils/logger';

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

export type CrashSeverity = SentrySeverity;
export type CrashContext = SentryContext;
export type CrashlyticsAttributes = SentryAttributes;
export type CrashlyticsUser = SentryUser;

let isInitialized = false;
let isEnabled = true;
let currentUser: SentryUser = {};
const breadcrumbs: string[] = [];
const MAX_BREADCRUMBS = 50;

function addBreadcrumb(message: string): void {
  const timestamp = new Date().toISOString();
  breadcrumbs.push(`[${timestamp}] ${message}`);

  while (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs.shift();
  }
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
  if (!isEnabled) {
    return;
  }

  if (!isInitialized) {
    await initialize();
  }

  logger.error('Sentry web fallback event', error, {
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
  if (!isEnabled) {
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
  if (!isEnabled) {
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
