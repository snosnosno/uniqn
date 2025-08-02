import React from 'react';
import { JobPostingTemplate } from '../../../types/jobPosting';
import { useDateUtils } from '../../../hooks/useDateUtils';
import { formatSalaryDisplay, getBenefitDisplayNames } from '../../../utils/jobPosting/jobPostingHelpers';
import Modal from '../../Modal';
import Button from '../../common/Button';
import LoadingSpinner from '../../LoadingSpinner';

interface LoadTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: JobPostingTemplate[];
  templatesLoading: boolean;
  onLoadTemplate: (template: JobPostingTemplate) => Promise<any>;
  onDeleteTemplate: (templateId: string, templateName: string) => Promise<boolean>;
}

const LoadTemplateModal: React.FC<LoadTemplateModalProps> = ({
  isOpen,
  onClose,
  templates,
  templatesLoading,
  onLoadTemplate,
  onDeleteTemplate
}) => {
  const { formatDateDisplay } = useDateUtils();

  const handleLoadTemplate = async (template: JobPostingTemplate) => {
    try {
      await onLoadTemplate(template);
    } catch (error) {
      alert(error instanceof Error ? error.message : '템플릿 불러오기 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteTemplate = async (templateId: string, templateName: string) => {
    try {
      await onDeleteTemplate(templateId, templateName);
    } catch (error) {
      alert(error instanceof Error ? error.message : '템플릿 삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="템플릿 불러오기">
      <div className="space-y-4">
        {templatesLoading ? (
          <div className="text-center py-4">
            <LoadingSpinner />
            <p className="text-gray-500 mt-2">템플릿 목록을 불러오는 중...</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 text-4xl mb-2">📂</div>
            <p className="text-gray-500">저장된 템플릿이 없습니다.</p>
            <p className="text-sm text-gray-400 mt-1">공고를 작성한 후 "템플릿으로 저장" 버튼을 눌러보세요.</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <div className="grid gap-3">
              {templates.map((template) => (
                <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{template.name}</h4>
                      {template.description && (
                        <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          📍 {template.templateData.location}
                          {template.templateData.district && ` ${template.templateData.district}`}
                        </span>
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                          📋 {template.templateData.type === 'application' ? '지원' : '고정'}
                        </span>
                        {template.templateData.salaryType && template.templateData.salaryAmount && (
                          <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                            💰 {formatSalaryDisplay(template.templateData.salaryType, template.templateData.salaryAmount)}
                          </span>
                        )}
                        {template.usageCount && template.usageCount > 0 && (
                          <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded">
                            📊 {template.usageCount}회 사용
                          </span>
                        )}
                      </div>
                      {template.templateData.benefits && Object.keys(template.templateData.benefits).length > 0 && (
                        <div className="mt-2 text-xs text-gray-600">
                          <span className="text-green-700">✅ {getBenefitDisplayNames(template.templateData.benefits).join(', ')}</span>
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        생성: {formatDateDisplay(template.createdAt)}
                      </p>
                    </div>
                    
                    <div className="flex space-x-2 ml-4">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => handleLoadTemplate(template)}
                      >
                        불러오기
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteTemplate(template.id, template.name)}
                      >
                        삭제
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-700">
            <span className="font-medium">※ 안내:</span> 템플릿 불러오기 후 시작일과 종료일을 설정해주세요.
          </p>
        </div>
        
        <div className="flex justify-end mt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            닫기
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default LoadTemplateModal;