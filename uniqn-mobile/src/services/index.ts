/**
 * UNIQN Mobile - 서비스 레이어 배럴 Export
 *
 * @version 1.0.0
 */

// Auth Domain (auth, storage, accountDeletion, biometric)
export * from './auth';

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

// Notifications Domain (notification, push, sync, inApp)
export * from './notifications';

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
// Observability (분석/모니터링/세션)
// ============================================================================
export * from './observability';

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
} from './adminService';

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
export { SettlementCalculator, TaxCalculator, SettlementCache } from '../domains/settlement';
export type {
  CalculationInput,
  SettlementResult as CalculatorSettlementResult,
  SettlementBreakdown,
  TaxBreakdown,
  TaxableAmounts,
  CachedSettlement,
} from '../domains/settlement';
