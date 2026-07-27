/**
 * UNIQN Mobile - 캐시 무효화 전략
 *
 * @description Phase 2.3 - 이벤트 기반 캐시 무효화 중앙화
 * @version 1.0.0
 *
 * 사용법:
 * 1. 뮤테이션 성공 후 관련 캐시 자동 무효화
 * 2. 이벤트 발생 시 연관된 모든 쿼리 그룹 자동 무효화
 *
 * @example
 * // 뮤테이션 onSuccess에서 사용
 * onSuccess: () => {
 *   invalidateRelated('application.create');
 * }
 *
 * // 수동으로 특정 이벤트 관련 캐시 무효화
 * invalidateRelated('applicant.confirm', { jobPostingId: 'job123' });
 */

import { queryClient, queryKeys } from './queryClient';
import { POSTING_FILLED_COUNTS_QUERY_KEY } from '@/hooks/postingFilledCountsKey';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * 무효화 이벤트 타입
 *
 * 네이밍 컨벤션: [도메인].[액션]
 */
export type InvalidationEvent =
  // 지원 관련
  | 'application.create'
  | 'application.cancel'
  | 'application.requestCancellation'
  // 지원자 관리 (구인자)
  | 'applicant.confirm'
  | 'applicant.reject'
  | 'applicant.bulkConfirm'
  | 'applicant.reviewCancellation'
  // 공고 관리
  | 'jobPosting.create'
  | 'jobPosting.update'
  | 'jobPosting.delete'
  | 'jobPosting.close'
  // 근무 기록
  | 'workLog.checkIn'
  | 'workLog.checkOut'
  | 'workLog.create'
  | 'workLog.update'
  // 정산
  | 'settlement.process'
  | 'settlement.bulkProcess'
  // 알림
  | 'notification.markAsRead'
  | 'notification.markAllAsRead'
  // 프로필
  | 'profile.update'
  // 리뷰/평가
  | 'review.create'
  // 관리자
  | 'admin.tournament.approve'
  | 'admin.tournament.reject'
  | 'admin.announcement.create'
  | 'admin.announcement.update'
  | 'admin.user.update';

/**
 * 무효화 컨텍스트 (선택적 파라미터)
 */
export interface InvalidationContext {
  /** 공고 ID */
  jobPostingId?: string;
  /** 지원서 ID */
  applicationId?: string;
  /** 근무기록 ID */
  workLogId?: string;
  /** 사용자 ID */
  userId?: string;
  /** 날짜 (YYYY-MM-DD) */
  date?: string;
  /** 피평가자 ID (리뷰) */
  revieweeId?: string;
}

/**
 * 무효화 대상 타입
 */
type InvalidationTarget =
  | 'applications.all'
  | 'applications.mine'
  | 'applications.byJobPosting'
  | 'jobPostings.all'
  | 'jobPostings.detail'
  | 'jobPostings.mine'
  | 'schedules.all'
  | 'schedules.mine'
  | 'workLogs.all'
  | 'workLogs.mine'
  | 'confirmedStaff.all'
  | 'confirmedStaff.byJobPosting'
  | 'settlement.all'
  | 'settlement.byJobPosting'
  | 'applicantManagement.all'
  | 'applicantManagement.byJobPosting'
  | 'applicantManagement.cancellationRequests'
  | 'notifications.all'
  | 'notifications.unreadCount'
  | 'user.profile'
  | 'tournaments.all'
  | 'announcements.all'
  | 'reviews.all'
  | 'reviews.byWorkLog'
  | 'reviews.myGiven'
  | 'reviews.pending'
  | 'reviews.bubbleScore'
  | 'admin.all'
  // 공고 인원 카운트 — count_posting_confirmed_by_slot(work_logs 기준) 파생
  | 'postingFilledCounts.all'
  // 근무표 — get_venue_grid_summary(work_logs + job_postings.schedule) 파생
  | 'workSchedule.all';

// ============================================================================
// Invalidation Graph
// ============================================================================

/**
 * 이벤트-쿼리 무효화 그래프
 *
 * 각 이벤트 발생 시 어떤 쿼리를 무효화해야 하는지 정의
 * - 그래프 기반으로 연관 데이터 일관성 유지
 * - 불필요한 무효화 최소화
 */
export const invalidationGraph: Record<InvalidationEvent, InvalidationTarget[]> = {
  // ========================================
  // 지원 관련 이벤트
  // ========================================

  /**
   * 지원서 생성
   * - 내 지원 내역 갱신
   * - 공고 상세 (지원자 수, 지원 여부)
   * - 내 스케줄 (지원 완료 시 스케줄에 표시될 수 있음)
   */
  'application.create': ['applications.mine', 'jobPostings.detail', 'schedules.mine'],

  /**
   * 지원 취소
   * - 내 지원 내역
   * - 공고 상세 (지원자 수)
   * - 지원자 관리 목록
   * - 내 스케줄
   */
  'application.cancel': [
    'applications.mine',
    'jobPostings.detail',
    'applicantManagement.byJobPosting',
    'schedules.mine',
  ],

  /**
   * 취소 요청 (스태프가 확정 후 취소 요청)
   * - 내 지원 내역 (상태 변경)
   * - 지원자 관리 (취소 요청 목록)
   */
  'application.requestCancellation': ['applications.mine', 'applicantManagement.byJobPosting'],

  // ========================================
  // 지원자 관리 이벤트 (구인자)
  // ========================================

  /**
   * 지원자 확정
   * - 지원자 관리 목록
   * - 확정 스태프 목록
   * - 근무기록 (WorkLog 생성됨)
   * - 정산 관련
   * - 공고 상세 (확정 인원)
   * - 공고 인원 카운트 / 근무표 (work_logs 생성 → 파생 집계 변동)
   */
  'applicant.confirm': [
    'applicantManagement.byJobPosting',
    'confirmedStaff.byJobPosting',
    'workLogs.all',
    'settlement.byJobPosting',
    'jobPostings.detail',
    'postingFilledCounts.all',
    'workSchedule.all',
  ],

  /**
   * 지원자 거절
   * - 지원자 관리 목록
   * - 공고 상세 (지원자 수)
   */
  'applicant.reject': ['applicantManagement.byJobPosting', 'jobPostings.detail'],

  /**
   * 일괄 확정
   * - 위 confirm과 동일 + 전체 스태프 목록
   */
  'applicant.bulkConfirm': [
    'applicantManagement.byJobPosting',
    'applicantManagement.all',
    'confirmedStaff.byJobPosting',
    'confirmedStaff.all',
    'workLogs.all',
    'settlement.byJobPosting',
    'jobPostings.detail',
    'postingFilledCounts.all',
    'workSchedule.all',
  ],

  /**
   * 취소 요청 검토 (승인/거절)
   * - 지원자 관리 목록
   * - 확정 스태프 (거절 시 목록에서 제거)
   * - 근무기록
   * - 정산
   * - 공고 상세
   */
  'applicant.reviewCancellation': [
    'applicantManagement.byJobPosting',
    'applicantManagement.cancellationRequests',
    'confirmedStaff.byJobPosting',
    'workLogs.all',
    'settlement.byJobPosting',
    'reviews.pending',
    'jobPostings.detail',
    'postingFilledCounts.all',
    'workSchedule.all',
  ],

  // ========================================
  // 공고 관리 이벤트
  // ========================================

  /**
   * 공고 생성
   * - 전체 공고 목록
   * - 내 공고 목록
   */
  'jobPosting.create': ['jobPostings.all', 'jobPostings.mine', 'workSchedule.all'],

  /**
   * 공고 수정
   * - 공고 상세
   * - 전체 공고 목록 (검색/필터 결과)
   * - 내 공고 목록
   */
  // 그리드 required_count 는 job_postings.schedule 에서 직접 파생되므로
  // 요구 인원 수정이 곧 그리드 "부족 N명" 배지 변경이다.
  'jobPosting.update': [
    'jobPostings.detail',
    'jobPostings.all',
    'jobPostings.mine',
    'workSchedule.all',
  ],

  /**
   * 공고 삭제
   * - 전체 공고 목록
   * - 내 공고 목록
   * - 관련 지원자 관리 (cleanup)
   */
  'jobPosting.delete': [
    'jobPostings.all',
    'jobPostings.mine',
    'applicantManagement.all',
    'postingFilledCounts.all',
    'workSchedule.all',
  ],

  /**
   * 공고 마감
   * - 공고 상세
   * - 전체 공고 목록
   * - 내 공고 목록
   */
  'jobPosting.close': [
    'jobPostings.detail',
    'jobPostings.all',
    'jobPostings.mine',
    'workSchedule.all',
  ],

  // ========================================
  // 근무 기록 이벤트
  // ========================================

  /**
   * QR 출근
   * - 근무기록
   * - 확정 스태프 상태
   * - 내 스케줄
   */
  'workLog.checkIn': [
    'workLogs.all',
    'workLogs.mine',
    'confirmedStaff.byJobPosting',
    'schedules.mine',
  ],

  /**
   * QR 퇴근
   * - 근무기록
   * - 확정 스태프 상태
   * - 정산 (근무 시간 확정)
   * - 내 스케줄
   */
  'workLog.checkOut': [
    'workLogs.all',
    'workLogs.mine',
    'confirmedStaff.byJobPosting',
    'settlement.byJobPosting',
    'schedules.mine',
    'reviews.pending',
  ],

  /**
   * 근무기록 생성 (수동)
   * - 근무기록 / 정산 / 확정 스태프
   * - 인원 카운트·그리드 (work_logs 행 증가 → 파생 집계 변동)
   */
  'workLog.create': [
    'workLogs.all',
    'settlement.byJobPosting',
    'confirmedStaff.byJobPosting',
    'postingFilledCounts.all',
    'workSchedule.all',
  ],

  /**
   * 근무기록 수정
   * - 근무기록 / 정산 / 확정 스태프
   * - 그리드 (셀에 표시되는 근무시간·역할이 work_logs 에서 옴)
   */
  'workLog.update': [
    'workLogs.all',
    'settlement.byJobPosting',
    'confirmedStaff.byJobPosting',
    'workSchedule.all',
  ],

  // ========================================
  // 정산 이벤트
  // ========================================

  /**
   * 정산 처리
   * - 정산 목록
   * - 근무기록 (상태 업데이트)
   * - 확정 스태프 (stats.settled 가 payrollStatus 에서 파생)
   */
  'settlement.process': [
    'settlement.byJobPosting',
    'settlement.all',
    'workLogs.all',
    'reviews.pending',
    'confirmedStaff.byJobPosting',
  ],

  /**
   * 일괄 정산
   * - 정산 전체
   * - 근무기록
   * - 확정 스태프 (stats.settled 가 payrollStatus 에서 파생)
   */
  'settlement.bulkProcess': [
    'settlement.all',
    'settlement.byJobPosting',
    'workLogs.all',
    'reviews.pending',
    'confirmedStaff.all',
  ],

  // ========================================
  // 알림 이벤트
  // ========================================

  /**
   * 알림 읽음 처리
   * - 알림 목록 (안 읽은 수)
   */
  'notification.markAsRead': ['notifications.all', 'notifications.unreadCount'],

  /**
   * 전체 읽음 처리
   */
  'notification.markAllAsRead': ['notifications.all', 'notifications.unreadCount'],

  // ========================================
  // 리뷰/평가 이벤트
  // ========================================

  /**
   * 리뷰 생성
   * - 해당 근무 양방향 리뷰
   * - 내가 작성한 리뷰
   * - 미작성 평가 목록
   * - 피평가자 버블 점수
   * - 프로필 버블 점수 (비정규화)
   */
  'review.create': [
    'reviews.byWorkLog',
    'reviews.myGiven',
    'reviews.pending',
    'reviews.bubbleScore',
    'user.profile',
  ],

  // ========================================
  // 프로필 이벤트
  // ========================================

  /**
   * 프로필 업데이트
   * - 사용자 프로필
   */
  'profile.update': ['user.profile'],

  // ========================================
  // 관리자 이벤트
  // ========================================

  /**
   * 대회공고 승인
   * - 대회공고 목록
   * - 전체 공고 목록 (승인된 공고가 노출됨)
   */
  'admin.tournament.approve': ['tournaments.all', 'jobPostings.all'],

  /**
   * 대회공고 거절
   * - 대회공고 목록
   */
  'admin.tournament.reject': ['tournaments.all'],

  /**
   * 공지사항 생성
   * - 공지사항 목록
   */
  'admin.announcement.create': ['announcements.all'],

  /**
   * 공지사항 수정
   * - 공지사항 목록
   */
  'admin.announcement.update': ['announcements.all'],

  /**
   * 사용자 정보 수정 (관리자)
   * - 관리자 대시보드
   * - 사용자 프로필
   */
  'admin.user.update': ['admin.all', 'user.profile'],
};

// ============================================================================
// Invalidation Functions
// ============================================================================

/**
 * 무효화 대상에 맞는 쿼리 키 반환
 */
function getQueryKeyForTarget(
  target: InvalidationTarget,
  context?: InvalidationContext
): readonly unknown[] | null {
  switch (target) {
    // 지원
    case 'applications.all':
      return queryKeys.applications.all;
    case 'applications.mine':
      return queryKeys.applications.mine();
    case 'applications.byJobPosting':
      return context?.jobPostingId
        ? queryKeys.applications.byJobPosting(context.jobPostingId)
        : queryKeys.applications.all;

    // 공고
    case 'jobPostings.all':
      return queryKeys.jobPostings.all;
    case 'jobPostings.detail':
      return context?.jobPostingId
        ? queryKeys.jobPostings.detail(context.jobPostingId)
        : queryKeys.jobPostings.details();
    case 'jobPostings.mine':
      return queryKeys.jobPostings.mine();

    // 스케줄
    case 'schedules.all':
      return queryKeys.schedules.all;
    case 'schedules.mine':
      return queryKeys.schedules.mine();

    // 근무기록
    case 'workLogs.all':
      return queryKeys.workLogs.all;
    case 'workLogs.mine':
      return queryKeys.workLogs.mine();

    // 확정 스태프
    case 'confirmedStaff.all':
      return queryKeys.confirmedStaff.all;
    case 'confirmedStaff.byJobPosting':
      return context?.jobPostingId
        ? queryKeys.confirmedStaff.byJobPosting(context.jobPostingId)
        : queryKeys.confirmedStaff.all;

    // 정산
    case 'settlement.all':
      return queryKeys.settlement.all;
    case 'settlement.byJobPosting':
      return context?.jobPostingId
        ? queryKeys.settlement.byJobPosting(context.jobPostingId)
        : queryKeys.settlement.all;

    // 지원자 관리
    case 'applicantManagement.all':
      return queryKeys.applicantManagement.all;
    case 'applicantManagement.byJobPosting':
      return context?.jobPostingId
        ? queryKeys.applicantManagement.byJobPosting(context.jobPostingId)
        : queryKeys.applicantManagement.all;
    case 'applicantManagement.cancellationRequests':
      return context?.jobPostingId
        ? queryKeys.applicantManagement.cancellationRequests(context.jobPostingId, context.userId)
        : queryKeys.applicantManagement.all;

    // 알림
    case 'notifications.all':
      return queryKeys.notifications.all;
    case 'notifications.unreadCount':
      return queryKeys.notifications.unreadCount();

    // 사용자
    case 'user.profile':
      return context?.userId ? queryKeys.user.profile(context.userId) : queryKeys.user.all;

    // 리뷰/평가
    case 'reviews.all':
      return queryKeys.reviews.all;
    case 'reviews.byWorkLog':
      return context?.workLogId
        ? queryKeys.reviews.byWorkLog(context.workLogId)
        : queryKeys.reviews.all;
    case 'reviews.myGiven':
      return queryKeys.reviews.myGiven();
    case 'reviews.pending':
      return queryKeys.reviews.pending();
    case 'reviews.bubbleScore':
      return context?.revieweeId
        ? queryKeys.reviews.bubbleScore(context.revieweeId)
        : queryKeys.reviews.all;

    // 관리자
    case 'tournaments.all':
      return queryKeys.tournaments.all;
    case 'announcements.all':
      return queryKeys.announcements.all;
    case 'admin.all':
      return queryKeys.admin.all;

    // 파생 집계 (공고 인원 카운트 / 근무표)
    // 둘 다 서버 RPC 가 work_logs·job_postings 를 집계해 만든 값이라,
    // 원본을 쓰는 뮤테이션마다 같이 씻어내야 화면 숫자가 어긋나지 않는다.
    case 'postingFilledCounts.all':
      return [POSTING_FILLED_COUNTS_QUERY_KEY];
    case 'workSchedule.all':
      return queryKeys.workSchedule.all;

    default:
      logger.warn('알 수 없는 무효화 대상', { target });
      return null;
  }
}

/**
 * 이벤트 발생 시 관련 쿼리 무효화
 *
 * @param event - 발생한 이벤트
 * @param context - 선택적 컨텍스트 (jobPostingId 등)
 *
 * @example
 * // 지원서 생성 후
 * invalidateRelated('application.create');
 *
 * // 지원자 확정 후 (특정 공고)
 * invalidateRelated('applicant.confirm', { jobPostingId: 'job123' });
 *
 * // 정산 처리 후
 * invalidateRelated('settlement.process', { jobPostingId: 'job123' });
 */
export function invalidateRelated(event: InvalidationEvent, context?: InvalidationContext): void {
  const targets = invalidationGraph[event];

  if (!targets || targets.length === 0) {
    logger.warn('무효화 대상이 없습니다', { event });
    return;
  }

  logger.debug('캐시 무효화 시작', {
    event,
    targetCount: targets.length,
    context,
  });

  // 모든 대상 쿼리 무효화
  targets.forEach((target) => {
    const queryKey = getQueryKeyForTarget(target, context);

    if (queryKey) {
      queryClient.invalidateQueries({ queryKey });
      logger.debug('쿼리 무효화', { target, queryKey });
    }
  });

  logger.info('캐시 무효화 완료', {
    event,
    targets,
    context,
  });
}
