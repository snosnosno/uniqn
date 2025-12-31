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
  type UserProfile,
  type AuthResult,
} from './authService';

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
  applyToJob,
  getMyApplications,
  getApplicationById,
  cancelApplication,
  hasAppliedToJob,
  getApplicationStats,
  type ApplicationWithJob,
} from './applicationService';

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
  type UserData,
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
  checkIn,
  checkOut,
  updateWorkTime,
  updatePayrollStatus,
  type CheckInResult,
  type CheckOutResult,
  type QRCodeData as WorkLogQRCodeData,
  type WorkLogStats,
} from './workLogService';

// QR Code Service
export {
  createQRCode,
  validateQRCode,
  getQRCodeById,
} from './qrCodeService';

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
  saveDraft,
  getDraft,
  deleteDraft,
  getMyJobPostingStats,
  bulkUpdateJobPostingStatus,
  type JobPostingDraft,
  type CreateJobPostingResult,
  type JobPostingStats,
} from './jobManagementService';

// Applicant Management Service (구인자용 지원자 관리)
export {
  getApplicantsByJobPosting,
  confirmApplication,
  rejectApplication,
  bulkConfirmApplications,
  addToWaitlist,
  promoteFromWaitlist,
  markApplicationAsRead,
  getApplicantStatsByRole,
  type ApplicantWithDetails,
  type ApplicantListResult,
  type ConfirmResult,
  type BulkConfirmResult,
} from './applicantManagementService';

// Settlement Service (구인자용 정산 관리)
export {
  getWorkLogsByJobPosting,
  calculateSettlement,
  updateWorkTime as updateWorkTimeForSettlement,
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
} from './settlementService';

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
  createDeepLink,
  createJobDeepLink,
  createApplicationDeepLink,
  createScheduleDeepLink,
  setupDeepLinkListener,
  getInitialDeepLink,
  openExternalUrl,
  linkingConfig,
  APP_SCHEME,
  WEB_DOMAIN,
  type DeepLinkRoute,
  type ParsedDeepLink,
} from './deepLinkService';

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
