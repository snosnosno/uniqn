/**
 * UNIQN Mobile - Assignment selection utilities
 */

import type { TimeSlotInfo, DatedScheduleInfo } from '@/types/unified';
import type { PostingType } from '@/types';
import { type DateSpecificRequirement } from '@/types/jobPosting/dateRequirement';
import { formatDateDisplay } from '@/types/unified';
import { areDatesConsecutive, formatDateRangeWithCount, toDateString } from '@/utils/date';

export type SelectionKey = string;

export interface ScheduleGroup {
  id: string;
  startDate: string;
  endDate: string;
  label: string;
  dates: DatedScheduleInfo[];
  timeSlots: TimeSlotInfo[];
}

function getRoleStructureKey(role: TimeSlotInfo['roles'][number]): string {
  // 그룹 경계 = 역할 종류 + 하루 요구 인원. 카드 그룹핑(utils/date/grouping.ts areRolesEqual,
  // headcount 비교)과 단일 기준 — 인원이 다른 날짜를 한 그룹으로 묶으면 하루 기준 분모가 성립하지 않는다.
  const base =
    role.roleId === 'other' && role.customName ? `other:${role.customName}` : role.roleId;
  return `${base}#${role.requiredCount}`;
}

export const areTimeSlotsStructureEqual = (
  slots1: TimeSlotInfo[],
  slots2: TimeSlotInfo[]
): boolean => {
  if (slots1.length !== slots2.length) return false;

  const sort = (slots: TimeSlotInfo[]) =>
    [...slots].sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));

  const sorted1 = sort(slots1);
  const sorted2 = sort(slots2);

  for (let i = 0; i < sorted1.length; i++) {
    const s1 = sorted1[i]!;
    const s2 = sorted2[i]!;

    if (s1.startTime !== s2.startTime) return false;
    if (!!s1.isTimeToBeAnnounced !== !!s2.isTimeToBeAnnounced) return false;
    if (s1.roles.length !== s2.roles.length) return false;

    const roleKeys1 = s1.roles.map(getRoleStructureKey).sort();
    const roleKeys2 = s2.roles.map(getRoleStructureKey).sort();
    for (let j = 0; j < roleKeys1.length; j++) {
      if (roleKeys1[j] !== roleKeys2[j]) return false;
    }
  }

  return true;
};

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
    timeSlots: schedules[0]!.timeSlots,
  };
};

export const groupDatedSchedules = (
  schedules: DatedScheduleInfo[],
  dateRequirements: DateSpecificRequirement[] | undefined,
  postingType?: PostingType
): ScheduleGroup[] => {
  if (schedules.length === 0) return [];

  const supportsGroupedRanges = postingType !== 'fixed';
  const shouldUseGroupedRanges =
    supportsGroupedRanges &&
    (dateRequirements ?? []).some((requirement) => requirement.isGrouped === true);

  if (!shouldUseGroupedRanges) {
    return schedules.map((schedule) => ({
      id: schedule.date,
      startDate: schedule.date,
      endDate: schedule.date,
      label: formatDateDisplay(schedule.date),
      dates: [schedule],
      timeSlots: schedule.timeSlots,
    }));
  }

  const sorted = [...schedules].sort((a, b) => a.date.localeCompare(b.date));
  const groups: ScheduleGroup[] = [];
  let currentGroup: DatedScheduleInfo[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    const prevReq = dateRequirements?.find(
      (requirement) => toDateString(requirement.date) === prev.date
    );
    const currReq = dateRequirements?.find(
      (requirement) => toDateString(requirement.date) === curr.date
    );
    const bothGrouped = prevReq?.isGrouped === true && currReq?.isGrouped === true;

    if (
      bothGrouped &&
      areDatesConsecutive(prev.date, curr.date) &&
      areTimeSlotsStructureEqual(prev.timeSlots, curr.timeSlots)
    ) {
      currentGroup.push(curr);
    } else {
      groups.push(createGroupFromSchedules(currentGroup));
      currentGroup = [curr];
    }
  }

  groups.push(createGroupFromSchedules(currentGroup));

  return groups;
};
