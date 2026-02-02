/**
 * UNIQN Mobile - Assignment 선택 유틸리티
 *
 * @description AssignmentSelector 컴포넌트에서 분리된 순수 함수들
 * @version 1.1.0 - selectionCore.ts로 makeSelectionKey 통합
 */

import type { TimeSlotInfo, DatedScheduleInfo } from '@/types/unified';
import type { PostingType } from '@/types';
import type { DateSpecificRequirement } from '@/types/jobPosting/dateRequirement';
import { formatDateDisplay } from '@/types/unified';
import {
  areDatesConsecutive,
  formatDateRangeWithCount,
  toDateString,
} from '@/utils/dateRangeUtils';
import { makeSelectionKey as makeSelectionKeyCore } from './selectionCore';

// ============================================================================
// Types
// ============================================================================

/** 역할 선택 키 (date|slot|role 조합) */
export type SelectionKey = string;

/**
 * 연속 날짜 그룹 (대회 공고용)
 *
 * @description 연속 날짜 + 동일 timeSlots를 가진 스케줄을 그룹화
 */
export interface ScheduleGroup {
  /** 고유 ID */
  id: string;
  /** 시작 날짜 (YYYY-MM-DD) */
  startDate: string;
  /** 종료 날짜 (YYYY-MM-DD) */
  endDate: string;
  /** 그룹 레이블 (예: "1/17(금) ~ 1/19(일) (3일간)") */
  label: string;
  /** 그룹에 속한 개별 날짜 스케줄 정보 */
  dates: DatedScheduleInfo[];
  /** 공유 시간대 정보 (첫 번째 날짜 기준) */
  timeSlots: TimeSlotInfo[];
}

// ============================================================================
// Functions
// ============================================================================

/**
 * 선택 키 생성 (date|slot|role)
 *
 * @param date - 날짜 (YYYY-MM-DD 또는 FIXED_DATE_MARKER)
 * @param slotTime - 시간대 (HH:MM 또는 TBA_TIME_MARKER)
 * @param role - 역할 ID
 * @returns 선택 키 문자열
 *
 * @example
 * makeSelectionKey('2024-01-17', '09:00', 'dealer')
 * // => '2024-01-17|09:00|dealer'
 */
export const makeSelectionKey = (date: string, slotTime: string, role: string): SelectionKey => {
  return makeSelectionKeyCore(date, slotTime, role);
};

/**
 * 시간대 구조 비교 (동일 여부)
 *
 * @description 두 시간대 배열이 같은 구조인지 확인 (시작시간, 역할ID 기준)
 * @param slots1 - 첫 번째 시간대 배열
 * @param slots2 - 두 번째 시간대 배열
 * @returns 구조가 동일하면 true
 *
 * @example
 * areTimeSlotsStructureEqual(day1Slots, day2Slots)
 * // => true (시작시간, 역할 구조가 동일)
 */
export const areTimeSlotsStructureEqual = (
  slots1: TimeSlotInfo[],
  slots2: TimeSlotInfo[]
): boolean => {
  if (slots1.length !== slots2.length) return false;

  // 시작시간 기준 정렬
  const sort = (slots: TimeSlotInfo[]) =>
    [...slots].sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));

  const sorted1 = sort(slots1);
  const sorted2 = sort(slots2);

  for (let i = 0; i < sorted1.length; i++) {
    const s1 = sorted1[i]!;
    const s2 = sorted2[i]!;

    // 시작 시간 비교
    if (s1.startTime !== s2.startTime) return false;
    if (!!s1.isTimeToBeAnnounced !== !!s2.isTimeToBeAnnounced) return false;

    // 역할 수 비교
    if (s1.roles.length !== s2.roles.length) return false;

    // 역할 ID 비교 (정렬 후)
    const roleIds1 = s1.roles.map((r) => r.roleId).sort();
    const roleIds2 = s2.roles.map((r) => r.roleId).sort();
    for (let j = 0; j < roleIds1.length; j++) {
      if (roleIds1[j] !== roleIds2[j]) return false;
    }
  }

  return true;
};

/**
 * DatedScheduleInfo[] → ScheduleGroup 생성 (내부 헬퍼)
 *
 * @param schedules - 그룹화할 스케줄 배열
 * @returns 생성된 ScheduleGroup
 */
export const createGroupFromSchedules = (schedules: DatedScheduleInfo[]): ScheduleGroup => {
  const sortedDates = schedules.map((s) => s.date).sort();
  const startDate = sortedDates[0]!;
  const endDate = sortedDates[sortedDates.length - 1]!;
  const label = formatDateRangeWithCount(startDate, endDate);

  return {
    id: `${startDate}-${endDate}`,
    startDate,
    endDate,
    label,
    dates: schedules,
    timeSlots: schedules[0]!.timeSlots, // 첫 번째 날짜 기준
  };
};

/**
 * DatedScheduleInfo[] → ScheduleGroup[] 변환
 *
 * @description 대회 공고: 연속 날짜 + 동일 timeSlots 구조 + isGrouped 플래그를 그룹화
 *              일반/긴급/고정 공고: 개별 날짜를 각각 그룹으로
 *
 * @param schedules - 스케줄 배열
 * @param dateRequirements - 날짜별 요구사항 (isGrouped 플래그 포함)
 * @param postingType - 공고 타입 (tournament만 그룹화)
 * @returns 그룹화된 스케줄 배열
 *
 * @example
 * // 대회 공고: 연속 3일 그룹화
 * groupDatedSchedules(schedules, requirements, 'tournament')
 * // => [{ id: '2024-01-17-2024-01-19', label: '1/17(금) ~ 1/19(일) (3일간)', ... }]
 *
 * // 일반 공고: 개별 날짜
 * groupDatedSchedules(schedules, requirements, 'regular')
 * // => [{ id: '2024-01-17', ... }, { id: '2024-01-18', ... }]
 */
export const groupDatedSchedules = (
  schedules: DatedScheduleInfo[],
  dateRequirements: DateSpecificRequirement[] | undefined,
  postingType?: PostingType
): ScheduleGroup[] => {
  if (schedules.length === 0) return [];

  // 대회 공고가 아니면 그룹화하지 않음 (개별 날짜 각각 그룹)
  if (postingType !== 'tournament') {
    return schedules.map((s) => ({
      id: s.date,
      startDate: s.date,
      endDate: s.date,
      label: formatDateDisplay(s.date),
      dates: [s],
      timeSlots: s.timeSlots,
    }));
  }

  // 날짜 기준 정렬
  const sorted = [...schedules].sort((a, b) => a.date.localeCompare(b.date));

  const groups: ScheduleGroup[] = [];
  let currentGroup: DatedScheduleInfo[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;

    // isGrouped 플래그 확인
    const prevReq = dateRequirements?.find((r) => toDateString(r.date) === prev.date);
    const currReq = dateRequirements?.find((r) => toDateString(r.date) === curr.date);
    const bothGrouped = prevReq?.isGrouped === true && currReq?.isGrouped === true;

    // 연속 날짜이고 timeSlots 구조가 동일하고 둘 다 그룹화 설정된 경우에만 같은 그룹
    if (
      bothGrouped &&
      areDatesConsecutive(prev.date, curr.date) &&
      areTimeSlotsStructureEqual(prev.timeSlots, curr.timeSlots)
    ) {
      currentGroup.push(curr);
    } else {
      // 새 그룹 시작
      groups.push(createGroupFromSchedules(currentGroup));
      currentGroup = [curr];
    }
  }

  // 마지막 그룹 추가
  groups.push(createGroupFromSchedules(currentGroup));

  return groups;
};
