/**
 * UNIQN Mobile - ApplicantCard ?좏떥由ы떚 ?⑥닔
 *
 * @description 吏?먯옄 移대뱶 而댄룷?뚰듃 ?ы띁 ?⑥닔
 * @version 1.2.0 - selectionCore.ts濡????앹꽦 ?듯빀
 */

import { getAssignmentRoles } from '@/domains/application';
import { getRoleDisplayName } from '@/types/unified';
import { formatAppliedDate } from '@/utils/date';
import {
  makeSelectionKey,
  getDateFromKey as getDateFromKeyCore,
  APPLICANT_SEPARATOR,
} from '@/utils/assignment';
import type { Assignment } from '@/types';
import type { AssignmentDisplay } from './types';

// Re-export for backward compatibility
export { formatAppliedDate };

// ============================================================================
// Role Helpers
// ============================================================================

// getRoleDisplayName? '@/types/unified'?먯꽌 吏곸젒 import?섏꽭??
/**
 * ?쒓컙? ?쒖떆 ?щ㎎ (誘몄젙 ?쒓컙 ?ъ쑀 ?ы븿)
 */
export const formatTimeSlotDisplay = (
  timeSlot: string,
  isTimeToBeAnnounced?: boolean,
  tentativeDescription?: string
): string => {
  if (isTimeToBeAnnounced || !timeSlot || timeSlot.trim() === '') {
    return tentativeDescription ? `誘몄젙 (${tentativeDescription})` : '誘몄젙';
  }
  return timeSlot;
};

// ============================================================================
// Assignment Formatting
// ============================================================================

/**
 * Assignment 諛곗뿴????븷蹂꾨줈 遺꾨━?섏뿬 ?쒖떆???뺥깭濡?蹂?? *
 * @param assignments - Assignment 諛곗뿴
 * @returns AssignmentDisplay 諛곗뿴 (?좎쭨?????쒓컙??????븷???뺣젹)
 */
export const formatAssignments = (assignments?: Assignment[]): AssignmentDisplay[] => {
  if (!assignments || assignments.length === 0) return [];

  const result: AssignmentDisplay[] = [];
  const seen = new Set<string>(); // 以묐났 諛⑹?

  for (const assignment of assignments) {
    const roles = getAssignmentRoles(assignment);

    for (const date of assignment.dates) {
      for (const role of roles) {
        const key = makeSelectionKey(date, assignment.timeSlot, role, {
          separator: APPLICANT_SEPARATOR,
        });
        if (seen.has(key)) continue; // 以묐났 ?ㅽ궢
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

  // ?좎쭨?????쒓컙??????븷???뺣젹 (誘몄젙? 留??ㅻ줈)
  return result.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    // ?쒓컙 誘몄젙? 留??ㅻ줈
    if (!a.timeSlot && b.timeSlot) return 1;
    if (a.timeSlot && !b.timeSlot) return -1;
    const timeCompare = a.timeSlot.localeCompare(b.timeSlot);
    if (timeCompare !== 0) return timeCompare;
    return a.role.localeCompare(b.role);
  });
};

/**
 * Assignment ???앹꽦 (date_timeSlot_role ?뺤떇)
 * @see selectionCore.ts - ?듯빀 援ы쁽
 */
export const createAssignmentKey = (date: string, timeSlot: string, role: string): string => {
  return makeSelectionKey(date, timeSlot, role, { separator: APPLICANT_SEPARATOR });
};

/**
 * Assignment ?ㅼ뿉???좎쭨 異붿텧
 * @see selectionCore.ts - ?듯빀 援ы쁽
 */
export const getDateFromKey = (key: string): string => {
  return getDateFromKeyCore(key, { separator: APPLICANT_SEPARATOR });
};
