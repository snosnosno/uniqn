/**
 * UNIQN Mobile - 서비스 레이어 배럴 Export
 *
 * 도메인별 폴더 구조:
 * - auth/          : 인증/계정
 * - jobs/          : 구인구직
 * - work/          : 근무/정산
 * - notifications/ : 알림
 * - observability/ : 분석/모니터링
 * - admin/         : 관리자
 *
 * ⚠️ `export *` 를 쓰지 않는다. 도메인 배럴을 통째로 재수출하면 실제로 아무도 쓰지 않는
 * 심볼까지 공개 표면에 올라가고, 중간 배럴이 사문(死文)으로 남는다. 여기에는 **실제
 * 소비되는 심볼만** 구현 모듈에서 직접 재수출한다. 새 심볼이 필요하면 이 목록에 추가하라.
 *
 * @version 3.0.0
 */

// ============================================================================
// auth 도메인
// ============================================================================

export {
  DELETION_GRACE_PERIOD_DAYS,
  DELETION_REASONS,
  getMyData,
  requestAccountDeletion,
  retryAppleTokenRevocation,
} from './auth/accountDeletionService';
export type { DeletionReason } from './auth/accountDeletionService';

export { getAppleLoginAvailability } from './auth/appleAuthService';
export type { AppleLoginAvailability } from './auth/appleAuthService';

export {
  adoptRecoverySessionFromUrl,
  checkNicknameExists,
  completePasswordReset,
  getCurrentUserAsync,
  getUserProfile,
  hasRecoverySession,
  login,
  resetPassword,
  signOut,
  signUp,
} from './auth/authCoreService';
export type { AuthResult, UserProfile } from './auth/authTypes';

export { callReverifyIdentity } from './auth/portOneIdentityService';

export { changePassword, updateProfilePhotoURL, updateUserProfile } from './auth/profileService';

export { completeSocialProfile, signInWithApple } from './auth/socialLoginService';

export { deleteProfileImage, replaceProfileImage } from './auth/storageService';

// ============================================================================
// jobs 도메인
// ============================================================================

export {
  bulkConfirmApplications,
  confirmApplication,
  getApplicantsByJobPosting,
  getApplicantStatsByRole,
  markApplicationAsRead,
  rejectApplication,
  subscribeToApplicantsAsync,
} from './jobs/applicantManagementService';
export type { ApplicantListResult, ApplicantWithDetails } from './jobs/applicantManagementService';

export {
  applyToJobV2,
  cancelApplication,
  getCancellationRequests,
  getMyApplications,
  hasAppliedToJob,
  requestCancellation,
  reviewCancellationRequest,
} from './jobs/applicationService';

export {
  bulkUpdateJobPostingStatus,
  closeJobPosting,
  createJobPosting,
  deleteJobPosting,
  getMyJobPostingStats,
  reopenJobPosting,
  updateJobPosting,
  updateJobPostingSettlementSettings,
} from './jobs/jobManagementService';

export {
  getJobPostingById,
  getJobPostings,
  getMyJobPostings,
  searchJobPostings,
  subscribeToJobPosting,
} from './jobs/jobService';

// ============================================================================
// work 도메인
// ============================================================================

export {
  addDirectStaff,
  cancelConfirmedStaffConfirmation,
  cancelNoShow,
  getConfirmedStaff,
  getConfirmedStaffByDate,
  markAsNoShow,
  searchStaffByNickname,
  subscribeToConfirmedStaff,
  updateStaffStatus,
  updateWorkTime as updateConfirmedStaffWorkTime,
} from './work/confirmedStaffService';
export type { GetConfirmedStaffResult } from './work/confirmedStaffService';

export {
  bulkSettlement,
  calculateSettlement,
  getJobPostingSettlementSummary,
  getWorkLogsByJobPosting,
  settleWorkLog,
  updateSettlementStatus,
  updateWorkLogCustomSettlement,
  updateWorkTimeForSettlement,
} from './work/settlement';
export type {
  BulkSettlementInput,
  CalculateSettlementInput,
  SettlementFilters,
  SettlementWorkLog,
  SettleWorkLogInput,
  UpdateWorkTimeInput,
} from './work/settlement';

// ============================================================================
// observability 도메인
// ============================================================================

export { trackSearch } from './observability/analyticsService';

// ============================================================================
// admin 도메인 — named exports로 incrementViewCount 충돌 회피
// (jobs/jobService와 admin/announcementService 모두 incrementViewCount를 export)
// ============================================================================

export {
  adminService,
  getDashboardStats,
  getUsers,
  getUserById,
  updateUserRole,
  setUserActive,
  getSystemMetrics,
  reportService,
  createReport,
  getReportById,
  reviewReport,
  getAllReports,
} from './admin';

// ============================================================================
// Root-level generic services
// ============================================================================

export * from './cacheService';
export * from './reviewService';
export * from './inquiryService';
export * from './versionService';
export * from './appConfigService';
export * from './boardService';

// ============================================================================
// 워크스페이스 협업 편집 (PR #2)
// ============================================================================

export {
  workspaceService,
  workspaceInvitationService,
  type InviteWorkspaceMemberOptions,
  type InviteWorkspaceMemberResult,
} from './workspace';
