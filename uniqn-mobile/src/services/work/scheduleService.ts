/**
 * UNIQN Mobile - 스케줄 서비스
 *
 * @description Supabase 기반 스케줄 서비스
 * @version 1.0.0
 */

import type { UnsubscribeFn } from '@/types/common';
import { logger } from '@/utils/logger';
import { NetworkError, ERROR_CODES, isAppError, toError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { STATUS } from '@/constants';
import {
  hasPendingPayrollEstimate,
  shouldUseFrozenPayrollAmount,
} from '@/utils/settlementGrouping';
import { formatDateWithDay, toDateString } from '@/utils/date';
import { TimeNormalizer } from '@/shared/time';
import type {
  ScheduleEvent,
  ScheduleFilters,
  ScheduleStats,
  ScheduleGroup,
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
  createScheduleContainerContext,
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
  /**
   * 조회한 달 **밖**이지만 같은 지원에 속한 근무일.
   *
   * 월 단위로만 조회하면 월 경계를 넘는 연속 근무가 두 카드로 쪼개져, 7일짜리 대회가
   * 7월 화면에서 '4일'로 표기된다 — 대회사 D-7 집중 인력이라는 이 앱의 핵심 시나리오가
   * 정확히 여기서 깨지고, 8월 초까지 잡혀 있다는 사실이 안 보여 이중 예약이 난다.
   *
   * 그룹핑에만 합쳐 쓰고, 캘린더 dot·통계·필터는 `schedules`(그 달만)를 그대로 쓴다.
   */
  boundarySchedules?: ScheduleEvent[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/** 월 경계를 넘는 연속 근무를 한 그룹으로 잡기 위한 조회 여유(일) */
const MONTH_BOUNDARY_PADDING_DAYS = 7;

/** 조회 범위를 앞뒤로 N일 넓힌다 */
function padDateRange(
  range: { start: string; end: string },
  days: number
): { start: string; end: string } {
  const shift = (value: string, delta: number) => {
    const date = new Date(`${value}T00:00:00`);
    date.setDate(date.getDate() + delta);
    return toDateString(date);
  };

  return { start: shift(range.start, -days), end: shift(range.end, days) };
}

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
 * 컨테이너 2차 해소(#6, S1 확장) — 근무표 직접배치 work_log 는 job_posting_id 가 지점 컨테이너
 * (status='container')를 가리키는데, 일반 공고 조회는 컨테이너를 의도적으로 제외한다.
 * staff 는 RLS 로 컨테이너 job_postings 를 직접 못 읽으므로(SELECT 정책이 container 제외)
 * SECDEF RPC 2종이 유일 경로다.
 *
 * 두 RPC 를 나란히 쓰되 **실패를 각각 흡수하고 키 합집합으로 순회**한다:
 * - get_my_venue_contexts   → 지점명·장소·연락처·소개 (지점당 1행 보장)
 * - get_my_venue_role_salaries → 역할별 단가 (CROSS JOIN LATERAL 이라 단가표가 비면 0행)
 *
 * 합집합인 이유는 둘의 행 집합이 다르기 때문이다 — 단가 미설정 지점은 salaries 에만 없고,
 * contexts 호출이 실패하면 salaries 에만 있다. 어느 한쪽이 죽어도 나머지는 살아남아야 한다.
 * contexts 만 실패 = 종전대로 '이벤트' 표시 + 단가는 정상. salaries 만 실패 = 이름·장소는
 * 보이고 급여만 기본 단가(15,000원)로 폴백. 둘 다 관측 가능하게 로그를 남긴다.
 */
async function resolveContainerContexts(
  containerIds: string[]
): Promise<Map<string, SchedulePostingContext>> {
  const resolved = new Map<string, SchedulePostingContext>();
  if (containerIds.length === 0) return resolved;

  const [contextResult, salaryResult] = await Promise.allSettled([
    jobPostingRepository.getMyVenueContexts(containerIds),
    jobPostingRepository.getMyVenueRoleSalaries(containerIds),
  ]);

  if (contextResult.status === 'rejected') {
    logger.warn('지점 표시 정보 조회 실패 — 지점명 폴백 유지', { error: contextResult.reason });
  }
  if (salaryResult.status === 'rejected') {
    logger.warn('컨테이너 역할 단가 2차 해소 실패 — 기본 단가 폴백 유지', {
      error: salaryResult.reason,
    });
  }

  const contexts = contextResult.status === 'fulfilled' ? contextResult.value : new Map();
  const salaries = salaryResult.status === 'fulfilled' ? salaryResult.value : new Map();

  for (const containerId of new Set([...contexts.keys(), ...salaries.keys()])) {
    resolved.set(
      containerId,
      createScheduleContainerContext(salaries.get(containerId) ?? [], contexts.get(containerId))
    );
  }
  return resolved;
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

  const missingIds = uniqueIds.filter((id) => !postingMap.has(id));
  for (const [containerId, context] of await resolveContainerContexts(missingIds)) {
    postingMap.set(containerId, context);
  }

  // 컨테이너로도 못 찾은 ID 로깅 (삭제된 공고 등)
  const stillMissingIds = uniqueIds.filter((id) => !postingMap.has(id));
  if (stillMissingIds.length > 0) {
    logger.debug('일부 공고 정보 없음 (삭제됨)', {
      missingCount: stillMissingIds.length,
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
 * WorkLogs·Applications를 공고 컨텍스트와 결합해 ScheduleEvent로 변환·병합한다.
 * getMySchedules(1회 조회)와 subscribeToSchedules(실시간)의 공통 변환 경로.
 */
function buildScheduleEvents(
  workLogs: WorkLog[],
  applications: Application[],
  jobPostingContextMap: Map<string, SchedulePostingContext>,
  dateRange?: { start: string; end: string }
): ScheduleEvent[] {
  const workLogSchedules: ScheduleEvent[] = workLogs.map((workLog) => {
    const normalizedId = IdNormalizer.normalizeJobId(workLog);
    return ScheduleConverter.workLogToScheduleEvent(
      workLog,
      jobPostingContextMap.get(normalizedId)
    );
  });

  const applicationSchedules: ScheduleEvent[] = applications.flatMap((app) => {
    const normalizedId = IdNormalizer.normalizeJobId(app);
    return ScheduleConverter.applicationToScheduleEvents(
      app,
      jobPostingContextMap.get(normalizedId)
    );
  });

  return mergeAndDeduplicateSchedules(workLogSchedules, applicationSchedules, dateRange);
}

/**
 * UI 출결 필터(filters.status)를 WorkLog 상태로 매핑한다. 미지정/미대응 시 undefined.
 */
function mapScheduleStatusFilter(status: ScheduleFilters['status']): WorkLogStatus | undefined {
  if (!status) {
    return undefined;
  }
  const statusMapping: Record<string, WorkLogStatus> = {
    not_started: STATUS.WORK_LOG.SCHEDULED as WorkLogStatus,
    checked_in: STATUS.WORK_LOG.CHECKED_IN as WorkLogStatus,
    checked_out: STATUS.WORK_LOG.CHECKED_OUT as WorkLogStatus,
  };
  return statusMapping[status];
}

/**
 * 클라이언트 사이드 필터(검색어·타입)를 적용한다. 불변(새 배열 반환).
 */
function applyScheduleFilters(
  schedules: ScheduleEvent[],
  filters?: ScheduleFilters
): ScheduleEvent[] {
  let filtered = schedules;

  if (filters?.searchTerm) {
    const term = filters.searchTerm.toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.jobPostingName.toLowerCase().includes(term) ||
        s.location.toLowerCase().includes(term) ||
        s.role.toLowerCase().includes(term)
    );
  }

  if (filters?.type) {
    filtered = filtered.filter((s) => s.type === filters.type);
  }

  return filtered;
}

/**
 * 스케줄 통계 계산
 * @description 조회된 스케줄 데이터 기준으로 통계를 계산
 * - thisMonthEarnings: 조회된 데이터(선택된 월)의 completed 수익 합계
 * - 지원/확정 카운트: 조회 범위(월 스코프) 내 type 기준으로 계산 — 날짜 필터 없음(리스트 표시기준과 통일)
 */
export function calculateScheduleStats(schedules: ScheduleEvent[]): ScheduleStats {
  const datedSchedules = schedules.filter((schedule) => hasScheduleDate(schedule.date));
  const confirmedScheduleKeys = new Set<string>();
  const upcomingScheduleKeys = new Set<string>();
  // 완료도 확정/지원과 같은 '건' 단위로 센다. 예전에는 여기만 원본 row 를 그대로 세서
  // 3일짜리 대회 1건이 상단 통계엔 '완료 3', 목록 필터탭엔 '완료 1' 로 동시에 나왔다.
  const completedScheduleKeys = new Set<string>();

  let completedWorkDays = 0;
  let totalEarnings = 0;
  let thisMonthEarnings = 0;
  let settledEarnings = 0;
  let estimatedEarnings = 0;
  let hoursWorked = 0;

  schedules.forEach((schedule) => {
    // 완료된 스케줄
    if (schedule.type === STATUS.SCHEDULE.COMPLETED) {
      completedWorkDays++;
      completedScheduleKeys.add(buildScheduleStatsCountKey(schedule));

      // 수익 계산 — 동결값 판정은 shouldUseFrozenPayrollAmount 를 유일 관문으로 쓴다.
      // 과거의 `payrollAmount > 0` 가드는 **정산 0원 완료 건**(노쇼 등)을 동결값으로 인정하지
      // 않고 재계산으로 흘려보내, 실제로 0원 지급한 근무를 수입 합계에 양수로 올렸다.
      let amount = 0;

      if (
        shouldUseFrozenPayrollAmount(
          schedule.payrollStatus === STATUS.PAYROLL.COMPLETED,
          schedule.payrollAmount
        )
      ) {
        // 1순위: 구인자 확정 금액(동결값). 0원도 존중한다.
        amount = schedule.payrollAmount;
      } else if (hasPendingPayrollEstimate(schedule.payrollAmount)) {
        // 2순위: 아직 정산 완료 전이지만 금액이 잡힌 건 — '정산 예정' 집계의 근거다.
        // 여기를 지우면 예정액이 통째로 0원으로 보인다(구인자가 금액을 넣어둔 상태인데도).
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

        // 정산 완료분과 아직 처리 전인 추정치를 분리한다. 한 숫자로 합치면
        // 입금 예정액으로 오해돼 급여 문의·분쟁의 출발점이 된다.
        if (schedule.payrollStatus === STATUS.PAYROLL.COMPLETED) {
          settledEarnings += amount;
        } else if (schedule.payrollStatus !== STATUS.PAYROLL.FAILED) {
          estimatedEarnings += amount;
        }
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

  // 확정/지원 카운트는 조회된 월(schedules는 useSchedulesByMonth로 이미 월별 스코프됨)의
  // confirmed/applied 전체를 센다 — 리스트·캘린더 표시 기준(type만 판정, 날짜 필터 없음)과 통일.
  // 과거 date >= today 필터는 과거 월 조회 시 확정건을 전부 누락시켜 리스트와 불일치를 유발했다.
  datedSchedules.forEach((schedule) => {
    if (schedule.type === STATUS.SCHEDULE.CONFIRMED) {
      confirmedScheduleKeys.add(buildScheduleStatsCountKey(schedule));
    }

    if (schedule.type === STATUS.SCHEDULE.APPLIED) {
      upcomingScheduleKeys.add(buildScheduleStatsCountKey(schedule));
    }
  });

  return {
    totalSchedules: schedules.length,
    completedSchedules: completedScheduleKeys.size,
    confirmedSchedules: confirmedScheduleKeys.size,
    upcomingSchedules: upcomingScheduleKeys.size,
    completedWorkDays,
    totalEarnings,
    thisMonthEarnings,
    settledEarnings,
    estimatedEarnings,
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
    const mappedStatus = mapScheduleStatusFilter(filters?.status);

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
    // 5-6. ScheduleEvent 변환 + 병합/중복 제거
    // ========================================
    const mergedSchedules = buildScheduleEvents(
      workLogs,
      applications,
      jobPostingContextMap,
      filters?.dateRange
    );

    // ========================================
    // 7. 클라이언트 사이드 필터링
    // ========================================
    const filteredSchedules = applyScheduleFilters(mergedSchedules, filters);
    const visibleSchedules = filteredSchedules.filter((schedule) => hasScheduleDate(schedule.date));

    // ========================================
    // 8. 통계 계산
    // ========================================
    const stats = calculateScheduleStats(filteredSchedules);

    const duration = Date.now() - startTime;
    logger.info('스케줄 목록 조회 완료', {
      count: visibleSchedules.length,
      workLogsCount: workLogs.length,
      applicationsCount: applications.length,
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
    // 앞뒤로 여유를 두고 조회해야 월 경계를 넘는 연속 근무가 한 그룹으로 성립한다.
    const paddedRange = padDateRange(dateRange, MONTH_BOUNDARY_PADDING_DAYS);

    const result = await getMySchedules(staffId, { dateRange: paddedRange }, 100);

    // 표시·집계 기준은 그대로 '그 달'이고, 패딩분은 그룹핑 재료로만 따로 넘긴다.
    const inMonth: ScheduleEvent[] = [];
    const outOfMonth: ScheduleEvent[] = [];
    for (const schedule of result.schedules) {
      if (schedule.date >= dateRange.start && schedule.date <= dateRange.end) {
        inMonth.push(schedule);
      } else {
        outOfMonth.push(schedule);
      }
    }

    // 그 달에 근무가 하나도 없는 지원의 패딩분까지 끌고 오면 남의 달 일정이 섞인다.
    const monthApplicationIds = new Set(
      inMonth.map((schedule) => schedule.applicationId).filter(Boolean)
    );
    const boundarySchedules = outOfMonth.filter(
      (schedule) => schedule.applicationId && monthApplicationIds.has(schedule.applicationId)
    );

    return {
      ...result,
      schedules: inMonth,
      stats: calculateScheduleStats(inMonth),
      ...(boundarySchedules.length > 0 && { boundarySchedules }),
    };
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
      } else {
        // 컨테이너 2차 해소(#6) — 근무표 직접배치는 컨테이너를 가리켜 getById 가 제외한다.
        // 목록 경로와 같은 헬퍼를 쓴다(두 곳이 갈라지면 상세만 조용히 낡는다).
        postingContext = (await resolveContainerContexts([normalizedJobId])).get(normalizedJobId);
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

        const schedules = buildScheduleEvents(
          workLogsSnapshot,
          applicationsSnapshot,
          postingContextMap
        );
        if (hasErrored || emissionId !== latestEmissionId) return;
        onUpdate(schedules.filter((schedule) => hasScheduleDate(schedule.date)));
      } catch (error) {
        if (hasErrored || emissionId !== latestEmissionId) return;
        logger.error('스케줄 구독 처리 실패', toError(error));
        onError?.(toError(error));
      }
    };

    const handleSubscriptionError = (error: Error) => {
      if (hasErrored) return;
      hasErrored = true;

      // Realtime CHANNEL_ERROR 등 transient 에러는 Phoenix가 자동 재연결하므로
      // warn 수준으로 로깅하여 Sentry 노이즈를 방지한다.
      if (isAppError(error) && error.isRetryable) {
        logger.warn('스케줄 구독 일시 장애 (자동 재시도 중)', { message: error.message });
      } else {
        logger.error('스케줄 구독 에러', error);
      }
      onError?.(error);
    };

    /**
     * 새 스냅샷 도착 = 구독 정상 동작 증거.
     * Realtime 채널이 CHANNEL_ERROR 후 Phoenix 재연결로 복구되면 Repository가
     * 'RECOVERED' 신호를 받아 데이터를 재조회하고 onData로 전달한다. 이때
     * hasErrored가 true로 고정되어 있으면 emitSchedules가 영원히 차단되므로,
     * 새 데이터 수신을 복구 증거로 삼아 플래그를 리셋한다.
     */
    const markRecoveredOnSnapshot = () => {
      hasErrored = false;
    };

    const workLogUnsubscribe = workLogRepository.subscribeByStaffId(
      staffId,
      (workLogs: WorkLog[]) => {
        markRecoveredOnSnapshot();
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
        markRecoveredOnSnapshot();
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
