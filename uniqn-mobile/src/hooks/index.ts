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
export {
  usePostingTypeCounts,
  AUTO_SELECT_PRIORITY,
  type PostingTypeAvailability,
} from './usePostingTypeCounts';

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
} from './useWorkLogs';
// @deprecated useCheckIn, useCheckOut, useAttendance 제거됨 - QR 스캔으로만 출퇴근

// ============================================================================
// QR Code Hooks
// ============================================================================

// 스태프용 QR 스캔 훅
export { useQRCodeScanner, useQRScannerModal, useQRDisplayModal } from './useQRCode';

// 구인자용 QR 생성 훅 (useEventQR는 Employer Hooks 섹션에서 export)

// ============================================================================
// Notification Hooks
// ============================================================================

export {
  useNotificationHandler,
  type UseNotificationHandlerOptions,
  type UseNotificationHandlerReturn,
} from './useNotificationHandler';

export {
  useNotificationList,
  useNotificationRealtime,
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
// Share Hooks
// ============================================================================

export { useShare, type ShareJobParams, type ShareResult, type UseShareReturn } from './useShare';

// ============================================================================
// Cache Management Hooks
// ============================================================================

export { useClearCache, type UseClearCacheReturn } from './useClearCache';

// ============================================================================
// Bookmark Hooks
// ============================================================================

export { useBookmarks, type BookmarkJobParams, type UseBookmarksReturn } from './useBookmarks';

// ============================================================================
// Auto Login Hooks
// ============================================================================

export { useAutoLogin, checkAutoLoginEnabled, type UseAutoLoginReturn } from './useAutoLogin';

// ============================================================================
// Biometric Auth Hooks
// ============================================================================

export { useBiometricAuth, type UseBiometricAuthReturn } from './useBiometricAuth';

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

// Applicant Management (지원자 관리) - Phase 3 분할 완료
export {
  useApplicantManagement,
  useApplicantsByJobPosting,
  useApplicantStats,
  useConfirmApplication,
  useRejectApplication,
  useBulkConfirmApplications,
  useMarkAsRead as useMarkApplicationAsRead,
  // v2.0 히스토리 기반 확정/취소
  useConfirmApplicationWithHistory,
  useCancelConfirmation,
  // 취소 요청 관리
  useCancellationRequests,
  useReviewCancellation,
  // 스태프 변환
  useConvertToStaff,
  useBatchConvertToStaff,
  useCanConvertToStaff,
  type UseApplicantManagementOptions,
  type UseApplicantsByJobPostingOptions,
} from './applicant';

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

// Settlement Date Navigation (정산 날짜 네비게이션)
export {
  useSettlementDateNavigation,
  type UseSettlementDateNavigationResult,
} from './useSettlementDateNavigation';

// Allowances (수당 관리)
export { useAllowances, type UseAllowancesResult } from './useAllowances';

// Confirmed Staff (확정 스태프 관리)
export {
  useConfirmedStaff,
  type UseConfirmedStaffOptions,
  type UseConfirmedStaffReturn,
} from './useConfirmedStaff';

// Event QR (현장 출퇴근 QR)
export { useEventQR, type UseEventQROptions, type UseEventQRReturn } from './useEventQR';

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

export { useRealtimeQuery, useRealtimeCollection, useRealtimeDocument } from './useRealtimeQuery';

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

// ============================================================================
// Tournament Approval Hooks (대회공고 승인)
// ============================================================================

export {
  useTournamentApproval,
  useTournamentDetail,
  useTournamentsByStatus,
} from './useTournamentApproval';

// ============================================================================
// 공고 데이터 정규화 Hooks
// ============================================================================

export { useJobSchedule, type UseJobScheduleResult } from './useJobSchedule';

export { useJobRoles, type UseJobRolesResult } from './useJobRoles';

// ============================================================================
// User Profile Hooks (사용자 프로필 조회)
// ============================================================================

export { useUserProfile } from './useUserProfile';

// ============================================================================
// Form Guard Hooks
// ============================================================================

export { useUnsavedChangesGuard } from './useUnsavedChangesGuard';
