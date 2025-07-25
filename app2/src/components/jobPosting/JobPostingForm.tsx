import React from 'react';
import { useJobPostingForm } from '../../hooks/useJobPostingForm';
import { useDateUtils } from '../../hooks/useDateUtils';
import { useTemplateManager } from '../../hooks/useTemplateManager';
import { LOCATIONS } from '../../utils/jobPosting/jobPostingHelpers';
import Button from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import DateDropdownSelector from '../DateDropdownSelector';
import TimeSlotManager from './TimeSlotManager';
import DateSpecificRequirements from './DateSpecificRequirements';
import PreQuestionManager from './PreQuestionManager';
import TemplateModal from './modals/TemplateModal';
import LoadTemplateModal from './modals/LoadTemplateModal';

interface JobPostingFormProps {
  onSubmit: (formData: any) => Promise<void>;
  isSubmitting?: boolean;
}

const JobPostingForm: React.FC<JobPostingFormProps> = ({
  onSubmit,
  isSubmitting = false
}) => {
  const { toDropdownValue } = useDateUtils();
  const {
    formData,
    handleFormChange,
    handleTimeSlotChange,
    handleTimeToBeAnnouncedToggle,
    handleTentativeDescriptionChange,
    handleRoleChange,
    addRole,
    removeRole,
    addTimeSlot,
    removeTimeSlot,
    handleDifferentDailyRequirementsToggle,
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
    resetForm,
    setFormDataFromTemplate,
    setFormData
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
    handleDeleteTemplate,
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

  const handleLoadTemplateWrapper = async (template: any) => {
    const templateFormData = await handleLoadTemplate(template);
    setFormDataFromTemplate(templateFormData);
    return templateFormData;
  };

  const handleDateSpecificRequirementsChange = (requirements: any[]) => {
    setFormData((prev: any) => ({ ...prev, dateSpecificRequirements: requirements }));
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-medium text-gray-900">새 공고 작성</h2>
        <div className="flex space-x-2">
          <Button
            type="button"
            variant="ghost"
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
            템플릿으로 저장
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 기본 정보 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              제목 <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleFormChange}
              placeholder="공고 제목을 입력하세요"
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
              value={formData.type}
              onChange={(value) => handleFormChange({ target: { name: 'type', value } } as any)}
              options={[
                { value: 'application', label: '지원' },
                { value: 'fixed', label: '고정' }
              ]}
              disabled={isSubmitting}
            />
          </div>

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
              상세 주소
            </label>
            <Input
              type="text"
              name="detailedAddress"
              value={formData.detailedAddress}
              onChange={handleFormChange}
              placeholder="상세 주소를 입력하세요"
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* 날짜 설정 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              시작 날짜 <span className="text-red-500">*</span>
            </label>
            <DateDropdownSelector
              value={toDropdownValue(formData.startDate)}
              onChange={handleStartDateChange}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              종료 날짜 <span className="text-red-500">*</span>
            </label>
            <DateDropdownSelector
              value={toDropdownValue(formData.endDate)}
              onChange={handleEndDateChange}
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* 일자별 다른 요구사항 토글 */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="usesDifferentDailyRequirements"
            checked={formData.usesDifferentDailyRequirements}
            onChange={(e) => handleDifferentDailyRequirementsToggle(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            disabled={isSubmitting}
          />
          <label htmlFor="usesDifferentDailyRequirements" className="text-sm text-gray-700">
            일자별로 다른 인원 요구사항 사용
          </label>
        </div>

        {/* 시간대 및 역할 설정 */}
        {formData.usesDifferentDailyRequirements ? (
          <DateSpecificRequirements
            requirements={formData.dateSpecificRequirements}
            startDate={formData.startDate}
            endDate={formData.endDate}
            onRequirementsChange={handleDateSpecificRequirementsChange}
            onDateSpecificTimeSlotChange={handleDateSpecificTimeSlotChange}
            onDateSpecificTimeToBeAnnouncedToggle={handleDateSpecificTimeToBeAnnouncedToggle}
            onDateSpecificTentativeDescriptionChange={handleDateSpecificTentativeDescriptionChange}
            onDateSpecificRoleChange={handleDateSpecificRoleChange}
          />
        ) : (
          <TimeSlotManager
            timeSlots={formData.timeSlots}
            onTimeSlotChange={handleTimeSlotChange}
            onTimeToBeAnnouncedToggle={handleTimeToBeAnnouncedToggle}
            onTentativeDescriptionChange={handleTentativeDescriptionChange}
            onRoleChange={handleRoleChange}
            onAddRole={addRole}
            onRemoveRole={removeRole}
            onAddTimeSlot={addTimeSlot}
            onRemoveTimeSlot={removeTimeSlot}
          />
        )}

        {/* 사전질문 설정 */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="usesPreQuestions"
              checked={formData.usesPreQuestions}
              onChange={(e) => handlePreQuestionsToggle(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              disabled={isSubmitting}
            />
            <label htmlFor="usesPreQuestions" className="text-sm text-gray-700">
              사전질문 사용
            </label>
          </div>

          {formData.usesPreQuestions && (
            <PreQuestionManager
              preQuestions={formData.preQuestions}
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
            placeholder="공고에 대한 상세한 설명을 입력하세요"
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
        onDeleteTemplate={handleDeleteTemplate}
      />
    </div>
  );
};

export default JobPostingForm;