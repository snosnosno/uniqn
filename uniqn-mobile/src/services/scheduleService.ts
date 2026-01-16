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
import { mapFirebaseError, NetworkError, ERROR_CODES } from '@/errors';
import { calculateSettlementBreakdown } from '@/utils/settlement';
import type {
  ScheduleEvent,
  ScheduleFilters,
  ScheduleStats,
  ScheduleGroup,
  ScheduleType,
  WorkLog,
  Application,
  ApplicationStatus,
  JobPosting,
  JobPostingCard,
} from '@/types';
import { toJobPostingCard } from '@/types/jobPosting';
import { FIXED_DATE_MARKER, FIXED_TIME_MARKER, TBA_TIME_MARKER } from '@/types/assignment';

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
  cardInfo?: JobPostingCardWithMeta
): ScheduleEvent {
  // status 매핑: WorkLog status → ScheduleType
  let type: ScheduleType = 'confirmed';
  if (workLog.status === 'completed' || workLog.status === 'checked_out') {
    type = 'completed';
  } else if (workLog.status === 'cancelled') {
    type = 'cancelled';
  }

  // 정산 세부 내역 미리 계산 (SettlementTab에서 중복 계산 방지)
  const settlementBreakdown = calculateSettlementBreakdown(
    {
      actualStartTime: workLog.actualStartTime,
      actualEndTime: workLog.actualEndTime,
      scheduledStartTime: workLog.scheduledStartTime,
      scheduledEndTime: workLog.scheduledEndTime,
      role: workLog.role,
      customRole: workLog.customRole,
      customSalaryInfo: workLog.customSalaryInfo,
      customAllowances: workLog.customAllowances,
      customTaxSettings: workLog.customTaxSettings,
    },
    cardInfo?.card
  );

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
    eventName: cardInfo?.title || '이벤트',
    location: cardInfo?.location || '',
    role: workLog.role,
    customRole: workLog.customRole,
    status:
      workLog.status === 'checked_in'
        ? 'checked_in'
        : workLog.status === 'checked_out' || workLog.status === 'completed'
          ? 'checked_out'
          : 'not_started',
    payrollStatus: workLog.payrollStatus,
    payrollAmount: workLog.payrollAmount,
    ownerPhone: cardInfo?.contactPhone,
    ownerId: cardInfo?.ownerId,
    notes: workLog.notes,
    sourceCollection: 'workLogs',
    sourceId: workLog.id,
    workLogId: workLog.id,
    // 개별 오버라이드 (구인자가 스태프별로 수정한 정산 정보)
    customSalaryInfo: workLog.customSalaryInfo,
    customAllowances: workLog.customAllowances,
    customTaxSettings: workLog.customTaxSettings,
    jobPostingCard: cardInfo?.card,
    // 시간대 문자열 (확정 상태 시간 표시 폴백용)
    timeSlot: workLog.timeSlot,
    // 정산 세부 내역 (미리 계산됨)
    settlementBreakdown: settlementBreakdown || undefined,
    createdAt: workLog.createdAt,
    updatedAt: workLog.updatedAt,
  };
}

/**
 * 시간대 문자열을 Timestamp로 변환
 * @param timeSlot - "19:00" 또는 "19:00~22:00" 형식
 * @param date - YYYY-MM-DD
 * @param type - 'start' | 'end'
 */
function parseTimeSlotToTimestamp(
  timeSlot: string,
  date: string,
  type: 'start' | 'end'
): Timestamp | null {
  if (
    !timeSlot ||
    timeSlot === FIXED_TIME_MARKER ||
    timeSlot === TBA_TIME_MARKER ||
    timeSlot === '미정'
  ) {
    return null;
  }

  // "19:00~22:00" 형식 처리
  const parts = timeSlot.split('~').map((p) => p.trim());
  const timeStr = type === 'start' ? parts[0] : parts[1] || parts[0];

  if (!timeStr) return null;

  const timeParts = timeStr.split(':');
  if (timeParts.length < 2) return null;

  const hours = parseInt(timeParts[0], 10);
  const minutes = parseInt(timeParts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;

  const dateParts = date.split('-');
  if (dateParts.length !== 3) return null;

  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10);
  const day = parseInt(dateParts[2], 10);

  const dateObj = new Date(year, month - 1, day, hours, minutes);
  return Timestamp.fromDate(dateObj);
}

/**
 * Application status를 ScheduleType으로 매핑
 */
function mapApplicationStatusToScheduleType(status: ApplicationStatus): ScheduleType | null {
  const typeMapping: Record<ApplicationStatus, ScheduleType | null> = {
    applied: 'applied',
    pending: 'applied', // pending도 "지원 중"으로 표시
    confirmed: 'confirmed', // 확정 (workLogs와 중복될 수 있음)
    rejected: null, // 스케줄에 표시 안 함
    cancelled: 'cancelled',
    waitlisted: 'applied', // 대기자도 지원 중으로 표시
    completed: 'completed',
    cancellation_pending: 'confirmed', // 취소 요청 중이지만 아직 확정 상태
  };

  return typeMapping[status] ?? null;
}

/**
 * Application의 Assignment를 ScheduleEvent 배열로 변환
 * @description 하나의 Application이 여러 날짜에 지원했을 수 있으므로 배열 반환
 */
function applicationToScheduleEvents(
  application: Application,
  cardInfo?: JobPostingCardWithMeta
): ScheduleEvent[] {
  const events: ScheduleEvent[] = [];

  const scheduleType = mapApplicationStatusToScheduleType(application.status);

  // 표시하지 않을 상태인 경우 빈 배열 반환
  if (!scheduleType) {
    return events;
  }

  // assignments가 있는 경우 (v2.0 지원서)
  if (application.assignments && application.assignments.length > 0) {
    for (const assignment of application.assignments) {
      // 각 날짜별로 ScheduleEvent 생성
      for (const date of assignment.dates) {
        // 고정공고 마커는 스킵
        if (date === FIXED_DATE_MARKER) continue;

        const event: ScheduleEvent = {
          id: `${application.id}_${date}_${assignment.timeSlot}`,
          type: scheduleType,
          date,
          startTime: parseTimeSlotToTimestamp(assignment.timeSlot, date, 'start'),
          endTime: parseTimeSlotToTimestamp(assignment.timeSlot, date, 'end'),
          actualStartTime: null,
          actualEndTime: null,
          eventId: application.jobPostingId,
          eventName: cardInfo?.title || application.jobPostingTitle || '공고',
          location: cardInfo?.location || '',
          role: assignment.roleIds[0] || application.appliedRole,
          customRole: application.customRole,
          status: 'not_started', // applications에는 출퇴근 데이터 없음
          payrollStatus: undefined,
          payrollAmount: undefined,
          ownerPhone: cardInfo?.contactPhone,
          ownerId: cardInfo?.ownerId,
          notes: application.message,
          sourceCollection: 'applications',
          sourceId: application.id,
          applicationId: application.id,
          jobPostingCard: cardInfo?.card,
          timeSlot: assignment.timeSlot,
          createdAt: application.createdAt,
          updatedAt: application.updatedAt,
        };
        events.push(event);
      }
    }
  } else if (application.appliedDate) {
    // 레거시 지원서 (assignments 없음) - appliedDate 사용
    const event: ScheduleEvent = {
      id: `${application.id}_${application.appliedDate}`,
      type: scheduleType,
      date: application.appliedDate,
      startTime: application.appliedTimeSlot
        ? parseTimeSlotToTimestamp(application.appliedTimeSlot, application.appliedDate, 'start')
        : null,
      endTime: application.appliedTimeSlot
        ? parseTimeSlotToTimestamp(application.appliedTimeSlot, application.appliedDate, 'end')
        : null,
      actualStartTime: null,
      actualEndTime: null,
      eventId: application.jobPostingId,
      eventName: cardInfo?.title || application.jobPostingTitle || '공고',
      location: cardInfo?.location || '',
      role: application.appliedRole,
      customRole: application.customRole,
      status: 'not_started',
      payrollStatus: undefined,
      payrollAmount: undefined,
      ownerPhone: cardInfo?.contactPhone,
      ownerId: cardInfo?.ownerId,
      notes: application.message,
      sourceCollection: 'applications',
      sourceId: application.id,
      applicationId: application.id,
      jobPostingCard: cardInfo?.card,
      timeSlot: application.appliedTimeSlot,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    };
    events.push(event);
  }

  return events;
}

/**
 * 이벤트 정보 일괄 조회 (부분 실패 허용)
 * @description JobPostingCard 전체 데이터를 반환하여 스케줄 탭에서 JobCard 사용 가능
 */
interface JobPostingCardWithMeta {
  card: JobPostingCard;
  title: string;
  location: string;
  contactPhone?: string;
  ownerId?: string;
}

async function fetchJobPostingCardBatch(eventIds: string[]): Promise<Map<string, JobPostingCardWithMeta>> {
  const cardMap = new Map<string, JobPostingCardWithMeta>();

  if (eventIds.length === 0) {
    return cardMap;
  }

  // 병렬 조회 with 개별 에러 처리
  const results = await Promise.allSettled(
    eventIds.map(async (eventId) => {
      const eventDoc = await getDoc(doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, eventId));

      if (eventDoc.exists()) {
        const data = eventDoc.data();
        const jobPosting = { id: eventDoc.id, ...data } as JobPosting;
        const card = toJobPostingCard(jobPosting);
        return {
          eventId,
          info: {
            card,
            title: data.title || '이벤트',
            location: typeof data.location === 'string' ? data.location : (data.location?.name || ''),
            contactPhone: data.contactPhone,
            ownerId: data.ownerId,
          },
        };
      }
      return { eventId, info: null };
    })
  );

  // 결과 처리
  let failedCount = 0;
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.info) {
      cardMap.set(result.value.eventId, result.value.info);
    } else if (result.status === 'rejected') {
      failedCount++;
    }
  }

  // 실패한 ID가 있으면 경고 로깅
  if (failedCount > 0) {
    logger.warn('일부 공고 정보 조회 실패', {
      failedCount,
      totalCount: eventIds.length,
    });
  }

  return cardMap;
}

/**
 * 스케줄 중복 체크용 키 생성
 */
function generateScheduleKey(schedule: ScheduleEvent): string {
  // eventId + date 조합으로 고유 키 생성
  return `${schedule.eventId}_${schedule.date}`;
}

/**
 * WorkLogs와 Applications 스케줄을 병합하고 중복 제거
 *
 * 중복 판별 기준: 같은 eventId + 같은 date
 * 우선순위: workLogs > applications (확정된 WorkLog가 있으면 Application은 제외)
 */
function mergeAndDeduplicateSchedules(
  workLogSchedules: ScheduleEvent[],
  applicationSchedules: ScheduleEvent[],
  dateRange?: { start: string; end: string }
): ScheduleEvent[] {
  // 1. WorkLogs로 중복 체크 맵 생성
  const existingKeys = new Set<string>();

  for (const schedule of workLogSchedules) {
    const key = generateScheduleKey(schedule);
    existingKeys.add(key);
  }

  // 2. Applications에서 중복 제거
  const filteredApplicationSchedules = applicationSchedules.filter((schedule) => {
    const key = generateScheduleKey(schedule);
    // 이미 WorkLog로 존재하면 제외
    if (existingKeys.has(key)) {
      return false;
    }

    // 날짜 범위 필터 (applications은 Firestore에서 필터링 못함)
    if (dateRange) {
      if (schedule.date < dateRange.start || schedule.date > dateRange.end) {
        return false;
      }
    }

    return true;
  });

  // 3. 병합 후 날짜순 정렬 (내림차순)
  const merged = [...workLogSchedules, ...filteredApplicationSchedules];
  merged.sort((a, b) => b.date.localeCompare(a.date));

  return merged;
}

/**
 * 스케줄 통계 계산
 * @description 조회된 스케줄 데이터 기준으로 통계를 계산
 * - thisMonthEarnings: 조회된 데이터(선택된 월)의 completed 수익 합계
 * - 지원/확정 카운트: 미래 날짜 기준으로 계산
 */
function calculateStats(schedules: ScheduleEvent[]): ScheduleStats {
  const today = formatDateString(new Date());

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
    // 1. WorkLogs 쿼리 구성
    // ========================================
    const workLogsRef = collection(getFirebaseDb(), WORK_LOGS_COLLECTION);
    const workLogsConstraints: Parameters<typeof query>[1][] = [
      where('staffId', '==', staffId),
    ];

    if (filters?.dateRange) {
      workLogsConstraints.push(where('date', '>=', filters.dateRange.start));
      workLogsConstraints.push(where('date', '<=', filters.dateRange.end));
    }

    if (filters?.status) {
      const statusMapping: Record<string, string[]> = {
        not_started: ['scheduled'],
        checked_in: ['checked_in'],
        checked_out: ['checked_out', 'completed'],
      };
      const firestoreStatuses = statusMapping[filters.status] || [filters.status];
      if (firestoreStatuses.length === 1) {
        workLogsConstraints.push(where('status', '==', firestoreStatuses[0]));
      }
    }

    workLogsConstraints.push(orderBy('date', 'desc'));
    workLogsConstraints.push(limit(pageSize));

    const workLogsQuery = query(workLogsRef, ...workLogsConstraints);

    // ========================================
    // 2. Applications 쿼리 구성
    // ========================================
    // 복합 인덱스: applicantId + status + createdAt (firestore.indexes.json 참조)
    // 인덱스 생성 완료 후 orderBy('createdAt', 'desc') 추가 가능
    const applicationsRef = collection(getFirebaseDb(), APPLICATIONS_COLLECTION);
    const applicationsConstraints: Parameters<typeof query>[1][] = [
      where('applicantId', '==', staffId),
      // 스케줄에 표시할 상태만 필터링
      where('status', 'in', ['applied', 'pending', 'waitlisted']),
    ];

    applicationsConstraints.push(orderBy('createdAt', 'desc'));
    applicationsConstraints.push(limit(pageSize));

    const applicationsQuery = query(applicationsRef, ...applicationsConstraints);

    // ========================================
    // 3. 병렬 조회 (부분 실패 허용)
    // ========================================
    const [workLogsResult, applicationsResult] = await Promise.allSettled([
      getDocs(workLogsQuery),
      getDocs(applicationsQuery),
    ]);

    // 둘 다 실패한 경우에만 에러 throw
    if (workLogsResult.status === 'rejected' && applicationsResult.status === 'rejected') {
      logger.error('WorkLogs, Applications 모두 조회 실패', workLogsResult.reason as Error, {
        staffId,
      });
      throw new NetworkError(ERROR_CODES.NETWORK_REQUEST_FAILED, {
        userMessage: '스케줄을 불러올 수 없습니다. 네트워크 연결을 확인해주세요.',
      });
    }

    // 부분 실패 로깅
    if (workLogsResult.status === 'rejected') {
      logger.warn('WorkLogs 조회 실패 (Applications는 성공)', {
        error: workLogsResult.reason,
        staffId,
      });
    }
    if (applicationsResult.status === 'rejected') {
      logger.warn('Applications 조회 실패 (WorkLogs는 성공)', {
        error: applicationsResult.reason,
        staffId,
      });
    }

    // ========================================
    // 4. 데이터 파싱
    // ========================================
    const workLogs: WorkLog[] =
      workLogsResult.status === 'fulfilled'
        ? workLogsResult.value.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) as WorkLog[]
        : [];

    const applications: Application[] =
      applicationsResult.status === 'fulfilled'
        ? applicationsResult.value.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) as Application[]
        : [];

    // ========================================
    // 5. 공고 정보 일괄 조회 (JobPostingCard 포함)
    // ========================================
    const workLogEventIds = workLogs.map((wl) => wl.eventId);
    const applicationEventIds = applications.map((app) => app.jobPostingId);
    const allEventIds = [...new Set([...workLogEventIds, ...applicationEventIds])];

    const jobPostingCardMap = await fetchJobPostingCardBatch(allEventIds);

    // ========================================
    // 6. ScheduleEvent 변환
    // ========================================
    // WorkLogs → ScheduleEvent
    const workLogSchedules: ScheduleEvent[] = workLogs.map((workLog) => {
      const cardInfo = jobPostingCardMap.get(workLog.eventId);
      return workLogToScheduleEvent(workLog, cardInfo);
    });

    // Applications → ScheduleEvent[] (다중 날짜 지원)
    const applicationSchedules: ScheduleEvent[] = applications.flatMap((app) => {
      const cardInfo = jobPostingCardMap.get(app.jobPostingId);
      return applicationToScheduleEvents(app, cardInfo);
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
          s.eventName.toLowerCase().includes(term) ||
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

    return { schedules: filteredSchedules, stats };
  } catch (error) {
    const appError = mapFirebaseError(error);
    logger.error('스케줄 목록 조회 실패', appError, { staffId });
    throw appError;
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

    // 공고 정보 조회 (JobPostingCard 포함)
    let cardInfo: JobPostingCardWithMeta | undefined;
    try {
      const eventDoc = await getDoc(doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, workLog.eventId));
      if (eventDoc.exists()) {
        const data = eventDoc.data();
        const jobPosting = { id: eventDoc.id, ...data } as JobPosting;
        cardInfo = {
          card: toJobPostingCard(jobPosting),
          title: data.title || '이벤트',
          location: typeof data.location === 'string' ? data.location : (data.location?.name || ''),
          contactPhone: data.contactPhone,
          ownerId: data.ownerId,
        };
      }
    } catch {
      // 공고 정보 조회 실패 시 무시
    }

    return workLogToScheduleEvent(workLog, cardInfo);
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

        // 공고 정보 조회 (JobPostingCard 포함)
        const eventIds = [...new Set(workLogs.map((wl) => wl.eventId))];
        const cardInfoMap = new Map<string, JobPostingCardWithMeta>();

        await Promise.all(
          eventIds.map(async (eventId) => {
            try {
              const eventDoc = await getDoc(doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, eventId));
              if (eventDoc.exists()) {
                const data = eventDoc.data();
                const jobPosting = { id: eventDoc.id, ...data } as JobPosting;
                cardInfoMap.set(eventId, {
                  card: toJobPostingCard(jobPosting),
                  title: data.title || '이벤트',
                  location: typeof data.location === 'string' ? data.location : (data.location?.name || ''),
                  contactPhone: data.contactPhone,
                  ownerId: data.ownerId,
                });
              }
            } catch {
              // 무시
            }
          })
        );

        const schedules = workLogs.map((workLog) =>
          workLogToScheduleEvent(workLog, cardInfoMap.get(workLog.eventId))
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
