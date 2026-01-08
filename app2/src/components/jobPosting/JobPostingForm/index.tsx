/**
 * JobPostingForm - 구인공고 폼 메인 컨테이너 (리팩토링 버전)
 *
 * 988줄의 단일 컴포넌트를 4개 섹션으로 분리하여 테스트 가능성, 재사용성, 유지보수성 향상
 *
 * @see app2/src/schemas/jobPosting/index.ts - Zod 검증 스키마
 * @see app2/src/types/jobPosting/*Props.ts - Props Grouping 인터페이스
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Timestamp } from 'firebase/firestore';
import { ZodError, ZodIssue } from 'zod';
import { useJobPostingForm } from '@/hooks/useJobPostingForm';
import { useTemplateManager } from '@/hooks/useTemplateManager';
import { JobPosting, JobPostingTemplate, Benefits } from '@/types/jobPosting';
import { toast } from '@/utils/toast';
import { jobPostingFormSchema } from '@/schemas/jobPosting';
import Button from '../../ui/Button';
import TemplateModal from '../modals/TemplateModal';
import LoadTemplateModal from '../modals/LoadTemplateModal';
import ConfirmModal from '../../modals/ConfirmModal';

// 섹션 컴포넌트 import (최적화된 경로)
import {
  BasicInfoSection,
  DateRequirementsSection,
  PreQuestionsSection,
  SalarySection,
  FixedWorkScheduleSection,
} from './sections';

interface JobPostingFormProps {
  onSubmit: (formData: Partial<JobPosting>) => Promise<void>;
  isSubmitting?: boolean;
}

/**
 * JobPostingForm 메인 컨테이너 (React.memo 적용)
 *
 * Container/Presenter 패턴:
 * - Container (이 컴포넌트): 상태 관리, 이벤트 핸들러, 비즈니스 로직
 * - Presenter (섹션 컴포넌트): UI 렌더링, Props Grouping 패턴
 */
const JobPostingForm: React.FC<JobPostingFormProps> = React.memo(
  ({ onSubmit, isSubmitting = false }) => {
    const { t } = useTranslation();
    // Zod 검증 상태
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

    // 폼 상태 및 핸들러
    const {
      formData,
      handleFormChange,
      handleDateSpecificTimeSlotChange,
      handleDateSpecificTimeToBeAnnouncedToggle,
      handleDateSpecificTentativeDescriptionChange,
      handleDateSpecificRoleChange,
      handleDateSpecificRequirementsChange,
      handlePreQuestionsToggle,
      handlePreQuestionChange,
      handlePreQuestionOptionChange,
      addPreQuestion,
      removePreQuestion,
      addPreQuestionOption,
      removePreQuestionOption,
      resetForm,
      setFormDataFromTemplate,
      setFormData,
      handleDistrictChange,
      handleSalaryTypeChange,
      handleSalaryAmountChange,
      handleBenefitToggle,
      handleBenefitChange,
      handleRoleSalaryToggle,
      handleAddRoleToSalary,
      handleRemoveRoleFromSalary,
      handleRoleChange: _handleRoleChange,
      handleRoleSalaryTypeChange,
      handleRoleSalaryAmountChange,
      handleCustomRoleNameChange: _handleCustomRoleNameChange,
      // 고정공고 근무일정 핸들러 (T029)
      handleWorkScheduleChange,
      handleRolesChange,
    } = useJobPostingForm();

    // 템플릿 관리
    const {
      templates,
      templatesLoading,
      isTemplateModalOpen,
      isLoadTemplateModalOpen,
      templateName,
      templateDescription,
      setTemplateName,
      setTemplateDescription,
      handleSaveTemplate,
      handleLoadTemplate,
      handleDeleteTemplateClick,
      handleDeleteTemplateConfirm,
      deleteConfirmTemplate,
      setDeleteConfirmTemplate,
      openTemplateModal,
      closeTemplateModal,
      openLoadTemplateModal,
      closeLoadTemplateModal,
    } = useTemplateManager();

    // 폼 제출 핸들러 (Zod 검증 통합)
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();

      // 모든 필드를 touched로 표시
      const allFields = Object.keys(formData).reduce(
        (acc, key) => {
          acc[key] = true;
          return acc;
        },
        {} as Record<string, boolean>
      );
      setTouchedFields(allFields);

      try {
        // Zod 스키마 검증
        jobPostingFormSchema.parse(formData);

        // 검증 성공 - 에러 초기화 및 제출
        setValidationErrors({});
        await onSubmit(formData);
        resetForm();
        setTouchedFields({});
      } catch (error) {
        if (error instanceof ZodError) {
          // Zod 검증 에러 처리
          const errors: Record<string, string> = {};
          error.errors.forEach((err: ZodIssue) => {
            const path = err.path.join('.');
            errors[path] = err.message;
          });
          setValidationErrors(errors);
          toast.error(t('toast.jobPosting.checkInput'));
        } else {
          // 기타 에러는 부모 컴포넌트에서 처리
          throw error;
        }
      }
    };

    // 템플릿 저장 래퍼
    const handleSaveTemplateWrapper = async () => {
      await handleSaveTemplate(formData);
    };

    // 템플릿 불러오기 래퍼
    const handleLoadTemplateWrapper = async (template: JobPostingTemplate) => {
      const templateFormData = await handleLoadTemplate(template);
      setFormDataFromTemplate(templateFormData);
      return templateFormData;
    };

    // 템플릿 삭제 래퍼
    const handleDeleteTemplateWrapper = async (templateId: string, templateName: string) => {
      handleDeleteTemplateClick(templateId, templateName);
      return true;
    };

    /**
     * BasicInfoSection Props 준비 (useMemo로 메모이제이션)
     */
    const basicInfoData = React.useMemo(
      () => ({
        title: formData.title,
        location: formData.location || '',
        district: formData.district || '',
        detailedAddress: formData.detailedAddress || '',
        description: formData.description,
        postingType: formData.postingType,
        contactPhone: formData.contactPhone || '',
        fixedConfig: formData.fixedConfig,
      }),
      [
        formData.title,
        formData.location,
        formData.district,
        formData.detailedAddress,
        formData.description,
        formData.postingType,
        formData.contactPhone,
        formData.fixedConfig,
      ]
    );

    const basicInfoValidation = React.useMemo(
      () => ({
        errors: {
          title: validationErrors['title'],
          location: validationErrors['location'],
          district: validationErrors['district'],
          detailedAddress: validationErrors['detailedAddress'],
          description: validationErrors['description'],
          postingType: validationErrors['postingType'],
          contactPhone: validationErrors['contactPhone'],
        },
        touched: {
          title: touchedFields['title'] || false,
          location: touchedFields['location'] || false,
          district: touchedFields['district'] || false,
          detailedAddress: touchedFields['detailedAddress'] || false,
          description: touchedFields['description'] || false,
          postingType: touchedFields['postingType'] || false,
          contactPhone: touchedFields['contactPhone'] || false,
        },
      }),
      [validationErrors, touchedFields]
    );

    const basicInfoHandlers = React.useMemo(
      () => ({
        onFormChange: handleFormChange,
        onLocationChange: (location: string, district?: string) => {
          const updates: Partial<typeof formData> = { location };
          if (district !== undefined) {
            updates.district = district;
          }
          setFormData((prev) => ({
            ...prev,
            ...updates,
          }));
          if (district) {
            handleDistrictChange(district);
          }
        },
        onPostingTypeChange: (postingType: 'regular' | 'fixed' | 'urgent' | 'tournament') => {
          if (postingType === 'tournament') {
            const { fixedConfig: _fixedConfig, urgentConfig: _urgentConfig, ...rest } = formData;
            // 기존 tournamentConfig가 있으면 보존, 없으면 새로 생성
            const existingConfig = formData.tournamentConfig;
            setFormData({
              ...rest,
              postingType: 'tournament',
              tournamentConfig: existingConfig || {
                approvalStatus: 'pending' as const,
                submittedAt: Timestamp.fromDate(new Date()),
              },
            });
          } else {
            setFormData((prev) => ({ ...prev, postingType }));
          }
        },
        onFixedDurationChange: (durationDays: 7 | 30 | 90) => {
          const now = new Date();
          const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

          setFormData((prev) => ({
            ...prev,
            fixedConfig: {
              durationDays,
              expiresAt: Timestamp.fromDate(expiresAt),
              createdAt: Timestamp.fromDate(now),
            },
          }));
        },
      }),
      [handleFormChange, handleDistrictChange, setFormData, formData]
    );

    /**
     * DateRequirementsSection Props 준비 (useMemo로 메모이제이션)
     */
    const dateRequirementsData = React.useMemo(
      () => ({
        dateSpecificRequirements: formData.dateSpecificRequirements || [],
      }),
      [formData.dateSpecificRequirements]
    );

    const dateRequirementsValidation = React.useMemo(
      () => ({
        errors: {
          dateSpecificRequirements: validationErrors['dateSpecificRequirements'],
        },
        touched: {
          dateSpecificRequirements: touchedFields['dateSpecificRequirements'],
        },
      }),
      [validationErrors, touchedFields]
    );

    const dateRequirementsHandlers = React.useMemo(
      () => ({
        onRequirementsChange: handleDateSpecificRequirementsChange,
        onTimeSlotChange: handleDateSpecificTimeSlotChange,
        onTimeToBeAnnouncedToggle: handleDateSpecificTimeToBeAnnouncedToggle,
        onTentativeDescriptionChange: handleDateSpecificTentativeDescriptionChange,
        onRoleChange: handleDateSpecificRoleChange,
      }),
      [
        handleDateSpecificRequirementsChange,
        handleDateSpecificTimeSlotChange,
        handleDateSpecificTimeToBeAnnouncedToggle,
        handleDateSpecificTentativeDescriptionChange,
        handleDateSpecificRoleChange,
      ]
    );

    /**
     * PreQuestionsSection Props 준비 (useMemo로 메모이제이션)
     */
    const preQuestionsData = React.useMemo(
      () => ({
        usesPreQuestions: formData.usesPreQuestions ?? false,
        preQuestions: formData.preQuestions || [],
      }),
      [formData.usesPreQuestions, formData.preQuestions]
    );

    const preQuestionsValidation = React.useMemo(
      () => ({
        errors: validationErrors,
        touched: touchedFields,
      }),
      [validationErrors, touchedFields]
    );

    const preQuestionsHandlers = React.useMemo(
      () => ({
        onToggle: handlePreQuestionsToggle,
        onQuestionChange: handlePreQuestionChange,
        onOptionChange: handlePreQuestionOptionChange,
        onAddQuestion: addPreQuestion,
        onRemoveQuestion: removePreQuestion,
        onAddOption: addPreQuestionOption,
        onRemoveOption: removePreQuestionOption,
      }),
      [
        handlePreQuestionsToggle,
        handlePreQuestionChange,
        handlePreQuestionOptionChange,
        addPreQuestion,
        removePreQuestion,
        addPreQuestionOption,
        removePreQuestionOption,
      ]
    );

    /**
     * SalarySection Props 준비 (useMemo로 메모이제이션)
     */
    const salaryData = React.useMemo(
      () => ({
        salaryType: formData.salaryType,
        salaryAmount: formData.salaryAmount || '',
        benefits: formData.benefits,
        useRoleSalary: formData.useRoleSalary || false,
        roleSalaries: formData.roleSalaries || {},
      }),
      [
        formData.salaryType,
        formData.salaryAmount,
        formData.benefits,
        formData.useRoleSalary,
        formData.roleSalaries,
      ]
    );

    const salaryValidation = React.useMemo(
      () => ({
        errors: {
          salaryType: validationErrors['salaryType'],
          salaryAmount: validationErrors['salaryAmount'],
        },
        touched: {
          salaryType: touchedFields['salaryType'] || false,
          salaryAmount: touchedFields['salaryAmount'] || false,
        },
      }),
      [validationErrors, touchedFields]
    );

    const salaryHandlers = React.useMemo(
      () => ({
        onSalaryTypeChange: handleSalaryTypeChange,
        onSalaryAmountChange: (amount: number) => handleSalaryAmountChange(amount.toString()),
        onBenefitToggle: handleBenefitToggle,
        onBenefitChange: (benefitType: keyof Benefits, value: string) =>
          handleBenefitChange(benefitType, value),
        onRoleSalaryToggle: handleRoleSalaryToggle,
        onAddRole: handleAddRoleToSalary,
        onRemoveRole: (roleIndex: string | number) => {
          const roleStr = typeof roleIndex === 'number' ? roleIndex.toString() : roleIndex;
          handleRemoveRoleFromSalary(roleStr);
        },
        onRoleSalaryChange: (role: string | number, type: string, amount: number) => {
          const roleStr = typeof role === 'number' ? role.toString() : role;
          handleRoleSalaryTypeChange(
            roleStr,
            type as 'hourly' | 'daily' | 'monthly' | 'negotiable' | 'other'
          );
          handleRoleSalaryAmountChange(roleStr, amount.toString());
        },
      }),
      [
        handleSalaryTypeChange,
        handleSalaryAmountChange,
        handleBenefitToggle,
        handleBenefitChange,
        handleRoleSalaryToggle,
        handleAddRoleToSalary,
        handleRemoveRoleFromSalary,
        handleRoleSalaryTypeChange,
        handleRoleSalaryAmountChange,
      ]
    );

    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        {/* 헤더: 제목 + 템플릿 버튼 */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">공고 작성</h2>
          <div className="flex space-x-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={openLoadTemplateModal}
              disabled={isSubmitting}
            >
              템플릿 불러오기
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={openTemplateModal}
              disabled={isSubmitting}
            >
              템플릿 저장
            </Button>
          </div>
        </div>

        {/* 메인 폼 */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 기본 정보 */}
          <BasicInfoSection
            data={basicInfoData}
            handlers={basicInfoHandlers}
            validation={basicInfoValidation}
          />

          {/* 급여 정보 */}
          <SalarySection
            data={salaryData}
            handlers={salaryHandlers}
            validation={salaryValidation}
          />

          {/* 날짜별 인원 요구사항 (고정공고가 아닐 때만 표시) */}
          {formData.postingType !== 'fixed' && (
            <DateRequirementsSection
              data={dateRequirementsData}
              handlers={dateRequirementsHandlers}
              validation={dateRequirementsValidation}
            />
          )}

          {/* 고정공고 근무일정 (postingType === 'fixed'일 때만 표시) - T029 */}
          {formData.postingType === 'fixed' && formData.workSchedule && (
            <FixedWorkScheduleSection
              data={{
                workSchedule: formData.workSchedule,
                requiredRolesWithCount: formData.requiredRolesWithCount || [],
              }}
              handlers={{
                onWorkScheduleChange: handleWorkScheduleChange,
                onRolesChange: handleRolesChange,
              }}
            />
          )}

          {/* 사전질문 */}
          <PreQuestionsSection
            data={preQuestionsData}
            handlers={preQuestionsHandlers}
            validation={preQuestionsValidation}
          />

          {/* 상세 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              상세 설명
            </label>
            <textarea
              name="description"
              rows={4}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm placeholder:text-xs"
              value={formData.description}
              onChange={handleFormChange}
              placeholder="추가 설명을 입력하세요&#10;예시 : 경력 1년이상,TDA숙지자 등등"
              disabled={isSubmitting}
            />
          </div>

          {/* 검증 에러 표시 */}
          {touchedFields && Object.keys(validationErrors).length > 0 && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <h4 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                ⚠️ 입력 내용을 확인해주세요
              </h4>
              <ul className="space-y-1">
                {Object.entries(validationErrors).map(([key, error]) =>
                  error ? (
                    <li key={key} className="text-sm text-red-600 dark:text-red-400">
                      • {error}
                    </li>
                  ) : null
                )}
              </ul>
            </div>
          )}

          {/* 제출 버튼 */}
          <div className="flex justify-end space-x-3">
            <Button type="button" variant="secondary" onClick={resetForm} disabled={isSubmitting}>
              초기화
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={openTemplateModal}
              disabled={isSubmitting}
            >
              템플릿 저장
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>
              {isSubmitting ? '등록 중...' : '공고 등록'}
            </Button>
          </div>
        </form>

        {/* 템플릿 저장 모달 */}
        <TemplateModal
          isOpen={isTemplateModalOpen}
          onClose={closeTemplateModal}
          templateName={templateName}
          templateDescription={templateDescription}
          onTemplateNameChange={setTemplateName}
          onTemplateDescriptionChange={setTemplateDescription}
          onSave={handleSaveTemplateWrapper}
        />

        {/* 템플릿 불러오기 모달 */}
        <LoadTemplateModal
          isOpen={isLoadTemplateModalOpen}
          onClose={closeLoadTemplateModal}
          templates={templates}
          templatesLoading={templatesLoading}
          onLoadTemplate={handleLoadTemplateWrapper}
          onDeleteTemplate={handleDeleteTemplateWrapper}
        />

        {/* 템플릿 삭제 확인 모달 */}
        <ConfirmModal
          isOpen={!!deleteConfirmTemplate}
          onClose={() => setDeleteConfirmTemplate(null)}
          onConfirm={async () => {
            const success = await handleDeleteTemplateConfirm();
            if (success) {
              toast.success(
                t('toast.template.deleteSuccess', { name: deleteConfirmTemplate?.name })
              );
            }
          }}
          title="템플릿 삭제"
          message={`"${deleteConfirmTemplate?.name}" 템플릿을 삭제하시겠습니까?\n\n⚠️ 주의: 이 작업은 되돌릴 수 없습니다.`}
          confirmText="삭제"
          cancelText="취소"
          isDangerous={true}
        />
      </div>
    );
  }
);

JobPostingForm.displayName = 'JobPostingForm';

export default JobPostingForm;

// Re-export sections for external usage
export {
  BasicInfoSection,
  DateRequirementsSection,
  PreQuestionsSection,
  SalarySection,
} from './sections';
