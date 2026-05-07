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
 * @version 2.0.0
 */

// Domain barrels
export * from './auth';
export * from './jobs';
export * from './work';
export * from './notifications';
export * from './observability';

// Admin Domain — named exports로 incrementViewCount 충돌 회피
// (jobs/jobService와 admin/announcementService 모두 incrementViewCount를 export)
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
  getReportsByJobPosting,
  getReportsByStaff,
  getMyReports,
  getReportById,
  reviewReport,
  getReportCountByStaff,
  getAllReports,
} from './admin';

// Root-level generic services
export * from './cacheService';
export * from './reviewService';
export * from './inquiryService';
export * from './versionService';
export * from './boardService';

// 워크스페이스 협업 편집 (PR #2)
export {
  workspaceService,
  workspaceInvitationService,
  type InviteWorkspaceMemberOptions,
  type InviteWorkspaceMemberResult,
} from './workspace';
