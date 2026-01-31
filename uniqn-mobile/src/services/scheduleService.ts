/**
 * UNIQN Mobile - 스케줄 서비스
 *
 * @description Firebase Firestore 기반 스케줄 서비스
 * @version 1.0.0
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
  documentId,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { NetworkError, ERROR_CODES, toError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { FIREBASE_LIMITS } from '@/constants';
import { toDateString } from '@/utils/date';
import { timestampToDate } from '@/utils/firestore';
import type {
  ScheduleEvent,
  ScheduleFilters,
  ScheduleStats,
  ScheduleGroup,
  ScheduleType,
  WorkLog,
  Application,
} from '@/types';
import { toJobPostingCard } from '@/types/jobPosting';
import {
  parseJobPostingDocument,
  parseWorkLogDocuments,
  parseApplicationDocuments,
  parseWorkLogDocument,
} from '@/schemas';
import { IdNormalizer } from '@/shared/id';
import { ScheduleMerger, ScheduleConverter, type JobPostingCardWithMeta } from '@/domains/schedule';
import { RealtimeManager } from '@/shared/realtime';
import { QueryBuilder } from '@/utils/firestore/queryBuilder';

// ============================================================================
// Constants
// ============================================================================

const WORK_LOGS_COLLECTION = 'workLogs';
const APPLICATIONS_COLLECTION = 'applications';
const JOB_POSTINGS_COLLECTION = 'jobPostings';
const DEFAULT_PAGE_SIZE = 50;

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
 * 이벤트 정보 일괄 조회 (부분 실패 허용)
 * @description JobPostingCard 전체 데이터를 반환하여 스케줄 탭에서 JobCard 사용 가능
 */
async function fetchJobPostingCardBatch(eventIds: string[]): Promise<Map<string, JobPostingCardWithMeta>> {
  const cardMap = new Map<string, JobPostingCardWithMeta>();

  if (eventIds.length === 0) {
    return cardMap;
  }

  // Firestore whereIn 최대 30개 제한 → 청크 분할
  const uniqueIds = [...new Set(eventIds)]; // 중복 제거
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += FIREBASE_LIMITS.WHERE_IN_MAX_ITEMS) {
    chunks.push(uniqueIds.slice(i, i + FIREBASE_LIMITS.WHERE_IN_MAX_ITEMS));
  }

  // 청크별 배치 쿼리 (병렬 처리)
  const results = await Promise.allSettled(
    chunks.map(async (chunk) => {
      const q = query(
        collection(getFirebaseDb(), JOB_POSTINGS_COLLECTION),
        where(documentId(), 'in', chunk)
      );
      return getDocs(q);
    })
  );

  // 결과 처리
  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const docSnap of result.value.docs) {
        const data = docSnap.data();
        const jobPosting = parseJobPostingDocument({ id: docSnap.id, ...data });
        if (!jobPosting) {
          logger.warn('JobPosting 문서 파싱 실패', { docId: docSnap.id });
          continue;
        }
        const card = toJobPostingCard(jobPosting);
        cardMap.set(docSnap.id, {
          card,
          title: data.title || '이벤트',
          location: typeof data.location === 'string' ? data.location : (data.location?.name || ''),
          contactPhone: data.contactPhone,
          ownerId: data.ownerId,
        });
      }
    } else {
      logger.warn('공고 배치 조회 실패', { error: result.reason });
    }
  }

  // 조회되지 않은 ID 로깅 (삭제된 공고 등)
  const missingIds = uniqueIds.filter((id) => !cardMap.has(id));
  if (missingIds.length > 0) {
    logger.debug('일부 공고 정보 없음 (삭제됨)', {
      missingCount: missingIds.length,
      totalCount: uniqueIds.length,
    });
  }

  return cardMap;
}

/**
 * WorkLogs와 Applications 스케줄을 병합하고 중복 제거
 *
 * @description Phase 5 - ScheduleMerger로 위임
 * 중복 판별 기준: 같은 eventId + 같은 date
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
function calculateStats(schedules: ScheduleEvent[]): ScheduleStats {
  const today = toDateString(new Date());

  let completedSchedules = 0;
  let confirmedSchedules = 0;
  let upcomingSchedules = 0;
  let totalEarnings = 0;
  let thisMonthEarnings = 0;
  let hoursWorked = 0;

  schedules.forEach((schedule) => {
    // 완료된 스케줄
    if (schedule.type === 'completed') {
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
          breakdown.taxSettings?.type !== 'none'
            ? breakdown.afterTaxPay
            : breakdown.totalPay;
      }

      if (amount > 0) {
        totalEarnings += amount;
        thisMonthEarnings += amount;
      }

      // 근무 시간 계산
      const start = timestampToDate(schedule.checkInTime);
      const end = timestampToDate(schedule.checkOutTime);
      if (start && end) {
        hoursWorked += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      }
    }

    // 확정된 스케줄 (미래 날짜, confirmed)
    if (schedule.date >= today && schedule.type === 'confirmed') {
      confirmedSchedules++;
    }

    // 지원 중인 스케줄 (미래 날짜, applied)
    if (schedule.date >= today && schedule.type === 'applied') {
      upcomingSchedules++;
    }
  });

  return {
    totalSchedules: schedules.length,
    completedSchedules,
    confirmedSchedules,
    upcomingSchedules,
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
    const date = schedule.date;
    if (!groups.has(date)) {
      groups.set(date, []);
    }
    groups.get(date)!.push(schedule);
  });

  // ScheduleGroup 배열로 변환
  const result: ScheduleGroup[] = [];
  groups.forEach((events, date) => {
    const dateObj = new Date(date);
    const isPast = date < today;
    const isToday = date === today;

    // 날짜 포맷팅
    const formattedDate = dateObj.toLocaleDateString('ko-KR', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });

    result.push({
      date,
      formattedDate,
      events: events.sort((a, b) => {
        // 시작 시간 순으로 정렬
        if (!a.startTime) return 1;
        if (!b.startTime) return -1;
        const aTime = a.startTime instanceof Timestamp ? a.startTime.toMillis() : 0;
        const bTime = b.startTime instanceof Timestamp ? b.startTime.toMillis() : 0;
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
    // 1. WorkLogs 쿼리 구성 (QueryBuilder 사용)
    // ========================================
    const workLogsRef = collection(getFirebaseDb(), WORK_LOGS_COLLECTION);

    // 상태 매핑 (UI 상태 → Firestore 상태)
    let mappedStatus: string | undefined;
    if (filters?.status) {
      const statusMapping: Record<string, string> = {
        not_started: 'scheduled',
        checked_in: 'checked_in',
        checked_out: 'checked_out',
      };
      mappedStatus = statusMapping[filters.status];
    }

    const workLogsQuery = new QueryBuilder(workLogsRef)
      .whereEqual('staffId', staffId)
      .whereDateRange('date', filters?.dateRange)
      .whereIf(!!mappedStatus, 'status', '==', mappedStatus)
      .orderByDesc('date')
      .limit(pageSize)
      .build();

    // ========================================
    // 2. Applications 쿼리 구성 (QueryBuilder 사용)
    // ========================================
    // 복합 인덱스: applicantId + status + createdAt (firestore.indexes.json 참조)
    const applicationsRef = collection(getFirebaseDb(), APPLICATIONS_COLLECTION);

    const applicationsQuery = new QueryBuilder(applicationsRef)
      .whereEqual('applicantId', staffId)
      .whereIn('status', ['applied', 'pending'])
      .orderByDesc('createdAt')
      .limit(pageSize)
      .build();

    // ========================================
    // 3. 병렬 조회 (부분 실패 허용)
    // ========================================
    const [workLogsResult, applicationsResult] = await Promise.allSettled([
      getDocs(workLogsQuery),
      getDocs(applicationsQuery),
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
    // 4. 데이터 파싱 (안전한 파서 사용)
    // ========================================
    const workLogs: WorkLog[] =
      workLogsResult.status === 'fulfilled'
        ? parseWorkLogDocuments(
            workLogsResult.value.docs.map((docSnap) => ({
              id: docSnap.id,
              ...docSnap.data(),
            }))
          )
        : [];

    const applications: Application[] =
      applicationsResult.status === 'fulfilled'
        ? parseApplicationDocuments(
            applicationsResult.value.docs.map((docSnap) => ({
              id: docSnap.id,
              ...docSnap.data(),
            }))
          )
        : [];

    // ========================================
    // 5. 공고 정보 일괄 조회 (JobPostingCard 포함)
    // ========================================
    // IdNormalizer로 통합 ID 추출 (eventId/jobPostingId 혼용 해결)
    const allJobPostingIds = IdNormalizer.extractUnifiedIds(workLogs, applications);
    const jobPostingCardMap = await fetchJobPostingCardBatch(Array.from(allJobPostingIds));

    // ========================================
    // 6. ScheduleEvent 변환
    // ========================================
    // WorkLogs → ScheduleEvent (IdNormalizer로 정규화된 ID 사용)
    const workLogSchedules: ScheduleEvent[] = workLogs.map((workLog) => {
      const normalizedId = IdNormalizer.normalizeJobId(workLog);
      const cardInfo = jobPostingCardMap.get(normalizedId);
      return ScheduleConverter.workLogToScheduleEvent(workLog, cardInfo);
    });

    // Applications → ScheduleEvent[] (다중 날짜 지원)
    const applicationSchedules: ScheduleEvent[] = applications.flatMap((app) => {
      const normalizedId = IdNormalizer.normalizeJobId(app);
      const cardInfo = jobPostingCardMap.get(normalizedId);
      return ScheduleConverter.applicationToScheduleEvents(app, cardInfo);
    });

    // ========================================
    // 7. 병합 및 중복 제거
    // ========================================
    const mergedSchedules = mergeAndDeduplicateSchedules(
      workLogSchedules,
      applicationSchedules,
      filters?.dateRange
    );

    // ========================================
    // 8. 클라이언트 사이드 필터링
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

    // ========================================
    // 9. 통계 계산
    // ========================================
    const stats = calculateStats(filteredSchedules);

    const duration = Date.now() - startTime;
    logger.info('스케줄 목록 조회 완료', {
      count: filteredSchedules.length,
      workLogsCount: workLogSchedules.length,
      applicationsCount: applicationSchedules.length,
      durationMs: duration,
    });

    return {
      schedules: filteredSchedules,
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
export async function getSchedulesByDate(
  staffId: string,
  date: string
): Promise<ScheduleEvent[]> {
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

    // WorkLog에서 조회
    const workLogDoc = await getDoc(doc(getFirebaseDb(), WORK_LOGS_COLLECTION, scheduleId));

    if (!workLogDoc.exists()) {
      logger.warn('스케줄을 찾을 수 없음', { scheduleId });
      return null;
    }

    const workLog = parseWorkLogDocument({ id: workLogDoc.id, ...workLogDoc.data() });
    if (!workLog) {
      logger.warn('WorkLog 문서 파싱 실패', { scheduleId });
      return null;
    }

    // 공고 정보 조회 (JobPostingCard 포함)
    // IdNormalizer로 통합 ID 추출 (eventId/jobPostingId 혼용 해결)
    const normalizedJobId = IdNormalizer.normalizeJobId(workLog);
    let cardInfo: JobPostingCardWithMeta | undefined;
    try {
      const eventDoc = await getDoc(doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, normalizedJobId));
      if (eventDoc.exists()) {
        const data = eventDoc.data();
        const jobPosting = parseJobPostingDocument({ id: eventDoc.id, ...data });
        if (jobPosting) {
          cardInfo = {
            card: toJobPostingCard(jobPosting),
            title: data.title || '이벤트',
            location: typeof data.location === 'string' ? data.location : (data.location?.name || ''),
            contactPhone: data.contactPhone,
            ownerId: data.ownerId,
          };
        } else {
          logger.debug('JobPosting 문서 파싱 실패 (상세)', { jobPostingId: normalizedJobId });
        }
      }
    } catch (err) {
      logger.debug('공고 정보 조회 실패 (상세)', { jobPostingId: normalizedJobId, error: err });
    }

    return ScheduleConverter.workLogToScheduleEvent(workLog, cardInfo);
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
    return schedules.filter((s) => s.type === 'confirmed' || s.type === 'applied');
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
): Unsubscribe {
  return RealtimeManager.subscribe(
    RealtimeManager.Keys.schedules(staffId),
    () => {
      logger.info('스케줄 구독 시작', { staffId });

      const workLogsRef = collection(getFirebaseDb(), WORK_LOGS_COLLECTION);
      const q = query(
        workLogsRef,
        where('staffId', '==', staffId),
        orderBy('date', 'desc'),
        limit(50)
      );

      return onSnapshot(
        q,
        async (snapshot) => {
          try {
            const workLogs: WorkLog[] = parseWorkLogDocuments(
              snapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                ...docSnap.data(),
              }))
            );

            // 공고 정보 일괄 조회 (배치 쿼리 - N+1 해결)
            // IdNormalizer로 통합 ID 추출 (eventId/jobPostingId 혼용 해결)
            const jobPostingIds = workLogs.map((wl) => IdNormalizer.normalizeJobId(wl));
            const cardInfoMap = await fetchJobPostingCardBatch(jobPostingIds);

            const schedules = workLogs.map((workLog) => {
              const normalizedId = IdNormalizer.normalizeJobId(workLog);
              return ScheduleConverter.workLogToScheduleEvent(workLog, cardInfoMap.get(normalizedId));
            });

            onUpdate(schedules);
          } catch (error) {
            logger.error('스케줄 구독 처리 실패', toError(error));
            onError?.(toError(error));
          }
        },
        (error) => {
          logger.error('스케줄 구독 에러', error);
          onError?.(error);
        }
      );
    }
  );
}

/**
 * 캘린더용 날짜별 마킹 데이터 생성
 */
export function getCalendarMarkedDates(
  schedules: ScheduleEvent[]
): Record<string, { marked: boolean; dotColor: string; type?: ScheduleType }> {
  const markedDates: Record<
    string,
    { marked: boolean; dotColor: string; type?: ScheduleType }
  > = {};

  const colorMap: Record<ScheduleType, string> = {
    applied: '#f59e0b', // yellow-500
    confirmed: '#22c55e', // green-500
    completed: '#3b82f6', // blue-500
    cancelled: '#ef4444', // red-500
  };

  schedules.forEach((schedule) => {
    // 이미 마킹된 날짜가 있으면 우선순위에 따라 결정
    // 우선순위: confirmed > applied > completed > cancelled
    if (!markedDates[schedule.date]) {
      markedDates[schedule.date] = {
        marked: true,
        dotColor: colorMap[schedule.type],
        type: schedule.type,
      };
    } else if (
      schedule.type === 'confirmed' ||
      (schedule.type === 'applied' && markedDates[schedule.date].type !== 'confirmed')
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
