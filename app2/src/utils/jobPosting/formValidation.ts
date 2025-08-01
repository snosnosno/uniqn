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
  }
  
  if (requirement.timeSlots.length === 0) {
    errors.push('최소 하나의 시간대를 추가해주세요.');
  }
  
  requirement.timeSlots.forEach((timeSlot, index) => {
    const timeSlotErrors = validateTimeSlot(timeSlot);
    errors.push(...timeSlotErrors.map(error => `시간대 ${index + 1}: ${error}`));
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
  
  if (!formData.startDate) {
    errors.push('시작 날짜를 선택해주세요.');
  }
  
  if (!formData.endDate) {
    errors.push('종료 날짜를 선택해주세요.');
  }
  
  if (formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
    errors.push('시작 날짜는 종료 날짜보다 이전이어야 합니다.');
  }
  
  // 시간대 검증
  if (formData.usesDifferentDailyRequirements) {
    if (formData.dateSpecificRequirements.length === 0) {
      errors.push('일자별 요구사항을 추가해주세요.');
    }
    
    // 일자별 요구사항의 날짜가 시작날짜와 종료날짜 범위 내에 있는지 검증
    formData.dateSpecificRequirements.forEach((requirement: DateSpecificRequirement, index: number) => {
      if (requirement.date && formData.startDate && formData.endDate) {
        if (requirement.date < formData.startDate) {
          errors.push(`일자 ${index + 1}: 날짜가 시작 날짜(${formData.startDate})보다 이전입니다.`);
        }
        if (requirement.date > formData.endDate) {
          errors.push(`일자 ${index + 1}: 날짜가 종료 날짜(${formData.endDate})보다 이후입니다.`);
        }
      }
      
      const requirementErrors = validateDateSpecificRequirement(requirement);
      errors.push(...requirementErrors.map(error => `일자 ${index + 1}: ${error}`));
    });
  } else {
    if (formData.timeSlots.length === 0) {
      errors.push('최소 하나의 시간대를 추가해주세요.');
    }
    
    formData.timeSlots.forEach((timeSlot: TimeSlot, index: number) => {
      const timeSlotErrors = validateTimeSlot(timeSlot);
      errors.push(...timeSlotErrors.map(error => `시간대 ${index + 1}: ${error}`));
    });
  }
  
  // 사전질문 검증
  if (formData.usesPreQuestions) {
    formData.preQuestions.forEach((question: any, index: number) => {
      const questionErrors = validatePreQuestion(question);
      errors.push(...questionErrors.map(error => `사전질문 ${index + 1}: ${error}`));
    });
  }
  
  return errors;
};

/**
 * 역할명 중복 검증
 */
export const checkDuplicateRoles = (roles: RoleRequirement[]): string[] => {
  const errors: string[] = [];
  const roleNames = roles.map(role => role.name);
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