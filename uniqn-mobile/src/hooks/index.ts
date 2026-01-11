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
export { useVersionCheck, type UseVersionCheckReturn } from './useVersionCheck';

// ============================================================================
// Auth & Navigation Hooks
// ============================================================================

export { useAuth } from './useAuth';

export {
  useAuthGuard,
  useHasPermission,
  useIsAdmin,
  useIsEmployer,
  useIsStaff,
} from './useAuthGuard';

export {
  useNavigationTracking,
  useCurrentScreen,
  useNavigationCount,
} from './useNavigationTracking';

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

// ============================================================================
// Notification Hooks
// ============================================================================

export {
  useNotificationList,
  useNotificationRealtime,
  useUnreadCountRealtime,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
  useNotificationSettingsQuery,
  useSaveNotificationSettings,
  useNotificationPermission,
} from './useNotifications';

// ============================================================================
// Deep Link Hooks
// ============================================================================

export {
  useDeepLinkSetup,
  useNotificationNavigation,
  useDeepLinkNavigation,
  usePendingDeepLink,
} from './useDeepLink';

// ============================================================================
// Employer Hooks (구인자용 훅)
// ============================================================================

// Job Management (공고 관리)
export {
  useJobManagement,
  useMyJobPostings,
  useJobPostingStats,
  useCreateJobPosting,
  useUpdateJobPosting,
  useDeleteJobPosting,
  useCloseJobPosting,
  useReopenJobPosting,
  useBulkUpdateStatus,
} from './useJobManagement';

// Template Management (템플릿 관리)
export {
  useTemplateManager,
  useTemplates,
  useSaveTemplate,
  useLoadTemplate,
  useDeleteTemplate,
} from './useTemplateManager';

// Applicant Management (지원자 관리)
export {
  useApplicantManagement,
  useApplicantsByJobPosting,
  useApplicantStats,
  useConfirmApplication,
  useRejectApplication,
  useBulkConfirmApplications,
  useAddToWaitlist,
  usePromoteFromWaitlist,
  useMarkAsRead as useMarkApplicationAsRead,
} from './useApplicantManagement';

// Settlement (정산 관리)
export {
  useSettlement,
  useSettlementDashboard,
  useWorkLogsByJobPosting,
  useSettlementSummary,
  useMySettlementSummary,
  useCalculateSettlement,
  useUpdateWorkTime,
  useSettleWorkLog,
  useBulkSettlement,
  useUpdateSettlementStatus,
} from './useSettlement';

// ============================================================================
// Feature Flag Hooks
// ============================================================================

export {
  useFeatureFlag,
  useFeatureFlagWithStatus,
  useFeatureFlags,
  useAllFeatureFlags,
  useMaintenanceMode,
  useWhenEnabled,
} from './useFeatureFlag';

// ============================================================================
// Assignment v2.0 Hooks
// ============================================================================

export {
  useAssignmentSelection,
  type UseAssignmentSelectionOptions,
  type UseAssignmentSelectionReturn,
} from './useAssignmentSelection';

// ============================================================================
// Realtime Query Integration Hooks
// ============================================================================

export {
  useRealtimeQuery,
  useRealtimeCollection,
  useRealtimeDocument,
} from './useRealtimeQuery';

// ============================================================================
// Admin Dashboard Hooks
// ============================================================================

export {
  useAdminDashboard,
  useAdminDashboardStats,
  useAdminUsers,
  useAdminUserDetail,
  useUpdateUserRole,
  useSetUserActive,
  useSystemMetrics,
} from './useAdminDashboard';
