/**
 * UNIQN Mobile - 스케줄 그룹핑 유틸리티
 *
 * 같은 지원(applicationId)의 연속/비연속 다중 날짜를 하나의 카드로 통합
 *
 * @version 1.0.0
 */

import { getRoleDisplayName } from '@/types/unified';
import { STATUS } from '@/constants';
import { WEEKDAYS_KO } from '@/constants/weekdays';
import { areAllDatesConsecutive, parseDateString } from '@/utils/date';
import type { ScheduleEvent, GroupedScheduleEvent, DateStatus, ScheduleType } from '@/types';

/** 스케줄탭 상태 필터 값 — 'all'은 전체(취소 포함) 노출, 나머지는 type 단일 매칭 */
/**
 * 리스트 필터.
 *
 * 'unpaid' 는 상태(type)가 아니라 **정산 관점** 축이다 — 근무 후 가장 잦은 확인이
 * '입금 됐나'인데, 예전에는 완료 카드를 하나씩 열어 정산 탭까지 들어가야 알 수 있었다.
 */
export type ScheduleStatusFilter = 'all' | ScheduleType | 'unpaid';

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
const WEEKDAYS = WEEKDAYS_KO;

/**
 * 날짜 배열이 연속인지 확인
 *
 * @example
 * isConsecutiveDates(['2025-01-15', '2025-01-16', '2025-01-17']) // true
 * isConsecutiveDates(['2025-01-15', '2025-01-17']) // false
 */
const UNDATED_LABEL = '날짜 미정';

export function isConsecutiveDates(dates: string[]): boolean {
  return areAllDatesConsecutive(dates);
}

/**
 * 단일 날짜를 포맷팅
 *
 * @example
 * formatSingleDate('2025-01-15') // "1/15(수)"
 */
export function formatSingleDate(dateStr: string): string {
  if (!dateStr) return UNDATED_LABEL;

  const date = parseDateString(dateStr);
  if (!date) return dateStr || '-';
  const dayOfWeek = WEEKDAYS[date.getDay()];
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
  const datedDates = dates.filter((date) => typeof date === 'string' && date.trim().length > 0);
  const undatedCount = dates.length - datedDates.length;

  if (datedDates.length === 0) {
    return undatedCount > 1 ? `${UNDATED_LABEL} (${undatedCount}일)` : UNDATED_LABEL;
  }

  if (undatedCount > 0) {
    const formattedDatedDates = datedDates.sort().map((date) => {
      const parsedDate = parseDateString(date);
      if (!parsedDate) {
        return date;
      }
      return `${parsedDate.getMonth() + 1}/${parsedDate.getDate()}`;
    });
    const displayItems = [...formattedDatedDates, UNDATED_LABEL];

    if (displayItems.length <= 3) {
      return `${displayItems.join(', ')} (${dates.length}일)`;
    }

    return `${displayItems[0]}, ${displayItems[1]} ... ${displayItems[displayItems.length - 1]} (${dates.length}일)`;
  }

  if (datedDates.length === 1) return formatSingleDate(datedDates[0]);

  const sorted = [...datedDates].sort();
  const totalDays = datedDates.length;
  const isConsecutive = isConsecutiveDates(sorted);

  if (isConsecutive) {
    // 연속 날짜: "1월 15일(수) ~ 17일(금) (3일)"
    const startDate = parseDateString(sorted[0]!);
    const endDate = parseDateString(sorted[sorted.length - 1]!);

    if (!startDate || !endDate) {
      return sorted.map((date) => formatSingleDate(date)).join(', ');
    }

    const startDayOfWeek = WEEKDAYS[startDate.getDay()];
    const endDayOfWeek = WEEKDAYS[endDate.getDay()];

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
      const date = parseDateString(d);
      if (!date) {
        return d;
      }
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
export function formatRolesDisplay(roles: string[], customRoles?: (string | undefined)[]): string {
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
 * 2. jobPostingId (같은 공고)
 * 3. type (같은 상태)
 * 4. timeSlot (같은 시간대)
 */
function createGroupKey(schedule: ScheduleEvent): string | null {
  // applicationId가 없으면 그룹화 불가
  if (!schedule.applicationId || !schedule.date) {
    return null;
  }

  // timeSlot 정규화 (구분자 통일)
  const normalizedTimeSlot = schedule.timeSlot?.replace(' - ', '~') || '';

  return `${schedule.applicationId}_${schedule.jobPostingId}_${schedule.type}_${normalizedTimeSlot}`;
}

/**
 * 그룹 React key.
 *
 * 예전엔 `grouped_${applicationId}` 만 썼는데, 그룹핑 축에는 type·timeSlot 도 들어간다.
 * 그래서 한 지원이 '일부 완료 + 일부 예정'으로 갈리면 **서로 다른 그룹 2장이 같은 key** 를
 * 갖게 되고, React 가 둘을 같은 노드로 취급해 카드가 뒤섞이거나 하나가 사라진다.
 * 키와 id 를 한 곳에서 파생시켜 축이 어긋나지 않게 한다.
 */
function createGroupId(schedule: ScheduleEvent): string {
  const groupKey = createGroupKey(schedule);
  return `grouped_${groupKey ?? schedule.id}`;
}

/**
 * ScheduleEvent 배열을 GroupedScheduleEvent로 변환
 */
function createGroupedScheduleEvent(events: ScheduleEvent[]): GroupedScheduleEvent {
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
      status: eventForDate?.status || STATUS.ATTENDANCE.NOT_STARTED,
      scheduleEventId: eventForDate?.id || '',
    };
  });

  // 시간대 포맷팅
  const timeSlot = firstEvent.timeSlot?.replace('~', ' ~ ') || '';

  return {
    id: createGroupId(firstEvent),
    type: firstEvent.type,
    jobPostingId: firstEvent.jobPostingId,
    jobPostingName: firstEvent.jobPostingName,
    location: firstEvent.location,
    detailedAddress: firstEvent.detailedAddress,
    locationAddress: firstEvent.locationAddress,
    dateRange: {
      start: dates[0],
      end: dates[dates.length - 1],
      dates,
      totalDays: dates.length,
      isConsecutive: isConsecutiveDates(dates),
    },
    roles,
    customRoles: alignedCustomRoles.some((v) => v !== undefined) ? alignedCustomRoles : undefined,
    timeSlot,
    dateStatuses,
    originalEvents: events,
    applicationId: firstEvent.applicationId,
    postingProjection: firstEvent.postingProjection,
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
 * 그룹화된 스케줄 목록을 상태(type)로 필터링
 *
 * 'all'이면 원본 배열을 그대로 반환(취소 포함). 그 외에는 type이 일치하는
 * 항목만 반환. ScheduleEvent/GroupedScheduleEvent 둘 다 단일 type 필드를
 * 가지므로 (같은 지원 내 여러 날짜라도 그룹은 하나의 type) 동일 로직으로 처리 가능.
 *
 * @example
 * filterSchedulesByStatus(schedules, 'confirmed') // 확정 상태만
 * filterSchedulesByStatus(schedules, 'all') // 전체(원본과 동일)
 */
export function filterSchedulesByStatus<T extends ScheduleEvent | GroupedScheduleEvent>(
  schedules: T[],
  statusFilter: ScheduleStatusFilter
): T[] {
  if (statusFilter === 'all') return schedules;
  if (statusFilter === 'unpaid') return schedules.filter(isUnpaidCompleted);
  return schedules.filter((schedule) => schedule.type === statusFilter);
}

/**
 * 완료했는데 아직 정산이 끝나지 않은 건인지.
 * payrollStatus 가 없으면 미처리(pending)로 본다 — 기본값이 곧 '아직 못 받음'이다.
 */
export function isUnpaidCompleted(item: ScheduleEvent | GroupedScheduleEvent): boolean {
  if (item.type !== 'completed') return false;

  if ('dateRange' in item) {
    return item.originalEvents.some((event) => event.payrollStatus !== 'completed');
  }
  return item.payrollStatus !== 'completed';
}

/** '미지급' 필터 배지에 쓰는 건수 */
export function countUnpaidSchedules(schedules: (ScheduleEvent | GroupedScheduleEvent)[]): number {
  return schedules.filter(isUnpaidCompleted).length;
}

/**
 * 그룹화된 스케줄 목록에서 상태(type)별 건수 집계
 *
 * FilterTabs의 count 배지에 사용. 그룹 1건 = 1건으로 집계(그룹 내 날짜 수가 아님).
 */
export function countSchedulesByType(
  schedules: (ScheduleEvent | GroupedScheduleEvent)[]
): Record<ScheduleType, number> {
  const counts: Record<ScheduleType, number> = {
    applied: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    no_show: 0,
  };

  for (const schedule of schedules) {
    counts[schedule.type] += 1;
  }

  return counts;
}

// ============================================================================
// 시간 축 정렬 — "다가오는 근무" 우선
// ============================================================================

/** 스케줄/그룹의 대표 시작 날짜 */
function scheduleStartDate(item: ScheduleEvent | GroupedScheduleEvent): string {
  return 'dateRange' in item ? item.dateRange.start : item.date;
}

/** 스케줄/그룹의 대표 종료 날짜 (그룹이면 마지막 근무일) */
function scheduleEndDate(item: ScheduleEvent | GroupedScheduleEvent): string {
  return 'dateRange' in item ? item.dateRange.end : item.date;
}

export interface ScheduleTimeSplit<T> {
  /** 오늘 포함 이후 — 가까운 순(오름차순) */
  upcoming: T[];
  /** 지난 근무 — 최근 순(내림차순) */
  past: T[];
}

/**
 * 목록을 '다가오는 근무'와 '지난 근무'로 가른다.
 *
 * 기본 그룹 정렬(`groupScheduleEvents`)은 최신순 내림차순이라, 27일인 사용자가
 * 목록을 열면 31일 카드가 맨 위에 온다. "오늘/내일 어디로 출근하지"에 답하려면
 * 다가오는 근무가 먼저, 그 안에서도 가까운 날이 먼저여야 한다.
 *
 * 캘린더 뷰가 공유하는 원본 정렬은 건드리지 않고 **목록 표시 단계에서만** 재정렬한다.
 * 여러 날에 걸친 그룹은 마지막 근무일이 오늘 이후면 아직 '다가오는' 것으로 본다.
 */
export function splitSchedulesByToday<T extends ScheduleEvent | GroupedScheduleEvent>(
  schedules: T[],
  todayStr: string
): ScheduleTimeSplit<T> {
  const upcoming: T[] = [];
  const past: T[] = [];

  for (const schedule of schedules) {
    if (scheduleEndDate(schedule) >= todayStr) {
      upcoming.push(schedule);
    } else {
      past.push(schedule);
    }
  }

  upcoming.sort((a, b) => scheduleStartDate(a).localeCompare(scheduleStartDate(b)));
  past.sort((a, b) => scheduleStartDate(b).localeCompare(scheduleStartDate(a)));

  return { upcoming, past };
}

/**
 * 그룹 상세를 열 때 먼저 보여줄 날짜.
 *
 * 폴백이 `originalEvents[0]`(내림차순 정렬의 **가장 나중** 날짜)이면 3일짜리 대회가
 * '3 / 3일'부터 열려, 정작 급한 첫날 출근 시간과 QR 이 가장 멀리 놓인다.
 * 오늘 이후 가장 가까운 근무일을 먼저 보여주고, 전부 지났으면 마지막 근무일을 쓴다.
 */
export function pickGroupFocusDate(dates: readonly string[], todayStr: string): string | null {
  if (dates.length === 0) return null;
  return dates.find((date) => date >= todayStr) ?? dates[dates.length - 1];
}

/**
 * 월을 이동했을 때 선택할 날짜.
 *
 * 월만 바꾸고 selectedDate 를 그대로 두면 선택일이 이전 달에 남아, 캘린더에 점은
 * 찍혀 있는데 아래 목록은 비고 어느 날짜도 선택 표시가 없다 — 지난달 기록을 보러 온
 * 사용자가 "기록이 사라졌다"고 오해한다.
 *
 * 우선순위: ① 그 달에 오늘이 있으면 오늘 → ② 일정이 있는 가장 이른 날 → ③ 1일.
 */
export function resolveSelectedDateForMonth(
  year: number,
  month: number,
  scheduleDates: readonly string[],
  todayStr: string
): string {
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;

  if (todayStr.startsWith(monthPrefix)) {
    return todayStr;
  }

  const datesInMonth = scheduleDates.filter((date) => date.startsWith(monthPrefix)).sort();
  return datesInMonth[0] ?? `${monthPrefix}-01`;
}
