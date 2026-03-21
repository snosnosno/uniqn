/**
 * UNIQN Mobile - 공고 폼 유효성 검증
 *
 * @description 공고 생성(JobPostingScrollForm) 및 수정(edit.tsx) 공통 검증 함수
 * @version 1.0.0
 */

import { STAFF_ROLES } from '@/constants';
import { xssValidation } from '@/utils/security';
import type { JobPostingFormData } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface SectionErrors {
  basicInfo: Record<string, string>;
  schedule: Record<string, string>;
  roles: Record<string, string>;
  salary: Record<string, string>;
  preQuestions: Record<string, string>;
}

export interface ValidateOptions {
  /** 수정 모드에서 레거시 필드 폴백 허용 (workDate, startTime) */
  allowLegacyFallback?: boolean;
}

// ============================================================================
// Validation Functions
// ============================================================================

export function validateBasicInfo(data: JobPostingFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.postingType) {
    errors.postingType = '공고 타입을 선택해주세요';
  }
  if (!data.title?.trim()) {
    errors.title = '제목을 입력해주세요';
  } else if (data.title.trim().length < 2) {
    errors.title = '제목은 최소 2자 이상 입력해주세요';
  } else if (!xssValidation(data.title)) {
    errors.title = '위험한 문자열이 포함되어 있습니다';
  }
  if (data.description && !xssValidation(data.description)) {
    errors.description = '위험한 문자열이 포함되어 있습니다';
  }
  const detailedAddress = data.location?.detailedAddress ?? data.detailedAddress;
  if (detailedAddress && !xssValidation(detailedAddress)) {
    errors.detailedAddress = '위험한 문자열이 포함되어 있습니다';
  }
  if (data.contactPhone && !xssValidation(data.contactPhone)) {
    errors.contactPhone = '위험한 문자열이 포함되어 있습니다';
  }
  if (!data.location) {
    errors.location = '근무지를 선택해주세요';
  }

  return errors;
}

export function validateSchedule(
  data: JobPostingFormData,
  options?: ValidateOptions
): Record<string, string> {
  const errors: Record<string, string> = {};

  const hasDateRequirements =
    data.dateSpecificRequirements && data.dateSpecificRequirements.length > 0;

  switch (data.postingType) {
    case 'regular':
    case 'urgent':
    case 'tournament':
      if (hasDateRequirements) {
        // 모든 날짜의 타임슬롯에 역할이 있는지 확인
        const hasIncomplete = data.dateSpecificRequirements!.some((req) => {
          return (
            !req.timeSlots ||
            req.timeSlots.length === 0 ||
            req.timeSlots.some((slot) => !slot.roles || slot.roles.length === 0)
          );
        });
        if (hasIncomplete) {
          errors.dateSpecificRequirements = '모든 날짜의 역할과 인원을 입력해주세요';
        }
      } else if (options?.allowLegacyFallback) {
        // 수정 모드: 레거시 필드 폴백 검증
        if (!data.workDate) {
          errors.workDate = '근무 날짜를 선택해주세요';
        }
        if (!data.startTime) {
          errors.startTime = '출근 시간을 선택해주세요';
        }
      } else {
        // 생성 모드: 날짜별 요구사항 필수
        errors.dateSpecificRequirements = '날짜별 요구사항을 추가해주세요';
      }
      break;
    case 'fixed':
      if (data.daysPerWeek === undefined || data.daysPerWeek < 0 || data.daysPerWeek > 7) {
        errors.daysPerWeek = '주 출근일수를 선택해주세요';
      }
      if (!data.isStartTimeNegotiable && !data.startTime) {
        errors.startTime = '출근 시간을 선택해주세요';
      }
      break;
  }

  return errors;
}

export function validateRoles(data: JobPostingFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  // fixed 타입만 RolesSection 사용 (다른 타입은 TimeSlot 내 역할 관리)
  if (data.postingType === 'fixed') {
    if (!data.roles || data.roles.length === 0) {
      errors.roles = '최소 1개 이상의 역할을 추가해주세요';
    } else {
      const totalCount = data.roles.reduce((sum, r) => sum + r.count, 0);
      if (totalCount === 0) {
        errors.roles = '모집 인원은 최소 1명 이상이어야 합니다';
      }
      const hasEmptyName = data.roles.some((r) => r.isCustom && !r.name.trim());
      if (hasEmptyName) {
        errors.roles = '모든 역할의 이름을 입력해주세요';
      }
    }
  }

  return errors;
}

export function validateSalary(data: JobPostingFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  const rolesWithoutSalary: string[] = [];

  data.roles.forEach((role) => {
    const staffRole = STAFF_ROLES.find((sr) => sr.name === role.name || sr.key === role.name);
    const displayName = staffRole?.name || role.name;
    const roleSalary = role.salary;

    // 협의(other)가 아닌 경우 금액 필수
    if (roleSalary?.type !== 'other' && (!roleSalary || roleSalary.amount <= 0)) {
      rolesWithoutSalary.push(displayName);
    }
  });

  if (rolesWithoutSalary.length > 0) {
    errors.roleSalary = `${rolesWithoutSalary.join(', ')}의 급여를 입력해주세요`;
  }

  return errors;
}

export function validatePreQuestions(data: JobPostingFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  if (data.usesPreQuestions) {
    const hasEmptyQuestion = data.preQuestions.some((q) => !q.question.trim());
    if (hasEmptyQuestion) {
      errors.preQuestions = '질문 내용을 입력해주세요';
    }

    const hasXssQuestion = data.preQuestions.some(
      (q) => q.question.trim() && !xssValidation(q.question)
    );
    if (hasXssQuestion) {
      errors.preQuestions = '위험한 문자열이 포함되어 있습니다';
    }

    const hasEmptyOption = data.preQuestions.some(
      (q) => q.type === 'select' && q.options?.some((opt) => !opt.trim())
    );
    if (hasEmptyOption) {
      errors.preQuestions = '선택지 내용을 입력해주세요';
    }

    const hasXssOption = data.preQuestions.some(
      (q) => q.type === 'select' && q.options?.some((opt) => opt.trim() && !xssValidation(opt))
    );
    if (hasXssOption) {
      errors.preQuestions = '위험한 문자열이 포함되어 있습니다';
    }
  }

  return errors;
}

/**
 * 전체 섹션 검증
 */
export function validateAllSections(
  data: JobPostingFormData,
  options?: ValidateOptions & { skipSections?: (keyof SectionErrors)[] }
): SectionErrors {
  const skipSections = options?.skipSections ?? [];

  return {
    basicInfo: skipSections.includes('basicInfo') ? {} : validateBasicInfo(data),
    schedule: skipSections.includes('schedule') ? {} : validateSchedule(data, options),
    roles: skipSections.includes('roles') ? {} : validateRoles(data),
    salary: skipSections.includes('salary') ? {} : validateSalary(data),
    preQuestions: skipSections.includes('preQuestions') ? {} : validatePreQuestions(data),
  };
}

/**
 * 에러가 있는 첫 번째 섹션 키 반환
 */
export function getFirstErrorSection(errors: SectionErrors): keyof SectionErrors | null {
  const sections: (keyof SectionErrors)[] = [
    'basicInfo',
    'schedule',
    'roles',
    'salary',
    'preQuestions',
  ];
  for (const section of sections) {
    if (Object.keys(errors[section]).length > 0) {
      return section;
    }
  }
  return null;
}
