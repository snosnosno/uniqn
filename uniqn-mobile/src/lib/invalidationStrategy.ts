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
  | 'notifications.all'
  | 'notifications.unreadCount'
  | 'user.profile'
  | 'tournaments.all'
  | 'announcements.all'
  | 'admin.all';

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
   */
  'applicant.confirm': [
    'applicantManagement.byJobPosting',
    'confirmedStaff.byJobPosting',
    'workLogs.all',
    'settlement.byJobPosting',
    'jobPostings.detail',
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
    'confirmedStaff.byJobPosting',
    'workLogs.all',
    'settlement.byJobPosting',
    'jobPostings.detail',
  ],

  // ========================================
  // 공고 관리 이벤트
  // ========================================

  /**
   * 공고 생성
   * - 전체 공고 목록
   * - 내 공고 목록
   */
  'jobPosting.create': ['jobPostings.all', 'jobPostings.mine'],

  /**
   * 공고 수정
   * - 공고 상세
   * - 전체 공고 목록 (검색/필터 결과)
   * - 내 공고 목록
   */
  'jobPosting.update': ['jobPostings.detail', 'jobPostings.all', 'jobPostings.mine'],

  /**
   * 공고 삭제
   * - 전체 공고 목록
   * - 내 공고 목록
   * - 관련 지원자 관리 (cleanup)
   */
  'jobPosting.delete': ['jobPostings.all', 'jobPostings.mine', 'applicantManagement.all'],

  /**
   * 공고 마감
   * - 공고 상세
   * - 전체 공고 목록
   * - 내 공고 목록
   */
  'jobPosting.close': ['jobPostings.detail', 'jobPostings.all', 'jobPostings.mine'],

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
  ],

  /**
   * 근무기록 생성 (수동)
   * - 근무기록
   * - 정산
   */
  'workLog.create': ['workLogs.all', 'settlement.byJobPosting'],

  /**
   * 근무기록 수정
   * - 근무기록
   * - 정산
   */
  'workLog.update': ['workLogs.all', 'settlement.byJobPosting'],

  // ========================================
  // 정산 이벤트
  // ========================================

  /**
   * 정산 처리
   * - 정산 목록
   * - 근무기록 (상태 업데이트)
   */
  'settlement.process': ['settlement.byJobPosting', 'settlement.all', 'workLogs.all'],

  /**
   * 일괄 정산
   * - 정산 전체
   * - 근무기록
   */
  'settlement.bulkProcess': ['settlement.all', 'settlement.byJobPosting', 'workLogs.all'],

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

    // 알림
    case 'notifications.all':
      return queryKeys.notifications.all;
    case 'notifications.unreadCount':
      return queryKeys.notifications.unreadCount();

    // 사용자
    case 'user.profile':
      return context?.userId ? queryKeys.user.profile(context.userId) : queryKeys.user.all;

    // 관리자
    case 'tournaments.all':
      return queryKeys.tournaments.all;
    case 'announcements.all':
      return queryKeys.announcements.all;
    case 'admin.all':
      return queryKeys.admin.all;

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

/**
 * 여러 이벤트 동시 무효화
 *
 * @param events - 이벤트 배열
 * @param context - 공유 컨텍스트
 *
 * @example
 * // 복합 작업 후 여러 이벤트 무효화
 * invalidateMultiple(
 *   ['applicant.confirm', 'workLog.create'],
 *   { jobPostingId: 'job123' }
 * );
 */
export function invalidateMultiple(
  events: InvalidationEvent[],
  context?: InvalidationContext
): void {
  // 중복 제거를 위해 Set 사용
  const allTargets = new Set<InvalidationTarget>();

  events.forEach((event) => {
    const targets = invalidationGraph[event];
    targets?.forEach((target) => allTargets.add(target));
  });

  logger.debug('복합 캐시 무효화 시작', {
    events,
    targetCount: allTargets.size,
  });

  // 중복 제거된 대상만 무효화
  allTargets.forEach((target) => {
    const queryKey = getQueryKeyForTarget(target, context);
    if (queryKey) {
      queryClient.invalidateQueries({ queryKey });
    }
  });

  logger.info('복합 캐시 무효화 완료', {
    events,
    uniqueTargets: Array.from(allTargets),
  });
}

/**
 * 특정 도메인의 모든 쿼리 무효화
 *
 * @param domain - 도메인 이름
 *
 * @example
 * invalidateDomain('applications');
 * invalidateDomain('settlement');
 */
export function invalidateDomain(
  domain:
    | 'applications'
    | 'jobPostings'
    | 'schedules'
    | 'workLogs'
    | 'confirmedStaff'
    | 'settlement'
    | 'notifications'
    | 'user'
    | 'admin'
): void {
  const domainKeys: Record<typeof domain, readonly unknown[]> = {
    applications: queryKeys.applications.all,
    jobPostings: queryKeys.jobPostings.all,
    schedules: queryKeys.schedules.all,
    workLogs: queryKeys.workLogs.all,
    confirmedStaff: queryKeys.confirmedStaff.all,
    settlement: queryKeys.settlement.all,
    notifications: queryKeys.notifications.all,
    user: queryKeys.user.all,
    admin: queryKeys.admin.all,
  };

  const queryKey = domainKeys[domain];
  queryClient.invalidateQueries({ queryKey });

  logger.info('도메인 캐시 무효화', { domain, queryKey });
}

// ============================================================================
// Mutation Helper
// ============================================================================

/**
 * 뮤테이션 성공 시 캐시 무효화 헬퍼
 *
 * @description useMutation의 onSuccess에서 사용할 수 있는 헬퍼 함수 생성
 *
 * @example
 * const mutation = useMutation({
 *   mutationFn: applyToJob,
 *   onSuccess: createInvalidationHandler('application.create'),
 * });
 *
 * // 컨텍스트와 함께
 * const mutation = useMutation({
 *   mutationFn: confirmApplicant,
 *   onSuccess: createInvalidationHandler('applicant.confirm', (data) => ({
 *     jobPostingId: data.jobPostingId,
 *   })),
 * });
 */
export function createInvalidationHandler<TData = unknown>(
  event: InvalidationEvent,
  contextExtractor?: (data: TData) => InvalidationContext
): (data: TData) => void {
  return (data: TData) => {
    const context = contextExtractor ? contextExtractor(data) : undefined;
    invalidateRelated(event, context);
  };
}

/**
 * 여러 이벤트에 대한 무효화 핸들러 생성
 */
export function createMultiInvalidationHandler<TData = unknown>(
  events: InvalidationEvent[],
  contextExtractor?: (data: TData) => InvalidationContext
): (data: TData) => void {
  return (data: TData) => {
    const context = contextExtractor ? contextExtractor(data) : undefined;
    invalidateMultiple(events, context);
  };
}
