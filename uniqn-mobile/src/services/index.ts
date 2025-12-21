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
