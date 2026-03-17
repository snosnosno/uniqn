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

// Crashlytics Service
export {
  crashlyticsService,
  setEnabled as setCrashlyticsEnabled,
  recordError,
  recordFatalError,
  recordAppError,
  recordComponentError,
  recordNetworkError,
  log as crashlyticsLog,
  setAttribute as setCrashlyticsAttribute,
  setAttributes as setCrashlyticsAttributes,
  setUserId as setCrashlyticsUserId,
  setUser as setCrashlyticsUser,
  clearUser as clearCrashlyticsUser,
  setScreen as setCrashlyticsScreen,
  getBreadcrumbs,
  clearBreadcrumbs,
  type CrashSeverity,
  type CrashContext,
  type CrashlyticsAttributes,
  type CrashlyticsUser,
} from './crashlyticsService';

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
