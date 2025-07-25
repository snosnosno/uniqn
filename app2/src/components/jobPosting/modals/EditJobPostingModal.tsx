import React from 'react';
import { useJobPostingForm } from '../../../hooks/useJobPostingForm';
import { useDateUtils } from '../../../hooks/useDateUtils';
import { LOCATIONS } from '../../../utils/jobPosting/jobPostingHelpers';
import Modal from '../../Modal';
import Button from '../../common/Button';
import { Input } from '../../common/Input';
import { Select } from '../../common/Select';
import DateDropdownSelector from '../../DateDropdownSelector';
import TimeSlotManager from '../TimeSlotManager';
import DateSpecificRequirements from '../DateSpecificRequirements'; 
import PreQuestionManager from '../PreQuestionManager';

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
    setFormData
  } = useJobPostingForm(currentPost);

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

  if (!isOpen || !currentPost) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="공고 수정">
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
              value={formData.type}
              onChange={(value) => handleFormChange({ target: { name: 'type', value } } as any)}
              options={[
                { value: 'application', label: '지원' },
                { value: 'fixed', label: '고정' }
              ]}
              disabled={isUpdating}
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
              disabled={isUpdating}
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
              disabled={isUpdating}
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
              disabled={isUpdating}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              종료 날짜 <span className="text-red-500">*</span>
            </label>
            <DateDropdownSelector
              value={toDropdownValue(formData.endDate)}
              onChange={handleEndDateChange}
              disabled={isUpdating}
            />
          </div>
        </div>

        {/* 일자별 다른 요구사항 토글 */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="usesDifferentDailyRequirements-edit"
            checked={formData.usesDifferentDailyRequirements}
            onChange={(e) => handleDifferentDailyRequirementsToggle(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            disabled={isUpdating}
          />
          <label htmlFor="usesDifferentDailyRequirements-edit" className="text-sm text-gray-700">
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
              id="usesPreQuestions-edit"
              checked={formData.usesPreQuestions}
              onChange={(e) => handlePreQuestionsToggle(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              disabled={isUpdating}
            />
            <label htmlFor="usesPreQuestions-edit" className="text-sm text-gray-700">
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
  );
};

export default EditJobPostingModal;