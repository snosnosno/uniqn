/**
 * UNIQN Mobile - Hooks 배럴 Export
 *
 * @description 커스텀 훅 모음
 * @version 1.0.0
 */

// ============================================================================
// App Lifecycle Hooks
// ============================================================================

export { useAppInitialize } from './useAppInitialize';

// ============================================================================
// Auth & Navigation Hooks
// ============================================================================

export {
  useAuthGuard,
  useHasPermission,
  useIsAdmin,
  useIsEmployer,
  useIsStaff,
} from './useAuthGuard';

// ============================================================================
// Job & Application Hooks
// ============================================================================

export { useJobPostings } from './useJobPostings';
export { useJobDetail } from './useJobDetail';
export { useApplications } from './useApplications';

// ============================================================================
// Schedule Hooks
// ============================================================================

export {
  useSchedules,
  useSchedulesByMonth,
  useSchedulesByDate,
  useScheduleDetail,
  useTodaySchedules,
  useUpcomingSchedules,
  useScheduleStats,
  useCalendarView,
} from './useSchedules';

// ============================================================================
// Work Log Hooks
// ============================================================================

export {
  useWorkLogs,
  useWorkLogsByDate,
  useWorkLogDetail,
  useCurrentWorkStatus,
  useWorkLogStats,
  useMonthlyPayroll,
  useCheckIn,
  useCheckOut,
  useAttendance,
} from './useWorkLogs';

// ============================================================================
// QR Code Hooks
// ============================================================================

export {
  useCreateQRCode,
  useQRCodeScanner,
  useValidateQRCode,
  useQRScannerModal,
  useQRDisplayModal,
  useQRAutoRefresh,
} from './useQRCode';
