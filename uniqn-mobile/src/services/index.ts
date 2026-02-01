/**
 * UNIQN Mobile - 서비스 레이어 배럴 Export
 *
 * @version 1.0.0
 */

// Auth Service
export {
  login,
  signUp,
  signOut,
  resetPassword,
  getUserProfile,
  updateUserProfile,
  reauthenticate,
  getCurrentUser,
  onAuthStateChanged,
  signInWithApple,
  signInWithGoogle,
  signInWithKakao,
  changePassword,
  updateProfilePhotoURL,
  type UserProfile,
  type AuthResult,
} from './authService';

// Storage Service
export {
  uploadProfileImage,
  deleteProfileImage,
  replaceProfileImage,
  type UploadResult,
} from './storageService';

// Job Service
export {
  getJobPostings,
  getJobPostingById,
  incrementViewCount,
  searchJobPostings,
  getUrgentJobPostings,
  getMyJobPostings,
  convertToCard,
  type PaginatedJobPostings,
} from './jobService';

// Application Service
export {
  applyToJobV2,
  getMyApplications,
  getApplicationById,
  cancelApplication,
  hasAppliedToJob,
  getApplicationStats,
  requestCancellation,
  reviewCancellationRequest,
  getCancellationRequests,
  type ApplicationWithJob,
} from './applicationService';

// Application History Service (확정/취소 이력 관리)
export {
  confirmApplicationWithHistory,
  cancelConfirmation,
  getOriginalApplicationData,
  getConfirmedSelections,
  isV2Application,
  getApplicationHistorySummary,
  type ConfirmWithHistoryResult,
  type CancelConfirmationResult,
} from './applicationHistoryService';

// Applicant Conversion Service (지원자→스태프 변환)
export {
  convertApplicantToStaff,
  batchConvertApplicants,
  isAlreadyStaff,
  canConvertToStaff,
  revertStaffConversion,
  type ConversionResult,
  type BulkConversionResult,
  type ConversionOptions,
} from './applicantConversionService';

// Account Deletion Service
export {
  requestAccountDeletion,
  cancelAccountDeletion,
  getMyData,
  updateMyData,
  exportMyData,
  getDeletionStatus,
  DELETION_REASONS,
  type DeletionReason,
  type DeletionRequest,
  type UserData,  // @deprecated - FirestoreUserProfile 사용 권장
  type UserDataExport,
} from './accountDeletionService';

// Schedule Service
export {
  getMySchedules,
  getSchedulesByDate,
  getSchedulesByMonth,
  getScheduleById,
  getTodaySchedules,
  getUpcomingSchedules,
  getScheduleStats,
  subscribeToSchedules,
  groupSchedulesByDate,
  getCalendarMarkedDates,
  type ScheduleQueryResult,
} from './scheduleService';

// Work Log Service
export {
  getMyWorkLogs,
  getWorkLogsByDate,
  getWorkLogById,
  getTodayCheckedInWorkLog,
  isCurrentlyWorking,
  getWorkLogStats,
  getMonthlyPayroll,
  updateWorkTime,
  updatePayrollStatus,
  type WorkLogStats,
} from './workLogService';
// @deprecated checkIn, checkOut 함수 제거됨 - eventQRService.processEventQRCheckIn 사용
// @deprecated QR Code Service가 삭제되었습니다.
// Event QR 시스템을 사용하세요: eventQRService의 generateEventQR, validateEventQR 등
// QR 관련 타입은 @/types에서 import: QRCodeAction, EventQRCode, EventQRDisplayData 등

// Notification Service
export {
  notificationService,
  fetchNotifications,
  getUnreadCount,
  getNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteNotifications,
  cleanupOldNotifications,
  subscribeToNotifications,
  subscribeToUnreadCount,
  getNotificationSettings,
  saveNotificationSettings,
  checkNotificationPermission,
  requestNotificationPermission,
  registerFCMToken,
  unregisterFCMToken,
  unregisterAllFCMTokens,
} from './notificationService';

// ============================================================================
// 구인자용 서비스 (Employer Services)
// ============================================================================

// Job Management Service (구인자용 공고 관리)
export {
  createJobPosting,
  updateJobPosting,
  deleteJobPosting,
  closeJobPosting,
  reopenJobPosting,
  getMyJobPostingStats,
  bulkUpdateJobPostingStatus,
  type CreateJobPostingResult,
  type JobPostingStats,
} from './jobManagementService';

// Template Service (공고 템플릿 관리)
export {
  getTemplates,
  saveTemplate,
  loadTemplate,
  deleteTemplate,
  updateTemplate,
} from './templateService';

// Applicant Management Service (구인자용 지원자 관리)
export {
  getApplicantsByJobPosting,
  subscribeToApplicants,
  subscribeToApplicantsAsync,
  verifyJobPostingOwnership,
  confirmApplication,
  rejectApplication,
  bulkConfirmApplications,
  markApplicationAsRead,
  getApplicantStatsByRole,
  type ApplicantWithDetails,
  type ApplicantListResult,
  type ConfirmResult,
  type BulkConfirmResult,
  type SubscribeToApplicantsCallbacks,
} from './applicantManagementService';

// Settlement Service (구인자용 정산 관리) - Phase 3 분할 완료
export {
  getWorkLogsByJobPosting,
  calculateSettlement,
  updateWorkTimeForSettlement,
  settleWorkLog,
  bulkSettlement,
  updateSettlementStatus,
  getJobPostingSettlementSummary,
  getMySettlementSummary,
  type SettlementWorkLog,
  type CalculateSettlementInput,
  type SettlementCalculation,
  type SettleWorkLogInput,
  type BulkSettlementInput,
  type SettlementResult,
  type BulkSettlementResult,
  type JobPostingSettlementSummary,
  type UpdateWorkTimeInput,
  type SettlementFilters,
} from './settlement';

// ============================================================================
// Analytics & Deep Link Services
// ============================================================================

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
  createApplicationDeepLink, // deprecated
  createScheduleDeepLink, // deprecated
  setupDeepLinkListener,
  getInitialDeepLink,
  openExternalUrl,
  linkingConfig, // deprecated
  APP_SCHEME,
  WEB_DOMAIN,
  type DeepLinkRoute,
  type ParsedDeepLink,
} from './deepLinkService';

// Deep Link Shared Module (v2.0)
export {
  RouteMapper,
  EXPO_ROUTES,
  NOTIFICATION_ROUTE_MAP,
  getRouteForNotificationType,
  isAdminOnlyNotification,
  isEmployerOnlyNotification,
  type NavigationContext,
} from '@/shared/deeplink';

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

// Push Notification Service
export {
  pushNotificationService,
  initialize as initializePushNotifications,
  checkPermission as checkPushPermission,
  requestPermission as requestPushPermission,
  getToken as getPushToken,
  registerToken as registerPushToken,
  unregisterToken as unregisterPushToken,
  getCurrentToken,
  setBadge,
  clearBadge,
  getBadge,
  scheduleLocalNotification,
  cancelScheduledNotification,
  cancelAllScheduledNotifications,
  dismissAllNotifications,
  setNotificationReceivedHandler,
  setNotificationResponseHandler,
  cleanup as cleanupPushNotifications,
  DEFAULT_CHANNELS,
  type NotificationPermissionStatus as PushPermissionStatus,
  type PushTokenResult,
  type NotificationPayload,
  type NotificationReceivedHandler,
  type NotificationResponseHandler,
  type NotificationChannel,
} from './pushNotificationService';

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

// Feature Flag Service
export {
  featureFlagService,
  whenEnabled,
  selectByFlag,
  type FeatureFlags,
  type FeatureFlagKey,
} from './featureFlagService';

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

// Confirmed Staff Service (구인자용 확정 스태프 관리)
export {
  getConfirmedStaff,
  getConfirmedStaffByDate,
  updateStaffRole,
  updateWorkTime as updateConfirmedStaffWorkTime,
  deleteConfirmedStaff,
  markAsNoShow,
  updateStaffStatus,
  subscribeToConfirmedStaff,
  type GetConfirmedStaffResult,
  type RoleChangeHistoryEntry,
} from './confirmedStaffService';

// Event QR Service (구인자용 현장 출퇴근 QR)
// 타입은 @/types에서 import하세요: EventQRCode, EventQRDisplayData, etc.
export {
  generateEventQR,
  validateEventQR,
  processEventQRCheckIn,
  getActiveEventQR,
  deactivateEventQR,
  cleanupExpiredQRCodes,
  getQRRemainingSeconds,
  stringifyQRData,
  QR_REFRESH_INTERVAL_MS,
} from './eventQRService';

// ============================================================================
// 관리자 서비스 (Admin Services)
// ============================================================================

// Admin Service (관리자 대시보드 및 사용자 관리)
export {
  adminService,
  getDashboardStats,
  getUsers,
  getUserById,
  updateUserRole,
  setUserActive,
  getSystemMetrics,
} from "./adminService";

// Report Service (스태프 신고 관리)
export {
  reportService,
  createReport,
  getReportsByJobPosting,
  getReportsByStaff,
  getMyReports,
  getReportById,
  reviewReport,
  getReportCountByStaff,
} from './reportService';

// ============================================================================
// 도메인 레이어 Re-export (Phase 7)
// ============================================================================

/**
 * @description 도메인 레이어의 주요 클래스 및 유틸리티를 services에서도 사용 가능하게 re-export
 * 하위 호환성 유지를 위해 제공
 */

// Schedule Domain (Phase 5)
export { ScheduleMerger } from '../domains/schedule';
export type {
  MergeOptions,
  DateGroup,
  ApplicationGroup,
  GroupByApplicationResult,
  GroupByApplicationOptions,
  MergerScheduleStats,
} from '../domains/schedule';

// Settlement Domain (Phase 6)
export {
  SettlementCalculator,
  TaxCalculator,
  SettlementCache,
} from '../domains/settlement';
export type {
  CalculationInput,
  SettlementResult as CalculatorSettlementResult,
  SettlementBreakdown,
  TaxBreakdown,
  TaxableAmounts,
  CachedSettlement,
} from '../domains/settlement';

