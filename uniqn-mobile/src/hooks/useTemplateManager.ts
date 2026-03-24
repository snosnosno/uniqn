/**
 * UNIQN Mobile - 怨듦퀬 ?쒗뵆由?愿由??? *
 * @description ?쒗뵆由???? 遺덈윭?ㅺ린, ??젣 湲곕뒫
 * @version 1.0.0
 */

import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getTemplates,
  saveTemplate,
  loadTemplate,
  deleteTemplate,
} from '@/services/jobs/templateService';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { templateToDraft } from '@/types/jobTemplate';
import { logger } from '@/utils/logger';
import { toError, requireAuth } from '@/errors';
import { extractErrorMessage } from '@/shared/errors';
import type { JobPostingTemplate, CreateTemplateInput } from '@/types';
import type { JobPostingDraft } from '@/types/jobPostingDraft';

// ============================================================================
// Types
// ============================================================================

interface SaveTemplateParams {
  name: string;
  description?: string;
  draft: JobPostingDraft;
}

interface DeleteTemplateParams {
  templateId: string;
  templateName: string;
}

// ============================================================================
// ?쒗뵆由?紐⑸줉 議고쉶 ??// ============================================================================

/**
 * ?쒗뵆由?紐⑸줉 議고쉶 ?? */
export function useTemplates() {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: queryKeys.templates.list(user?.uid),
    queryFn: () => getTemplates(user!.uid),
    enabled: !!user,
    staleTime: cachingPolicies.stable,
  });
}

// ============================================================================
// ?쒗뵆由??????// ============================================================================

/**
 * ?쒗뵆由????裕ㅽ뀒?댁뀡 ?? */
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
      logger.info('?쒗뵆由?????꾨즺');
      addToast({ type: 'success', message: '?쒗뵆由우씠 ??λ릺?덉뒿?덈떎.' });
      queryClient.invalidateQueries({
        queryKey: queryKeys.templates.all,
      });
    },
    onError: (error) => {
      logger.error('?쒗뵆由?????ㅽ뙣', toError(error));
      addToast({
        type: 'error',
        message: extractErrorMessage(error, '?쒗뵆由???μ뿉 ?ㅽ뙣?덉뒿?덈떎.'),
      });
    },
  });
}

// ============================================================================
// ?쒗뵆由?遺덈윭?ㅺ린 ??// ============================================================================

/**
 * ?쒗뵆由?遺덈윭?ㅺ린 裕ㅽ뀒?댁뀡 ?? */
export function useLoadTemplate() {
  const { addToast } = useToastStore();

  return useMutation({
    mutationFn: (templateId: string) => loadTemplate(templateId),
    onSuccess: (template) => {
      logger.info('?쒗뵆由?遺덈윭?ㅺ린 ?꾨즺', { templateId: template.id });
      addToast({
        type: 'success',
        message: `'${template.name}' ?쒗뵆由우쓣 遺덈윭?붿뒿?덈떎. ?좎쭨瑜??ㅼ젙?댁＜?몄슂.`,
      });
    },
    onError: (error) => {
      logger.error('?쒗뵆由?遺덈윭?ㅺ린 ?ㅽ뙣', toError(error));
      addToast({
        type: 'error',
        message: extractErrorMessage(error, '?쒗뵆由?遺덈윭?ㅺ린???ㅽ뙣?덉뒿?덈떎.'),
      });
    },
  });
}

// ============================================================================
// ?쒗뵆由???젣 ??// ============================================================================

/**
 * ?쒗뵆由???젣 裕ㅽ뀒?댁뀡 ?? */
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
      logger.info('?쒗뵆由???젣 ?꾨즺', { templateId: params.templateId });
      addToast({
        type: 'success',
        message: `'${params.templateName}' ?쒗뵆由우씠 ??젣?섏뿀?듬땲??`,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.templates.all,
      });
    },
    onError: (error) => {
      logger.error('?쒗뵆由???젣 ?ㅽ뙣', toError(error));
      addToast({
        type: 'error',
        message: extractErrorMessage(error, '?쒗뵆由???젣???ㅽ뙣?덉뒿?덈떎.'),
      });
    },
  });
}

// ============================================================================
// ?듯빀 ?쒗뵆由?愿由???// ============================================================================

/**
 * ?쒗뵆由?愿由??듯빀 ?? *
 * @description 紐⑤떖 ?곹깭 愿由?諛??쒗뵆由?CRUD 湲곕뒫 ?듯빀
 */
export function useTemplateManager() {
  // 紐⑤떖 ?곹깭
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isLoadTemplateModalOpen, setIsLoadTemplateModalOpen] = useState(false);

  // ?쒗뵆由??낅젰 ?곹깭
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  // ??젣 ?뺤씤 ?곹깭
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
  // 紐⑤떖 ?쒖뼱
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
  // ?쒗뵆由????  // ============================================================

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
    [templateName, templateDescription, saveMutation, closeTemplateModal]
  );

  // ============================================================
  // ?쒗뵆由?遺덈윭?ㅺ린
  // ============================================================

  const handleLoadTemplate = useCallback(
    async (template: JobPostingTemplate): Promise<JobPostingDraft> => {
      const loadedTemplate = await loadMutation.mutateAsync(template.id);
      closeLoadTemplateModal();
      return templateToDraft(loadedTemplate);
    },
    [loadMutation, closeLoadTemplateModal]
  );

  // ============================================================
  // ?쒗뵆由???젣
  // ============================================================

  /**
   * ?쒗뵆由?吏곸젒 ??젣 (Alert ?뺤씤 ???몄텧??
   *
   * @description LoadTemplateModal?먯꽌 Alert ?뺤씤 ??吏곸젒 ?몄텧
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

  // ??젣 ?뺤씤 ?곹깭 湲곕컲 ?몃뱾??(蹂꾨룄 ?뺤씤 紐⑤떖 ?ъ슜 ??
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
  // 諛섑솚
  // ============================================================

  return {
    // ?쒗뵆由?紐⑸줉
    templates: templatesQuery.data ?? [],
    templatesLoading: templatesQuery.isLoading,
    templatesError: templatesQuery.error,

    // ?쒗뵆由????紐⑤떖
    isTemplateModalOpen,
    templateName,
    templateDescription,
    setTemplateName,
    setTemplateDescription,
    openTemplateModal,
    closeTemplateModal,
    handleSaveTemplate,
    isSavingTemplate: saveMutation.isPending,

    // ?쒗뵆由?遺덈윭?ㅺ린 紐⑤떖
    isLoadTemplateModalOpen,
    openLoadTemplateModal,
    closeLoadTemplateModal,
    handleLoadTemplate,
    isLoadingTemplate: loadMutation.isPending,

    // ?쒗뵆由???젣
    handleDeleteTemplate, // 吏곸젒 ??젣 (Alert ?뺤씤 ???몄텧)
    deleteConfirmTemplate,
    handleDeleteTemplateClick,
    handleDeleteTemplateConfirm,
    handleDeleteTemplateCancel,
    isDeletingTemplate: deleteMutation.isPending,
  };
}

export default useTemplateManager;
