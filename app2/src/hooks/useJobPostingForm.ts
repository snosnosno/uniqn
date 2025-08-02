import { useState, useCallback } from 'react';
import { RoleRequirement, TimeSlot, DateSpecificRequirement } from '../types/jobPosting';
import { 
  createInitialFormData, 
  createInitialTimeSlot, 
  createNewRole, 
  createNewPreQuestion,
  createNewDateSpecificRequirement
} from '../utils/jobPosting/jobPostingHelpers';
import { convertToDateString, dropdownValueToDateString } from '../utils/jobPosting/dateUtils';

import { JobPosting } from '../types/jobPosting';

export const useJobPostingForm = (initialData?: Partial<JobPosting>) => {
  const [formData, setFormData] = useState(() => 
    initialData ? initialData : createInitialFormData()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 기본 폼 핸들러
  const handleFormChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  // 시간대 관련 핸들러들
  const handleTimeSlotChange = useCallback((timeSlotIndex: number, value: string) => {
    setFormData((prev: any) => {
      const newTimeSlots = [...prev.timeSlots];
      newTimeSlots[timeSlotIndex].time = value;
      return { ...prev, timeSlots: newTimeSlots };
    });
  }, []);

  const handleTimeToBeAnnouncedToggle = useCallback((timeSlotIndex: number, isAnnounced: boolean) => {
    setFormData((prev: any) => {
      const newTimeSlots = [...prev.timeSlots];
      newTimeSlots[timeSlotIndex].isTimeToBeAnnounced = isAnnounced;
      if (isAnnounced) {
        newTimeSlots[timeSlotIndex].time = '미정';
      } else {
        newTimeSlots[timeSlotIndex].time = '';
        newTimeSlots[timeSlotIndex].tentativeDescription = '';
      }
      return { ...prev, timeSlots: newTimeSlots };
    });
  }, []);

  const handleTentativeDescriptionChange = useCallback((timeSlotIndex: number, description: string) => {
    setFormData((prev: any) => {
      const newTimeSlots = [...prev.timeSlots];
      newTimeSlots[timeSlotIndex].tentativeDescription = description;
      return { ...prev, timeSlots: newTimeSlots };
    });
  }, []);

  const addTimeSlot = useCallback(() => {
    setFormData((prev: any) => ({
      ...prev,
      timeSlots: [...prev.timeSlots, createInitialTimeSlot()]
    }));
  }, []);

  const removeTimeSlot = useCallback((index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      timeSlots: prev.timeSlots.filter((_: any, i: number) => i !== index)
    }));
  }, []);

  // 역할 관련 핸들러들
  const handleRoleChange = useCallback((timeSlotIndex: number, roleIndex: number, field: 'name' | 'count', value: string | number) => {
    setFormData((prev: any) => {
      const newTimeSlots = [...prev.timeSlots];
      if (field === 'name') {
        newTimeSlots[timeSlotIndex].roles[roleIndex].name = value as string;
      } else {
        newTimeSlots[timeSlotIndex].roles[roleIndex].count = Number(value);
      }
      return { ...prev, timeSlots: newTimeSlots };
    });
  }, []);

  const addRole = useCallback((timeSlotIndex: number) => {
    setFormData((prev: any) => {
      const newTimeSlots = [...prev.timeSlots];
      newTimeSlots[timeSlotIndex].roles.push(createNewRole());
      return { ...prev, timeSlots: newTimeSlots };
    });
  }, []);

  const removeRole = useCallback((timeSlotIndex: number, roleIndex: number) => {
    setFormData((prev: any) => {
      const newTimeSlots = [...prev.timeSlots];
      newTimeSlots[timeSlotIndex].roles = newTimeSlots[timeSlotIndex].roles.filter(
        (_: any, i: number) => i !== roleIndex
      );
      return { ...prev, timeSlots: newTimeSlots };
    });
  }, []);

  // 일자별 요구사항 관련 핸들러들
  const handleDifferentDailyRequirementsToggle = useCallback((enabled: boolean) => {
    setFormData((prev: any) => {
      if (enabled) {
        // 기존 시간대를 첫 번째 날짜의 요구사항으로 변환
        const startDate = convertToDateString(prev.startDate);
        const firstRequirement = createNewDateSpecificRequirement(startDate);
        firstRequirement.timeSlots = [...prev.timeSlots];
        
        return {
          ...prev,
          usesDifferentDailyRequirements: true,
          dateSpecificRequirements: [firstRequirement]
        };
      } else {
        // 첫 번째 일자별 요구사항을 기본 시간대로 변환
        const timeSlots = prev.dateSpecificRequirements.length > 0 
          ? prev.dateSpecificRequirements[0].timeSlots 
          : [createInitialTimeSlot()];
        
        return {
          ...prev,
          usesDifferentDailyRequirements: false,
          timeSlots,
          dateSpecificRequirements: []
        };
      }
    });
  }, []);

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

  // 날짜 관련 핸들러들
  const handleStartDateChange = useCallback((value: { year?: string; month?: string; day?: string }) => {
    const dateString = dropdownValueToDateString(value);
    setFormData((prev: any) => ({ ...prev, startDate: dateString }));
  }, []);

  const handleEndDateChange = useCallback((value: { year?: string; month?: string; day?: string }) => {
    const dateString = dropdownValueToDateString(value);
    setFormData((prev: any) => ({ ...prev, endDate: dateString }));
  }, []);

  // 지역 관련 핸들러
  const handleDistrictChange = useCallback((district: string) => {
    setFormData((prev: any) => ({ ...prev, district }));
  }, []);

  // 급여 관련 핸들러들
  const handleSalaryTypeChange = useCallback((salaryType: 'hourly' | 'daily' | 'monthly' | 'other') => {
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
        [benefitType]: checked ? '' : undefined
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
    
    // 시간대 핸들러
    handleTimeSlotChange,
    handleTimeToBeAnnouncedToggle,
    handleTentativeDescriptionChange,
    addTimeSlot,
    removeTimeSlot,
    
    // 역할 핸들러
    handleRoleChange,
    addRole,
    removeRole,
    
    // 일자별 요구사항 핸들러
    handleDifferentDailyRequirementsToggle,
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
  };
};