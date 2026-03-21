/**
 * Observability 도메인 — 분석/모니터링/세션
 */

// Analytics Service
export {
  analyticsService,
  trackEvent,
  trackScreenView,
  setUserProperties,
  setUserId,
  setAnalyticsEnabled,
  trackLogin,
  trackSignup,
  trackLogout,
  trackJobView,
  trackJobApply,
  trackJobCreate,
  trackCheckIn,
  trackCheckOut,
  trackSettlementComplete,
  trackSearch,
  trackError,
  type AnalyticsEvent,
  type AnalyticsEventParams,
  type UserProperties as AnalyticsUserProperties,
} from './analyticsService';

// Sentry Service (canonical)
export {
  sentryService,
  setEnabled as setSentryEnabled,
  crashlyticsService,
  recordHandledError,
  setEnabled as setCrashlyticsEnabled,
  recordError,
  recordFatalError,
  recordAppError,
  recordComponentError,
  recordNetworkError,
  log as sentryLog,
  log as crashlyticsLog,
  setAttribute as setSentryAttribute,
  setAttribute as setCrashlyticsAttribute,
  setAttributes as setSentryAttributes,
  setAttributes as setCrashlyticsAttributes,
  setUserId as setSentryUserId,
  setUserId as setCrashlyticsUserId,
  setUser as setSentryUser,
  setUser as setCrashlyticsUser,
  clearUser as clearSentryUser,
  clearUser as clearCrashlyticsUser,
  setScreen as setSentryScreen,
  setScreen as setCrashlyticsScreen,
  getBreadcrumbs,
  clearBreadcrumbs,
  type SentrySeverity,
  type SentryContext,
  type SentryAttributes,
  type SentryUser,
  type CrashSeverity,
  type CrashContext,
  type CrashlyticsAttributes,
  type CrashlyticsUser,
} from './sentryService';

// Performance Service
export {
  performanceService,
  startScreenTrace,
  startApiTrace,
  startTrace,
  stopTrace,
  recordMetric,
  measureAsync,
  measure,
  recordNavigationTime,
  recordRenderTime,
  setPerformanceEnabled,
  type PerformanceTrace,
  type PerformanceMetrics,
} from './performanceService';

// Deep Link Service
export {
  deepLinkService,
  parseDeepLink,
  navigateToDeepLink,
  navigateFromNotification,
  getRouteFromNotification,
  validateNotificationLink,
  createDeepLink,
  createJobDeepLink,
  setupDeepLinkListener,
  getInitialDeepLink,
  openExternalUrl,
  waitForNavigationReadyAsync,
  APP_SCHEME,
  WEB_DOMAIN,
  type DeepLinkRoute,
  type ParsedDeepLink,
} from './deepLinkService';

// Session Service
export {
  sessionService,
  initialize as initializeSession,
  cleanup as cleanupSession,
  recordActivity,
  isSessionActive,
  getSessionState,
  refreshToken,
  getValidToken,
  checkLoginAttempts,
  incrementLoginAttempts,
  resetLoginAttempts,
  getRemainingLoginAttempts,
  type SessionState,
  type LoginAttempts,
} from './sessionService';

// Token Refresh Service
export * from './tokenRefreshService';
