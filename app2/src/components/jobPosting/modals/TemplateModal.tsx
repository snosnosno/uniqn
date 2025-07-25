import React from 'react';
import Modal from '../../Modal';
import Button from '../../common/Button';
import { Input } from '../../common/Input';

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
      alert('템플릿 이름을 입력해주세요.');
      return;
    }

    try {
      await onSave();
    } catch (error) {
      alert(error instanceof Error ? error.message : '템플릿 저장 중 오류가 발생했습니다.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="템플릿으로 저장">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            템플릿 설명 (선택사항)
          </label>
          <textarea
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            rows={3}
            placeholder="템플릿에 대한 설명을 입력하세요"
            value={templateDescription}
            onChange={(e) => onTemplateDescriptionChange(e.target.value)}
            disabled={isSaving}
          />
        </div>

        <div className="text-sm text-gray-500 bg-blue-50 p-3 rounded-md">
          💡 <strong>저장될 내용:</strong>
          <ul className="mt-2 space-y-1 ml-4 list-disc">
            <li>제목, 공고 타입, 지역 정보</li>
            <li>시간대 및 역할 설정</li>
            <li>일자별 요구사항 설정</li>
            <li>사전질문 설정</li>
            <li>공고 상세 설명</li>
          </ul>
          <p className="mt-2 text-xs text-gray-400">
            * 시작/종료 날짜는 저장되지 않습니다 (템플릿 사용 시 오늘 날짜로 설정됨)
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