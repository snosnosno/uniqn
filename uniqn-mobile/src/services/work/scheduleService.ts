/**
 * UNIQN Mobile - 스케줄 서비스
 *
 * @description Firebase Firestore 기반 스케줄 서비스
 * @version 1.0.0
 */

import type { UnsubscribeFn } from '@/types/common';
import { logger } from '@/utils/logger';
import { NetworkError, ERROR_CODES, toError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { STATUS } from '@/constants';
import { formatDateWithDay, toDateString } from '@/utils/date';
import { TimeNormalizer } from '@/shared/time';
import type {
  ScheduleEvent,
  ScheduleFilters,
  ScheduleStats,
  ScheduleGroup,
  ScheduleType,
  WorkLog,
  Application,
  WorkLogStatus,
  ApplicationStatus,
} from '@/types';
import { IdNormalizer } from '@/shared/id';
import {
  ScheduleMerger,
  ScheduleConverter,
  createSchedulePostingContext,
  type SchedulePostingContext,
} from '@/domains/schedule';
import { RealtimeManager } from '@/shared/realtime';
import { workLogRepository, jobPostingRepository, applicationRepository } from '@/repositories';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PAGE_SIZE = 50;
const ACTIVE_SCHEDULE_APPLICATION_STATUSES: ApplicationStatus[] = [
  STATUS.APPLICATION.APPLIED as ApplicationStatus,
  STATUS.APPLICATION.CONFIRMED as ApplicationStatus,
  STATUS.APPLICATION.CANCELLATION_PENDING as ApplicationStatus,
];

function hasScheduleDate(date: string | undefined): boolean {
  return typeof date === 'string' && date.trim().length > 0;
}

function buildScheduleStatsCountKey(schedule: ScheduleEvent): string {
  const applicationId = schedule.applicationId?.trim();
  if (applicationId) {
    return `application:${applicationId}`;
  }

  const jobPostingId = schedule.jobPostingId?.trim();
  if (jobPostingId) {
    return `posting:${jobPostingId}`;
  }

  return `schedule:${schedule.id}`;
}

// ============================================================================
// Types
// ============================================================================

export interface ScheduleQueryResult {
  schedules: ScheduleEvent[];
  stats: ScheduleStats;
  /** 부분 실패 시 경고 메시지 */
  warning?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 월의 시작일과 끝일 계산
 */
function getMonthRange(year: number, month: number): { start: string; end: string } {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  return {
    start: toDateString(startDate),
    end: toDateString(endDate),
  };
}

/**
 * 공고 정보 일괄 조회 (부분 실패 허용)
 * @description JobPostingCard 전체 데이터를 반환하여 스케줄 탭에서 JobCard 사용 가능
 */
async function fetchJobPostingContextBatch(
  jobPostingIds: string[]
): Promise<Map<string, SchedulePostingContext>> {
  const postingMap = new Map<string, SchedulePostingContext>();

  if (jobPostingIds.length === 0) {
    return postingMap;
  }

  const uniqueIds = [...new Set(jobPostingIds)];

  try {
    // Repository를 통한 배치 조회 (내부적으로 청크 분할 처리)
    const jobPostings = await jobPostingRepository.getByIdBatch(uniqueIds);

    for (const jobPosting of jobPostings) {
      postingMap.set(jobPosting.id, createSchedulePostingContext(jobPosting));
    }
  } catch (error) {
    logger.warn('공고 배치 조회 실패', { error });
  }

  // 조회되지 않은 ID 로깅 (삭제된 공고 등)
  const missingIds = uniqueIds.filter((id) => !postingMap.has(id));
  if (missingIds.length > 0) {
    logger.debug('일부 공고 정보 없음 (삭제됨)', {
      missingCount: missingIds.length,
      totalCount: uniqueIds.length,
    });
  }

  return postingMap;
}

/**
 * WorkLogs와 Applications 스케줄을 병합하고 중복 제거
 *
 * @description Phase 5 - ScheduleMerger로 위임
 * 중복 판별 기준: 같은 jobPostingId + 같은 date
 * 우선순위: workLogs > applications (확정된 WorkLog가 있으면 Application은 제외)
 */
function mergeAndDeduplicateSchedules(
  workLogSchedules: ScheduleEvent[],
  applicationSchedules: ScheduleEvent[],
  dateRange?: { start: string; end: string }
): ScheduleEvent[] {
  return ScheduleMerger.merge(workLogSchedules, applicationSchedules, {
    dateRange,
    sortOrder: 'desc',
  });
}

/**
 * 스케줄 통계 계산
 * @description 조회된 스케줄 데이터 기준으로 통계를 계산
 * - thisMonthEarnings: 조회된 데이터(선택된 월)의 completed 수익 합계
 * - 지원/확정 카운트: 미래 날짜 기준으로 계산
 */
export function calculateScheduleStats(schedules: ScheduleEvent[]): ScheduleStats {
  const today = toDateString(new Date());
  const datedSchedules = schedules.filter((schedule) => hasScheduleDate(schedule.date));
  const confirmedScheduleKeys = new Set<string>();
  const upcomingScheduleKeys = new Set<string>();

  let completedSchedules = 0;
  let totalEarnings = 0;
  let thisMonthEarnings = 0;
  let hoursWorked = 0;

  schedules.forEach((schedule) => {
    // 완료된 스케줄
    if (schedule.type === STATUS.SCHEDULE.COMPLETED) {
      completedSchedules++;

      // 수익 계산 (payrollAmount 우선, 없으면 settlementBreakdown 사용)
      let amount = 0;

      if (schedule.payrollAmount && schedule.payrollAmount > 0) {
        // 1순위: 구인자 확정 금액
        amount = schedule.payrollAmount;
      } else if (schedule.settlementBreakdown) {
        // 2순위: 미리 계산된 정산 세부 내역
        const breakdown = schedule.settlementBreakdown;
        amount =
          breakdown.taxSettings?.type !== 'none' ? breakdown.afterTaxPay : breakdown.totalPay;
      }

      if (amount > 0) {
        totalEarnings += amount;
        thisMonthEarnings += amount;
      }

      // 근무 시간 계산
      const start = TimeNormalizer.parseTime(schedule.checkInTime);
      const end = TimeNormalizer.parseTime(schedule.checkOutTime);
      if (start && end) {
        hoursWorked += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      }
    }

    // 확정된 스케줄 (미래 날짜, confirmed)

    // 지원 중인 스케줄 (미래 날짜, applied)
  });

  datedSchedules.forEach((schedule) => {
    if (schedule.date >= today && schedule.type === STATUS.SCHEDULE.CONFIRMED) {
      confirmedScheduleKeys.add(buildScheduleStatsCountKey(schedule));
    }

    if (schedule.date >= today && schedule.type === STATUS.SCHEDULE.APPLIED) {
      upcomingScheduleKeys.add(buildScheduleStatsCountKey(schedule));
    }
  });

  return {
    totalSchedules: schedules.length,
    completedSchedules,
    confirmedSchedules: confirmedScheduleKeys.size,
    upcomingSchedules: upcomingScheduleKeys.size,
    totalEarnings,
    thisMonthEarnings,
    hoursWorked: Math.round(hoursWorked * 10) / 10, // 소수점 1자리
  };
}

/**
 * 스케줄을 날짜별로 그룹화
 */
export function groupSchedulesByDate(schedules: ScheduleEvent[]): ScheduleGroup[] {
  const groups = new Map<string, ScheduleEvent[]>();
  const today = toDateString(new Date());

  // 날짜별로 그룹화
  schedules.forEach((schedule) => {
    if (!hasScheduleDate(schedule.date)) {
      return;
    }

    const date = schedule.date;
    if (!groups.has(date)) {
      groups.set(date, []);
    }
    groups.get(date)!.push(schedule);
  });

  // ScheduleGroup 배열로 변환
  const result: ScheduleGroup[] = [];
  groups.forEach((events, date) => {
    const isPast = date < today;
    const isToday = date === today;
    const formattedDate = formatDateWithDay(date) || date;

    result.push({
      date,
      formattedDate,
      events: events.sort((a, b) => {
        // 시작 시간 순으로 정렬
        if (!a.startTime) return 1;
        if (!b.startTime) return -1;
        const aTime = TimeNormalizer.parseTime(a.startTime)?.getTime() ?? 0;
        const bTime = TimeNormalizer.parseTime(b.startTime)?.getTime() ?? 0;
        return aTime - bTime;
      }),
      isToday,
      isPast,
    });
  });

  // 날짜순 정렬 (최신순)
  return result.sort((a, b) => b.date.localeCompare(a.date));
}

// ============================================================================
// Schedule Service
// ============================================================================

/**
 * 내 스케줄 목록 조회
 * @description WorkLogs와 Applications를 병합하여 조회
 */
export async function getMySchedules(
  staffId: string,
  filters?: ScheduleFilters,
  pageSize: number = DEFAULT_PAGE_SIZE
): Promise<ScheduleQueryResult> {
  const startTime = Date.now();

  try {
    logger.info('스케줄 목록 조회 시작', { staffId, filters });

    // ========================================
    // 1. 상태 매핑 (UI 상태 → Firestore 상태)
    // ========================================
    let mappedStatus: WorkLogStatus | undefined;
    if (filters?.status) {
      const statusMapping: Record<string, WorkLogStatus> = {
        not_started: STATUS.WORK_LOG.SCHEDULED as WorkLogStatus,
        checked_in: STATUS.WORK_LOG.CHECKED_IN as WorkLogStatus,
        checked_out: STATUS.WORK_LOG.CHECKED_OUT as WorkLogStatus,
      };
      mappedStatus = statusMapping[filters.status];
    }

    // ========================================
    // 2. Repository를 통한 병렬 조회 (부분 실패 허용)
    // ========================================
    const [workLogsResult, applicationsResult] = await Promise.allSettled([
      workLogRepository.getByStaffIdWithFilters(staffId, {
        dateRange: filters?.dateRange,
        status: mappedStatus,
        pageSize,
      }),
      applicationRepository.getByApplicantIdWithStatuses(
        staffId,
        ACTIVE_SCHEDULE_APPLICATION_STATUSES,
        pageSize
      ),
    ]);

    // 둘 다 실패한 경우에만 에러 throw
    if (workLogsResult.status === 'rejected' && applicationsResult.status === 'rejected') {
      logger.error('WorkLogs, Applications 모두 조회 실패', toError(workLogsResult.reason), {
        staffId,
      });
      throw new NetworkError(ERROR_CODES.NETWORK_REQUEST_FAILED, {
        userMessage: '스케줄을 불러올 수 없습니다. 네트워크 연결을 확인해주세요',
      });
    }

    // 부분 실패 로깅 및 경고 메시지 생성
    let partialFailureWarning: string | undefined;

    if (workLogsResult.status === 'rejected') {
      logger.warn('WorkLogs 조회 실패 (Applications는 성공)', {
        error: workLogsResult.reason,
        staffId,
      });
      partialFailureWarning = '일부 근무 기록을 불러오지 못했습니다';
    }
    if (applicationsResult.status === 'rejected') {
      logger.warn('Applications 조회 실패 (WorkLogs는 성공)', {
        error: applicationsResult.reason,
        staffId,
      });
      partialFailureWarning = partialFailureWarning
        ? '일부 데이터를 불러오지 못했습니다'
        : '일부 지원 기록을 불러오지 못했습니다';
    }

    // ========================================
    // 3. Repository가 반환한 타입 안전한 데이터 사용
    // ========================================
    const workLogs: WorkLog[] = workLogsResult.status === 'fulfilled' ? workLogsResult.value : [];

    const applications: Application[] =
      applicationsResult.status === 'fulfilled' ? applicationsResult.value : [];

    // ========================================
    // 4. 공고 정보 일괄 조회 (JobPostingCard 포함)
    // ========================================
    // IdNormalizer로 통합 ID 추출
    const allJobPostingIds = IdNormalizer.extractUnifiedIds(workLogs, applications);
    const jobPostingContextMap = await fetchJobPostingContextBatch(Array.from(allJobPostingIds));

    // ========================================
    // 5. ScheduleEvent 변환
    // ========================================
    // WorkLogs → ScheduleEvent (IdNormalizer로 정규화된 ID 사용)
    const workLogSchedules: ScheduleEvent[] = workLogs.map((workLog) => {
      const normalizedId = IdNormalizer.normalizeJobId(workLog);
      const postingContext = jobPostingContextMap.get(normalizedId);
      return ScheduleConverter.workLogToScheduleEvent(workLog, postingContext);
    });

    // Applications → ScheduleEvent[] (다중 날짜 지원)
    const applicationSchedules: ScheduleEvent[] = applications.flatMap((app) => {
      const normalizedId = IdNormalizer.normalizeJobId(app);
      const postingContext = jobPostingContextMap.get(normalizedId);
      return ScheduleConverter.applicationToScheduleEvents(app, postingContext);
    });

    // ========================================
    // 6. 병합 및 중복 제거
    // ========================================
    const mergedSchedules = mergeAndDeduplicateSchedules(
      workLogSchedules,
      applicationSchedules,
      filters?.dateRange
    );

    // ========================================
    // 7. 클라이언트 사이드 필터링
    // ========================================
    let filteredSchedules = mergedSchedules;

    // 검색어 필터
    if (filters?.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filteredSchedules = filteredSchedules.filter(
        (s) =>
          s.jobPostingName.toLowerCase().includes(term) ||
          s.location.toLowerCase().includes(term) ||
          s.role.toLowerCase().includes(term)
      );
    }

    // 타입 필터
    if (filters?.type) {
      filteredSchedules = filteredSchedules.filter((s) => s.type === filters.type);
    }

    const visibleSchedules = filteredSchedules.filter((schedule) => hasScheduleDate(schedule.date));

    // ========================================
    // 8. 통계 계산
    // ========================================
    const stats = calculateScheduleStats(filteredSchedules);

    const duration = Date.now() - startTime;
    logger.info('스케줄 목록 조회 완료', {
      count: visibleSchedules.length,
      workLogsCount: workLogSchedules.length,
      applicationsCount: applicationSchedules.length,
      durationMs: duration,
    });

    return {
      schedules: visibleSchedules,
      stats,
      ...(partialFailureWarning && { warning: partialFailureWarning }),
    };
  } catch (error) {
    throw handleServiceError(error, {
      operation: '스케줄 목록 조회',
      component: 'scheduleService',
      context: { staffId },
    });
  }
}

/**
 * 특정 날짜의 스케줄 조회
 */
export async function getSchedulesByDate(staffId: string, date: string): Promise<ScheduleEvent[]> {
  try {
    logger.info('날짜별 스케줄 조회', { staffId, date });

    const { schedules } = await getMySchedules(staffId, {
      dateRange: { start: date, end: date },
    });

    return schedules;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '날짜별 스케줄 조회',
      component: 'scheduleService',
      context: { staffId, date },
    });
  }
}

/**
 * 특정 월의 스케줄 조회
 */
export async function getSchedulesByMonth(
  staffId: string,
  year: number,
  month: number
): Promise<ScheduleQueryResult> {
  try {
    logger.info('월별 스케줄 조회', { staffId, year, month });

    const dateRange = getMonthRange(year, month);

    return await getMySchedules(staffId, { dateRange }, 100);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '월별 스케줄 조회',
      component: 'scheduleService',
      context: { staffId, year, month },
    });
  }
}

/**
 * 스케줄 상세 조회
 */
export async function getScheduleById(scheduleId: string): Promise<ScheduleEvent | null> {
  try {
    logger.info('스케줄 상세 조회', { scheduleId });

    // Repository를 통한 WorkLog 조회
    const workLog = await workLogRepository.getById(scheduleId);

    if (!workLog) {
      logger.warn('스케줄을 찾을 수 없음', { scheduleId });
      return null;
    }

    // Repository를 통한 공고 정보 조회 (JobPostingCard 포함)
    const normalizedJobId = IdNormalizer.normalizeJobId(workLog);
    let postingContext: SchedulePostingContext | undefined;
    try {
      const jobPosting = await jobPostingRepository.getById(normalizedJobId);
      if (jobPosting) {
        postingContext = createSchedulePostingContext(jobPosting);
      }
    } catch (err) {
      logger.debug('공고 정보 조회 실패 (상세)', { jobPostingId: normalizedJobId, error: err });
    }

    return ScheduleConverter.workLogToScheduleEvent(workLog, postingContext);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '스케줄 상세 조회',
      component: 'scheduleService',
      context: { scheduleId },
    });
  }
}

/**
 * 오늘의 스케줄 조회
 */
export async function getTodaySchedules(staffId: string): Promise<ScheduleEvent[]> {
  const today = toDateString(new Date());
  return getSchedulesByDate(staffId, today);
}

/**
 * 다가오는 스케줄 조회 (오늘 포함 7일)
 */
export async function getUpcomingSchedules(
  staffId: string,
  days: number = 7
): Promise<ScheduleEvent[]> {
  try {
    logger.info('다가오는 스케줄 조회', { staffId, days });

    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + days);

    const { schedules } = await getMySchedules(staffId, {
      dateRange: {
        start: toDateString(today),
        end: toDateString(endDate),
      },
    });

    // confirmed 상태만 필터링
    return schedules.filter(
      (s) => s.type === STATUS.SCHEDULE.CONFIRMED || s.type === STATUS.SCHEDULE.APPLIED
    );
  } catch (error) {
    throw handleServiceError(error, {
      operation: '다가오는 스케줄 조회',
      component: 'scheduleService',
      context: { staffId },
    });
  }
}

/**
 * 스케줄 실시간 구독
 *
 * @description Phase 12 - RealtimeManager로 중복 구독 방지
 */
export function subscribeToSchedules(
  staffId: string,
  onUpdate: (schedules: ScheduleEvent[]) => void,
  onError?: (error: Error) => void
): UnsubscribeFn {
  return RealtimeManager.subscribe(RealtimeManager.Keys.schedules(staffId), () => {
    logger.info('스케줄 구독 시작', { staffId });

    let hasErrored = false;
    let currentWorkLogs: WorkLog[] = [];
    let currentApplications: Application[] = [];
    let hasReceivedInitialWorkLogSnapshot = false;
    let hasReceivedInitialApplicationSnapshot = false;
    let latestEmissionId = 0;

    const emitSchedules = async () => {
      if (hasErrored) return;
      if (!hasReceivedInitialWorkLogSnapshot || !hasReceivedInitialApplicationSnapshot) return;

      const emissionId = ++latestEmissionId;
      const workLogsSnapshot = currentWorkLogs;
      const applicationsSnapshot = currentApplications;

      try {
        const jobPostingIds = IdNormalizer.extractUnifiedIds(
          workLogsSnapshot,
          applicationsSnapshot
        );
        const postingContextMap = await fetchJobPostingContextBatch(Array.from(jobPostingIds));
        if (hasErrored || emissionId !== latestEmissionId) return;

        const workLogSchedules = workLogsSnapshot.map((workLog) => {
          const normalizedId = IdNormalizer.normalizeJobId(workLog);
          return ScheduleConverter.workLogToScheduleEvent(
            workLog,
            postingContextMap.get(normalizedId)
          );
        });

        const applicationSchedules = applicationsSnapshot.flatMap((application) => {
          const normalizedId = IdNormalizer.normalizeJobId(application);
          return ScheduleConverter.applicationToScheduleEvents(
            application,
            postingContextMap.get(normalizedId)
          );
        });

        const schedules = mergeAndDeduplicateSchedules(workLogSchedules, applicationSchedules);
        if (hasErrored || emissionId !== latestEmissionId) return;
        onUpdate(schedules.filter((schedule) => hasScheduleDate(schedule.date)));
      } catch (error) {
        if (hasErrored || emissionId !== latestEmissionId) return;
        logger.error('?ㅼ?以?援щ룆 泥섎━ ?ㅽ뙣', toError(error));
        onError?.(toError(error));
      }
    };

    const handleSubscriptionError = (error: Error) => {
      if (hasErrored) return;
      hasErrored = true;

      logger.error('?ㅼ?以?援щ룆 ?먮윭', error);
      onError?.(error);
    };

    const workLogUnsubscribe = workLogRepository.subscribeByStaffId(
      staffId,
      (workLogs: WorkLog[]) => {
        currentWorkLogs = workLogs;
        hasReceivedInitialWorkLogSnapshot = true;
        void emitSchedules();
      },
      handleSubscriptionError
    );

    const applicationUnsubscribe = applicationRepository.subscribeByApplicantIdWithStatuses(
      staffId,
      ACTIVE_SCHEDULE_APPLICATION_STATUSES,
      (applications: Application[]) => {
        currentApplications = applications;
        hasReceivedInitialApplicationSnapshot = true;
        void emitSchedules();
      },
      handleSubscriptionError
    );

    return () => {
      hasErrored = true;
      workLogUnsubscribe();
      applicationUnsubscribe();
    };
  });
}

/**
 * 캘린더용 날짜별 마킹 데이터 생성
 */
export function getCalendarMarkedDates(
  schedules: ScheduleEvent[]
): Record<string, { marked: boolean; dotColor: string; type?: ScheduleType }> {
  const markedDates: Record<string, { marked: boolean; dotColor: string; type?: ScheduleType }> =
    {};

  const colorMap: Record<ScheduleType, string> = {
    applied: '#f59e0b', // yellow-500
    confirmed: '#22c55e', // green-500
    completed: '#A855F7', // primary-500
    cancelled: '#ef4444', // red-500
  };

  schedules.forEach((schedule) => {
    // 이미 마킹된 날짜가 있으면 우선순위에 따라 결정
    // 우선순위: confirmed > applied > completed > cancelled
    if (!hasScheduleDate(schedule.date)) {
      return;
    }

    if (!markedDates[schedule.date]) {
      markedDates[schedule.date] = {
        marked: true,
        dotColor: colorMap[schedule.type],
        type: schedule.type,
      };
    } else if (
      schedule.type === STATUS.SCHEDULE.CONFIRMED ||
      (schedule.type === STATUS.SCHEDULE.APPLIED &&
        markedDates[schedule.date].type !== STATUS.SCHEDULE.CONFIRMED)
    ) {
      markedDates[schedule.date] = {
        marked: true,
        dotColor: colorMap[schedule.type],
        type: schedule.type,
      };
    }
  });

  return markedDates;
}

/**
 * 스케줄 통계 조회
 */
export async function getScheduleStats(staffId: string): Promise<ScheduleStats> {
  try {
    logger.info('스케줄 통계 조회', { staffId });

    // 최근 6개월 데이터 조회
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 6);

    const { stats } = await getMySchedules(
      staffId,
      {
        dateRange: {
          start: toDateString(sixMonthsAgo),
          end: toDateString(now),
        },
      },
      500
    );

    return stats;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '스케줄 통계 조회',
      component: 'scheduleService',
      context: { staffId },
    });
  }
}
