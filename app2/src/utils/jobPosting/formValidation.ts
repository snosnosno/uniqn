import { RoleRequirement, TimeSlot, DateSpecificRequirement } from '../../types/jobPosting';

/**
 * 시간대 유효성 검증
 */
export const validateTimeSlot = (timeSlot: TimeSlot): string[] => {
  const errors: string[] = [];

  if (!timeSlot.isTimeToBeAnnounced && !timeSlot.time) {
    errors.push('시간을 입력해주세요.');
  }

  if (timeSlot.roles.length === 0) {
    errors.push('최소 하나의 역할을 추가해주세요.');
  }

  timeSlot.roles.forEach((role, index) => {
    if (!role.name) {
      errors.push(`역할 ${index + 1}의 이름을 선택해주세요.`);
    }
    if (role.count < 1) {
      errors.push(`역할 ${index + 1}의 인원은 최소 1명이어야 합니다.`);
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
    errors.push('날짜를 선택해주세요.');
  } else {
    const dateStr = typeof requirement.date === 'string' ? requirement.date : '';

    // 날짜 형식 검증
    if (!validateDateFormat(dateStr)) {
      errors.push(`올바른 날짜 형식이 아닙니다. (${dateStr})`);
    } else {
      // 과거 날짜 검증
      if (!validateNotPastDate(dateStr)) {
        errors.push(`과거 날짜는 선택할 수 없습니다. (${dateStr})`);
      }

      // 1년 이후 날짜 검증
      if (!validateNotFutureDate(dateStr)) {
        errors.push(`1년 이후의 날짜는 선택할 수 없습니다. (${dateStr})`);
      }
    }
  }

  if (requirement.timeSlots.length === 0) {
    errors.push('최소 하나의 시간대를 추가해주세요.');
  }

  requirement.timeSlots.forEach((timeSlot, index) => {
    const timeSlotErrors = validateTimeSlot(timeSlot);
    errors.push(...timeSlotErrors.map((error) => `시간대 ${index + 1}: ${error}`));
  });

  return errors;
};

/**
 * 사전질문 유효성 검증
 */
export const validatePreQuestion = (question: any): string[] => {
  const errors: string[] = [];

  if (!question.question?.trim()) {
    errors.push('질문 내용을 입력해주세요.');
  }

  if (question.type === 'select' && (!question.options || question.options.length === 0)) {
    errors.push('선택형 질문은 최소 하나의 옵션이 필요합니다.');
  }

  return errors;
};

/**
 * 폼 데이터 전체 유효성 검증
 */
export const validateJobPostingForm = (formData: any): string[] => {
  const errors: string[] = [];

  // 기본 정보 검증
  if (!formData.title?.trim()) {
    errors.push('제목을 입력해주세요.');
  }

  if (!formData.location?.trim()) {
    errors.push('지역을 선택해주세요.');
  }

  if (!formData.contactPhone?.trim()) {
    errors.push('문의 연락처를 입력해주세요.');
  }

  // startDate/endDate는 더 이상 사용하지 않음 - dateSpecificRequirements로 관리

  // 시간대 검증 - 날짜별 요구사항만 사용
  if (!formData.dateSpecificRequirements || formData.dateSpecificRequirements.length === 0) {
    errors.push('최소 하나의 날짜별 요구사항을 추가해주세요.');
  }

  // 일자별 요구사항 검증
  const dates = new Set<string>();
  formData.dateSpecificRequirements?.forEach(
    (requirement: DateSpecificRequirement, index: number) => {
      // 중복 날짜 검사
      const dateStr = typeof requirement.date === 'string' ? requirement.date : '';
      if (dates.has(dateStr)) {
        errors.push(`일자 ${index + 1}: 중복된 날짜입니다 (${dateStr})`);
      }
      dates.add(dateStr);

      const requirementErrors = validateDateSpecificRequirement(requirement);
      errors.push(...requirementErrors.map((error) => `일자 ${index + 1}: ${error}`));
    }
  );

  // 사전질문 검증
  if (formData.usesPreQuestions) {
    formData.preQuestions.forEach((question: any, index: number) => {
      const questionErrors = validatePreQuestion(question);
      errors.push(...questionErrors.map((error) => `사전질문 ${index + 1}: ${error}`));
    });
  }

  return errors;
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
    errors.push(`중복된 역할이 있습니다: ${uniqueDuplicates.join(', ')}`);
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
