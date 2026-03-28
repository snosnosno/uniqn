/**
 * UNIQN Mobile - 공고 템플릿 관리 훅
 * @description 템플릿 목록 조회, 저장, 불러오기, 삭제 기능을 제공합니다.
 * @version 1.0.0
 */

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteTemplate,
  getTemplates,
  loadTemplate,
  saveTemplate,
} from '@/services/jobs/templateService';
import { cachingPolicies, queryKeys } from '@/lib/queryClient';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { templateToDraft } from '@/types/jobTemplate';
import { logger } from '@/utils/logger';
import { requireAuth, toError } from '@/errors';
import { extractErrorMessage } from '@/shared/errors';
import type { CreateTemplateInput, JobPostingTemplate } from '@/types';
import type { JobPostingDraft } from '@/types/jobPostingDraft';

interface SaveTemplateParams {
  name: string;
  description?: string;
  draft: JobPostingDraft;
}

interface DeleteTemplateParams {
  templateId: string;
  templateName: string;
}

/**
 * 템플릿 목록을 조회합니다.
 */
export function useTemplates() {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: queryKeys.templates.list(user?.uid),
    queryFn: () => getTemplates(user!.uid),
    enabled: !!user,
    staleTime: cachingPolicies.stable,
  });
}

/**
 * 템플릿 저장 뮤테이션입니다.
 */
export function useSaveTemplate() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (params: SaveTemplateParams) => {
      requireAuth(user?.uid, 'useTemplateManager');
      const input: CreateTemplateInput = {
        name: params.name,
        description: params.description,
        draft: params.draft,
      };
      return saveTemplate(input, user.uid);
    },
    onSuccess: () => {
      logger.info('템플릿 저장 완료');
      addToast({ type: 'success', message: '템플릿이 저장되었습니다.' });
      queryClient.invalidateQueries({
        queryKey: queryKeys.templates.all,
      });
    },
    onError: (error) => {
      logger.error('템플릿 저장 실패', toError(error));
      addToast({
        type: 'error',
        message: extractErrorMessage(error, '템플릿 저장에 실패했습니다.'),
      });
    },
  });
}

/**
 * 템플릿 불러오기 뮤테이션입니다.
 */
export function useLoadTemplate() {
  const { addToast } = useToastStore();

  return useMutation({
    mutationFn: (templateId: string) => loadTemplate(templateId),
    onSuccess: (template) => {
      logger.info('템플릿 불러오기 완료', { templateId: template.id });
      addToast({
        type: 'success',
        message: `'${template.name}' 템플릿을 불러왔습니다. 날짜를 설정해주세요.`,
      });
    },
    onError: (error) => {
      logger.error('템플릿 불러오기 실패', toError(error));
      addToast({
        type: 'error',
        message: extractErrorMessage(error, '템플릿 불러오기에 실패했습니다.'),
      });
    },
  });
}

/**
 * 템플릿 삭제 뮤테이션입니다.
 */
export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (params: DeleteTemplateParams) => {
      requireAuth(user?.uid, 'useTemplateManager');
      return deleteTemplate(params.templateId, user.uid);
    },
    onSuccess: (_, params) => {
      logger.info('템플릿 삭제 완료', { templateId: params.templateId });
      addToast({
        type: 'success',
        message: `'${params.templateName}' 템플릿이 삭제되었습니다.`,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.templates.all,
      });
    },
    onError: (error) => {
      logger.error('템플릿 삭제 실패', toError(error));
      addToast({
        type: 'error',
        message: extractErrorMessage(error, '템플릿 삭제에 실패했습니다.'),
      });
    },
  });
}

/**
 * 템플릿 관련 UI 상태와 액션을 통합 관리합니다.
 */
export function useTemplateManager() {
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isLoadTemplateModalOpen, setIsLoadTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [deleteConfirmTemplate, setDeleteConfirmTemplate] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const templatesQuery = useTemplates();
  const saveMutation = useSaveTemplate();
  const loadMutation = useLoadTemplate();
  const deleteMutation = useDeleteTemplate();

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
    setDeleteConfirmTemplate(null);
  }, []);

  const handleSaveTemplate = useCallback(
    async (draft: JobPostingDraft) => {
      if (!templateName.trim()) {
        return;
      }

      await saveMutation.mutateAsync({
        name: templateName.trim(),
        description: templateDescription.trim() || undefined,
        draft,
      });

      closeTemplateModal();
    },
    [closeTemplateModal, saveMutation, templateDescription, templateName]
  );

  const handleLoadTemplate = useCallback(
    async (template: JobPostingTemplate): Promise<JobPostingDraft> => {
      const loadedTemplate = await loadMutation.mutateAsync(template.id);
      closeLoadTemplateModal();
      return templateToDraft(loadedTemplate);
    },
    [closeLoadTemplateModal, loadMutation]
  );

  /**
   * Alert 없이 직접 삭제할 때 사용하는 헬퍼입니다.
   */
  const handleDeleteTemplate = useCallback(
    async (templateId: string, templateNameToDelete: string) => {
      try {
        await deleteMutation.mutateAsync({
          templateId,
          templateName: templateNameToDelete,
        });
        return true;
      } catch {
        return false;
      }
    },
    [deleteMutation]
  );

  const handleDeleteTemplateClick = useCallback((id: string, name: string) => {
    setDeleteConfirmTemplate({ id, name });
  }, []);

  const handleDeleteTemplateConfirm = useCallback(async () => {
    if (!deleteConfirmTemplate) {
      return false;
    }

    try {
      await deleteMutation.mutateAsync({
        templateId: deleteConfirmTemplate.id,
        templateName: deleteConfirmTemplate.name,
      });
      setDeleteConfirmTemplate(null);
      return true;
    } catch {
      return false;
    }
  }, [deleteConfirmTemplate, deleteMutation]);

  const handleDeleteTemplateCancel = useCallback(() => {
    setDeleteConfirmTemplate(null);
  }, []);

  return {
    templates: templatesQuery.data ?? [],
    templatesLoading: templatesQuery.isLoading,
    templatesError: templatesQuery.error,

    isTemplateModalOpen,
    templateName,
    templateDescription,
    setTemplateName,
    setTemplateDescription,
    openTemplateModal,
    closeTemplateModal,
    handleSaveTemplate,
    isSavingTemplate: saveMutation.isPending,

    isLoadTemplateModalOpen,
    openLoadTemplateModal,
    closeLoadTemplateModal,
    handleLoadTemplate,
    isLoadingTemplate: loadMutation.isPending,

    handleDeleteTemplate,
    deleteConfirmTemplate,
    handleDeleteTemplateClick,
    handleDeleteTemplateConfirm,
    handleDeleteTemplateCancel,
    isDeletingTemplate: deleteMutation.isPending,
  };
}

export default useTemplateManager;
