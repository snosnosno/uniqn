/**
 * UNIQN Mobile - ApplicantCard 표시 유틸
 *
 * @description 지원서와 확정 카드에 쓰이는 포맷팅 유틸리티입니다.
 * @version 1.2.0
 */

import { getAssignmentRoles } from '@/domains/application';
import { WorkLogCreator } from '@/domains/schedule';
import { isTimeTBD } from '@/shared/time';
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
 *
 * 🔴 판정은 `isTimeTBD` 로 한다. 예전 규칙("빈 문자열이 아니면 원문")은 레거시 지원서의
 *    `'NEGOTIABLE'` 을 걸러내지 못해 **사장 화면에 영문 토큰이 그대로 렌더**됐다.
 *    반대로 사람이 적어둔 자유 텍스트('협의' 등)는 계속 살린다 — 있던 정보를 지우면 안 된다.
 */
export const formatTimeSlotDisplay = (
  timeSlot: string,
  isTimeToBeAnnounced?: boolean,
  tentativeDescription?: string
): string => {
  if (isTimeToBeAnnounced || isTimeTBD(timeSlot)) {
    return tentativeDescription ? `미정 (${tentativeDescription})` : '미정';
  }

  return timeSlot;
};

/**
 * 고정공고 카드에 보여줄 출근 시각을 고른다 — 없으면 `undefined`(협의 라벨로 유도).
 *
 * 비유: 안내문에 시간이 적혀 있으면 그걸 읽고, 빈칸이면 "협의"라고 말한다.
 * 빈칸을 채우려고 장부 뒷장의 내부 코드('NEGOTIABLE')를 그대로 읽어 주면 안 된다.
 *
 * 🔴 마지막 폴백인 `legacyTimeSlot`(= `getPostingLegacyTimeSlot`)은 협의 고정공고에서
 *    레거시 센티널을 담을 수 있다. 그래서 **세 후보 전부**를 `isTimeTBD` 로 거른다.
 *    `undefined` 를 돌려주면 `FixedScheduleDisplay` 가 `isStartTimeNegotiable` 과 함께
 *    '협의' 라벨을 만든다(D1: 협의 표시는 공고 유형·플래그에서 유도).
 */
export const resolveFixedStartTime = (
  explicitStartTime?: string,
  postingStartTime?: string,
  legacyTimeSlot?: string
): string | undefined => {
  for (const candidate of [explicitStartTime, postingStartTime, legacyTimeSlot]) {
    if (isTimeTBD(candidate)) {
      continue;
    }
    // 레거시 폴백은 범위형('11:00~19:00')일 수 있어 시작 시각만 취한다.
    const start = WorkLogCreator.extractStartTime(candidate!);
    if (start) {
      return start;
    }
  }

  return undefined;
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
