/**
 * UNIQN Mobile - Firestore 필드명 상수
 *
 * @description Firestore 쿼리에 사용되는 필드명 중앙 관리
 * @version 1.0.0
 *
 * 사용 위치: Repository/Service의 where(), orderBy(), QueryBuilder
 *
 * @example
 * import { FIELDS } from '@/constants';
 * where(FIELDS.WORK_LOG.staffId, '==', staffId)
 * orderBy(FIELDS.COMMON.createdAt, 'desc')
 */

// ============================================================================
// 공통 필드 (여러 컬렉션에서 공유)
// ============================================================================

export const COMMON_FIELDS = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  status: 'status',
} as const;

// ============================================================================
// 도메인별 필드
// ============================================================================

export const USER_FIELDS = {
  ...COMMON_FIELDS,
  role: 'role',
  isActive: 'isActive',
  identityVerified: 'identityVerified',
  userId: 'userId',
} as const;

export const JOB_POSTING_FIELDS = {
  ...COMMON_FIELDS,
  ownerId: 'ownerId',
  postingType: 'postingType',
  locationDistrict: 'location.district',
  isUrgent: 'isUrgent',
  workDate: 'workDate',
  tournamentApprovalStatus: 'tournamentConfig.approvalStatus',
} as const;

export const APPLICATION_FIELDS = {
  ...COMMON_FIELDS,
  jobPostingId: 'jobPostingId',
  applicantId: 'applicantId',
} as const;

export const WORK_LOG_FIELDS = {
  ...COMMON_FIELDS,
  staffId: 'staffId',
  jobPostingId: 'jobPostingId',
  date: 'date',
  checkInTime: 'checkInTime',
  payrollStatus: 'payrollStatus',
} as const;

export const NOTIFICATION_FIELDS = {
  ...COMMON_FIELDS,
  recipientId: 'recipientId',
  isRead: 'isRead',
} as const;

export const EVENT_QR_FIELDS = {
  ...COMMON_FIELDS,
  jobPostingId: 'jobPostingId',
  date: 'date',
  action: 'action',
  isActive: 'isActive',
  securityCode: 'securityCode',
  expiresAt: 'expiresAt',
} as const;

export const REPORT_FIELDS = {
  ...COMMON_FIELDS,
  reporterId: 'reporterId',
  targetId: 'targetId',
  jobPostingId: 'jobPostingId',
} as const;

export const INQUIRY_FIELDS = {
  ...COMMON_FIELDS,
  userId: 'userId',
} as const;

export const ANNOUNCEMENT_FIELDS = {
  ...COMMON_FIELDS,
  isPinned: 'isPinned',
  priority: 'priority',
  publishedAt: 'publishedAt',
} as const;

export const TEMPLATE_FIELDS = {
  ...COMMON_FIELDS,
  createdBy: 'createdBy',
} as const;

// ============================================================================
// 통합 Export
// ============================================================================

export const FIELDS = {
  COMMON: COMMON_FIELDS,
  USER: USER_FIELDS,
  JOB_POSTING: JOB_POSTING_FIELDS,
  APPLICATION: APPLICATION_FIELDS,
  WORK_LOG: WORK_LOG_FIELDS,
  NOTIFICATION: NOTIFICATION_FIELDS,
  EVENT_QR: EVENT_QR_FIELDS,
  REPORT: REPORT_FIELDS,
  INQUIRY: INQUIRY_FIELDS,
  ANNOUNCEMENT: ANNOUNCEMENT_FIELDS,
  TEMPLATE: TEMPLATE_FIELDS,
} as const;
