import { useState, useCallback } from 'react';
// Removed unused type imports
import { 
  createInitialFormData, 
  createNewPreQuestion,
  PREDEFINED_ROLES
} from '../utils/jobPosting/jobPostingHelpers';
// import { dropdownValueToDateString } from '../utils/jobPosting/dateUtils'; // 현재 사용하지 않음

import { JobPosting } from '../types/jobPosting';
// import { JobPostingFormData } from '../types/jobPosting'; // 현재 사용하지 않음

export const useJobPostingForm = (initialData?: Partial<JobPosting>) => {
  const [formData, setFormData] = useState<any>(() => 
    initialData ? initialData : createInitialFormData()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 기본 폼 핸들러
  const handleFormChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  }, []);

  // 시간대 관련 핸들러들

  // 일자별 요구사항 관련 핸들러들

  const handleDateSpecificTimeSlotChange = useCallback((dateIndex: number, timeSlotIndex: number, value: string) => {
    setFormData((prev: any) => {
      const newRequirements = [...prev.dateSpecificRequirements];
      newRequirements[dateIndex].timeSlots[timeSlotIndex].time = value;
      return { ...prev, dateSpecificRequirements: newRequirements };
    });
  }, []);

  const handleDateSpecificTimeToBeAnnouncedToggle = useCallback((dateIndex: number, timeSlotIndex: number, isAnnounced: boolean) => {
    setFormData((prev: any) => {
      const newRequirements = [...prev.dateSpecificRequirements];
      newRequirements[dateIndex].timeSlots[timeSlotIndex].isTimeToBeAnnounced = isAnnounced;
      if (isAnnounced) {
        newRequirements[dateIndex].timeSlots[timeSlotIndex].time = '미정';
      } else {
        newRequirements[dateIndex].timeSlots[timeSlotIndex].time = '';
        newRequirements[dateIndex].timeSlots[timeSlotIndex].tentativeDescription = '';
      }
      return { ...prev, dateSpecificRequirements: newRequirements };
    });
  }, []);

  const handleDateSpecificTentativeDescriptionChange = useCallback((dateIndex: number, timeSlotIndex: number, description: string) => {
    setFormData((prev: any) => {
      const newRequirements = [...prev.dateSpecificRequirements];
      newRequirements[dateIndex].timeSlots[timeSlotIndex].tentativeDescription = description;
      return { ...prev, dateSpecificRequirements: newRequirements };
    });
  }, []);

  const handleDateSpecificRoleChange = useCallback((
    dateIndex: number, 
    timeSlotIndex: number, 
    roleIndex: number, 
    field: 'name' | 'count', 
    value: string | number
  ) => {
    setFormData((prev: any) => {
      const newRequirements = [...prev.dateSpecificRequirements];
      if (field === 'name') {
        newRequirements[dateIndex].timeSlots[timeSlotIndex].roles[roleIndex].name = value as string;
      } else {
        newRequirements[dateIndex].timeSlots[timeSlotIndex].roles[roleIndex].count = Number(value);
      }
      return { ...prev, dateSpecificRequirements: newRequirements };
    });
  }, []);

  // 사전질문 관련 핸들러들
  const handlePreQuestionsToggle = useCallback((enabled: boolean) => {
    setFormData((prev: any) => ({
      ...prev,
      usesPreQuestions: enabled,
      preQuestions: enabled ? (prev.preQuestions.length === 0 ? [createNewPreQuestion()] : prev.preQuestions) : []
    }));
  }, []);

  const handlePreQuestionChange = useCallback((questionIndex: number, field: string, value: any) => {
    setFormData((prev: any) => {
      const newQuestions = [...prev.preQuestions];
      newQuestions[questionIndex] = { ...newQuestions[questionIndex], [field]: value };
      
      // select 타입이 아니면 options 제거
      if (field === 'type' && value !== 'select') {
        newQuestions[questionIndex].options = [];
      }
      
      return { ...prev, preQuestions: newQuestions };
    });
  }, []);

  const handlePreQuestionOptionChange = useCallback((questionIndex: number, optionIndex: number, value: string) => {
    setFormData((prev: any) => {
      const newQuestions = [...prev.preQuestions];
      newQuestions[questionIndex].options[optionIndex] = value;
      return { ...prev, preQuestions: newQuestions };
    });
  }, []);

  const addPreQuestion = useCallback(() => {
    setFormData((prev: any) => ({
      ...prev,
      preQuestions: [...prev.preQuestions, createNewPreQuestion()]
    }));
  }, []);

  const removePreQuestion = useCallback((index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      preQuestions: prev.preQuestions.filter((_: any, i: number) => i !== index)
    }));
  }, []);

  const addPreQuestionOption = useCallback((questionIndex: number) => {
    setFormData((prev: any) => {
      const newQuestions = [...prev.preQuestions];
      if (!newQuestions[questionIndex].options) {
        newQuestions[questionIndex].options = [];
      }
      newQuestions[questionIndex].options.push('');
      return { ...prev, preQuestions: newQuestions };
    });
  }, []);

  const removePreQuestionOption = useCallback((questionIndex: number, optionIndex: number) => {
    setFormData((prev: any) => {
      const newQuestions = [...prev.preQuestions];
      newQuestions[questionIndex].options = newQuestions[questionIndex].options.filter(
        (_: any, i: number) => i !== optionIndex
      );
      return { ...prev, preQuestions: newQuestions };
    });
  }, []);

  // 날짜 관련 핸들러들 (레거시 호환성을 위해 유지하지만 사용하지 않음)
  const handleStartDateChange = useCallback((_value: { year?: string; month?: string; day?: string }) => {
    // startDate/endDate는 더 이상 사용하지 않음 - dateSpecificRequirements로 관리
  }, []);

  const handleEndDateChange = useCallback((_value: { year?: string; month?: string; day?: string }) => {
    // startDate/endDate는 더 이상 사용하지 않음 - dateSpecificRequirements로 관리
  }, []);

  // 지역 관련 핸들러
  const handleDistrictChange = useCallback((district: string) => {
    setFormData((prev: any) => ({ ...prev, district }));
  }, []);

  // 급여 관련 핸들러들
  const handleSalaryTypeChange = useCallback((salaryType: 'hourly' | 'daily' | 'monthly' | 'negotiable' | 'other') => {
    setFormData((prev: any) => ({ ...prev, salaryType }));
  }, []);

  const handleSalaryAmountChange = useCallback((salaryAmount: string) => {
    // 숫자만 입력 가능하도록 필터링
    const numericValue = salaryAmount.replace(/[^0-9]/g, '');
    setFormData((prev: any) => ({ ...prev, salaryAmount: numericValue }));
  }, []);

  // 복리후생 관련 핸들러들
  const handleBenefitToggle = useCallback((benefitType: keyof NonNullable<typeof formData.benefits>, checked: boolean) => {
    setFormData((prev: any) => ({
      ...prev,
      benefits: {
        ...prev.benefits,
        // 식사의 경우 체크 시 자동으로 "제공" 입력
        [benefitType]: checked ? (benefitType === 'meal' ? '제공' : '') : undefined
      }
    }));
  }, []);

  const handleBenefitChange = useCallback((benefitType: keyof NonNullable<typeof formData.benefits>, value: string) => {
    setFormData((prev: any) => ({
      ...prev,
      benefits: {
        ...prev.benefits,
        [benefitType]: value
      }
    }));
  }, []);

  // 역할별 급여 관련 핸들러들
  const handleRoleSalaryToggle = useCallback((enabled: boolean) => {
    setFormData((prev: any) => {
      if (enabled) {
        // 활성화 시 기본 역할 3개 추가 (딜러, 플로어, 서빙)
        const defaultRoles = {
          'dealer': { 
            salaryType: 'hourly' as const, 
            salaryAmount: '20000' 
          },
          'floor': { 
            salaryType: 'hourly' as const, 
            salaryAmount: '20000' 
          },
          'serving': { 
            salaryType: 'hourly' as const, 
            salaryAmount: '20000' 
          }
        };
        return { 
          ...prev, 
          useRoleSalary: true, 
          roleSalaries: prev.roleSalaries || defaultRoles 
        };
      } else {
        return { ...prev, useRoleSalary: false };
      }
    });
  }, []);

  const handleAddRoleToSalary = useCallback(() => {
    setFormData((prev: any) => {
      const existingRoles = Object.keys(prev.roleSalaries || {});
      const availableRoles = PREDEFINED_ROLES.filter(r => !existingRoles.includes(r));
      
      if (availableRoles.length === 0) {
        alert('모든 역할이 이미 추가되었습니다.');
        return prev;
      }
      
      const newRole = availableRoles[0] as string;
      return {
        ...prev,
        roleSalaries: {
          ...prev.roleSalaries,
          [newRole]: { 
            salaryType: 'hourly' as const, 
            salaryAmount: '20000' 
          }
        }
      };
    });
  }, []);

  const handleRemoveRoleFromSalary = useCallback((role: string) => {
    setFormData((prev: any) => {
      const { [role]: _removed, ...rest } = prev.roleSalaries || {};
      return {
        ...prev,
        roleSalaries: rest
      };
    });
  }, []);

  const handleRoleChange = useCallback((oldRole: string, newRole: string) => {
    setFormData((prev: any) => {
      const { [oldRole]: oldSalary, ...rest } = prev.roleSalaries || {};
      return {
        ...prev,
        roleSalaries: {
          ...rest,
          [newRole]: oldSalary || { salaryType: 'hourly', salaryAmount: '20000' }
        }
      };
    });
  }, []);

  const handleRoleSalaryTypeChange = useCallback((role: string, salaryType: string) => {
    setFormData((prev: any) => ({
      ...prev,
      roleSalaries: {
        ...prev.roleSalaries,
        [role]: {
          ...prev.roleSalaries?.[role],
          salaryType,
          // 협의인 경우 금액 초기화
          salaryAmount: salaryType === 'negotiable' ? '' : prev.roleSalaries?.[role]?.salaryAmount || '20000'
        }
      }
    }));
  }, []);

  const handleRoleSalaryAmountChange = useCallback((role: string, salaryAmount: string) => {
    // 숫자만 입력 가능하도록 필터링
    const numericValue = salaryAmount.replace(/[^0-9]/g, '');
    setFormData((prev: any) => ({
      ...prev,
      roleSalaries: {
        ...prev.roleSalaries,
        [role]: {
          ...prev.roleSalaries?.[role],
          salaryAmount: numericValue
        }
      }
    }));
  }, []);

  const handleCustomRoleNameChange = useCallback((role: string, customName: string) => {
    setFormData((prev: any) => ({
      ...prev,
      roleSalaries: {
        ...prev.roleSalaries,
        [role]: {
          ...prev.roleSalaries?.[role],
          customRoleName: customName
        }
      }
    }));
  }, []);

  // 폼 초기화
  const resetForm = useCallback(() => {
    setFormData(createInitialFormData());
  }, []);

  // 폼 데이터 설정
  const setFormDataFromTemplate = useCallback((templateData: any) => {
    setFormData(templateData);
  }, []);

  return {
    formData,
    setFormData,
    isSubmitting,
    setIsSubmitting,
    
    // 기본 핸들러
    handleFormChange,
    resetForm,
    setFormDataFromTemplate,
    
    // 일자별 요구사항 핸들러
    handleDateSpecificTimeSlotChange,
    handleDateSpecificTimeToBeAnnouncedToggle,
    handleDateSpecificTentativeDescriptionChange,
    handleDateSpecificRoleChange,
    
    // 사전질문 핸들러
    handlePreQuestionsToggle,
    handlePreQuestionChange,
    handlePreQuestionOptionChange,
    addPreQuestion,
    removePreQuestion,
    addPreQuestionOption,
    removePreQuestionOption,
    
    // 날짜 핸들러
    handleStartDateChange,
    handleEndDateChange,
    
    // 지역 핸들러
    handleDistrictChange,
    
    // 급여 핸들러
    handleSalaryTypeChange,
    handleSalaryAmountChange,
    
    // 복리후생 핸들러
    handleBenefitToggle,
    handleBenefitChange,
    
    // 역할별 급여 핸들러
    handleRoleSalaryToggle,
    handleAddRoleToSalary,
    handleRemoveRoleFromSalary,
    handleRoleChange,
    handleRoleSalaryTypeChange,
    handleRoleSalaryAmountChange,
    handleCustomRoleNameChange,
  };
};