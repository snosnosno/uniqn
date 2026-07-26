import type { JobPosting, Assignment, PreQuestionAnswer } from '@/types';
import { selectPostingRoleAvailability } from '@/domains/job-posting';
import { isValidAssignment } from '@/types/assignment';
import { validateRequiredAnswers } from '@/types/preQuestion';
import { getClosingStatus } from '@/utils/job-posting/dateUtils';
import { STATUS } from '@/constants';
import { validateAssignmentSlotCapacity } from './slotCapacity';

export interface RoleCapacityResult {
  available: boolean;
  reason?: string;
  currentFilled?: number;
  maxCapacity?: number;
}

export interface ApplicationValidationResult {
  isValid: boolean;
  errors: ApplicationValidationError[];
}

export interface ApplicationValidationError {
  code:
    | 'JOB_NOT_ACTIVE'
    | 'MAX_CAPACITY_REACHED'
    | 'ROLE_CAPACITY_REACHED'
    | 'INVALID_ASSIGNMENT'
    | 'MISSING_PRE_QUESTION_ANSWERS'
    | 'INVALID_PRE_QUESTION_ANSWERS';
  message: string;
  field?: string;
}

export class ApplicationValidator {
  /**
   * 선택한 역할이 **이 공고에 존재하는지** 확인한다.
   *
   * @description 이름과 달리 정원(마감)은 보지 않는다 — 볼 수도 없다. 역할별 충원 카운터는
   * SP3 에서 제거돼 `role.filled` 이 상수 0 이고(domains/job-posting/core.ts), 지원 게이트는
   * 실확정 수(`filledByRole`)를 주입하지 않기 때문이다. **의도된 정책**이다: 마감된 역할에도
   * 대기 성격의 지원은 받고, 최종 overfill 차단은 서버 `confirm_application`(H1 정원 가드)이
   * 권위를 갖는다.
   *
   * ⚠️ 예전에는 여기서 "모집이 마감되었습니다"를 냈다. 도달할 수 없는 문구였고, 실제로 걸리는
   * 유일한 경우(카탈로그에 없는 역할 선택 — 구버전 화면·stale 캐시)에 원인과 무관한 안내를
   * 하고 있었다. 그래서 존재 검사로 정직하게 좁혔다.
   */
  checkRoleCapacity(jobData: JobPosting, appliedRole: string): RoleCapacityResult {
    const roleAvailability = selectPostingRoleAvailability(jobData);

    if (roleAvailability.items.length === 0) {
      return { available: true };
    }

    const matchedRole = roleAvailability.items.find((role) => {
      if (role.key === appliedRole) return true;
      if (role.role === appliedRole) return true;
      if (role.role === 'other' && role.customRole === appliedRole) return true;
      return false;
    });

    if (!matchedRole) {
      return {
        available: false,
        reason: '선택한 역할이 공고에 없습니다. 새로고침 후 다시 선택해 주세요.',
      };
    }

    return {
      available: true,
      currentFilled: matchedRole.filled,
      maxCapacity: matchedRole.count,
    };
  }

  /**
   * 공고 전체 정원 마감 확인.
   *
   * @description 역할 단위(`checkRoleCapacity`)는 마감을 막지 않는데 전체 단위는 막는 비대칭은
   * 의도된 것이다. 전체 정원이 차면 DB 트리거 `fn_recalc_total_and_capacity` 가 상태를
   * `capacity_full` 로 내려 `isJobActive` 가 먼저 걸러 낸다 — 이 검사는 그 전이가 아직 반영되지
   * 않은 행(구버전에서 만들어져 전이를 못 탄 active 공고)을 위한 **뒷받침**이다.
   * `domains/job-posting/facts.ts` 의 `capacity_full || filled>=total` 판정과 같은 이유로 남긴다.
   * 반면 역할 단위에는 대응하는 DB 전이가 없고, 마감 역할 지원 허용이 정책이라 뒷받침할 대상 자체가 없다.
   */
  checkTotalCapacity(jobData: JobPosting): RoleCapacityResult {
    const { total: totalPositions, filled: currentFilled } = getClosingStatus(jobData);

    if (totalPositions > 0 && currentFilled >= totalPositions) {
      return {
        available: false,
        reason: '모집 인원이 마감되었습니다.',
        currentFilled,
        maxCapacity: totalPositions,
      };
    }

    return {
      available: true,
      currentFilled,
      maxCapacity: totalPositions,
    };
  }

  isJobActive(jobData: JobPosting): boolean {
    return jobData.status === STATUS.JOB_POSTING.ACTIVE;
  }

  validateAssignments(assignments: Assignment[]): {
    isValid: boolean;
    invalidIndices: number[];
  } {
    const invalidIndices: number[] = [];

    assignments.forEach((assignment, index) => {
      if (!isValidAssignment(assignment)) {
        invalidIndices.push(index);
      }
    });

    return {
      isValid: invalidIndices.length === 0,
      invalidIndices,
    };
  }

  validatePreQuestionAnswers(
    jobData: JobPosting,
    answers?: PreQuestionAnswer[]
  ): { isValid: boolean; reason?: string } {
    const questions = jobData.questions.items ?? [];

    if (questions.length === 0) {
      return { isValid: true };
    }

    if (!answers?.length) {
      return {
        isValid: false,
        reason: '사전질문에 답변해 주세요',
      };
    }

    const isValid = validateRequiredAnswers(answers);
    if (!isValid) {
      return {
        isValid: false,
        reason: '필수 질문에 모두 답변해 주세요',
      };
    }

    return { isValid: true };
  }

  validateApplication(
    jobData: JobPosting,
    assignments: Assignment[],
    preQuestionAnswers?: PreQuestionAnswer[]
  ): ApplicationValidationResult {
    const errors: ApplicationValidationError[] = [];

    if (!this.isJobActive(jobData)) {
      errors.push({
        code: 'JOB_NOT_ACTIVE',
        message: '지원이 마감된 공고입니다.',
      });
    }

    const totalCapacity = this.checkTotalCapacity(jobData);
    if (!totalCapacity.available) {
      errors.push({
        code: 'MAX_CAPACITY_REACHED',
        message: totalCapacity.reason ?? '모집 인원이 마감되었습니다.',
      });
    }

    const assignmentValidation = this.validateAssignments(assignments);
    if (!assignmentValidation.isValid) {
      errors.push({
        code: 'INVALID_ASSIGNMENT',
        message: '지원 정보가 올바르지 않습니다. 역할, 시간, 날짜를 확인해 주세요.',
        field: `assignments[${assignmentValidation.invalidIndices.join(', ')}]`,
      });
    }

    // 이 검사가 실제로 잡는 것은 "공고에 없는 날짜·시간·역할 조합"이다(정원 아님 — slotCapacity.ts 주석).
    // 옛 문구는 "모집이 마감되었습니다"라 원인과 안내가 어긋났고, 사용자는 새로고침하면 풀린다는 걸 알 길이 없었다.
    const slotCapacity = validateAssignmentSlotCapacity(jobData, assignments);
    if (!slotCapacity.available && slotCapacity.firstIssue) {
      errors.push({
        code: 'ROLE_CAPACITY_REACHED',
        message: '선택한 날짜·시간·역할이 공고에 없습니다. 새로고침 후 다시 선택해 주세요.',
        field: `assignments:${slotCapacity.firstIssue.date}:${slotCapacity.firstIssue.timeSlot}:${slotCapacity.firstIssue.roleId}`,
      });
    }

    const preQuestionValidation = this.validatePreQuestionAnswers(jobData, preQuestionAnswers);
    if (!preQuestionValidation.isValid) {
      errors.push({
        code: preQuestionAnswers?.length
          ? 'INVALID_PRE_QUESTION_ANSWERS'
          : 'MISSING_PRE_QUESTION_ANSWERS',
        message: preQuestionValidation.reason ?? '사전질문 답변을 확인해 주세요',
        field: 'preQuestionAnswers',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

export const applicationValidator = new ApplicationValidator();
