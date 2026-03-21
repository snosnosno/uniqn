/**
 * Compatibility alias for legacy crashlytics naming.
 *
 * Canonical implementation lives in sentryService.ts.
 * Keep this file until all external imports are migrated.
 */

export {
  sentryService,
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
  type SentrySeverity,
  type SentryContext,
  type SentryAttributes,
  type SentryUser,
} from './sentryService';

export type CrashSeverity = import('./sentryService').SentrySeverity;
export type CrashContext = import('./sentryService').SentryContext;
export type CrashlyticsAttributes = import('./sentryService').SentryAttributes;
export type CrashlyticsUser = import('./sentryService').SentryUser;

export { sentryService as crashlyticsService } from './sentryService';
export { sentryService as default } from './sentryService';
