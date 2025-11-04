import React from 'react';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import { toast } from '../../../utils/toast';

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateName: string;
  templateDescription: string;
  onTemplateNameChange: (name: string) => void;
  onTemplateDescriptionChange: (description: string) => void;
  onSave: () => Promise<void>;
  isSaving?: boolean;
}

const TemplateModal: React.FC<TemplateModalProps> = ({
  isOpen,
  onClose,
  templateName,
  templateDescription,
  onTemplateNameChange,
  onTemplateDescriptionChange,
  onSave,
  isSaving = false
}) => {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!templateName.trim()) {
      toast.warning('템플릿 이름을 입력해주세요.');
      return;
    }

    try {
      await onSave();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '템플릿 저장 중 오류가 발생했습니다.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="템플릿 저장">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            템플릿 이름 <span className="text-red-500">*</span>
          </label>
          <Input
            type="text"
            placeholder="템플릿 이름을 입력하세요"
            value={templateName}
            onChange={(e) => onTemplateNameChange(e.target.value)}
            required
            disabled={isSaving}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            템플릿 설명 (선택사항)
          </label>
          <textarea
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            rows={3}
            placeholder="템플릿에 대한 설명을 입력하세요"
            value={templateDescription}
            onChange={(e) => onTemplateDescriptionChange(e.target.value)}
            disabled={isSaving}
          />
        </div>

        <div className="text-sm text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/30 p-3 rounded-md">
          💡 <strong>저장될 내용:</strong>
          <ul className="mt-2 space-y-1 ml-4 list-disc">
            <li>제목, 공고 타입, 지역 정보 (시/군/구, 상세주소, 문의 연락처 포함)</li>
            <li>급여 정보 (급여 유형, 금액, 역할별 급여)</li>
            <li>복리후생 정보</li>
            <li>사전질문 설정 및 사용 여부</li>
            <li>공고 상세 설명</li>
          </ul>
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            * 날짜 및 인원 요구사항은 저장되지 않습니다 (템플릿 사용 시 새로 입력 필요)
          </p>
        </div>

        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSaving}
          >
            취소
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSaving}
            disabled={!templateName.trim()}
          >
            {isSaving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default TemplateModal;