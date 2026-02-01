/**
 * 구인공고 날짜 관련 유틸리티
 *
 * @version 3.0.0 - 중복 함수 제거, date/ 폴더에서 import
 * @description 날짜별 요구사항 섹션에서 사용하는 유틸리티 함수들
 */

import { toISODateString, generateId as generateIdBase } from '../date/core';
import { formatDateWithDay } from '../date/formatting';
import { groupConsecutiveDates as groupConsecutiveDatesBase } from '../date/grouping';

// Re-export from date/ for backward compatibility
export { groupConsecutiveDatesBase as groupConsecutiveDates };
export { generateIdBase as generateId };

// Re-export validation functions
export {
  isDuplicateDate,
  validateDateCount,
  isWithinUrgentDateLimit,
  parseDate,
  getDateAfterDays,
} from '../date/validation';

// Re-export range functions
export { generateDateRange, sortDates } from '../date/ranges';

/**
 * 오늘 날짜 문자열 (yyyy-MM-dd)
 * @see getTodayString from date/core
 */
export function getTodayDateString(): string {
  const today = new Date();
  return toISODateString(today) ?? '';
}

/**
 * 날짜 그룹을 포맷된 문자열로 변환
 *
 * @description 단일 날짜는 그대로, 연속된 날짜는 범위로 표시
 *
 * @example
 * ["2025-01-15"] → "1월 15일 (수)"
 * ["2025-01-15", "2025-01-16"] → "1월 15일 (수) ~ 1월 16일 (목)"
 */
export function formatDateGroup(dates: string[]): string {
  if (!dates || dates.length === 0) return '';

  const firstDate = dates[0];
  if (!firstDate) return '';

  if (dates.length === 1) {
    return formatDateWithDay(firstDate);
  }

  const lastDate = dates[dates.length - 1];
  if (!lastDate) return formatDateWithDay(firstDate);

  const first = formatDateWithDay(firstDate);
  const last = formatDateWithDay(lastDate);
  return `${first} ~ ${last}`;
}

/**
 * 날짜 배열을 범위 문자열로 변환
 *
 * @description 연속된 날짜들을 그룹화하여 표시
 *
 * @example
 * ["2025-01-15", "2025-01-16", "2025-01-18"]
 * → "1월 15일 (수) ~ 1월 16일 (목), 1월 18일 (토) (3일)"
 */
export function formatDateRangeDisplay(dates: string[]): string {
  if (!dates || dates.length === 0) return '';

  const sortedDates = [...dates].sort();
  const totalDays = sortedDates.length;

  // 단일 날짜
  if (sortedDates.length === 1) {
    return formatDateWithDay(sortedDates[0]!);
  }

  // 연속된 날짜 그룹으로 분류
  const groups = groupConsecutiveDatesBase(sortedDates);

  // 각 그룹을 포맷팅
  const formattedGroups = groups.map((group) => {
    if (group.length === 1) {
      return formatDateWithDay(group[0]!);
    } else {
      const first = formatDateWithDay(group[0]!);
      const last = formatDateWithDay(group[group.length - 1]!);
      return `${first} ~ ${last}`;
    }
  });

  // 그룹들을 연결
  let result = formattedGroups.join(', ');

  // 전체 일수 표시 (2일 이상일 때만)
  if (totalDays > 1) {
    result += ` (${totalDays}일)`;
  }

  return result;
}

/**
 * 중복 역할 검사 (커스텀 역할 지원)
 */
export function isDuplicateRole(
  existingRoles: { role: string; customRole?: string }[],
  newRole: string,
  currentIndex?: number
): boolean {
  return existingRoles.some((r, i) => {
    if (currentIndex !== undefined && i === currentIndex) return false;
    if (r.role === newRole) return true;
    if (r.role === 'other' && r.customRole === newRole) return true;
    return false;
  });
}

/**
 * 인원 수 보정 (1-200 범위)
 */
export function clampHeadcount(value: number): number {
  return Math.max(1, Math.min(200, Math.floor(value)));
}

/**
 * HH:mm 형식 검증
 */
export function isValidTimeFormat(time: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
}

/**
 * yyyy-MM-dd 형식 검증
 */
export function isValidDateFormat(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

// ============================================================================
// Migration Utilities
// ============================================================================

/**
 * TournamentDates → DateSpecificRequirements 변환
 */
export function convertTournamentDatesToDateRequirements(
  tournamentDates: {
    day: number;
    date: string;
    startTime: string;
  }[]
): {
  date: string;
  timeSlots: {
    id: string;
    startTime: string;
    isTimeToBeAnnounced: boolean;
    tentativeDescription?: string;
    roles: {
      id: string;
      role: 'dealer';
      customRole?: string;
      headcount: number;
    }[];
  }[];
}[] {
  return tournamentDates.map((td) => ({
    date: td.date,
    timeSlots: [
      {
        id: generateIdBase(),
        startTime: td.startTime,
        isTimeToBeAnnounced: false,
        roles: [
          {
            id: generateIdBase(),
            role: 'dealer' as const,
            headcount: 1,
          },
        ],
      },
    ],
  }));
}

/**
 * DateSpecificRequirements → TournamentDates 변환 (하위 호환)
 */
export function convertDateRequirementsToTournamentDates(
  dateRequirements: {
    date: string | { seconds: number } | { toDate: () => Date };
    timeSlots: {
      startTime: string;
    }[];
  }[]
): {
  day: number;
  date: string;
  startTime: string;
}[] {
  return dateRequirements.map((dr, index) => {
    let dateString: string;
    if (typeof dr.date === 'string') {
      dateString = dr.date;
    } else if ('toDate' in dr.date && typeof dr.date.toDate === 'function') {
      const dateObj = dr.date.toDate();
      dateString = toISODateString(dateObj) ?? '';
    } else if ('seconds' in dr.date) {
      const dateObj = new Date(dr.date.seconds * 1000);
      dateString = toISODateString(dateObj) ?? '';
    } else {
      dateString = '';
    }

    const firstTimeSlot = dr.timeSlots[0];
    const startTime = firstTimeSlot?.startTime || '09:00';

    return {
      day: index + 1,
      date: dateString,
      startTime,
    };
  });
}

// ============================================================================
// 마감 계산 유틸리티
// ============================================================================

interface RoleWithCount {
  role?: string;
  headcount?: number;
  filled?: number;
}

interface TimeSlotWithRoles {
  startTime?: string;
  roles: RoleWithCount[];
}

interface DateRequirementWithSlots {
  date: string | { seconds: number } | { toDate: () => Date };
  timeSlots: TimeSlotWithRoles[];
}

/**
 * dateSpecificRequirements에서 총 모집 인원 계산
 */
export function calculateTotalFromDateReqs(
  requirements: DateRequirementWithSlots[] | undefined
): number {
  if (!requirements || requirements.length === 0) return 0;

  return requirements.reduce(
    (total, req) =>
      total +
      req.timeSlots.reduce(
        (slotTotal, slot) =>
          slotTotal + slot.roles.reduce((roleTotal, role) => roleTotal + (role.headcount ?? 0), 0),
        0
      ),
    0
  );
}

/**
 * dateSpecificRequirements에서 확정된 인원 계산
 */
export function calculateFilledFromDateReqs(
  requirements: DateRequirementWithSlots[] | undefined
): number {
  if (!requirements || requirements.length === 0) return 0;

  return requirements.reduce(
    (total, req) =>
      total +
      req.timeSlots.reduce(
        (slotTotal, slot) =>
          slotTotal + slot.roles.reduce((roleTotal, role) => roleTotal + (role.filled ?? 0), 0),
        0
      ),
    0
  );
}

/**
 * 전체 마감 여부 확인
 */
export function isFullyClosed(requirements: DateRequirementWithSlots[] | undefined): boolean {
  const total = calculateTotalFromDateReqs(requirements);
  const filled = calculateFilledFromDateReqs(requirements);
  return total > 0 && filled >= total;
}

/**
 * 마감 여부 계산 (레거시 폴백 포함)
 */
export function getClosingStatus(jobData: {
  dateSpecificRequirements?: DateRequirementWithSlots[];
  totalPositions?: number;
  filledPositions?: number;
}): { total: number; filled: number; isClosed: boolean } {
  if (jobData.dateSpecificRequirements && jobData.dateSpecificRequirements.length > 0) {
    const total = calculateTotalFromDateReqs(jobData.dateSpecificRequirements);
    const filled = calculateFilledFromDateReqs(jobData.dateSpecificRequirements);
    return {
      total,
      filled,
      isClosed: total > 0 && filled >= total,
    };
  }

  const total = jobData.totalPositions ?? 0;
  const filled = jobData.filledPositions ?? 0;
  return {
    total,
    filled,
    isClosed: total > 0 && filled >= total,
  };
}
