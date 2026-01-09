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
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { mapFirebaseError } from '@/errors';
import type {
  ScheduleEvent,
  ScheduleFilters,
  ScheduleStats,
  ScheduleGroup,
  ScheduleType,
  WorkLog,
} from '@/types';

// ============================================================================
// Constants
// ============================================================================

const WORK_LOGS_COLLECTION = 'workLogs';
// export for future use - suppresses unused warning
export const APPLICATIONS_COLLECTION = 'applications'; // 향후 지원 기반 스케줄 조회 시 활용
const JOB_POSTINGS_COLLECTION = 'jobPostings';
const DEFAULT_PAGE_SIZE = 50;

// ============================================================================
// Types
// ============================================================================

export interface ScheduleQueryResult {
  schedules: ScheduleEvent[];
  stats: ScheduleStats;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 날짜 문자열을 YYYY-MM-DD 형식으로 변환
 */
function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 월의 시작일과 끝일 계산
 */
function getMonthRange(year: number, month: number): { start: string; end: string } {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  return {
    start: formatDateString(startDate),
    end: formatDateString(endDate),
  };
}

/**
 * WorkLog를 ScheduleEvent로 변환
 */
function workLogToScheduleEvent(
  workLog: WorkLog,
  jobPosting?: { title: string; location: string }
): ScheduleEvent {
  // status 매핑: WorkLog status → ScheduleType
  let type: ScheduleType = 'confirmed';
  if (workLog.status === 'completed' || workLog.status === 'checked_out') {
    type = 'completed';
  } else if (workLog.status === 'cancelled') {
    type = 'cancelled';
  }

  return {
    id: workLog.id,
    type,
    date: workLog.date,
    startTime: workLog.scheduledStartTime
      ? typeof workLog.scheduledStartTime === 'string'
        ? null
        : workLog.scheduledStartTime
      : null,
    endTime: workLog.scheduledEndTime
      ? typeof workLog.scheduledEndTime === 'string'
        ? null
        : workLog.scheduledEndTime
      : null,
    actualStartTime: workLog.actualStartTime
      ? typeof workLog.actualStartTime === 'string'
        ? null
        : workLog.actualStartTime
      : null,
    actualEndTime: workLog.actualEndTime
      ? typeof workLog.actualEndTime === 'string'
        ? null
        : workLog.actualEndTime
      : null,
    eventId: workLog.eventId,
    eventName: jobPosting?.title || '이벤트',
    location: jobPosting?.location || '',
    role: workLog.role,
    status:
      workLog.status === 'checked_in'
        ? 'checked_in'
        : workLog.status === 'checked_out' || workLog.status === 'completed'
          ? 'checked_out'
          : 'not_started',
    payrollStatus: workLog.payrollStatus,
    payrollAmount: workLog.payrollAmount,
    notes: workLog.notes,
    sourceCollection: 'workLogs',
    sourceId: workLog.id,
    workLogId: workLog.id,
    createdAt: workLog.createdAt,
    updatedAt: workLog.updatedAt,
  };
}

/**
 * 스케줄 통계 계산
 */
function calculateStats(schedules: ScheduleEvent[]): ScheduleStats {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const today = formatDateString(now);

  let completedSchedules = 0;
  let upcomingSchedules = 0;
  let totalEarnings = 0;
  let thisMonthEarnings = 0;
  let hoursWorked = 0;

  schedules.forEach((schedule) => {
    // 완료된 스케줄
    if (schedule.type === 'completed') {
      completedSchedules++;

      // 총 수익
      if (schedule.payrollAmount) {
        totalEarnings += schedule.payrollAmount;

        // 이번 달 수익
        const scheduleDate = new Date(schedule.date);
        if (
          scheduleDate.getMonth() === currentMonth &&
          scheduleDate.getFullYear() === currentYear
        ) {
          thisMonthEarnings += schedule.payrollAmount;
        }
      }

      // 근무 시간 계산
      if (schedule.actualStartTime && schedule.actualEndTime) {
        const start =
          schedule.actualStartTime instanceof Timestamp
            ? schedule.actualStartTime.toDate()
            : new Date(schedule.actualStartTime as unknown as string);
        const end =
          schedule.actualEndTime instanceof Timestamp
            ? schedule.actualEndTime.toDate()
            : new Date(schedule.actualEndTime as unknown as string);
        hoursWorked += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      }
    }

    // 예정된 스케줄
    if (schedule.date >= today && schedule.type === 'confirmed') {
      upcomingSchedules++;
    }
  });

  return {
    totalSchedules: schedules.length,
    completedSchedules,
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
  const today = formatDateString(new Date());

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
 */
export async function getMySchedules(
  staffId: string,
  filters?: ScheduleFilters,
  pageSize: number = DEFAULT_PAGE_SIZE
): Promise<ScheduleQueryResult> {
  try {
    logger.info('스케줄 목록 조회', { staffId, filters });

    const workLogsRef = collection(getFirebaseDb(), WORK_LOGS_COLLECTION);
    const constraints: Parameters<typeof query>[1][] = [];

    // 스태프 ID 필터 (필수)
    constraints.push(where('staffId', '==', staffId));

    // 날짜 범위 필터
    if (filters?.dateRange) {
      constraints.push(where('date', '>=', filters.dateRange.start));
      constraints.push(where('date', '<=', filters.dateRange.end));
    }

    // 상태 필터
    if (filters?.status) {
      const statusMapping: Record<string, string[]> = {
        not_started: ['scheduled'],
        checked_in: ['checked_in'],
        checked_out: ['checked_out', 'completed'],
      };
      const firestoreStatuses = statusMapping[filters.status] || [filters.status];
      if (firestoreStatuses.length === 1) {
        constraints.push(where('status', '==', firestoreStatuses[0]));
      }
    }

    // 정렬
    constraints.push(orderBy('date', 'desc'));
    constraints.push(limit(pageSize));

    const q = query(workLogsRef, ...constraints);
    const snapshot = await getDocs(q);

    // WorkLog 데이터 수집
    const workLogs: WorkLog[] = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as WorkLog[];

    // 이벤트 정보 조회 (일괄)
    const eventIds = [...new Set(workLogs.map((wl) => wl.eventId))];
    const eventInfoMap = new Map<string, { title: string; location: string }>();

    // 이벤트 정보 조회 (병렬)
    await Promise.all(
      eventIds.map(async (eventId) => {
        try {
          const eventDoc = await getDoc(doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, eventId));
          if (eventDoc.exists()) {
            const data = eventDoc.data();
            eventInfoMap.set(eventId, {
              title: data.title || '이벤트',
              location: data.location?.name || data.location || '',
            });
          }
        } catch {
          // 이벤트 정보 조회 실패 시 무시
        }
      })
    );

    // ScheduleEvent로 변환
    const schedules: ScheduleEvent[] = workLogs.map((workLog) =>
      workLogToScheduleEvent(workLog, eventInfoMap.get(workLog.eventId))
    );

    // 검색어 필터 (클라이언트 사이드)
    let filteredSchedules = schedules;
    if (filters?.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filteredSchedules = schedules.filter(
        (s) =>
          s.eventName.toLowerCase().includes(term) ||
          s.location.toLowerCase().includes(term) ||
          s.role.toLowerCase().includes(term)
      );
    }

    // 타입 필터 (클라이언트 사이드)
    if (filters?.type) {
      filteredSchedules = filteredSchedules.filter((s) => s.type === filters.type);
    }

    // 통계 계산
    const stats = calculateStats(filteredSchedules);

    logger.info('스케줄 목록 조회 완료', { count: filteredSchedules.length });

    return { schedules: filteredSchedules, stats };
  } catch (error) {
    logger.error('스케줄 목록 조회 실패', error as Error, { staffId });
    throw mapFirebaseError(error);
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
    logger.error('날짜별 스케줄 조회 실패', error as Error, { staffId, date });
    throw mapFirebaseError(error);
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
    logger.error('월별 스케줄 조회 실패', error as Error, { staffId, year, month });
    throw mapFirebaseError(error);
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

    const workLog = { id: workLogDoc.id, ...workLogDoc.data() } as WorkLog;

    // 이벤트 정보 조회
    let eventInfo: { title: string; location: string } | undefined;
    try {
      const eventDoc = await getDoc(doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, workLog.eventId));
      if (eventDoc.exists()) {
        const data = eventDoc.data();
        eventInfo = {
          title: data.title || '이벤트',
          location: data.location?.name || data.location || '',
        };
      }
    } catch {
      // 이벤트 정보 조회 실패 시 무시
    }

    return workLogToScheduleEvent(workLog, eventInfo);
  } catch (error) {
    logger.error('스케줄 상세 조회 실패', error as Error, { scheduleId });
    throw mapFirebaseError(error);
  }
}

/**
 * 오늘의 스케줄 조회
 */
export async function getTodaySchedules(staffId: string): Promise<ScheduleEvent[]> {
  const today = formatDateString(new Date());
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
        start: formatDateString(today),
        end: formatDateString(endDate),
      },
    });

    // confirmed 상태만 필터링
    return schedules.filter((s) => s.type === 'confirmed' || s.type === 'applied');
  } catch (error) {
    logger.error('다가오는 스케줄 조회 실패', error as Error, { staffId });
    throw mapFirebaseError(error);
  }
}

/**
 * 스케줄 실시간 구독
 */
export function subscribeToSchedules(
  staffId: string,
  onUpdate: (schedules: ScheduleEvent[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
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
        const workLogs: WorkLog[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as WorkLog[];

        // 이벤트 정보 조회
        const eventIds = [...new Set(workLogs.map((wl) => wl.eventId))];
        const eventInfoMap = new Map<string, { title: string; location: string }>();

        await Promise.all(
          eventIds.map(async (eventId) => {
            try {
              const eventDoc = await getDoc(doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, eventId));
              if (eventDoc.exists()) {
                const data = eventDoc.data();
                eventInfoMap.set(eventId, {
                  title: data.title || '이벤트',
                  location: data.location?.name || data.location || '',
                });
              }
            } catch {
              // 무시
            }
          })
        );

        const schedules = workLogs.map((workLog) =>
          workLogToScheduleEvent(workLog, eventInfoMap.get(workLog.eventId))
        );

        onUpdate(schedules);
      } catch (error) {
        logger.error('스케줄 구독 처리 실패', error as Error);
        onError?.(error as Error);
      }
    },
    (error) => {
      logger.error('스케줄 구독 에러', error);
      onError?.(error);
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
          start: formatDateString(sixMonthsAgo),
          end: formatDateString(now),
        },
      },
      500
    );

    return stats;
  } catch (error) {
    logger.error('스케줄 통계 조회 실패', error as Error, { staffId });
    throw mapFirebaseError(error);
  }
}
