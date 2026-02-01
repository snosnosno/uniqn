/**
 * UNIQN Mobile - ApplicantCard 유틸리티 함수
 *
 * @description 지원자 카드 컴포넌트 헬퍼 함수
 * @version 1.1.0 - formatAppliedDate를 utils/date에서 import
 */

import { getAssignmentRoles } from '@/types';
import { getRoleDisplayName } from '@/types/unified';
import { formatAppliedDate } from '@/utils/date';
import type { Assignment } from '@/types';
import type { AssignmentDisplay } from './types';

// Re-export for backward compatibility
export { formatAppliedDate };

// ============================================================================
// Role Helpers
// ============================================================================

// getRoleDisplayName은 '@/types/unified'에서 직접 import하세요

/**
 * 시간대 표시 포맷 (미정 시간 사유 포함)
 */
export const formatTimeSlotDisplay = (
  timeSlot: string,
  isTimeToBeAnnounced?: boolean,
  tentativeDescription?: string
): string => {
  if (isTimeToBeAnnounced || !timeSlot || timeSlot.trim() === '') {
    return tentativeDescription ? `미정 (${tentativeDescription})` : '미정';
  }
  return timeSlot;
};

// ============================================================================
// Assignment Formatting
// ============================================================================

/**
 * Assignment 배열을 역할별로 분리하여 표시용 형태로 변환
 *
 * @param assignments - Assignment 배열
 * @returns AssignmentDisplay 배열 (날짜순 → 시간순 → 역할순 정렬)
 */
export const formatAssignments = (assignments?: Assignment[]): AssignmentDisplay[] => {
  if (!assignments || assignments.length === 0) return [];

  const result: AssignmentDisplay[] = [];
  const seen = new Set<string>(); // 중복 방지

  for (const assignment of assignments) {
    const roles = getAssignmentRoles(assignment);

    for (const date of assignment.dates) {
      for (const role of roles) {
        const key = `${date}_${assignment.timeSlot}_${role}`;
        if (seen.has(key)) continue; // 중복 스킵
        seen.add(key);

        result.push({
          date,
          formattedDate: formatAppliedDate(date),
          timeSlot: assignment.timeSlot,
          timeSlotDisplay: formatTimeSlotDisplay(
            assignment.timeSlot,
            assignment.isTimeToBeAnnounced,
            assignment.tentativeDescription
          ),
          role,
          roleLabel: getRoleDisplayName(role),
        });
      }
    }
  }

  // 날짜순 → 시간순 → 역할순 정렬 (미정은 맨 뒤로)
  return result.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    // 시간 미정은 맨 뒤로
    if (!a.timeSlot && b.timeSlot) return 1;
    if (a.timeSlot && !b.timeSlot) return -1;
    const timeCompare = a.timeSlot.localeCompare(b.timeSlot);
    if (timeCompare !== 0) return timeCompare;
    return a.role.localeCompare(b.role);
  });
};

/**
 * Assignment 키 생성 (date_timeSlot_role 형식)
 */
export const createAssignmentKey = (date: string, timeSlot: string, role: string): string => {
  return `${date}_${timeSlot}_${role}`;
};

/**
 * Assignment 키에서 날짜 추출
 */
export const getDateFromKey = (key: string): string => {
  return key.split('_')[0];
};
