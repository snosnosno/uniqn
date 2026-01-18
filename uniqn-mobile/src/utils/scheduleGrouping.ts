/**
 * UNIQN Mobile - 스케줄 그룹핑 유틸리티
 *
 * 같은 지원(applicationId)의 연속/비연속 다중 날짜를 하나의 카드로 통합
 *
 * @version 1.0.0
 */

import { getRoleDisplayName } from '@/types/unified';
import type {
  ScheduleEvent,
  GroupedScheduleEvent,
  DateStatus,
  ScheduleType,
  AttendanceStatus,
} from '@/types';

// ============================================================================
// Types
// ============================================================================

/** 그룹핑 옵션 */
export interface GroupScheduleOptions {
  /** 그룹핑 활성화 여부 (기본: true) */
  enabled?: boolean;
  /** 최소 그룹 크기 (이 수 이상일 때만 그룹화, 기본: 2) */
  minGroupSize?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 날짜 문자열을 Date 객체로 변환
 * iOS 타임존 이슈 방지를 위해 직접 파싱
 */
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * 날짜 배열이 연속인지 확인
 *
 * @example
 * isConsecutiveDates(['2025-01-15', '2025-01-16', '2025-01-17']) // true
 * isConsecutiveDates(['2025-01-15', '2025-01-17']) // false
 */
export function isConsecutiveDates(dates: string[]): boolean {
  if (dates.length <= 1) return true;

  const sorted = [...dates].sort();

  for (let i = 1; i < sorted.length; i++) {
    const prev = parseDate(sorted[i - 1]);
    const curr = parseDate(sorted[i]);

    // 하루 차이인지 확인
    const diffDays = Math.round(
      (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays !== 1) {
      return false;
    }
  }

  return true;
}

/**
 * 단일 날짜를 포맷팅
 *
 * @example
 * formatSingleDate('2025-01-15') // "1/15(수)"
 */
export function formatSingleDate(dateStr: string): string {
  const date = parseDate(dateStr);
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${date.getMonth() + 1}/${date.getDate()}(${dayOfWeek})`;
}

/**
 * 날짜 범위를 포맷팅 (연속 vs 비연속 분기)
 *
 * @example
 * // 연속
 * formatDateDisplay(['2025-01-15', '2025-01-16', '2025-01-17'])
 * // → "1월 15일(수) ~ 17일(금) (3일)"
 *
 * // 비연속
 * formatDateDisplay(['2025-01-15', '2025-01-17'])
 * // → "1/15, 1/17 (2일)"
 */
export function formatDateDisplay(dates: string[]): string {
  if (dates.length === 0) return '';
  if (dates.length === 1) return formatSingleDate(dates[0]);

  const sorted = [...dates].sort();
  const totalDays = dates.length;
  const isConsecutive = isConsecutiveDates(sorted);

  if (isConsecutive) {
    // 연속 날짜: "1월 15일(수) ~ 17일(금) (3일)"
    const startDate = parseDate(sorted[0]);
    const endDate = parseDate(sorted[sorted.length - 1]);

    const startDayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][
      startDate.getDay()
    ];
    const endDayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][
      endDate.getDay()
    ];

    const startMonth = startDate.getMonth() + 1;
    const startDay = startDate.getDate();
    const endDay = endDate.getDate();

    // 같은 달인 경우
    if (startDate.getMonth() === endDate.getMonth()) {
      return `${startMonth}월 ${startDay}일(${startDayOfWeek}) ~ ${endDay}일(${endDayOfWeek}) (${totalDays}일)`;
    }

    // 다른 달인 경우
    const endMonth = endDate.getMonth() + 1;
    return `${startMonth}/${startDay}(${startDayOfWeek}) ~ ${endMonth}/${endDay}(${endDayOfWeek}) (${totalDays}일)`;
  } else {
    // 비연속 날짜: "1/15, 1/17, 1/20 (3일)"
    // 최대 3개까지 표시, 그 이상은 축약
    const formattedDates = sorted.map((d) => {
      const date = parseDate(d);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });

    if (formattedDates.length <= 3) {
      return `${formattedDates.join(', ')} (${totalDays}일)`;
    }

    // 4개 이상: 처음 2개 + ... + 마지막 1개
    return `${formattedDates[0]}, ${formattedDates[1]} ... ${formattedDates[formattedDates.length - 1]} (${totalDays}일)`;
  }
}

/**
 * 역할 배열을 포맷팅
 *
 * @example
 * formatRolesDisplay(['dealer']) // "딜러"
 * formatRolesDisplay(['dealer', 'floor']) // "딜러, 플로어맨"
 * formatRolesDisplay(['dealer', 'other'], [undefined, '조명담당']) // "딜러, 조명담당"
 */
export function formatRolesDisplay(
  roles: string[],
  customRoles?: (string | undefined)[]
): string {
  if (roles.length === 0) return '';

  const displayNames = roles.map((role, index) => {
    const customRole = customRoles?.[index];
    return getRoleDisplayName(role, customRole);
  });

  // 중복 제거
  const uniqueNames = [...new Set(displayNames)];

  return uniqueNames.join(', ');
}

/**
 * ScheduleEvent 배열에서 그룹핑 키 생성
 *
 * 그룹핑 기준:
 * 1. applicationId (같은 지원)
 * 2. eventId (같은 이벤트)
 * 3. type (같은 상태)
 * 4. timeSlot (같은 시간대)
 */
function createGroupKey(schedule: ScheduleEvent): string | null {
  // applicationId가 없으면 그룹화 불가
  if (!schedule.applicationId) {
    return null;
  }

  // timeSlot 정규화 (구분자 통일)
  const normalizedTimeSlot = schedule.timeSlot?.replace(' - ', '~') || '';

  return `${schedule.applicationId}_${schedule.eventId}_${schedule.type}_${normalizedTimeSlot}`;
}

/**
 * ScheduleEvent 배열을 GroupedScheduleEvent로 변환
 */
function createGroupedScheduleEvent(
  events: ScheduleEvent[]
): GroupedScheduleEvent {
  if (events.length === 0) {
    throw new Error('Cannot create grouped event from empty array');
  }

  // 첫 번째 이벤트를 기준으로 공통 정보 추출
  const firstEvent = events[0];

  // 날짜 수집 및 정렬
  const dates = [...new Set(events.map((e) => e.date))].sort();

  // 역할 수집 (Map 기반으로 role-customRole 1:1 매핑 유지)
  const roleMap = new Map<string, string | undefined>();
  for (const event of events) {
    if (!roleMap.has(event.role)) {
      roleMap.set(event.role, event.customRole);
    }
  }
  const roles = Array.from(roleMap.keys());
  // roles와 동일한 인덱스로 customRoles 배열 생성 (formatRolesDisplay 호환)
  const alignedCustomRoles = roles.map((role) => roleMap.get(role));

  // 날짜별 상태 생성
  const dateStatuses: DateStatus[] = dates.map((date) => {
    const eventForDate = events.find((e) => e.date === date);
    return {
      date,
      formattedDate: formatSingleDate(date),
      status: eventForDate?.status || 'not_started',
      scheduleEventId: eventForDate?.id || '',
    };
  });

  // 시간대 포맷팅
  const timeSlot = firstEvent.timeSlot?.replace('~', ' ~ ') || '';

  return {
    id: `grouped_${firstEvent.applicationId}`,
    type: firstEvent.type,
    eventId: firstEvent.eventId,
    eventName: firstEvent.eventName,
    location: firstEvent.location,
    detailedAddress: firstEvent.detailedAddress,
    dateRange: {
      start: dates[0],
      end: dates[dates.length - 1],
      dates,
      totalDays: dates.length,
      isConsecutive: isConsecutiveDates(dates),
    },
    roles,
    customRoles: alignedCustomRoles.some((v) => v !== undefined)
      ? alignedCustomRoles
      : undefined,
    timeSlot,
    dateStatuses,
    originalEvents: events,
    applicationId: firstEvent.applicationId,
    jobPostingCard: firstEvent.jobPostingCard,
    ownerId: firstEvent.ownerId,
    ownerPhone: firstEvent.ownerPhone,
  };
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * 스케줄 이벤트들을 그룹화
 *
 * 같은 applicationId의 스케줄들을 GroupedScheduleEvent로 통합
 * 단일 스케줄이거나 그룹화 불가능한 경우 원본 ScheduleEvent 유지
 *
 * @example
 * const schedules = [...]; // 3일 연속 딜러 지원 스케줄
 * const grouped = groupScheduleEvents(schedules);
 * // → [GroupedScheduleEvent] (1개의 통합 카드)
 */
export function groupScheduleEvents(
  schedules: ScheduleEvent[],
  options: GroupScheduleOptions = {}
): (ScheduleEvent | GroupedScheduleEvent)[] {
  const { enabled = true, minGroupSize = 2 } = options;

  // 그룹핑 비활성화 시 원본 반환
  if (!enabled) {
    return schedules;
  }

  // 그룹 맵 생성
  const groupMap = new Map<string, ScheduleEvent[]>();
  const ungrouped: ScheduleEvent[] = [];

  for (const schedule of schedules) {
    const groupKey = createGroupKey(schedule);

    if (groupKey) {
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, []);
      }
      groupMap.get(groupKey)!.push(schedule);
    } else {
      // applicationId 없는 경우 그룹화 불가
      ungrouped.push(schedule);
    }
  }

  // 결과 배열 생성
  const result: (ScheduleEvent | GroupedScheduleEvent)[] = [];

  // 그룹화된 이벤트 처리
  for (const events of groupMap.values()) {
    if (events.length >= minGroupSize) {
      // 그룹 크기 충족: GroupedScheduleEvent 생성
      result.push(createGroupedScheduleEvent(events));
    } else {
      // 그룹 크기 미달: 원본 유지
      result.push(...events);
    }
  }

  // 그룹화 불가능한 이벤트 추가
  result.push(...ungrouped);

  // 날짜순 정렬 (최신순)
  result.sort((a, b) => {
    const dateA = 'dateRange' in a ? a.dateRange.start : a.date;
    const dateB = 'dateRange' in b ? b.dateRange.start : b.date;
    return dateB.localeCompare(dateA);
  });

  return result;
}

/**
 * 그룹화된 스케줄 목록에서 특정 날짜의 스케줄만 필터링
 *
 * GroupedScheduleEvent의 경우 해당 날짜를 포함하면 반환
 */
export function filterSchedulesByDate(
  schedules: (ScheduleEvent | GroupedScheduleEvent)[],
  date: string
): (ScheduleEvent | GroupedScheduleEvent)[] {
  return schedules.filter((schedule) => {
    if ('dateRange' in schedule) {
      // GroupedScheduleEvent: dates 배열에 포함되면 반환
      return schedule.dateRange.dates.includes(date);
    }
    // ScheduleEvent: 직접 비교
    return schedule.date === date;
  });
}

/**
 * 그룹화된 스케줄에서 통계 계산
 */
export function calculateGroupedStats(
  schedules: (ScheduleEvent | GroupedScheduleEvent)[]
): {
  totalEvents: number;
  appliedCount: number;
  confirmedCount: number;
  completedCount: number;
  groupedCount: number;
} {
  let totalEvents = 0;
  let appliedCount = 0;
  let confirmedCount = 0;
  let completedCount = 0;
  let groupedCount = 0;

  for (const schedule of schedules) {
    if ('dateRange' in schedule) {
      // GroupedScheduleEvent
      groupedCount++;
      totalEvents += schedule.dateRange.totalDays;

      switch (schedule.type) {
        case 'applied':
          appliedCount += schedule.dateRange.totalDays;
          break;
        case 'confirmed':
          confirmedCount += schedule.dateRange.totalDays;
          break;
        case 'completed':
          completedCount += schedule.dateRange.totalDays;
          break;
      }
    } else {
      // ScheduleEvent
      totalEvents++;

      switch (schedule.type) {
        case 'applied':
          appliedCount++;
          break;
        case 'confirmed':
          confirmedCount++;
          break;
        case 'completed':
          completedCount++;
          break;
      }
    }
  }

  return {
    totalEvents,
    appliedCount,
    confirmedCount,
    completedCount,
    groupedCount,
  };
}

/**
 * 캘린더 마킹용 날짜 추출
 *
 * GroupedScheduleEvent의 모든 날짜를 개별적으로 반환
 */
export function extractAllDatesForCalendar(
  schedules: (ScheduleEvent | GroupedScheduleEvent)[]
): { date: string; type: ScheduleType; status?: AttendanceStatus }[] {
  const result: {
    date: string;
    type: ScheduleType;
    status?: AttendanceStatus;
  }[] = [];

  for (const schedule of schedules) {
    if ('dateRange' in schedule) {
      // GroupedScheduleEvent: 모든 날짜 추출
      for (const dateStatus of schedule.dateStatuses) {
        result.push({
          date: dateStatus.date,
          type: schedule.type,
          status: dateStatus.status,
        });
      }
    } else {
      // ScheduleEvent
      result.push({
        date: schedule.date,
        type: schedule.type,
        status: schedule.status,
      });
    }
  }

  return result;
}
