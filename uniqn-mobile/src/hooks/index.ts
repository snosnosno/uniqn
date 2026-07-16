/**
 * UNIQN Mobile - Hook barrel exports
 */

export { useAppInitialize } from './useAppInitialize';
export { useVersionCheck, type UseVersionCheckReturn } from './useVersionCheck';
export { useWeeklyGridEnabled, type UseWeeklyGridEnabledReturn } from './useWeeklyGridEnabled';
// ⚠️ 리프 UI 컴포넌트에서는 이 barrel(@/hooks) 대신 '@/hooks/useReduceMotion' 직접 경로로
// import할 것 — barrel 첫 export(useAppInitialize)가 도메인 그래프를 끌어와
// ApplicationStatusMachine의 모듈스코프 STATUS.* 순환-undefined 크래시를 유발한다(2026-07-17 실측).
export { useReduceMotion } from './useReduceMotion';

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
export { useApplications, useHasAppliedToJob } from './useApplications';
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

export { useShare, type ShareResult, type UseShareReturn } from './useShare';
export { useInstallPrompt, type InstallPromptSource } from './useInstallPrompt';
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
  useAndroidOrientationPolicy,
  resolveAndroidOrientationPolicy,
  type AndroidOrientationPolicy,
} from './useAndroidOrientationPolicy';

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
export { useTemplateManager, useTemplates } from './useTemplateManager';
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
export { useStaffPhoneSearch, type UseStaffPhoneSearchReturn } from './useStaffPhoneSearch';
export { useEventQR, type UseEventQROptions, type UseEventQRReturn } from './useEventQR';

export {
  useAssignmentSelection,
  type UseAssignmentSelectionOptions,
  type UseAssignmentSelectionReturn,
} from './useAssignmentSelection';

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
export { useUserProfile } from './useUserProfile';
export { useUnsavedChangesGuard } from './useUnsavedChangesGuard';
export {
  useBoardHome,
  useBoardPosts,
  useBoardPostDetail,
  useIncrementBoardViewCount,
  useCreateBoardPost,
  useUpdateBoardPost,
  useSetBoardPostLock,
  useHideBoardPost,
  useCreateBoardComment,
  useUpdateBoardComment,
  useSetBoardCommentStatus,
  useSetBoardCommentPinned,
  useToggleBoardPostVote,
  useToggleBoardCommentReaction,
  useCreateBoardReport,
} from './useBoard';
