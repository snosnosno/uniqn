import { STAFF_ROLES } from '@/constants';
import { xssValidation } from '@/utils/security';
import type { JobPostingFormData } from '@/types';

export interface SectionErrors {
  basicInfo: Record<string, string>;
  schedule: Record<string, string>;
  roles: Record<string, string>;
  salary: Record<string, string>;
  preQuestions: Record<string, string>;
}

export interface ValidateOptions {
  allowLegacyFallback?: boolean;
}

export function validateBasicInfo(data: JobPostingFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.postingType) {
    errors.postingType = '공고 타입을 선택해 주세요';
  }
  if (!data.title?.trim()) {
    errors.title = '제목을 입력해 주세요';
  } else if (data.title.trim().length < 2) {
    errors.title = '제목은 최소 2자 이상 입력해 주세요';
  } else if (!xssValidation(data.title)) {
    errors.title = '위험한 문자가 포함되어 있습니다';
  }
  if (data.description && !xssValidation(data.description)) {
    errors.description = '위험한 문자가 포함되어 있습니다';
  }
  const detailedAddress = data.location?.detailedAddress ?? data.detailedAddress;
  if (detailedAddress && !xssValidation(detailedAddress)) {
    errors.detailedAddress = '위험한 문자가 포함되어 있습니다';
  }
  if (data.contactPhone && !xssValidation(data.contactPhone)) {
    errors.contactPhone = '위험한 문자가 포함되어 있습니다';
  }
  if (!data.location) {
    errors.location = '근무지를 선택해 주세요';
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

  if (data.postingType === 'fixed') {
    if (data.daysPerWeek < 0 || data.daysPerWeek > 7) {
      errors.daysPerWeek = '주 출근일수를 선택해 주세요';
    }

    if (!data.isStartTimeNegotiable && !data.startTime) {
      errors.startTime = '출근 시간을 선택해 주세요';
    }

    return errors;
  }

  if (hasDateRequirements) {
    const hasIncomplete = data.dateSpecificRequirements!.some((req) => {
      return (
        !req.timeSlots ||
        req.timeSlots.length === 0 ||
        req.timeSlots.some((slot) => !slot.roles || slot.roles.length === 0)
      );
    });
    if (hasIncomplete) {
      errors.dateSpecificRequirements = '모든 날짜에 역할과 인원을 입력해 주세요';
    }
  } else if (options?.allowLegacyFallback) {
    if (!data.workDate) {
      errors.workDate = '근무 날짜를 선택해 주세요';
    }
    if (!data.startTime) {
      errors.startTime = '출근 시간을 선택해 주세요';
    }
  } else {
    errors.dateSpecificRequirements = '날짜별 모집 요구사항을 추가해 주세요';
  }

  return errors;
}

export function validateRoles(data: JobPostingFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.roles || data.roles.length === 0) {
    errors.roles = '최소 1개 이상의 역할을 추가해 주세요';
    return errors;
  }

  const hasInvalidRole = data.roles.some((role) => !role.name.trim() || role.count < 1);
  if (hasInvalidRole) {
    errors.roles = '모든 역할의 이름과 인원을 입력해 주세요';
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

    if (roleSalary?.type !== 'other' && (!roleSalary || roleSalary.amount <= 0)) {
      rolesWithoutSalary.push(displayName);
    }
  });

  if (rolesWithoutSalary.length > 0) {
    errors.roleSalary = `${rolesWithoutSalary.join(', ')}의 급여를 입력해 주세요`;
  }

  return errors;
}

export function validatePreQuestions(data: JobPostingFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  if (data.usesPreQuestions) {
    const hasEmptyQuestion = data.preQuestions.some((q) => !q.question.trim());
    if (hasEmptyQuestion) {
      errors.preQuestions = '질문 내용을 입력해 주세요';
    }

    const hasXssQuestion = data.preQuestions.some(
      (q) => q.question.trim() && !xssValidation(q.question)
    );
    if (hasXssQuestion) {
      errors.preQuestions = '위험한 문자가 포함되어 있습니다';
    }

    const hasEmptyOption = data.preQuestions.some(
      (q) => q.type === 'select' && q.options?.some((opt) => !opt.trim())
    );
    if (hasEmptyOption) {
      errors.preQuestions = '선택지 내용을 입력해 주세요';
    }

    const hasXssOption = data.preQuestions.some(
      (q) => q.type === 'select' && q.options?.some((opt) => opt.trim() && !xssValidation(opt))
    );
    if (hasXssOption) {
      errors.preQuestions = '위험한 문자가 포함되어 있습니다';
    }
  }

  return errors;
}

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
