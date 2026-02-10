/**
 * UNIQN Functions - Firestore 쿼리용 상태값 런타임 상수
 *
 * @description Cloud Functions에서 사용하는 상태 상수
 * 모바일앱(uniqn-mobile/src/constants/statusValues.ts)과 동일한 값 유지
 */

export const STATUS = {
  JOB_POSTING: {
    ACTIVE: 'active',
    CLOSED: 'closed',
    CANCELLED: 'cancelled',
  },
  TOURNAMENT: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
  },
  PAYROLL: {
    COMPLETED: 'completed',
  },
  APPLICATION: {
    CANCELLED: 'cancelled',
  },
} as const;
