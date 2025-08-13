import React from 'react';
import { JobPostingTemplate } from '../../../types/jobPosting';
import { useDateUtils } from '../../../hooks/useDateUtils';
import { formatSalaryDisplay, getBenefitDisplayNames } from '../../../utils/jobPosting/jobPostingHelpers';
import Modal, { ModalFooter } from '../../ui/Modal';
import Button from '../../common/Button';
import LoadingSpinner from '../../LoadingSpinner';
import { EmptyState, Badge, InfoCard } from '../../common';

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
          <EmptyState
            icon="📂"
            title="저장된 템플릿이 없습니다."
            description='공고를 작성한 후 "템플릿으로 저장" 버튼을 눌러보세요.'
          />
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <div className="grid gap-3">
              {templates.map((template) => (
                <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{template.name}</h4>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="info" size="sm" icon="📍">
                          {template.templateData.location}
                          {template.templateData.district && ` ${template.templateData.district}`}
                        </Badge>
                        <Badge variant="success" size="sm" icon="📋">
                          {template.templateData.type === 'application' ? '지원' : '고정'}
                        </Badge>
                        {template.templateData.salaryType && template.templateData.salaryAmount && (
                          <Badge variant="warning" size="sm" icon="💰">
                            {formatSalaryDisplay(template.templateData.salaryType, template.templateData.salaryAmount)}
                          </Badge>
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
                        onClick={() => handleDeleteTemplate(template.id || '', template.name)}
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
        
        <InfoCard
          type="info"
          title="※ 안내:"
          message="템플릿 불러오기 후 시작일과 종료일을 설정해주세요."
          className="mt-4"
        />
        
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