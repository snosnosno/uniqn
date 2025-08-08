import { useState, useCallback } from 'react';
import { logger } from '../utils/logger';
import { collection, addDoc, query, where, deleteDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { useCollection } from 'react-firebase-hooks/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { JobPostingTemplate } from '../types/jobPosting';
import { templateToFormData } from '../utils/jobPosting/jobPostingHelpers';
import { useMemo } from 'react';

export const useTemplateManager = () => {
  const { currentUser } = useAuth();
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isLoadTemplateModalOpen, setIsLoadTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<JobPostingTemplate | null>(null);

  // Template query
  const templatesQuery = useMemo(() => 
    currentUser ? query(
      collection(db, 'jobPostingTemplates'), 
      where('createdBy', '==', currentUser.uid)
    ) : null, 
    [currentUser]
  );
  const [templatesSnap, templatesLoading, templatesError] = useCollection(templatesQuery);

  // Memoized templates
  const templates = useMemo(() => 
    templatesSnap?.docs.map(d => ({ id: d.id, ...d.data() } as JobPostingTemplate)) || [],
    [templatesSnap]
  );

  // 템플릿 저장
  const handleSaveTemplate = useCallback(async (formData: any) => {
    if (!currentUser || !templateName.trim()) {
      throw new Error('템플릿 이름을 입력해주세요.');
    }

    try {
      const templateData = {
        name: templateName.trim(),
        description: templateDescription.trim(),
        templateData: {
          title: formData.title,
          type: formData.type,
          dateSpecificRequirements: formData.dateSpecificRequirements,
          description: formData.description,
          location: formData.location,
          district: formData.district,
          detailedAddress: formData.detailedAddress,
          salaryType: formData.salaryType,
          salaryAmount: formData.salaryAmount,
          benefits: formData.benefits,
          preQuestions: formData.preQuestions,
          usesPreQuestions: formData.usesPreQuestions,
        },
        createdBy: currentUser.uid,
        createdAt: new Date(),
        usageCount: 0
      };

      await addDoc(collection(db, 'jobPostingTemplates'), templateData);
      
      // 폼 초기화
      setTemplateName('');
      setTemplateDescription('');
      setIsTemplateModalOpen(false);
      
      return true;
    } catch (error) {
      logger.error('템플릿 저장 오류:', error instanceof Error ? error : new Error(String(error)), { component: 'useTemplateManager' });
      throw error;
    }
  }, [currentUser, templateName, templateDescription]);

  // 템플릿 불러오기
  const handleLoadTemplate = useCallback(async (template: JobPostingTemplate) => {
    try {
      // 사용 횟수 증가
      if (template.id) {
        const templateRef = doc(db, 'jobPostingTemplates', template.id);
        await updateDoc(templateRef, {
          usageCount: increment(1),
          lastUsedAt: new Date()
        });
      }

      const formData = templateToFormData(template);
      setIsLoadTemplateModalOpen(false);
      
      return formData;
    } catch (error) {
      logger.error('템플릿 불러오기 오류:', error instanceof Error ? error : new Error(String(error)), { component: 'useTemplateManager' });
      throw error;
    }
  }, []);

  // 템플릿 삭제
  const handleDeleteTemplate = useCallback(async (templateId: string, templateName: string) => {
    if (!window.confirm(`"${templateName}" 템플릿을 삭제하시겠습니까?`)) {
      return false;
    }

    try {
      await deleteDoc(doc(db, 'jobPostingTemplates', templateId));
      return true;
    } catch (error) {
      logger.error('템플릿 삭제 오류:', error instanceof Error ? error : new Error(String(error)), { component: 'useTemplateManager' });
      throw error;
    }
  }, []);

  // 모달 제어 함수들
  const openTemplateModal = useCallback(() => {
    setIsTemplateModalOpen(true);
  }, []);

  const closeTemplateModal = useCallback(() => {
    setIsTemplateModalOpen(false);
    setTemplateName('');
    setTemplateDescription('');
  }, []);

  const openLoadTemplateModal = useCallback(() => {
    setIsLoadTemplateModalOpen(true);
  }, []);

  const closeLoadTemplateModal = useCallback(() => {
    setIsLoadTemplateModalOpen(false);
    setSelectedTemplate(null);
  }, []);

  return {
    // 상태
    templates,
    templatesLoading,
    templatesError,
    isTemplateModalOpen,
    isLoadTemplateModalOpen,
    templateName,
    templateDescription,
    selectedTemplate,

    // 상태 업데이트 함수
    setTemplateName,
    setTemplateDescription,
    setSelectedTemplate,

    // 템플릿 작업 함수
    handleSaveTemplate,
    handleLoadTemplate,
    handleDeleteTemplate,

    // 모달 제어 함수
    openTemplateModal,
    closeTemplateModal,
    openLoadTemplateModal,
    closeLoadTemplateModal,
  };
};