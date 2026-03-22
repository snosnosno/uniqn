/**
 * UNIQN Mobile - Hook barrel exports
 */

export { useAppInitialize } from './useAppInitialize';
export { useVersionCheck, type UseVersionCheckReturn } from './useVersionCheck';

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

export { useJobPostings } from './useJobPostings';
export { useJobDetail } from './useJobDetail';
export { useApplications } from './useApplications';
export {
  usePostingTypeCounts,
  AUTO_SELECT_PRIORITY,
  type PostingTypeAvailability,
} from './usePostingTypeCounts';

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

export {
  useWorkLogs,
  useWorkLogsByDate,
  useWorkLogDetail,
  useCurrentWorkStatus,
  useWorkLogStats,
  useMonthlyPayroll,
} from './useWorkLogs';
export { useQRCodeScanner, useQRScannerModal, useQRDisplayModal } from './useQRCode';

export {
  useNotificationHandler,
  type UseNotificationHandlerOptions,
  type UseNotificationHandlerReturn,
} from './useNotificationHandler';
export {
  useNotificationList,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
  useNotificationSettingsQuery,
  useSaveNotificationSettings,
  useNotificationPermission,
} from './useNotifications';

export {
  useDeepLinkSetup,
  useNotificationNavigation,
  useDeepLinkNavigation,
  usePendingDeepLink,
} from './useDeepLink';

export { useShare, type ShareJobParams, type ShareResult, type UseShareReturn } from './useShare';
export { useClearCache, type UseClearCacheReturn } from './useClearCache';
export { useBookmarks, type BookmarkJobParams, type UseBookmarksReturn } from './useBookmarks';
export {
  useAutoLogin,
  checkAutoLoginEnabled,
  AUTO_LOGIN_HELPER_TEXT,
  type UseAutoLoginReturn,
} from './useAutoLogin';
export { useBiometricAuth, type UseBiometricAuthReturn } from './useBiometricAuth';

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
export {
  useTemplateManager,
  useTemplates,
  useSaveTemplate,
  useLoadTemplate,
  useDeleteTemplate,
} from './useTemplateManager';
export {
  useApplicantManagement,
  useApplicantsByJobPosting,
  useApplicantStats,
  useConfirmApplication,
  useRejectApplication,
  useBulkConfirmApplications,
  useMarkAsRead as useMarkApplicationAsRead,
  useConfirmApplicationWithHistory,
  useCancelConfirmation,
  useCancellationRequests,
  useReviewCancellation,
  type UseApplicantManagementOptions,
  type UseApplicantsByJobPostingOptions,
} from './applicant';

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
export {
  useSettlementDateNavigation,
  type UseSettlementDateNavigationResult,
} from './useSettlementDateNavigation';
export { useAllowances, type UseAllowancesResult } from './useAllowances';
export {
  useConfirmedStaff,
  type UseConfirmedStaffOptions,
  type UseConfirmedStaffReturn,
} from './useConfirmedStaff';
export { useEventQR, type UseEventQROptions, type UseEventQRReturn } from './useEventQR';

export {
  useAssignmentSelection,
  type UseAssignmentSelectionOptions,
  type UseAssignmentSelectionReturn,
} from './useAssignmentSelection';
export { useRealtimeQuery, useRealtimeCollection, useRealtimeDocument } from './useRealtimeQuery';

export {
  useAdminDashboard,
  useAdminDashboardStats,
  useAdminUsers,
  useAdminUserDetail,
  useUpdateUserRole,
  useSetUserActive,
  useSystemMetrics,
} from './useAdminDashboard';

export {
  useTournamentApproval,
  useTournamentDetail,
  useTournamentsByStatus,
} from './useTournamentApproval';

export { useJobSchedule, type UseJobScheduleResult } from './useJobSchedule';
export { useJobRoles, type UseJobRolesResult } from './useJobRoles';
export { useUserProfile } from './useUserProfile';
export { useUnsavedChangesGuard } from './useUnsavedChangesGuard';
