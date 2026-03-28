/**
 * UNIQN Mobile - ApplicantCard 표시 유틸
 *
 * @description 지원서와 확정 카드에 쓰이는 포맷팅 유틸리티입니다.
 * @version 1.2.0
 */

import { getAssignmentRoles } from '@/domains/application';
import { getRoleDisplayName } from '@/types/unified';
import { formatAppliedDate } from '@/utils/date';
import {
  APPLICANT_SEPARATOR,
  getDateFromKey as getDateFromKeyCore,
  makeSelectionKey,
} from '@/utils/assignment';
import type { Assignment } from '@/types';
import type { AssignmentDisplay } from './types';

// Re-export for backward compatibility.
export { formatAppliedDate };

/**
 * 확정되지 않은 시간대를 자연스럽게 표시합니다.
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

/**
 * Assignment 배열을 화면 표시용 구조로 변환합니다.
 */
export const formatAssignments = (assignments?: Assignment[]): AssignmentDisplay[] => {
  if (!assignments || assignments.length === 0) {
    return [];
  }

  const result: AssignmentDisplay[] = [];
  const seen = new Set<string>();

  for (const assignment of assignments) {
    const roles = getAssignmentRoles(assignment);

    for (const date of assignment.dates) {
      for (const role of roles) {
        const key = makeSelectionKey(date, assignment.timeSlot, role, {
          separator: APPLICANT_SEPARATOR,
        });

        if (seen.has(key)) {
          continue;
        }

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

  return result.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    if (!a.timeSlot && b.timeSlot) {
      return 1;
    }

    if (a.timeSlot && !b.timeSlot) {
      return -1;
    }

    const timeCompare = a.timeSlot.localeCompare(b.timeSlot);
    if (timeCompare !== 0) {
      return timeCompare;
    }

    return a.role.localeCompare(b.role);
  });
};

/**
 * Assignment 선택 키를 생성합니다.
 */
export const createAssignmentKey = (date: string, timeSlot: string, role: string): string => {
  return makeSelectionKey(date, timeSlot, role, { separator: APPLICANT_SEPARATOR });
};

/**
 * Assignment 키에서 날짜를 추출합니다.
 */
export const getDateFromKey = (key: string): string => {
  return getDateFromKeyCore(key, { separator: APPLICANT_SEPARATOR });
};
