/**
 * 날짜 그룹화 유틸리티
 *
 * @description 연속 날짜 감지 및 그룹화 함수들
 * @version 1.0.0
 */

import { differenceInDays, addDays, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { parseDateString, toDateString, generateId } from './core';
import type {
  DateSpecificRequirement,
  TimeSlot,
  RoleRequirement,
} from '@/types/jobPosting/dateRequirement';

// ============================================================================
// Types
// ============================================================================

/**
 * 날짜 범위 그룹 (UI 표시용)
 *
 * @description 연속 날짜를 하나의 그룹으로 묶어 표시
 * Firebase 저장 시에는 개별 DateSpecificRequirement로 확장
 */
export interface DateRangeGroup {
  /** 고유 ID */
  id: string;
  /** 시작 날짜 (YYYY-MM-DD) */
  startDate: string;
  /** 종료 날짜 (YYYY-MM-DD), 단일 날짜면 startDate와 동일 */
  endDate: string;
  /** 공유되는 시간대 정보 */
  timeSlots: TimeSlot[];
}

// ============================================================================
// 연속 날짜 감지
// ============================================================================

/**
 * 두 날짜가 연속인지 확인 (1일 차이)
 */
export function areDatesConsecutive(date1: string, date2: string): boolean {
  const d1 = parseDateString(date1);
  const d2 = parseDateString(date2);

  if (!d1 || !d2) return false;

  const diff = Math.abs(differenceInDays(d2, d1));
  return diff === 1;
}

/**
 * 날짜 배열이 모두 연속인지 확인
 */
export function areAllDatesConsecutive(dates: string[]): boolean {
  if (dates.length <= 1) return true;

  const sortedDates = [...dates].sort();
  for (let i = 1; i < sortedDates.length; i++) {
    if (!areDatesConsecutive(sortedDates[i - 1]!, sortedDates[i]!)) {
      return false;
    }
  }
  return true;
}

/**
 * 날짜 배열을 연속 그룹으로 분할
 *
 * @example
 * groupConsecutiveDates(['2025-01-17', '2025-01-18', '2025-01-20'])
 * // => [['2025-01-17', '2025-01-18'], ['2025-01-20']]
 */
export function groupConsecutiveDates(dates: string[]): string[][] {
  if (dates.length === 0) return [];
  if (dates.length === 1) return [[dates[0]!]];

  const sortedDates = [...dates].sort();
  const groups: string[][] = [];
  let currentGroup: string[] = [sortedDates[0]!];

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = sortedDates[i - 1]!;
    const currDate = sortedDates[i]!;

    if (areDatesConsecutive(prevDate, currDate)) {
      currentGroup.push(currDate);
    } else {
      groups.push(currentGroup);
      currentGroup = [currDate];
    }
  }

  groups.push(currentGroup);
  return groups;
}

// ============================================================================
// 날짜 범위 포맷팅
// ============================================================================

/**
 * 날짜 범위 포맷 (UI 표시용)
 *
 * @example
 * formatDateRange('2025-01-17', '2025-01-19')
 * // => "1/17(금) ~ 1/19(일)"
 *
 * formatDateRange('2025-01-17', '2025-01-17')
 * // => "1/17(금)"
 */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = parseDateString(startDate);
  const end = parseDateString(endDate);

  if (!start) return '';

  const formatSingle = (date: Date) => format(date, 'M/d(E)', { locale: ko });

  if (!end || startDate === endDate) {
    return formatSingle(start);
  }

  return `${formatSingle(start)} ~ ${formatSingle(end)}`;
}

/**
 * 날짜 범위의 일수 계산
 *
 * @example
 * getDayCount('2025-01-17', '2025-01-19') // => 3
 * getDayCount('2025-01-17', '2025-01-17') // => 1
 */
export function getDayCount(startDate: string, endDate: string): number {
  const start = parseDateString(startDate);
  const end = parseDateString(endDate);

  if (!start || !end) return 1;

  return Math.abs(differenceInDays(end, start)) + 1;
}

/**
 * 날짜 범위 레이블 생성 (일수 포함)
 *
 * @example
 * formatDateRangeWithCount('2025-01-17', '2025-01-19')
 * // => "1/17(금) ~ 1/19(일)\n    (3일)"
 */
export function formatDateRangeWithCount(startDate: string, endDate: string): string {
  const rangeStr = formatDateRange(startDate, endDate);
  const dayCount = getDayCount(startDate, endDate);

  if (dayCount <= 1) {
    return rangeStr;
  }

  return `${rangeStr}\n    (${dayCount}일)`;
}

// ============================================================================
// TimeSlot 비교 유틸리티
// ============================================================================

/**
 * RoleRequirement 비교 (동일 여부)
 */
function areRolesEqual(roles1: RoleRequirement[], roles2: RoleRequirement[]): boolean {
  if (roles1.length !== roles2.length) return false;

  const sort = (roles: RoleRequirement[]) =>
    [...roles].sort((a, b) => {
      const roleA = a.role || '';
      const roleB = b.role || '';
      return roleA.localeCompare(roleB);
    });

  const sorted1 = sort(roles1);
  const sorted2 = sort(roles2);

  for (let i = 0; i < sorted1.length; i++) {
    const r1 = sorted1[i]!;
    const r2 = sorted2[i]!;

    const role1 = r1.role;
    const role2 = r2.role;
    const headcount1 = r1.headcount ?? 0;
    const headcount2 = r2.headcount ?? 0;

    if (role1 !== role2 || headcount1 !== headcount2) {
      return false;
    }

    if (role1 === 'other' && r1.customRole !== r2.customRole) {
      return false;
    }
  }

  return true;
}

/**
 * TimeSlot 비교 (동일 여부)
 */
function areTimeSlotsEqual(slots1: TimeSlot[], slots2: TimeSlot[]): boolean {
  if (slots1.length !== slots2.length) return false;

  const sort = (slots: TimeSlot[]) =>
    [...slots].sort((a, b) => {
      const timeA = a.startTime || '99:99';
      const timeB = b.startTime || '99:99';
      return timeA.localeCompare(timeB);
    });

  const sorted1 = sort(slots1);
  const sorted2 = sort(slots2);

  for (let i = 0; i < sorted1.length; i++) {
    const s1 = sorted1[i]!;
    const s2 = sorted2[i]!;

    const time1 = s1.startTime;
    const time2 = s2.startTime;
    if (time1 !== time2) return false;

    if (!!s1.isTimeToBeAnnounced !== !!s2.isTimeToBeAnnounced) return false;

    if (!areRolesEqual(s1.roles || [], s2.roles || [])) return false;
  }

  return true;
}

// ============================================================================
// DateSpecificRequirement ↔ DateRangeGroup 변환
// ============================================================================

/**
 * TimeSlots 깊은 복사
 */
function deepCloneTimeSlots(timeSlots: TimeSlot[]): TimeSlot[] {
  return timeSlots.map((slot) => ({
    ...slot,
    id: generateId(),
    roles: slot.roles.map((role) => ({
      ...role,
      id: generateId(),
    })),
  }));
}

/**
 * DateSpecificRequirement[] 에서 DateRangeGroup 생성
 */
function createGroupFromRequirements(requirements: DateSpecificRequirement[]): DateRangeGroup {
  const sortedDates = requirements.map((r) => toDateString(r.date)).sort();

  const startDate = sortedDates[0]!;
  const endDate = sortedDates[sortedDates.length - 1]!;

  const timeSlots = requirements[0]!.timeSlots;

  return {
    id: generateId(),
    startDate,
    endDate,
    timeSlots: deepCloneTimeSlots(timeSlots),
  };
}

/**
 * DateSpecificRequirement[] → DateRangeGroup[] 변환
 *
 * @description 연속 날짜 + 동일 timeSlots를 가진 항목들을 그룹화
 *
 * 그룹화 조건:
 * 1. 날짜가 연속 (1일 차이)
 * 2. timeSlots가 동일 (시작시간, 역할, 인원 모두 같음)
 */
export function groupRequirementsToDateRanges(
  requirements: DateSpecificRequirement[]
): DateRangeGroup[] {
  if (requirements.length === 0) return [];

  const sorted = [...requirements].sort((a, b) => {
    const dateA = toDateString(a.date);
    const dateB = toDateString(b.date);
    return dateA.localeCompare(dateB);
  });

  const groups: DateRangeGroup[] = [];
  let currentGroup: DateSpecificRequirement[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;

    const prevDate = toDateString(prev.date);
    const currDate = toDateString(curr.date);

    const bothGrouped = prev.isGrouped === true && curr.isGrouped === true;
    if (
      bothGrouped &&
      areDatesConsecutive(prevDate, currDate) &&
      areTimeSlotsEqual(prev.timeSlots, curr.timeSlots)
    ) {
      currentGroup.push(curr);
    } else {
      groups.push(createGroupFromRequirements(currentGroup));
      currentGroup = [curr];
    }
  }

  groups.push(createGroupFromRequirements(currentGroup));

  return groups;
}

/**
 * DateRangeGroup → DateSpecificRequirement[] 변환 (저장용)
 *
 * @description 날짜 범위를 개별 날짜로 확장
 */
export function expandDateRangeToRequirements(group: DateRangeGroup): DateSpecificRequirement[] {
  const requirements: DateSpecificRequirement[] = [];

  const start = parseDateString(group.startDate);
  const end = parseDateString(group.endDate);

  if (!start) return requirements;

  if (!end) {
    requirements.push({
      date: group.startDate,
      timeSlots: deepCloneTimeSlots(group.timeSlots),
    });
    return requirements;
  }

  const dayCount = getDayCount(group.startDate, group.endDate);

  for (let i = 0; i < dayCount; i++) {
    const date = addDays(start, i);
    const dateStr = format(date, 'yyyy-MM-dd');

    requirements.push({
      date: dateStr,
      timeSlots: deepCloneTimeSlots(group.timeSlots),
    });
  }

  return requirements;
}

/**
 * DateRangeGroup[] → DateSpecificRequirement[] 변환 (저장용)
 */
export function expandAllDateRangesToRequirements(
  groups: DateRangeGroup[]
): DateSpecificRequirement[] {
  return groups.flatMap(expandDateRangeToRequirements);
}

/**
 * 날짜 범위가 단일 날짜인지 확인
 */
export function isSingleDate(group: DateRangeGroup): boolean {
  return group.startDate === group.endDate;
}

/**
 * 날짜 범위 그룹의 모든 날짜 목록 반환
 */
export function getDateListFromRange(group: DateRangeGroup): string[] {
  const dates: string[] = [];
  const start = parseDateString(group.startDate);
  const dayCount = getDayCount(group.startDate, group.endDate);

  if (!start) return dates;

  for (let i = 0; i < dayCount; i++) {
    dates.push(format(addDays(start, i), 'yyyy-MM-dd'));
  }

  return dates;
}
