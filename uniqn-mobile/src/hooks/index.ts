/**
 * UNIQN Mobile - Hook barrel exports
 */

export { useAppInitialize } from './useAppInitialize';
export { useVersionCheck, type UseVersionCheckReturn } from './useVersionCheck';
export { useWeeklyGridEnabled, type UseWeeklyGridEnabledReturn } from './useWeeklyGridEnabled';

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
  useCalendarView,
} from './useSchedules';

export {
  useWorkLogs,
  useWorkLogsByDate,
  useWorkLogDetail,
  useCurrentWorkStatus,
  useWorkLogStats,
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
  useWorkLogsByJobPosting,
  useSettlementSummary,
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
export {
  useConfirmedStaff,
  type UseConfirmedStaffOptions,
  type UseConfirmedStaffReturn,
} from './useConfirmedStaff';
export { useStaffPhoneSearch, type UseStaffPhoneSearchReturn } from './useStaffPhoneSearch';
export { useEventQR, type UseEventQROptions, type UseEventQRReturn } from './useEventQR';

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
