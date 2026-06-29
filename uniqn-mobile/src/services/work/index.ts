/**
 * UNIQN Mobile - Work 도메인 서비스 배럴
 *
 * @description 근무 관련 서비스 통합 export
 * - scheduleService: 스케줄 조회/구독
 * - workLogService: 근무 기록 조회/수정/구독
 * - confirmedStaffService: 확정 스태프 관리 (구인자용)
 * - eventQRService: 현장 출퇴근 QR (구인자용)
 * - settlement: 정산 관리 (구인자용)
 *
 * @version 1.0.0
 */

// ============================================================================
// Schedule Service
// ============================================================================

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

// ============================================================================
// Work Log Service
// ============================================================================

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
  subscribeToWorkLog,
  subscribeToMyWorkLogs,
  subscribeToTodayWorkStatus,
  type WorkLogStats,
} from './workLogService';

// ============================================================================
// Confirmed Staff Service (구인자용)
// ============================================================================

export {
  getConfirmedStaff,
  getConfirmedStaffByDate,
  updateStaffRole,
  updateStaffStatus,
  updateWorkTime as updateConfirmedStaffWorkTime,
  cancelConfirmedStaffConfirmation,
  markAsNoShow,
  searchStaffByPhone,
  addDirectStaff,
  subscribeToConfirmedStaff,
  type GetConfirmedStaffResult,
} from './confirmedStaffService';

// ============================================================================
// Event QR Service (구인자용)
// ============================================================================

export {
  generateEventQR,
  validateEventQR,
  processEventQRCheckIn,
  processVenueQRCheckIn,
  getActiveEventQR,
  deactivateEventQR,
  cleanupExpiredQRCodes,
  getQRRemainingSeconds,
  stringifyQRData,
  QR_REFRESH_INTERVAL_MS,
} from './eventQRService';

// ============================================================================
// Settlement Service (구인자용 정산 관리)
// ============================================================================

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
  updateWorkLogCustomSettlement,
} from './settlement';
