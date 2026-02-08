/**
 * UNIQN Mobile - 공고 템플릿 관리 훅
 *
 * @description 템플릿 저장, 불러오기, 삭제 기능
 * @version 1.0.0
 */

import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getTemplates,
  saveTemplate,
  loadTemplate,
  deleteTemplate,
} from '@/services/templateService';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { templateToFormData } from '@/types';
import { logger } from '@/utils/logger';
import { toError, requireAuth } from '@/errors';
import { extractErrorMessage } from '@/shared/errors';
import type { JobPostingTemplate, CreateTemplateInput, JobPostingFormData } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface SaveTemplateParams {
  name: string;
  description?: string;
  formData: JobPostingFormData;
}

interface DeleteTemplateParams {
  templateId: string;
  templateName: string;
}

// ============================================================================
// 템플릿 목록 조회 훅
// ============================================================================

/**
 * 템플릿 목록 조회 훅
 */
export function useTemplates() {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: queryKeys.templates.list(),
    queryFn: () => getTemplates(user!.uid),
    enabled: !!user,
    staleTime: cachingPolicies.stable,
  });
}

// ============================================================================
// 템플릿 저장 훅
// ============================================================================

/**
 * 템플릿 저장 뮤테이션 훅
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
        formData: params.formData,
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

// ============================================================================
// 템플릿 불러오기 훅
// ============================================================================

/**
 * 템플릿 불러오기 뮤테이션 훅
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

// ============================================================================
// 템플릿 삭제 훅
// ============================================================================

/**
 * 템플릿 삭제 뮤테이션 훅
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

// ============================================================================
// 통합 템플릿 관리 훅
// ============================================================================

/**
 * 템플릿 관리 통합 훅
 *
 * @description 모달 상태 관리 및 템플릿 CRUD 기능 통합
 */
export function useTemplateManager() {
  // 모달 상태
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isLoadTemplateModalOpen, setIsLoadTemplateModalOpen] = useState(false);

  // 템플릿 입력 상태
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  // 삭제 확인 상태
  const [deleteConfirmTemplate, setDeleteConfirmTemplate] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Query & Mutations
  const templatesQuery = useTemplates();
  const saveMutation = useSaveTemplate();
  const loadMutation = useLoadTemplate();
  const deleteMutation = useDeleteTemplate();

  // ============================================================
  // 모달 제어
  // ============================================================

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

  // ============================================================
  // 템플릿 저장
  // ============================================================

  const handleSaveTemplate = useCallback(
    async (formData: JobPostingFormData) => {
      if (!templateName.trim()) {
        return;
      }

      await saveMutation.mutateAsync({
        name: templateName.trim(),
        description: templateDescription.trim() || undefined,
        formData,
      });

      closeTemplateModal();
    },
    [templateName, templateDescription, saveMutation, closeTemplateModal]
  );

  // ============================================================
  // 템플릿 불러오기
  // ============================================================

  const handleLoadTemplate = useCallback(
    async (template: JobPostingTemplate): Promise<Partial<JobPostingFormData>> => {
      const loadedTemplate = await loadMutation.mutateAsync(template.id);
      closeLoadTemplateModal();
      return templateToFormData(loadedTemplate);
    },
    [loadMutation, closeLoadTemplateModal]
  );

  // ============================================================
  // 템플릿 삭제
  // ============================================================

  /**
   * 템플릿 직접 삭제 (Alert 확인 후 호출용)
   *
   * @description LoadTemplateModal에서 Alert 확인 후 직접 호출
   */
  const handleDeleteTemplate = useCallback(
    async (templateId: string, templateName: string) => {
      try {
        await deleteMutation.mutateAsync({
          templateId,
          templateName,
        });
        return true;
      } catch {
        return false;
      }
    },
    [deleteMutation]
  );

  // 삭제 확인 상태 기반 핸들러 (별도 확인 모달 사용 시)
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

  // ============================================================
  // 반환
  // ============================================================

  return {
    // 템플릿 목록
    templates: templatesQuery.data ?? [],
    templatesLoading: templatesQuery.isLoading,
    templatesError: templatesQuery.error,

    // 템플릿 저장 모달
    isTemplateModalOpen,
    templateName,
    templateDescription,
    setTemplateName,
    setTemplateDescription,
    openTemplateModal,
    closeTemplateModal,
    handleSaveTemplate,
    isSavingTemplate: saveMutation.isPending,

    // 템플릿 불러오기 모달
    isLoadTemplateModalOpen,
    openLoadTemplateModal,
    closeLoadTemplateModal,
    handleLoadTemplate,
    isLoadingTemplate: loadMutation.isPending,

    // 템플릿 삭제
    handleDeleteTemplate, // 직접 삭제 (Alert 확인 후 호출)
    deleteConfirmTemplate,
    handleDeleteTemplateClick,
    handleDeleteTemplateConfirm,
    handleDeleteTemplateCancel,
    isDeletingTemplate: deleteMutation.isPending,
  };
}

export default useTemplateManager;
