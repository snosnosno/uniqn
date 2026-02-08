/**
 * @file jobPosting.ts
 * @description 공고 관련 공용 타입 정의 (Functions 측)
 *
 * 클라이언트 측 타입: uniqn-mobile/src/types/jobPosting.ts
 * 두 파일의 ClosedReason 값을 동기화해야 합니다.
 */

/** 공고 마감 사유 */
export type ClosedReason = 'manual' | 'expired' | 'expired_by_work_date';

/** 공고 상태 */
export type JobPostingStatus = 'draft' | 'active' | 'closed' | 'cancelled';

/** 공고 타입 */
export type PostingType = 'regular' | 'urgent' | 'tournament' | 'fixed';
