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
        reason: '해당 역할은 모집 중이 아닙니다.',
      };
    }

    return matchedRole.isAvailable
      ? {
          available: true,
          currentFilled: matchedRole.filled,
          maxCapacity: matchedRole.count,
        }
      : {
          available: false,
          reason: '해당 역할은 모집이 마감되었습니다.',
        };
  }

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
        message: '잘못된 지원 정보입니다. 역할, 시간, 날짜를 확인해 주세요.',
        field: `assignments[${assignmentValidation.invalidIndices.join(', ')}]`,
      });
    }

    const slotCapacity = validateAssignmentSlotCapacity(jobData, assignments);
    if (!slotCapacity.available && slotCapacity.firstIssue) {
      errors.push({
        code: 'ROLE_CAPACITY_REACHED',
        message: '선택한 날짜 또는 역할의 모집이 마감되었습니다.',
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
