import {
  RoleRequirement,
  TimeSlot,
  DateSpecificRequirement,
  PreQuestion,
  JobPostingFormData,
} from '../../types/jobPosting';
import i18n from '../../i18n';
import { jobPostingFormSchema } from '../../schemas/jobPosting';

/**
 * 시간대 유효성 검증
 */
export const validateTimeSlot = (timeSlot: TimeSlot): string[] => {
  const errors: string[] = [];

  if (!timeSlot.isTimeToBeAnnounced && !timeSlot.time) {
    errors.push(i18n.t('validation.timeRequired'));
  }

  if (timeSlot.roles.length === 0) {
    errors.push(i18n.t('validation.minOneRole'));
  }

  timeSlot.roles.forEach((role, index) => {
    if (!role.name) {
      errors.push(i18n.t('validation.roleNameRequired', { index: index + 1 }));
    }
    if (role.count < 1) {
      errors.push(i18n.t('validation.roleCountMin', { index: index + 1 }));
    }
  });

  return errors;
};

/**
 * 일자별 요구사항 유효성 검증
 */
export const validateDateSpecificRequirement = (requirement: DateSpecificRequirement): string[] => {
  const errors: string[] = [];

  if (!requirement.date) {
    errors.push(i18n.t('validation.dateRequired'));
  } else {
    const dateStr = typeof requirement.date === 'string' ? requirement.date : '';

    // 날짜 형식 검증
    if (!validateDateFormat(dateStr)) {
      errors.push(i18n.t('validation.invalidDateFormat', { date: dateStr }));
    } else {
      // 과거 날짜 검증
      if (!validateNotPastDate(dateStr)) {
        errors.push(i18n.t('validation.pastDateNotAllowed', { date: dateStr }));
      }

      // 1년 이후 날짜 검증
      if (!validateNotFutureDate(dateStr)) {
        errors.push(i18n.t('validation.futureDateNotAllowed', { date: dateStr }));
      }
    }
  }

  if (requirement.timeSlots.length === 0) {
    errors.push(i18n.t('validation.minOneTimeSlot'));
  }

  requirement.timeSlots.forEach((timeSlot, index) => {
    const timeSlotErrors = validateTimeSlot(timeSlot);
    errors.push(
      ...timeSlotErrors.map((error) =>
        i18n.t('validation.timeSlotError', { index: index + 1, error })
      )
    );
  });

  return errors;
};

/**
 * 사전질문 유효성 검증
 */
export const validatePreQuestion = (question: PreQuestion): string[] => {
  const errors: string[] = [];

  if (!question.question?.trim()) {
    errors.push(i18n.t('validation.questionRequired'));
  }

  if (question.type === 'select' && (!question.options || question.options.length === 0)) {
    errors.push(i18n.t('validation.selectOptionRequired'));
  }

  return errors;
};

/**
 * 폼 데이터 전체 유효성 검증 (Zod 스키마 기반)
 */
export const validateJobPostingForm = (formData: Partial<JobPostingFormData>): string[] => {
  const errors: string[] = [];

  // Zod 스키마로 기본 검증
  const result = jobPostingFormSchema.safeParse(formData);

  if (!result.success) {
    // Zod 에러를 문자열 배열로 변환
    result.error.errors.forEach((err) => {
      errors.push(err.message);
    });
  }

  // 추가 검증: 일자별 요구사항 상세 검증
  const dates = new Set<string>();
  formData.dateSpecificRequirements?.forEach(
    (requirement: DateSpecificRequirement, index: number) => {
      // 중복 날짜 검사
      const dateStr = typeof requirement.date === 'string' ? requirement.date : '';
      if (dateStr && dates.has(dateStr)) {
        errors.push(i18n.t('validation.duplicateDate', { index: index + 1, date: dateStr }));
      }
      if (dateStr) {
        dates.add(dateStr);
      }

      // 날짜별 요구사항 상세 검증
      const requirementErrors = validateDateSpecificRequirement(requirement);
      errors.push(
        ...requirementErrors.map((error) =>
          i18n.t('validation.dateError', { index: index + 1, error })
        )
      );
    }
  );

  // 추가 검증: 사전질문 상세 검증
  if (formData.usesPreQuestions) {
    formData.preQuestions?.forEach((question: PreQuestion, index: number) => {
      const questionErrors = validatePreQuestion(question);
      errors.push(
        ...questionErrors.map((error) =>
          i18n.t('validation.preQuestionError', { index: index + 1, error })
        )
      );
    });
  }

  // 중복 에러 제거
  return Array.from(new Set(errors));
};

/**
 * 역할명 중복 검증
 */
export const checkDuplicateRoles = (roles: RoleRequirement[]): string[] => {
  const errors: string[] = [];
  const roleNames = roles.map((role) => role.name);
  const duplicates = roleNames.filter((name, index) => roleNames.indexOf(name) !== index);

  if (duplicates.length > 0) {
    const uniqueDuplicates = Array.from(new Set(duplicates));
    errors.push(i18n.t('validation.duplicateRoles', { roles: uniqueDuplicates.join(', ') }));
  }

  return errors;
};

/**
 * 시간 형식 검증 (HH:mm)
 */
export const validateTimeFormat = (time: string): boolean => {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
};

/**
 * 날짜 형식 검증 (yyyy-MM-dd)
 */
export const validateDateFormat = (date: string): boolean => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return dateRegex.test(date) && !isNaN(new Date(date).getTime());
};

/**
 * 과거 날짜 검증 (오늘 날짜는 허용)
 */
export const validateNotPastDate = (date: string): boolean => {
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const inputDate = new Date(date);
  const inputMidnight = new Date(
    inputDate.getFullYear(),
    inputDate.getMonth(),
    inputDate.getDate()
  );

  return inputMidnight >= todayMidnight;
};

/**
 * 1년 이후 날짜 검증
 */
export const validateNotFutureDate = (date: string): boolean => {
  const today = new Date();
  const oneYearLater = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());

  const inputDate = new Date(date);
  const inputMidnight = new Date(
    inputDate.getFullYear(),
    inputDate.getMonth(),
    inputDate.getDate()
  );

  return inputMidnight <= oneYearLater;
};
