import React from 'react';
import { useJobPostingForm } from '../../hooks/useJobPostingForm';
import { useDateUtils } from '../../hooks/useDateUtils';
import { useTemplateManager } from '../../hooks/useTemplateManager';
import { LOCATIONS, PREDEFINED_ROLES, getRoleDisplayName } from '../../utils/jobPosting/jobPostingHelpers';
import { JobPosting, DateSpecificRequirement, JobPostingTemplate } from '../../types/jobPosting';
import { toast } from '../../utils/toast';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { Select } from '../common/Select';
import DateSpecificRequirementsNew from './DateSpecificRequirementsNew';
import PreQuestionManager from './PreQuestionManager';
import TemplateModal from './modals/TemplateModal';
import LoadTemplateModal from './modals/LoadTemplateModal';
import ConfirmModal from '../modals/ConfirmModal';

interface JobPostingFormProps {
  onSubmit: (formData: Partial<JobPosting>) => Promise<void>;
  isSubmitting?: boolean;
}

const JobPostingForm: React.FC<JobPostingFormProps> = ({
  onSubmit,
  isSubmitting = false
}) => {
  const { toDropdownValue: _toDropdownValue } = useDateUtils();
  const {
    formData,
    handleFormChange,
    handleDateSpecificTimeSlotChange,
    handleDateSpecificTimeToBeAnnouncedToggle,
    handleDateSpecificTentativeDescriptionChange,
    handleDateSpecificRoleChange,
    handlePreQuestionsToggle,
    handlePreQuestionChange,
    handlePreQuestionOptionChange,
    addPreQuestion,
    removePreQuestion,
    addPreQuestionOption,
    removePreQuestionOption,
    handleStartDateChange: _handleStartDateChange,
    handleEndDateChange: _handleEndDateChange,
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
    handleRoleChange,
    handleRoleSalaryTypeChange,
    handleRoleSalaryAmountChange,
    handleCustomRoleNameChange
  } = useJobPostingForm();

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
    handleDeleteTemplateConfirm: _handleDeleteTemplateConfirm,
    deleteConfirmTemplate: _deleteConfirmTemplate,
    setDeleteConfirmTemplate: _setDeleteConfirmTemplate,
    openTemplateModal,
    closeTemplateModal,
    openLoadTemplateModal,
    closeLoadTemplateModal,
  } = useTemplateManager();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await onSubmit(formData);
      resetForm();
    } catch (error) {
      // 에러는 부모 컴포넌트에서 처리
    }
  };

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
    return true; // Return true to indicate the modal should wait for confirmation
  };

  const handleDateSpecificRequirementsChange = (requirements: DateSpecificRequirement[]) => {
    setFormData((prev: Partial<JobPosting>) => ({ ...prev, dateSpecificRequirements: requirements }));
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-medium text-gray-900">공고 작성</h2>
        <div className="flex space-x-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={openLoadTemplateModal}
          >
            템플릿 불러오기
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={openTemplateModal}
          >
            템플릿 저장
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 기본 정보 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              대회명(매장명) <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleFormChange}
              placeholder="대회명(매장명)"
              maxLength={25}
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              모집 유형
            </label>
            <Select
              name="type"
              value={'type' in formData ? formData.type : 'application'}
              onChange={(value) => handleFormChange({ target: { name: 'type', value } } as any)}
              options={[
                { value: 'application', label: '지원' },
                { value: 'fixed', label: '고정' }
              ]}
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                지역 <span className="text-red-500">*</span>
              </label>
              <Select
                name="location"
                value={formData.location}
                onChange={(value) => handleFormChange({ target: { name: 'location', value } } as any)}
                options={LOCATIONS.map(location => ({ value: location, label: location }))}
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                시/군/구
              </label>
              <Input
                type="text"
                name="district"
                value={formData.district || ''}
                onChange={(e) => handleDistrictChange(e.target.value)}
                placeholder="시/군/구를 입력하세요"
                maxLength={25}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              상세 주소
            </label>
            <Input
              type="text"
              name="detailedAddress"
              value={formData.detailedAddress}
              onChange={handleFormChange}
              placeholder="상세 주소를 입력하세요"
              maxLength={25}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              문의 연락처
            </label>
            <Input
              type="text"
              name="contactPhone"
              value={formData.contactPhone || ''}
              onChange={handleFormChange}
              placeholder="010-0000-0000"
              maxLength={25}
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* 급여 정보 */}
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="useRoleSalary"
              checked={formData.useRoleSalary || false}
              onChange={(e) => handleRoleSalaryToggle(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              disabled={isSubmitting}
            />
            <label htmlFor="useRoleSalary" className="ml-2 text-sm font-medium text-gray-700">
              역할별 급여 설정
            </label>
          </div>

          {formData.useRoleSalary ? (
            <div className="space-y-3 border rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
              <div className="text-sm text-gray-600 mb-2">
                각 역할별로 급여를 설정하세요. 기본값: 시급 20,000원
              </div>
              
              {/* 역할별 급여 목록 */}
              {Object.entries(formData.roleSalaries || {}).map(([role, salary]: [string, any]) => (
                <div key={role} className="grid grid-cols-12 gap-2 items-center">
                  {/* 역할 선택 - 기타일 때만 특별 처리 */}
                  {role === 'other' ? (
                    <>
                      <div className="col-span-2">
                        <Select
                          value={role}
                          onChange={(value) => handleRoleChange(role, value)}
                          options={PREDEFINED_ROLES.map(r => ({
                            value: r,
                            label: getRoleDisplayName(r)
                          }))}
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="col-span-3">
                        <Input
                          type="text"
                          value={salary.customRoleName || ''}
                          onChange={(e) => handleCustomRoleNameChange(role, e.target.value)}
                          placeholder="역할명을 입력하세요"
                          disabled={isSubmitting}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="col-span-4">
                      <Select
                        value={role}
                        onChange={(value) => handleRoleChange(role, value)}
                        options={PREDEFINED_ROLES.map(r => ({
                            value: r,
                            label: getRoleDisplayName(r)
                        }))}
                        disabled={isSubmitting}
                      />
                    </div>
                  )}

                  {/* 급여 유형 */}
                  <div className={role === 'other' ? "col-span-2" : "col-span-3"}>
                    <Select
                      value={salary.salaryType}
                      onChange={(value) => handleRoleSalaryTypeChange(role, value)}
                      options={[
                        { value: 'hourly', label: '시급' },
                        { value: 'daily', label: '일급' },
                        { value: 'monthly', label: '월급' },
                        { value: 'negotiable', label: '협의' },
                        { value: 'other', label: '기타' }
                      ]}
                      disabled={isSubmitting}
                    />
                  </div>

                  {/* 급여 금액 */}
                  <div className="col-span-3">
                    {salary.salaryType === 'negotiable' ? (
                      <div className="text-gray-500 text-sm py-2">급여 협의</div>
                    ) : (
                      <Input
                        type="text"
                        value={salary.salaryAmount}
                        onChange={(e) => handleRoleSalaryAmountChange(role, e.target.value)}
                        placeholder="급여 금액"
                        disabled={isSubmitting || salary.salaryType === 'negotiable'}
                      />
                    )}
                  </div>

                  {/* 삭제 버튼 */}
                  <div className="col-span-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveRoleFromSalary(role)}
                      disabled={isSubmitting}
                    >
                      삭제
                    </Button>
                  </div>
                </div>
              ))}

              {/* 역할 추가 버튼 */}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddRoleToSalary}
                disabled={isSubmitting}
              >
                + 역할 추가
              </Button>
            </div>
          ) : (
            // 기존 통합 급여 입력
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  급여 유형 <span className="text-red-500">*</span>
                </label>
                <Select
                  name="salaryType"
                  value={formData.salaryType || ''}
                  onChange={(value) => handleSalaryTypeChange(value as 'hourly' | 'daily' | 'monthly' | 'negotiable' | 'other')}
                  options={[
                    { value: '', label: '선택하세요' },
                    { value: 'hourly', label: '시급' },
                    { value: 'daily', label: '일급' },
                    { value: 'monthly', label: '월급' },
                    { value: 'negotiable', label: '협의' },
                    { value: 'other', label: '기타' }
                  ]}
                  required={!formData.useRoleSalary}
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  급여 금액 <span className="text-red-500">*</span>
                </label>
                {formData.salaryType === 'negotiable' ? (
                  <div className="text-gray-500 text-sm py-2">급여 협의</div>
                ) : (
                  <Input
                    type="text"
                    name="salaryAmount"
                    value={formData.salaryAmount || ''}
                    onChange={(e) => handleSalaryAmountChange(e.target.value)}
                    placeholder="급여 금액을 입력하세요"
                    required={!formData.useRoleSalary && formData.salaryType !== 'negotiable'}
                    disabled={isSubmitting || formData.salaryType === 'negotiable'}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* 복리후생 */}
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">복리후생 (제공되는 정보만 입력)</label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 보장시간 */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="benefit-guaranteedHours"
                checked={!!formData.benefits?.guaranteedHours}
                onChange={(e) => handleBenefitToggle('guaranteedHours', e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                disabled={isSubmitting}
              />
              <label htmlFor="benefit-guaranteedHours" className="text-sm text-gray-700 whitespace-nowrap">
                보장시간
              </label>
              {formData.benefits?.guaranteedHours !== undefined && (
                <Input
                  type="text"
                  value={formData.benefits.guaranteedHours}
                  onChange={(e) => handleBenefitChange('guaranteedHours', e.target.value)}
                  placeholder="예시: 6시간"
                  maxLength={25}
                  className="flex-1"
                  disabled={isSubmitting}
                />
              )}
            </div>

            {/* 복장 */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="benefit-clothing"
                checked={!!formData.benefits?.clothing}
                onChange={(e) => handleBenefitToggle('clothing', e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                disabled={isSubmitting}
              />
              <label htmlFor="benefit-clothing" className="text-sm text-gray-700 whitespace-nowrap">
                복장
              </label>
              {formData.benefits?.clothing !== undefined && (
                <Input
                  type="text"
                  value={formData.benefits.clothing}
                  onChange={(e) => handleBenefitChange('clothing', e.target.value)}
                  placeholder="예시: 검은셔츠,슬랙스,운동화"
                  maxLength={25}
                  className="flex-1"
                  disabled={isSubmitting}
                />
              )}
            </div>

            {/* 식사 */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="benefit-meal"
                checked={!!formData.benefits?.meal}
                onChange={(e) => handleBenefitToggle('meal', e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                disabled={isSubmitting}
              />
              <label htmlFor="benefit-meal" className="text-sm text-gray-700 whitespace-nowrap">
                식사
              </label>
              {formData.benefits?.meal !== undefined && (
                <Input
                  type="text"
                  value={formData.benefits.meal}
                  onChange={(e) => handleBenefitChange('meal', e.target.value)}
                  placeholder="식사 정보 입력"
                  maxLength={25}
                  className="flex-1"
                  disabled={isSubmitting}
                />
              )}
            </div>

            {/* 교통비 */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="benefit-transportation"
                checked={!!formData.benefits?.transportation}
                onChange={(e) => handleBenefitToggle('transportation', e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                disabled={isSubmitting}
              />
              <label htmlFor="benefit-transportation" className="text-sm text-gray-700 whitespace-nowrap">
                교통비 (일당)
              </label>
              {formData.benefits?.transportation !== undefined && (
                <>
                  <Input
                    type="text"
                    value={formData.benefits.transportation}
                    onChange={(e) => handleBenefitChange('transportation', e.target.value)}
                    placeholder="일당 5,000원"
                    maxLength={25}
                    className="flex-1"
                    disabled={isSubmitting}
                  />
                  <span className="text-sm text-gray-500">원/일</span>
                </>
              )}
            </div>

            {/* 식비 */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="benefit-mealAllowance"
                checked={!!formData.benefits?.mealAllowance}
                onChange={(e) => handleBenefitToggle('mealAllowance', e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                disabled={isSubmitting}
              />
              <label htmlFor="benefit-mealAllowance" className="text-sm text-gray-700 whitespace-nowrap">
                식비 (일당)
              </label>
              {formData.benefits?.mealAllowance !== undefined && (
                <>
                  <Input
                    type="text"
                    value={formData.benefits.mealAllowance}
                    onChange={(e) => handleBenefitChange('mealAllowance', e.target.value)}
                    placeholder="일당 10,000원"
                    maxLength={25}
                    className="flex-1"
                    disabled={isSubmitting}
                  />
                  <span className="text-sm text-gray-500">원/일</span>
                </>
              )}
            </div>

            {/* 숙소 */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="benefit-accommodation"
                checked={!!formData.benefits?.accommodation}
                onChange={(e) => handleBenefitToggle('accommodation', e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                disabled={isSubmitting}
              />
              <label htmlFor="benefit-accommodation" className="text-sm text-gray-700 whitespace-nowrap">
                숙소 (일당)
              </label>
              {formData.benefits?.accommodation !== undefined && (
                <>
                  <Input
                    type="text"
                    value={formData.benefits.accommodation}
                    onChange={(e) => handleBenefitChange('accommodation', e.target.value)}
                    placeholder="일당 15,000원"
                    maxLength={25}
                    className="flex-1"
                    disabled={isSubmitting}
                  />
                  <span className="text-sm text-gray-500">원/일</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 날짜별 인원 요구사항 설정 */}
        <DateSpecificRequirementsNew
          requirements={formData.dateSpecificRequirements || []}
          onRequirementsChange={handleDateSpecificRequirementsChange}
          onDateSpecificTimeSlotChange={handleDateSpecificTimeSlotChange}
          onDateSpecificTimeToBeAnnouncedToggle={handleDateSpecificTimeToBeAnnouncedToggle}
          onDateSpecificTentativeDescriptionChange={handleDateSpecificTentativeDescriptionChange}
          onDateSpecificRoleChange={handleDateSpecificRoleChange}
        />

        {/* 사전질문 설정 */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="usesPreQuestions"
              checked={'usesPreQuestions' in formData ? formData.usesPreQuestions : false}
              onChange={(e) => handlePreQuestionsToggle(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              disabled={isSubmitting}
            />
            <label htmlFor="usesPreQuestions" className="text-sm text-gray-700">
              사전질문 사용(추가 질문)
            </label>
          </div>

          {'usesPreQuestions' in formData && formData.usesPreQuestions && (
            <PreQuestionManager
              preQuestions={formData.preQuestions || []}
              onPreQuestionChange={handlePreQuestionChange}
              onPreQuestionOptionChange={handlePreQuestionOptionChange}
              onAddPreQuestion={addPreQuestion}
              onRemovePreQuestion={removePreQuestion}
              onAddPreQuestionOption={addPreQuestionOption}
              onRemovePreQuestionOption={removePreQuestionOption}
            />
          )}
        </div>

        {/* 상세 설명 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            상세 설명
          </label>
          <textarea
            name="description"
            rows={4}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm placeholder:text-xs"
            value={formData.description}
            onChange={handleFormChange}
            placeholder="추가 설명을 입력하세요&#10;예시 : 경력 1년이상,TDA숙지자 등등"
            disabled={isSubmitting}
          />
        </div>

        {/* 제출 버튼 */}
        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="secondary"
            onClick={resetForm}
            disabled={isSubmitting}
          >
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
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
          >
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
        isOpen={!!_deleteConfirmTemplate}
        onClose={() => _setDeleteConfirmTemplate(null)}
        onConfirm={async () => {
          const success = await _handleDeleteTemplateConfirm();
          if (success) {
            toast.success(`"${_deleteConfirmTemplate?.name}" 템플릿이 삭제되었습니다.`);
          }
        }}
        title="템플릿 삭제"
        message={`"${_deleteConfirmTemplate?.name}" 템플릿을 삭제하시겠습니까?\n\n⚠️ 주의: 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        cancelText="취소"
        isDangerous={true}
      />
    </div>
  );
};

export default JobPostingForm;