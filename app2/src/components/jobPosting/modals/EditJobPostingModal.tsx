import React from 'react';
import { useJobPostingForm } from '../../../hooks/useJobPostingForm';
import { useDateUtils } from '../../../hooks/useDateUtils';
import { useTemplateManager } from '../../../hooks/useTemplateManager';
import { LOCATIONS } from '../../../utils/jobPosting/jobPostingHelpers';
import Modal, { ModalFooter } from '../../ui/Modal';
import Button from '../../common/Button';
import { Input } from '../../common/Input';
import { Select } from '../../common/Select';
import DateDropdownSelector from '../../DateDropdownSelector';
import DateSpecificRequirements from '../DateSpecificRequirements'; 
import PreQuestionManager from '../PreQuestionManager';
import TemplateModal from './TemplateModal';
import LoadTemplateModal from './LoadTemplateModal';

interface EditJobPostingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPost: any;
  onUpdate: (postId: string, formData: any) => Promise<void>;
  isUpdating?: boolean;
}

const EditJobPostingModal: React.FC<EditJobPostingModalProps> = ({
  isOpen,
  onClose,
  currentPost,
  onUpdate,
  isUpdating = false
}) => {
  const { toDropdownValue } = useDateUtils();
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
    handleStartDateChange,
    handleEndDateChange,
    setFormData,
    setFormDataFromTemplate,
    handleDistrictChange,
    handleSalaryTypeChange,
    handleSalaryAmountChange,
    handleBenefitToggle,
    handleBenefitChange
  } = useJobPostingForm(currentPost);

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
    handleDeleteTemplate,
    openTemplateModal,
    closeTemplateModal,
    openLoadTemplateModal,
    closeLoadTemplateModal,
  } = useTemplateManager();

  React.useEffect(() => {
    if (currentPost) {
      setFormData(currentPost);
    }
  }, [currentPost, setFormData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await onUpdate(currentPost.id, formData);
    } catch (error) {
      alert(error instanceof Error ? error.message : '공고 수정 중 오류가 발생했습니다.');
    }
  };

  const handleDateSpecificRequirementsChange = (requirements: any[]) => {
    setFormData((prev: any) => ({ ...prev, dateSpecificRequirements: requirements }));
  };

  const handleSaveTemplateWrapper = async () => {
    await handleSaveTemplate(formData);
  };

  const handleLoadTemplateWrapper = async (template: any) => {
    const templateFormData = await handleLoadTemplate(template);
    setFormDataFromTemplate(templateFormData);
    return templateFormData;
  };

  if (!isOpen || !currentPost) return null;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="공고 수정">
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
              템플릿으로 저장
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
              disabled={isUpdating}
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
              disabled={isUpdating}
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
                disabled={isUpdating}
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
                disabled={isUpdating}
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
              disabled={isUpdating}
            />
          </div>
        </div>

        {/* 급여 정보 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              급여 유형 <span className="text-red-500">*</span>
            </label>
            <Select
              name="salaryType"
              value={formData.salaryType || ''}
              onChange={(value) => handleSalaryTypeChange(value as 'hourly' | 'daily' | 'monthly' | 'other')}
              options={[
                { value: '', label: '선택하세요' },
                { value: 'hourly', label: '시급' },
                { value: 'daily', label: '일급' },
                { value: 'monthly', label: '월급' },
                { value: 'other', label: '기타' }
              ]}
              required
              disabled={isUpdating}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              급여 금액 <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              name="salaryAmount"
              value={formData.salaryAmount || ''}
              onChange={(e) => handleSalaryAmountChange(e.target.value)}
              placeholder="급여 금액을 입력하세요"
              required
              disabled={isUpdating}
            />
          </div>
        </div>

        {/* 복리후생 */}
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">복리후생</label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 보장시간 */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="benefit-guaranteedHours-edit"
                checked={!!formData.benefits?.guaranteedHours}
                onChange={(e) => handleBenefitToggle('guaranteedHours', e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                disabled={isUpdating}
              />
              <label htmlFor="benefit-guaranteedHours-edit" className="text-sm text-gray-700 whitespace-nowrap">
                보장시간
              </label>
              {formData.benefits?.guaranteedHours !== undefined && (
                <Input
                  type="text"
                  value={formData.benefits.guaranteedHours}
                  onChange={(e) => handleBenefitChange('guaranteedHours', e.target.value)}
                  placeholder="보장시간 정보 입력"
                  maxLength={25}
                  className="flex-1"
                  disabled={isUpdating}
                />
              )}
            </div>

            {/* 복장 */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="benefit-clothing-edit"
                checked={!!formData.benefits?.clothing}
                onChange={(e) => handleBenefitToggle('clothing', e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                disabled={isUpdating}
              />
              <label htmlFor="benefit-clothing-edit" className="text-sm text-gray-700 whitespace-nowrap">
                복장
              </label>
              {formData.benefits?.clothing !== undefined && (
                <Input
                  type="text"
                  value={formData.benefits.clothing}
                  onChange={(e) => handleBenefitChange('clothing', e.target.value)}
                  placeholder="복장 정보 입력"
                  maxLength={25}
                  className="flex-1"
                  disabled={isUpdating}
                />
              )}
            </div>

            {/* 식사 */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="benefit-meal-edit"
                checked={!!formData.benefits?.meal}
                onChange={(e) => handleBenefitToggle('meal', e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                disabled={isUpdating}
              />
              <label htmlFor="benefit-meal-edit" className="text-sm text-gray-700 whitespace-nowrap">
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
                  disabled={isUpdating}
                />
              )}
            </div>

            {/* 교통비 */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="benefit-transportation-edit"
                checked={!!formData.benefits?.transportation}
                onChange={(e) => handleBenefitToggle('transportation', e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                disabled={isUpdating}
              />
              <label htmlFor="benefit-transportation-edit" className="text-sm text-gray-700 whitespace-nowrap">
                교통비
              </label>
              {formData.benefits?.transportation !== undefined && (
                <Input
                  type="text"
                  value={formData.benefits.transportation}
                  onChange={(e) => handleBenefitChange('transportation', e.target.value)}
                  placeholder="교통비 정보 입력"
                  maxLength={25}
                  className="flex-1"
                  disabled={isUpdating}
                />
              )}
            </div>

            {/* 식비 */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="benefit-mealAllowance-edit"
                checked={!!formData.benefits?.mealAllowance}
                onChange={(e) => handleBenefitToggle('mealAllowance', e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                disabled={isUpdating}
              />
              <label htmlFor="benefit-mealAllowance-edit" className="text-sm text-gray-700 whitespace-nowrap">
                식비
              </label>
              {formData.benefits?.mealAllowance !== undefined && (
                <Input
                  type="text"
                  value={formData.benefits.mealAllowance}
                  onChange={(e) => handleBenefitChange('mealAllowance', e.target.value)}
                  placeholder="식비 정보 입력"
                  maxLength={25}
                  className="flex-1"
                  disabled={isUpdating}
                />
              )}
            </div>

            {/* 숙소 */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="benefit-accommodation-edit"
                checked={!!formData.benefits?.accommodation}
                onChange={(e) => handleBenefitToggle('accommodation', e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                disabled={isUpdating}
              />
              <label htmlFor="benefit-accommodation-edit" className="text-sm text-gray-700 whitespace-nowrap">
                숙소
              </label>
              {formData.benefits?.accommodation !== undefined && (
                <Input
                  type="text"
                  value={formData.benefits.accommodation}
                  onChange={(e) => handleBenefitChange('accommodation', e.target.value)}
                  placeholder="숙소 정보 입력"
                  maxLength={25}
                  className="flex-1"
                  disabled={isUpdating}
                />
              )}
            </div>
          </div>
        </div>

        {/* 날짜 설정 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              시작일 <span className="text-red-500">*</span>
            </label>
            <DateDropdownSelector
              value={toDropdownValue(typeof formData.startDate === 'string' ? formData.startDate : '')}
              onChange={handleStartDateChange}
              disabled={isUpdating}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              종료일 <span className="text-red-500">*</span>
            </label>
            <DateDropdownSelector
              value={toDropdownValue(typeof formData.endDate === 'string' ? formData.endDate : '')}
              onChange={handleEndDateChange}
              disabled={isUpdating}
            />
          </div>
        </div>

        {/* 시간대 및 역할 설정 - 항상 날짜별 요구사항 사용 */}
        <DateSpecificRequirements
          requirements={formData.dateSpecificRequirements || []}
          startDate={typeof formData.startDate === 'string' ? formData.startDate : ''}
          endDate={typeof formData.endDate === 'string' ? formData.endDate : ''}
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
              id="usesPreQuestions-edit"
              checked={'usesPreQuestions' in formData ? formData.usesPreQuestions : false}
              onChange={(e) => handlePreQuestionsToggle(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              disabled={isUpdating}
            />
            <label htmlFor="usesPreQuestions-edit" className="text-sm text-gray-700">
              사전질문 사용
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
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            value={formData.description}
            onChange={handleFormChange}
            disabled={isUpdating}
          />
        </div>

        {/* 상태 설정 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            상태
          </label>
          <Select
            name="status"
            value={formData.status}
            onChange={(value) => handleFormChange({ target: { name: 'status', value } } as any)}
            options={[
              { value: 'open', label: '모집중' },
              { value: 'closed', label: '마감' },
              { value: 'draft', label: '임시저장' }
            ]}
            disabled={isUpdating}
          />
        </div>

        {/* 버튼 */}
        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isUpdating}
          >
            취소
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isUpdating}
          >
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
      onDeleteTemplate={handleDeleteTemplate}
    />
  </>
  );
};

export default EditJobPostingModal;