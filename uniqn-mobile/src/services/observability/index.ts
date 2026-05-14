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
  recordError,
  recordFatalError,
  recordAppError,
  recordComponentError,
  recordNetworkError,
  getBreadcrumbs,
  clearBreadcrumbs,
  type SentrySeverity,
  type SentryContext,
  type SentryAttributes,
  type SentryUser,
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
  getSessionState,
  type SessionState,
} from './sessionService';

// Token Refresh Service
export * from './tokenRefreshService';
