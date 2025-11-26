import { useState, useCallback } from 'react';
import {
  createInitialFormData,
  createNewPreQuestion,
  PREDEFINED_ROLES,
} from '../utils/jobPosting/jobPostingHelpers';
// import { dropdownValueToDateString } from '../utils/jobPosting/dateUtils'; // 현재 사용하지 않음

import { JobPosting, JobPostingFormData } from '../types/jobPosting';
import {
  DateSpecificRequirement,
  Benefits,
  TimeSlot,
  RoleRequirement,
} from '../types/jobPosting/base';
import { Timestamp } from 'firebase/firestore';
import { toast } from '../utils/toast';

export const useJobPostingForm = (initialData?: Partial<JobPosting>) => {
  const [formData, setFormData] = useState<JobPostingFormData>(() =>
    initialData
      ? (initialData as JobPostingFormData)
      : (createInitialFormData() as JobPostingFormData)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 기본 폼 핸들러
  const handleFormChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData((prev: JobPostingFormData) => ({ ...prev, [name]: value }));
    },
    []
  );

  // 시간대 관련 핸들러들

  // 일자별 요구사항 관련 핸들러들

  const handleDateSpecificTimeSlotChange = useCallback(
    (dateIndex: number, timeSlotIndex: number, value: string) => {
      setFormData((prev: JobPostingFormData) => {
        const newRequirements = [...(prev.dateSpecificRequirements || [])];
        const requirement = newRequirements[dateIndex];
        const timeSlot = requirement?.timeSlots?.[timeSlotIndex];
        if (timeSlot) {
          timeSlot.time = value;
        }
        return { ...prev, dateSpecificRequirements: newRequirements };
      });
    },
    []
  );

  const handleDateSpecificTimeToBeAnnouncedToggle = useCallback(
    (dateIndex: number, timeSlotIndex: number, isAnnounced: boolean) => {
      setFormData((prev: JobPostingFormData) => {
        const newRequirements = [...(prev.dateSpecificRequirements || [])];
        const timeSlot = newRequirements[dateIndex]?.timeSlots?.[timeSlotIndex];
        if (timeSlot) {
          timeSlot.isTimeToBeAnnounced = isAnnounced;
          if (isAnnounced) {
            timeSlot.time = '미정';
          } else {
            timeSlot.time = '';
            timeSlot.tentativeDescription = '';
          }
        }
        return { ...prev, dateSpecificRequirements: newRequirements };
      });
    },
    []
  );

  const handleDateSpecificTentativeDescriptionChange = useCallback(
    (dateIndex: number, timeSlotIndex: number, description: string) => {
      setFormData((prev: JobPostingFormData) => {
        const newRequirements = [...(prev.dateSpecificRequirements || [])];
        const requirement = newRequirements[dateIndex];
        const timeSlot = requirement?.timeSlots?.[timeSlotIndex];
        if (timeSlot) {
          timeSlot.tentativeDescription = description;
        }
        return { ...prev, dateSpecificRequirements: newRequirements };
      });
    },
    []
  );

  const handleDateSpecificRoleChange = useCallback(
    (
      dateIndex: number,
      timeSlotIndex: number,
      roleIndex: number,
      field: 'name' | 'count',
      value: string | number
    ) => {
      setFormData((prev: JobPostingFormData) => {
        const newRequirements = [...(prev.dateSpecificRequirements || [])];
        const role = newRequirements[dateIndex]?.timeSlots?.[timeSlotIndex]?.roles?.[roleIndex];
        if (role) {
          if (field === 'name') {
            role.name = value as string;
          } else {
            role.count = Number(value);
          }
        }
        return { ...prev, dateSpecificRequirements: newRequirements };
      });
    },
    []
  );

  const handleDateSpecificRequirementsChange = useCallback(
    (requirements: DateSpecificRequirement[]) => {
      setFormData((prev: JobPostingFormData) => ({
        ...prev,
        dateSpecificRequirements: requirements,
      }));
    },
    []
  );

  // 사전질문 관련 핸들러들
  const handlePreQuestionsToggle = useCallback((enabled: boolean) => {
    setFormData((prev: JobPostingFormData): JobPostingFormData => {
      if (enabled) {
        return {
          ...prev,
          usesPreQuestions: true,
          preQuestions:
            (prev.preQuestions || []).length === 0 ? [createNewPreQuestion()] : prev.preQuestions,
        } as JobPostingFormData;
      } else {
        const { preQuestions, ...rest } = prev;
        return {
          ...rest,
          usesPreQuestions: false,
        } as JobPostingFormData;
      }
    });
  }, []);

  const handlePreQuestionChange = useCallback(
    (questionIndex: number, field: string, value: string | boolean | string[]) => {
      setFormData((prev: JobPostingFormData) => {
        const newQuestions = [...(prev.preQuestions || [])];
        const currentQuestion = newQuestions[questionIndex];

        // 타입 안전하게 업데이트
        if (currentQuestion) {
          if (field === 'question' && typeof value === 'string') {
            currentQuestion.question = value;
          } else if (field === 'required' && typeof value === 'boolean') {
            currentQuestion.required = value;
          } else if (
            field === 'type' &&
            typeof value === 'string' &&
            (value === 'text' || value === 'textarea' || value === 'select')
          ) {
            currentQuestion.type = value as 'text' | 'textarea' | 'select';
            // select 타입이 아니면 options 제거
            if (value !== 'select') {
              currentQuestion.options = [];
            }
          } else if (field === 'options' && Array.isArray(value)) {
            currentQuestion.options = value;
          }
        }

        return { ...prev, preQuestions: newQuestions };
      });
    },
    []
  );

  const handlePreQuestionOptionChange = useCallback(
    (questionIndex: number, optionIndex: number, value: string) => {
      setFormData((prev: JobPostingFormData) => {
        const newQuestions = [...(prev.preQuestions || [])];
        const question = newQuestions[questionIndex];
        if (question) {
          if (!question.options) {
            question.options = [];
          }
          question.options[optionIndex] = value;
        }
        return { ...prev, preQuestions: newQuestions };
      });
    },
    []
  );

  const addPreQuestion = useCallback(() => {
    setFormData((prev: JobPostingFormData) => ({
      ...prev,
      preQuestions: [...(prev.preQuestions || []), createNewPreQuestion()],
    }));
  }, []);

  const removePreQuestion = useCallback((index: number) => {
    setFormData((prev: JobPostingFormData) => ({
      ...prev,
      preQuestions: (prev.preQuestions || []).filter((_, i: number) => i !== index),
    }));
  }, []);

  const addPreQuestionOption = useCallback((questionIndex: number) => {
    setFormData((prev: JobPostingFormData) => {
      const newQuestions = [...(prev.preQuestions || [])];
      const question = newQuestions[questionIndex];
      if (question) {
        if (!question.options) {
          question.options = [];
        }
        question.options.push('');
      }
      return { ...prev, preQuestions: newQuestions };
    });
  }, []);

  const removePreQuestionOption = useCallback((questionIndex: number, optionIndex: number) => {
    setFormData((prev: JobPostingFormData) => {
      const newQuestions = [...(prev.preQuestions || [])];
      const question = newQuestions[questionIndex];
      if (question) {
        question.options = (question.options || []).filter((_, i: number) => i !== optionIndex);
      }
      return { ...prev, preQuestions: newQuestions };
    });
  }, []);

  // 날짜 관련 핸들러들 (레거시 호환성을 위해 유지하지만 사용하지 않음)
  const handleStartDateChange = useCallback(
    (_value: { year?: string; month?: string; day?: string }) => {
      // startDate/endDate는 더 이상 사용하지 않음 - dateSpecificRequirements로 관리
    },
    []
  );

  const handleEndDateChange = useCallback(
    (_value: { year?: string; month?: string; day?: string }) => {
      // startDate/endDate는 더 이상 사용하지 않음 - dateSpecificRequirements로 관리
    },
    []
  );

  // 지역 관련 핸들러
  const handleDistrictChange = useCallback((district: string) => {
    setFormData((prev: JobPostingFormData) => ({ ...prev, district }));
  }, []);

  // 급여 관련 핸들러들
  const handleSalaryTypeChange = useCallback(
    (salaryType: 'hourly' | 'daily' | 'monthly' | 'negotiable' | 'other') => {
      setFormData((prev: JobPostingFormData) => ({ ...prev, salaryType }));
    },
    []
  );

  const handleSalaryAmountChange = useCallback((salaryAmount: string) => {
    // 숫자만 입력 가능하도록 필터링
    const numericValue = salaryAmount.replace(/[^0-9]/g, '');
    setFormData((prev: JobPostingFormData) => ({ ...prev, salaryAmount: numericValue }));
  }, []);

  // 복리후생 관련 핸들러들
  const handleBenefitToggle = useCallback((benefitType: keyof Benefits, checked: boolean) => {
    setFormData((prev: JobPostingFormData) => ({
      ...prev,
      benefits: {
        ...(prev.benefits || {}),
        // 식사의 경우 체크 시 자동으로 "제공" 입력
        [benefitType]: checked ? (benefitType === 'meal' ? '제공' : '') : undefined,
      },
    }));
  }, []);

  const handleBenefitChange = useCallback((benefitType: keyof Benefits, value: string) => {
    setFormData((prev: JobPostingFormData) => ({
      ...prev,
      benefits: {
        ...(prev.benefits || {}),
        [benefitType]: value,
      },
    }));
  }, []);

  // 역할별 급여 관련 핸들러들
  const handleRoleSalaryToggle = useCallback((enabled: boolean) => {
    setFormData((prev: JobPostingFormData) => {
      if (enabled) {
        // 활성화 시 기본 역할 3개 추가 (딜러, 플로어, 서빙)
        const defaultRoles = {
          dealer: {
            salaryType: 'hourly' as const,
            salaryAmount: '20000',
          },
          floor: {
            salaryType: 'hourly' as const,
            salaryAmount: '20000',
          },
          serving: {
            salaryType: 'hourly' as const,
            salaryAmount: '20000',
          },
        };
        return {
          ...prev,
          useRoleSalary: true,
          roleSalaries: prev.roleSalaries || defaultRoles,
        };
      } else {
        return { ...prev, useRoleSalary: false };
      }
    });
  }, []);

  const handleAddRoleToSalary = useCallback(() => {
    setFormData((prev: JobPostingFormData) => {
      const existingRoles = Object.keys(prev.roleSalaries || {});
      const availableRoles = PREDEFINED_ROLES.filter((r) => !existingRoles.includes(r));

      if (availableRoles.length === 0) {
        toast.warning('모든 역할이 이미 추가되었습니다.');
        return prev;
      }

      const newRole = availableRoles[0] as string;
      return {
        ...prev,
        roleSalaries: {
          ...(prev.roleSalaries || {}),
          [newRole]: {
            salaryType: 'hourly' as const,
            salaryAmount: '20000',
          },
        },
      };
    });
  }, []);

  const handleRemoveRoleFromSalary = useCallback((role: string) => {
    setFormData((prev: JobPostingFormData) => {
      const { [role]: _removed, ...rest } = prev.roleSalaries || {};
      return {
        ...prev,
        roleSalaries: rest,
      };
    });
  }, []);

  const handleRoleChange = useCallback((oldRole: string, newRole: string) => {
    setFormData((prev: JobPostingFormData) => {
      const { [oldRole]: oldSalary, ...rest } = prev.roleSalaries || {};
      return {
        ...prev,
        roleSalaries: {
          ...rest,
          [newRole]: oldSalary || { salaryType: 'hourly', salaryAmount: '20000' },
        },
      };
    });
  }, []);

  const handleRoleSalaryTypeChange = useCallback(
    (role: string, salaryType: 'hourly' | 'daily' | 'monthly' | 'negotiable' | 'other') => {
      setFormData((prev: JobPostingFormData) => {
        const existingRole = prev.roleSalaries?.[role];
        return {
          ...prev,
          roleSalaries: {
            ...(prev.roleSalaries || {}),
            [role]: {
              salaryType,
              salaryAmount:
                salaryType === 'negotiable' ? '' : existingRole?.salaryAmount || '20000',
              ...(existingRole?.customRoleName && { customRoleName: existingRole.customRoleName }),
            },
          },
        };
      });
    },
    []
  );

  const handleRoleSalaryAmountChange = useCallback((role: string, salaryAmount: string) => {
    // 숫자만 입력 가능하도록 필터링
    const numericValue = salaryAmount.replace(/[^0-9]/g, '');
    setFormData((prev: JobPostingFormData) => ({
      ...prev,
      roleSalaries: {
        ...(prev.roleSalaries || {}),
        [role]: {
          ...(prev.roleSalaries?.[role] || { salaryType: 'hourly', salaryAmount: '20000' }),
          salaryAmount: numericValue,
        },
      },
    }));
  }, []);

  const handleCustomRoleNameChange = useCallback((role: string, customName: string) => {
    setFormData((prev: JobPostingFormData) => ({
      ...prev,
      roleSalaries: {
        ...(prev.roleSalaries || {}),
        [role]: {
          ...(prev.roleSalaries?.[role] || { salaryType: 'hourly', salaryAmount: '20000' }),
          customRoleName: customName,
        },
      },
    }));
  }, []);

  // 폼 초기화
  const resetForm = useCallback(() => {
    setFormData(createInitialFormData() as JobPostingFormData);
  }, []);

  // 폼 데이터 설정
  const setFormDataFromTemplate = useCallback((templateData: JobPostingFormData) => {
    setFormData(templateData);
  }, []);

  // ========== 고정공고 근무일정 핸들러 ==========

  /**
   * 근무일정 변경 핸들러 (T005)
   */
  const handleWorkScheduleChange = useCallback(
    (schedule: { daysPerWeek: number; startTime: string; endTime: string }) => {
      setFormData((prev: JobPostingFormData) => ({ ...prev, workSchedule: schedule }));
    },
    []
  );

  /**
   * 역할 목록 변경 핸들러 (T006)
   */
  const handleRolesChange = useCallback(
    (roles: Array<{ id: string; role: string; count: number }>) => {
      setFormData((prev: JobPostingFormData) => ({ ...prev, requiredRolesWithCount: roles }));
    },
    []
  );

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
    handleDateSpecificRequirementsChange,

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

    // 고정공고 근무일정 핸들러 (T007)
    handleWorkScheduleChange,
    handleRolesChange,
  };
};
