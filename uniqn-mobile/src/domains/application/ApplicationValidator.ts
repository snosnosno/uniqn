/**
 * UNIQN Mobile - Application Validator
 *
 * @description 지원서 관련 검증 로직 통합
 * @version 1.0.0
 *
 * ## 책임
 * - 지원 가능 여부 검증
 * - 역할별 정원 확인
 * - 사전질문 답변 검증
 * - Assignment 유효성 검증
 */

import type { JobPosting, Assignment, PreQuestionAnswer } from '@/types';
import { isValidAssignment, validateRequiredAnswers } from '@/types';
import { getClosingStatus } from '@/utils/job-posting/dateUtils';
import { STATUS } from '@/constants';

// ============================================================================
// Types
// ============================================================================

/**
 * 역할 정원 확인 결과
 */
export interface RoleCapacityResult {
  available: boolean;
  reason?: string;
  currentFilled?: number;
  maxCapacity?: number;
}

/**
 * 지원 검증 결과
 */
export interface ApplicationValidationResult {
  isValid: boolean;
  errors: ApplicationValidationError[];
}

/**
 * 지원 검증 에러
 */
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

// ============================================================================
// Application Validator
// ============================================================================

/**
 * 지원서 검증 클래스
 *
 * @example
 * ```typescript
 * const validator = new ApplicationValidator();
 *
 * // 역할 정원 확인
 * const capacity = validator.checkRoleCapacity(jobData, 'dealer');
 *
 * // 전체 검증
 * const result = validator.validateApplication(jobData, assignments, answers);
 * if (!result.isValid) {
 *   console.log(result.errors);
 * }
 * ```
 */
export class ApplicationValidator {
  /**
   * 특정 역할의 정원 확인
   *
   * @description dateSpecificRequirements 또는 roles 배열에서 역할별 마감 상태 확인
   *
   * @param jobData - 공고 데이터
   * @param appliedRole - 지원 역할
   * @returns 정원 확인 결과
   */
  checkRoleCapacity(jobData: JobPosting, appliedRole: string): RoleCapacityResult {
    /**
     * 역할 매칭 헬퍼
     * - 표준 역할: r.role === appliedRole
     * - 커스텀 역할: r.role === 'other' && r.customRole === appliedRole
     */
    const matchesRole = (r: { role?: string; name?: string; customRole?: string }) => {
      if (r.role === appliedRole || r.name === appliedRole) return true;
      if (r.role === 'other' && r.customRole === appliedRole) return true;
      return false;
    };

    // dateSpecificRequirements가 있으면 역할별 마감 확인
    if (jobData.schedule.kind === 'dated') {
      if (jobData.schedule.requirements.length === 0) {
        return { available: true };
      }

      for (const req of jobData.schedule.requirements) {
        for (const slot of req.timeSlots || []) {
          const roleReq = slot.roles?.find(matchesRole);
          if (roleReq) {
            const total = roleReq.count ?? 0;
            const filled = roleReq.filled ?? 0;
            if (total > 0 && filled < total) {
              return {
                available: true,
                currentFilled: filled,
                maxCapacity: total,
              };
            }
          }
        }
      }
      return {
        available: false,
        reason: '해당 역할의 모집이 마감되었습니다',
      };
    }

    // 레거시: roles 배열 확인
    if (jobData.schedule.kind === 'fixed') {
      if (!jobData.schedule.roleRequirements?.length) {
        return { available: true };
      }

      const roleReq = jobData.schedule.roleRequirements?.find(matchesRole);
      if (roleReq) {
        const filled = roleReq.filled ?? 0;
        if (filled < roleReq.count) {
          return {
            available: true,
            currentFilled: filled,
            maxCapacity: roleReq.count,
          };
        }
      }
      return {
        available: false,
        reason: '해당 역할의 모집이 마감되었습니다',
      };
    }

    // 역할 정보 없으면 통과 (레거시 호환)
    return { available: true };
  }

  /**
   * 공고 전체 정원 확인
   *
   * @param jobData - 공고 데이터
   * @returns 정원 확인 결과
   */
  checkTotalCapacity(jobData: JobPosting): RoleCapacityResult {
    const { total: totalPositions, filled: currentFilled } = getClosingStatus(jobData);

    if (totalPositions > 0 && currentFilled >= totalPositions) {
      return {
        available: false,
        reason: '모집 인원이 마감되었습니다',
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

  /**
   * 공고 상태 확인
   *
   * @param jobData - 공고 데이터
   * @returns 지원 가능 여부
   */
  isJobActive(jobData: JobPosting): boolean {
    return jobData.status === STATUS.JOB_POSTING.ACTIVE;
  }

  /**
   * Assignment 배열 유효성 검증
   *
   * @param assignments - Assignment 배열
   * @returns 검증 결과
   */
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

  /**
   * 사전질문 답변 검증
   *
   * @param jobData - 공고 데이터 (사전질문 포함)
   * @param answers - 사전질문 답변
   * @returns 검증 결과
   */
  validatePreQuestionAnswers(
    jobData: JobPosting,
    answers?: PreQuestionAnswer[]
  ): { isValid: boolean; reason?: string } {
    // 사전질문 사용 안 함
    const questions = jobData.questions.items ?? [];

    if (questions.length === 0) {
      return { isValid: true };
    }

    // 답변 없음
    if (!answers?.length) {
      return {
        isValid: false,
        reason: '사전질문에 답변해주세요',
      };
    }

    // 필수 답변 검증
    const isValid = validateRequiredAnswers(answers);
    if (!isValid) {
      return {
        isValid: false,
        reason: '필수 질문에 모두 답변해주세요',
      };
    }

    return { isValid: true };
  }

  /**
   * 지원 전체 검증
   *
   * @description 공고 상태, 정원, Assignment, 사전질문을 모두 검증
   *
   * @param jobData - 공고 데이터
   * @param assignments - Assignment 배열
   * @param preQuestionAnswers - 사전질문 답변 (선택)
   * @returns 검증 결과
   */
  validateApplication(
    jobData: JobPosting,
    assignments: Assignment[],
    preQuestionAnswers?: PreQuestionAnswer[]
  ): ApplicationValidationResult {
    const errors: ApplicationValidationError[] = [];

    // 1. 공고 상태 확인
    if (!this.isJobActive(jobData)) {
      errors.push({
        code: 'JOB_NOT_ACTIVE',
        message: '지원이 마감된 공고입니다',
      });
    }

    // 2. 전체 정원 확인
    const totalCapacity = this.checkTotalCapacity(jobData);
    if (!totalCapacity.available) {
      errors.push({
        code: 'MAX_CAPACITY_REACHED',
        message: totalCapacity.reason ?? '모집 인원이 마감되었습니다',
      });
    }

    // 3. Assignment 유효성 확인
    const assignmentValidation = this.validateAssignments(assignments);
    if (!assignmentValidation.isValid) {
      errors.push({
        code: 'INVALID_ASSIGNMENT',
        message: '잘못된 지원 정보입니다. 역할, 시간, 날짜를 확인해주세요.',
        field: `assignments[${assignmentValidation.invalidIndices.join(', ')}]`,
      });
    }

    // 4. 역할별 정원 확인 (모든 Assignment의 모든 roleId)
    for (let i = 0; i < assignments.length; i++) {
      const roleIds = assignments[i]?.roleIds;
      if (!roleIds?.length) continue;

      for (let j = 0; j < roleIds.length; j++) {
        const roleId = roleIds[j];
        if (!roleId) continue;

        const roleCapacity = this.checkRoleCapacity(jobData, roleId);
        if (!roleCapacity.available) {
          errors.push({
            code: 'ROLE_CAPACITY_REACHED',
            message: roleCapacity.reason ?? '해당 역할의 모집이 마감되었습니다',
            field: `assignments[${i}].roleIds[${j}]`,
          });
          break; // 같은 assignment 내 다른 역할도 이미 마감이면 첫 번째만 보고
        }
      }
    }

    // 5. 사전질문 답변 검증
    const preQuestionValidation = this.validatePreQuestionAnswers(jobData, preQuestionAnswers);
    if (!preQuestionValidation.isValid) {
      errors.push({
        code: preQuestionAnswers?.length
          ? 'INVALID_PRE_QUESTION_ANSWERS'
          : 'MISSING_PRE_QUESTION_ANSWERS',
        message: preQuestionValidation.reason ?? '사전질문 답변을 확인해주세요',
        field: 'preQuestionAnswers',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * ApplicationValidator 싱글톤 인스턴스
 */
export const applicationValidator = new ApplicationValidator();
