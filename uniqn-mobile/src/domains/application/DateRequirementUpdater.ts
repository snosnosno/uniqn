/**
 * UNIQN Mobile - 날짜별 요구사항 업데이트 유틸리티
 *
 * @description dateSpecificRequirements의 filled 값 계산 (순수 함수)
 * @version 1.0.0
 *
 * 원래 applicationHistoryService.ts에서 분리됨
 * - Service, Repository 양쪽에서 사용하므로 Domain 레이어에 위치
 */

import { logger } from '@/utils/logger';
import { BusinessError, ERROR_CODES } from '@/errors';
import { WorkLogCreator } from '@/domains/schedule';
import { getDateString } from '@/types/jobPosting/dateRequirement';
import type { Assignment, DateSpecificRequirement } from '@/types';

/**
 * Assignment의 timeSlot에서 시작 시간 추출
 * @description WorkLogCreator.extractStartTime 위임
 */
const extractStartTime = WorkLogCreator.extractStartTime.bind(WorkLogCreator);

/**
 * dateSpecificRequirements의 filled 값 업데이트
 *
 * @param requirements 현재 dateSpecificRequirements
 * @param assignments 확정/취소할 assignments
 * @param operation 'increment' | 'decrement'
 * @returns 업데이트된 dateSpecificRequirements
 */
export function updateDateSpecificRequirementsFilled(
  requirements: DateSpecificRequirement[] | undefined,
  assignments: Assignment[],
  operation: 'increment' | 'decrement'
): DateSpecificRequirement[] | undefined {
  if (!requirements || requirements.length === 0) {
    return requirements;
  }

  // Deep copy to avoid mutation
  const updatedRequirements = requirements.map((req) => ({
    ...req,
    timeSlots: req.timeSlots.map((ts) => ({
      ...ts,
      roles: ts.roles.map((r) => ({ ...r })),
    })),
  }));

  // 매칭 통계
  let expectedUpdates = 0;
  let successfulUpdates = 0;

  // 각 assignment에 대해 해당하는 slot 찾아서 업데이트
  for (const assignment of assignments) {
    const assignmentStartTime = extractStartTime(assignment.timeSlot);
    // v3.0: roleIds 사용
    const assignmentRole = assignment.roleIds[0];

    if (!assignmentRole) {
      logger.warn('Assignment에 역할 정보 없음', { assignment });
      continue;
    }

    for (const date of assignment.dates) {
      expectedUpdates++;

      // 해당 날짜의 requirement 찾기
      const dateReq = updatedRequirements.find((req) => {
        // getDateString으로 다양한 형식 (string | Timestamp | { seconds }) 통합 처리
        const reqDateStr = getDateString(req.date);
        return reqDateStr === date;
      });

      if (!dateReq) {
        logger.warn('dateSpecificRequirements에서 날짜 매칭 실패', {
          targetDate: date,
          availableDates: updatedRequirements.map((r) => r.date),
        });
        continue;
      }

      // 해당 시간대의 timeSlot 찾기
      const timeSlot = dateReq.timeSlots.find((ts) => {
        const slotStartTime = ts.startTime ?? (ts as { time?: string }).time ?? '';
        return slotStartTime === assignmentStartTime;
      });

      if (!timeSlot) {
        logger.warn('dateSpecificRequirements에서 시간대 매칭 실패', {
          targetTime: assignmentStartTime,
          availableTimes: dateReq.timeSlots.map(
            (ts) => ts.startTime ?? (ts as { time?: string }).time
          ),
        });
        continue;
      }

      // 해당 역할 찾기 (커스텀 역할 지원)
      const roleReq = timeSlot.roles.find((r) => {
        const roleName = r.role ?? (r as { name?: string }).name;
        if (roleName === assignmentRole) return true;
        // 커스텀 역할 체크: role이 'other'이고 customRole이 assignmentRole과 일치
        if (r.role === 'other' && r.customRole === assignmentRole) return true;
        return false;
      });

      if (!roleReq) {
        logger.warn('dateSpecificRequirements에서 역할 매칭 실패', {
          targetRole: assignmentRole,
          availableRoles: timeSlot.roles.map((r) => r.role ?? (r as { name?: string }).name),
        });
        continue;
      }

      // filled 값 업데이트
      const currentFilled = roleReq.filled ?? (roleReq as { filled?: number }).filled ?? 0;
      if (operation === 'increment') {
        roleReq.filled = currentFilled + 1;
      } else {
        roleReq.filled = Math.max(0, currentFilled - 1);
      }
      successfulUpdates++;
    }
  }

  // 매칭 결과 처리
  if (expectedUpdates > 0 && successfulUpdates === 0) {
    if (operation === 'decrement') {
      // 취소 흐름에서는 throw 하지 않음 (교착 방지: 확정 취소가 실패하면 안 됨)
      logger.error('dateSpecificRequirements filled 전체 매칭 실패 (취소 흐름)', {
        operation,
        expectedUpdates,
      });
    } else {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '모집 현황 업데이트에 실패했습니다. 공고 데이터를 확인해주세요.',
      });
    }
  } else if (expectedUpdates > 0 && successfulUpdates < expectedUpdates) {
    logger.warn('dateSpecificRequirements filled 업데이트 일부 실패', {
      operation,
      expectedUpdates,
      successfulUpdates,
      failedUpdates: expectedUpdates - successfulUpdates,
    });
  }

  return updatedRequirements;
}
