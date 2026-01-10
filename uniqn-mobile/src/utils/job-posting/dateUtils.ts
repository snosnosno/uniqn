/**
 * 구인공고 날짜 관련 유틸리티
 *
 * @version 2.0.0
 * @description 날짜별 요구사항 섹션에서 사용하는 유틸리티 함수들
 */

import { formatDateWithDay, toISODateString } from '../dateUtils';

/**
 * 중복 날짜 검사
 */
export function isDuplicateDate(existingDates: string[], newDate: string): boolean {
  return existingDates.includes(newDate);
}

/**
 * 날짜 배열을 연속된 그룹으로 나누기
 *
 * @example
 * ["2025-01-15", "2025-01-16", "2025-01-18"]
 * → [["2025-01-15", "2025-01-16"], ["2025-01-18"]]
 */
export function groupConsecutiveDates(dates: string[]): string[][] {
  if (!dates || dates.length === 0) return [];

  const sortedDates = [...dates].sort();
  const groups: string[][] = [];
  const firstDate = sortedDates[0];
  if (!firstDate) return [];

  let currentGroup: string[] = [firstDate];

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDateStr = sortedDates[i - 1];
    const currDateStr = sortedDates[i];

    if (!prevDateStr || !currDateStr) continue;

    const prevDate = new Date(prevDateStr);
    const currDate = new Date(currDateStr);
    const diffDays = (currDate.getTime() - prevDate.getTime()) / (1000 * 3600 * 24);

    if (diffDays === 1) {
      // 연속된 날짜면 현재 그룹에 추가
      currentGroup.push(currDateStr);
    } else {
      // 연속되지 않으면 새 그룹 시작
      groups.push(currentGroup);
      currentGroup = [currDateStr];
    }
  }

  // 마지막 그룹 추가
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
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
  const groups = groupConsecutiveDates(sortedDates);

  // 각 그룹을 포맷팅
  const formattedGroups = groups.map((group) => {
    if (group.length === 1) {
      // 단일 날짜
      return formatDateWithDay(group[0]!);
    } else {
      // 날짜 범위
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
 * 날짜 범위 생성
 *
 * @description 시작일부터 종료일까지의 모든 날짜 배열 반환
 */
export function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const isoString = toISODateString(date);
    if (isoString) {
      dates.push(isoString);
    }
  }

  return dates;
}

/**
 * 타입별 날짜 개수 검증
 */
export function validateDateCount(
  postingType: 'regular' | 'urgent' | 'tournament' | 'fixed',
  count: number
): boolean {
  if (postingType === 'regular' || postingType === 'urgent') {
    return count === 1;
  }
  if (postingType === 'tournament') {
    return count >= 1 && count <= 30;
  }
  // fixed는 DateRequirementsSection 사용 안 함
  return false;
}

/**
 * 날짜 정렬 (오름차순)
 */
export function sortDates(dates: string[]): string[] {
  return [...dates].sort();
}

/**
 * 중복 역할 검사
 */
export function isDuplicateRole(
  existingRoles: Array<{ role: string }>,
  newRole: string,
  currentIndex?: number
): boolean {
  return existingRoles.some((r, i) => {
    // 현재 인덱스는 제외
    if (currentIndex !== undefined && i === currentIndex) return false;
    return r.role === newRole;
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

/**
 * 날짜 문자열을 Date 객체로 변환
 */
export function parseDate(dateString: string): Date | null {
  if (!isValidDateFormat(dateString)) return null;

  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * 오늘 날짜 문자열 (yyyy-MM-dd)
 */
export function getTodayDateString(): string {
  const today = new Date();
  return toISODateString(today) ?? '';
}

/**
 * N일 후 날짜 문자열
 */
export function getDateAfterDays(days: number): string {
  const today = new Date();
  today.setDate(today.getDate() + days);
  return toISODateString(today) ?? '';
}

/**
 * 긴급 공고 날짜 제한 (7일 이내)
 */
export function isWithinUrgentDateLimit(date: string): boolean {
  const targetDate = parseDate(date);
  if (!targetDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const limitDate = new Date(today);
  limitDate.setDate(limitDate.getDate() + 7);

  return targetDate >= today && targetDate <= limitDate;
}

// ============================================================================
// Migration Utilities (Phase 8)
// ============================================================================

/**
 * 고유 ID 생성
 *
 * @description 타임스탬프 + 랜덤값으로 고유 ID 생성
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * TournamentDates → DateSpecificRequirements 변환
 *
 * @description 레거시 tournamentDates 데이터를 신규 dateSpecificRequirements로 변환
 * @version 2.0.0
 *
 * @example
 * // Before (tournamentDates)
 * [
 *   { day: 1, date: '2025-01-15', startTime: '09:00' },
 *   { day: 2, date: '2025-01-16', startTime: '10:00' },
 * ]
 *
 * // After (dateSpecificRequirements)
 * [
 *   {
 *     date: '2025-01-15',
 *     timeSlots: [{
 *       id: '...',
 *       startTime: '09:00',
 *       isTimeToBeAnnounced: false,
 *       roles: [{ id: '...', role: 'dealer', headcount: 1 }],
 *     }],
 *   },
 *   ...
 * ]
 */
export function convertTournamentDatesToDateRequirements(
  tournamentDates: Array<{
    day: number;
    date: string;
    startTime: string;
  }>
): Array<{
  date: string;
  timeSlots: Array<{
    id: string;
    startTime: string;
    isTimeToBeAnnounced: boolean;
    tentativeDescription?: string;
    roles: Array<{
      id: string;
      role: 'dealer';
      customRole?: string;
      headcount: number;
    }>;
  }>;
}> {
  return tournamentDates.map((td) => ({
    date: td.date,
    timeSlots: [
      {
        id: generateId(),
        startTime: td.startTime,
        isTimeToBeAnnounced: false,
        roles: [
          {
            id: generateId(),
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
 *
 * @description 신규 dateSpecificRequirements를 레거시 tournamentDates 형식으로 변환
 * @version 2.0.0
 *
 * @remarks
 * - 하위 호환성을 위해 v1.0.0까지 양쪽 필드 모두 저장
 * - 첫 번째 timeSlot의 startTime만 사용
 * - roles 정보는 유실됨 (레거시 필드에는 역할 정보 없음)
 */
export function convertDateRequirementsToTournamentDates(
  dateRequirements: Array<{
    date: string | { seconds: number } | { toDate: () => Date };
    timeSlots: Array<{
      startTime: string;
    }>;
  }>
): Array<{
  day: number;
  date: string;
  startTime: string;
}> {
  return dateRequirements.map((dr, index) => {
    // date 필드를 문자열로 변환
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

    // 첫 번째 timeSlot의 startTime 사용
    const firstTimeSlot = dr.timeSlots[0];
    const startTime = firstTimeSlot?.startTime || '09:00';

    return {
      day: index + 1,
      date: dateString,
      startTime,
    };
  });
}
