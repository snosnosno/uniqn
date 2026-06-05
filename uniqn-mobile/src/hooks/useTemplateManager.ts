/**
 * UNIQN Mobile - 공고 템플릿 관리 훅
 * @description 템플릿 목록 조회, 저장, 불러오기, 삭제(옵티미스틱+Undo) 기능 제공.
 * @version 1.1.0
 */

import { useCallback, useRef, useState } from 'react';
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

const UNDO_DELAY_MS = 5000;

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
 * 템플릿 저장 뮤테이션입니다. (useTemplateManager 내부 전용)
 */
function useSaveTemplate() {
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
 * 템플릿 불러오기 뮤테이션입니다. (useTemplateManager 내부 전용)
 */
function useLoadTemplate() {
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
 * 템플릿 관련 UI 상태와 액션을 통합 관리합니다.
 *
 * 삭제는 Undo 토스트 패턴을 사용합니다:
 *   1. UI 캐시에서 즉시 제거 (옵티미스틱)
 *   2. 5초 "되돌리기" 토스트 노출
 *   3. 5초 경과 시 실제 DELETE 호출
 *   4. "되돌리기" 탭 시 타이머 취소 + 캐시 복원
 */
export function useTemplateManager() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isLoadTemplateModalOpen, setIsLoadTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  const templatesQuery = useTemplates();
  const saveMutation = useSaveTemplate();
  const loadMutation = useLoadTemplate();

  // 진행 중인 삭제 타이머 (Undo 지원)
  const pendingDeletesRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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
  }, []);

  const handleSaveTemplate = useCallback(
    async (draft: JobPostingDraft) => {
      const trimmedName = templateName.trim();
      if (!trimmedName) {
        return;
      }

      // 이름 중복 검증 (대소문자 무시)
      const duplicate = templatesQuery.data?.find(
        (t) => t.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicate) {
        addToast({
          type: 'error',
          message: '같은 이름의 템플릿이 이미 있습니다.',
        });
        return;
      }

      await saveMutation.mutateAsync({
        name: trimmedName,
        description: templateDescription.trim() || undefined,
        draft,
      });

      closeTemplateModal();
    },
    [
      addToast,
      closeTemplateModal,
      saveMutation,
      templateDescription,
      templateName,
      templatesQuery.data,
    ]
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
   * Undo 토스트 기반 옵티미스틱 삭제.
   * UI 캐시에서 즉시 제거하고 5초 후 실제 DELETE 호출.
   */
  const handleDeleteTemplate = useCallback(
    async (templateId: string, templateNameToDelete: string): Promise<boolean> => {
      requireAuth(user?.uid, 'useTemplateManager');
      const userId = user.uid;
      const listKey = queryKeys.templates.list(userId);

      const previousList = queryClient.getQueryData<JobPostingTemplate[]>(listKey);
      const deletedTemplate = previousList?.find((t) => t.id === templateId);

      if (!previousList || !deletedTemplate) {
        return false;
      }

      // 1. 캐시에서 즉시 제거 (옵티미스틱)
      queryClient.setQueryData<JobPostingTemplate[]>(
        listKey,
        previousList.filter((t) => t.id !== templateId)
      );

      // 2. 실제 DELETE 스케줄
      const timer = setTimeout(async () => {
        pendingDeletesRef.current.delete(templateId);
        try {
          await deleteTemplate(templateId, userId);
          logger.info('템플릿 삭제 완료', { templateId });
          queryClient.invalidateQueries({ queryKey: queryKeys.templates.all });
        } catch (error) {
          logger.error('템플릿 삭제 실패', toError(error));
          // 실패 시 캐시 복원
          queryClient.setQueryData<JobPostingTemplate[]>(listKey, previousList);
          addToast({
            type: 'error',
            message: extractErrorMessage(error, '템플릿 삭제에 실패했습니다.'),
          });
        }
      }, UNDO_DELAY_MS);

      pendingDeletesRef.current.set(templateId, timer);

      // 3. Undo 토스트
      addToast({
        type: 'success',
        message: `'${templateNameToDelete}' 템플릿을 삭제했습니다.`,
        duration: UNDO_DELAY_MS,
        action: {
          label: '되돌리기',
          onPress: () => {
            const pending = pendingDeletesRef.current.get(templateId);
            if (pending) {
              clearTimeout(pending);
              pendingDeletesRef.current.delete(templateId);
            }
            queryClient.setQueryData<JobPostingTemplate[]>(listKey, previousList);
            addToast({
              type: 'info',
              message: `'${templateNameToDelete}' 템플릿을 복원했습니다.`,
            });
          },
        },
      });

      return true;
    },
    [addToast, queryClient, user]
  );

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
    isDeletingTemplate: false,
  };
}

export default useTemplateManager;
