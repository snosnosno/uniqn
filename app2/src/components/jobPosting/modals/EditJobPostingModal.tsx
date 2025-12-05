/**
 * EditJobPostingModal - 공고 수정 모달 (리팩토링 버전)
 *
 * JobPostingForm의 섹션 컴포넌트들을 재사용하여 코드 중복을 제거하고
 * 일관된 UI/UX를 제공합니다.
 *
 * @see app2/src/components/jobPosting/JobPostingForm/sections
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ZodError, ZodIssue } from 'zod';
import { useJobPostingForm } from '@/hooks/useJobPostingForm';
import { useTemplateManager } from '@/hooks/useTemplateManager';
import { jobPostingFormSchema } from '@/schemas/jobPosting';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import TemplateModal from './TemplateModal';
import LoadTemplateModal from './LoadTemplateModal';
import ConfirmModal from '../../modals/ConfirmModal';
import { Select } from '../../common/Select';
import { toast } from '@/utils/toast';

// 섹션 컴포넌트 재사용
import {
  BasicInfoSection,
  SalarySection,
  DateRequirementsSection,
  PreQuestionsSection,
} from '../JobPostingForm/sections';

import type {
  JobPosting,
  JobPostingFormData,
  JobPostingTemplate,
  Benefits,
} from '@/types/jobPosting';
import type { DateSpecificRequirement } from '@/types/jobPosting/base';

interface EditJobPostingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPost: JobPosting | null;
  onUpdate: (postId: string, formData: Partial<JobPostingFormData>) => Promise<void>;
  isUpdating?: boolean;
}

/**
 * EditJobPostingModal 컴포넌트
 *
 * JobPostingForm의 섹션 컴포넌트를 재사용하여 일관성 유지
 * mode='edit'으로 공고 타입 변경 불가 처리
 */
const EditJobPostingModal: React.FC<EditJobPostingModalProps> = ({
  isOpen,
  onClose,
  currentPost,
  onUpdate,
  isUpdating = false,
}) => {
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
    setFormData,
    setFormDataFromTemplate,
    handleDistrictChange,
    handleSalaryTypeChange,
    handleSalaryAmountChange,
    handleBenefitToggle,
    handleBenefitChange,
    handleRoleSalaryToggle,
    handleAddRoleToSalary,
    handleRemoveRoleFromSalary,
    handleRoleSalaryTypeChange,
    handleRoleSalaryAmountChange,
  } = useJobPostingForm(currentPost ?? undefined);

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

  // currentPost 변경 시 폼 데이터 설정
  React.useEffect(() => {
    if (currentPost) {
      setFormData(currentPost as unknown as JobPostingFormData);
    }
  }, [currentPost, setFormData]);

  // 폼 제출 핸들러 (Zod 검증 통합)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPost) return;

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
      await onUpdate(currentPost.id, formData);
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
        toast.error(error instanceof Error ? error.message : '공고 수정 중 오류가 발생했습니다.');
      }
    }
  };

  // 날짜별 인원 요구사항 변경 핸들러
  const handleDateRequirementsChange = React.useCallback(
    (requirements: DateSpecificRequirement[]) => {
      handleDateSpecificRequirementsChange(requirements);
    },
    [handleDateSpecificRequirementsChange]
  );

  // 템플릿 래퍼 함수들
  const handleSaveTemplateWrapper = async () => {
    await handleSaveTemplate(formData);
  };

  const handleLoadTemplateWrapper = async (template: JobPostingTemplate) => {
    const templateFormData = await handleLoadTemplate(template);
    setFormDataFromTemplate(templateFormData);
    return templateFormData;
  };

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
      // 수정 모드에서는 공고 타입 변경 불가 - 빈 함수
      onPostingTypeChange: () => {},
      onFixedDurationChange: undefined, // 수정 모드에서 고정 기간 변경 불가
    }),
    [handleFormChange, handleDistrictChange, setFormData]
  );

  /**
   * SalarySection Props 준비
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

  /**
   * DateRequirementsSection Props 준비
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
      onRequirementsChange: handleDateRequirementsChange,
      onTimeSlotChange: handleDateSpecificTimeSlotChange,
      onTimeToBeAnnouncedToggle: handleDateSpecificTimeToBeAnnouncedToggle,
      onTentativeDescriptionChange: handleDateSpecificTentativeDescriptionChange,
      onRoleChange: handleDateSpecificRoleChange,
    }),
    [
      handleDateRequirementsChange,
      handleDateSpecificTimeSlotChange,
      handleDateSpecificTimeToBeAnnouncedToggle,
      handleDateSpecificTentativeDescriptionChange,
      handleDateSpecificRoleChange,
    ]
  );

  /**
   * PreQuestionsSection Props 준비
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

  if (!isOpen || !currentPost) return null;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="공고 수정">
        {/* 템플릿 버튼 */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex space-x-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={openLoadTemplateModal}
              disabled={isUpdating}
            >
              템플릿 불러오기
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={openTemplateModal}
              disabled={isUpdating}
            >
              템플릿 저장
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 기본 정보 - mode='edit'으로 공고 타입 변경 불가 */}
          <BasicInfoSection
            data={basicInfoData}
            handlers={basicInfoHandlers}
            validation={basicInfoValidation}
            mode="edit"
            isDisabled={isUpdating}
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
              disabled={isUpdating}
            />
          </div>

          {/* 상태 설정 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              상태
            </label>
            <Select
              name="status"
              value={formData.status}
              onChange={(value) =>
                handleFormChange({
                  target: { name: 'status', value },
                } as React.ChangeEvent<HTMLSelectElement>)
              }
              options={[
                { value: 'open', label: '모집중' },
                { value: 'closed', label: '마감' },
                { value: 'draft', label: '임시저장' },
              ]}
              disabled={isUpdating}
            />
          </div>

          {/* 검증 에러 표시 */}
          {touchedFields && Object.keys(validationErrors).length > 0 && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <h4 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                입력 내용을 확인해주세요
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

          {/* 버튼 */}
          <div className="flex justify-end space-x-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isUpdating}>
              취소
            </Button>
            <Button type="submit" variant="primary" loading={isUpdating}>
              {isUpdating ? '수정 중...' : '수정 완료'}
            </Button>
          </div>
        </form>
      </Modal>

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
            toast.success(t('toast.template.deleteSuccess', { name: deleteConfirmTemplate?.name }));
          }
        }}
        title="템플릿 삭제"
        message={`"${deleteConfirmTemplate?.name}" 템플릿을 삭제하시겠습니까?\n\n⚠️ 주의: 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        cancelText="취소"
        isDangerous={true}
      />
    </>
  );
};

export default EditJobPostingModal;
