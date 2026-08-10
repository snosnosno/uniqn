/**
 * UNIQN Mobile - 공고 템플릿(프리셋) 관리 훅
 * @description 템플릿 목록 조회, 저장, 이름 변경, 삭제(옵티미스틱+Undo) 기능 제공.
 * @version 2.0.0
 *
 * 2026-08-02 정리 — '불러오기 모달' 경로(useLoadTemplate·handleLoadTemplate·모달 상태)를 제거했다.
 * 소비 UI(LoadTemplateModal)가 S4 리팩터링에서 파일째 사라져 훅 API 만 고아로 남아 있었다.
 * 프리셋 캐러셀이 더 나은 방식으로 대체했다: 옛 흐름은 '버튼→모달→목록→선택→서버 재조회→주입'
 * (5단계·왕복 1회), 지금은 '칩 탭→즉시 적용'(1단계·왕복 0). 목록 쿼리가 templateData 전체를
 * 이미 싣고 오므로 선택 시점의 재조회는 원리적으로 잉여다.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteTemplate,
  getTemplates,
  saveTemplate,
  updateTemplate,
} from '@/services/jobs/templateService';
import { requireOnlineForMutation } from '@/services/offline/remoteMutationGuard';
import { cachingPolicies, queryKeys } from '@/lib/queryClient';
import { UNDO_DELAY_MS } from '@/constants/undo';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import {
  isDuplicateTemplateName,
  suggestUniqueTemplateName,
  templateNameSchema,
} from '@/schemas/jobTemplate.schema';
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

interface RenameTemplateParams {
  templateId: string;
  name: string;
}

// Undo 유예 시간은 `@/constants/undo` 의 UNDO_DELAY_MS 가 단일 소스다.
// (알림 삭제 Undo 와 같은 값을 써야 화면마다 유예 시간이 갈리지 않는다 — 로컬 복제 금지)

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
      requireOnlineForMutation('템플릿 저장');
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
 * 템플릿 이름 변경 뮤테이션.
 *
 * 이름만 바꾸므로 updateTemplate 의 부분 갱신 계약({ name })을 그대로 쓴다 —
 * templateData 를 함께 보내면 시트가 들고 있던 stale 구성이 저장 내용을 덮어쓴다.
 * 이름 검증은 호출부가 templateNameSchema 로 선행한다(저장 경로와 같은 축).
 */
export function useRenameTemplate() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (params: RenameTemplateParams) => {
      requireOnlineForMutation('템플릿 이름 변경');
      requireAuth(user?.uid, 'useRenameTemplate');
      return updateTemplate(params.templateId, { name: params.name }, user.uid);
    },
    onSuccess: (_result, params) => {
      logger.info('템플릿 이름 변경 완료', { templateId: params.templateId });
      addToast({ type: 'success', message: '프리셋 이름을 변경했습니다.' });
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.all });
    },
    onError: (error) => {
      logger.error('템플릿 이름 변경 실패', toError(error));
      addToast({
        type: 'error',
        message: extractErrorMessage(error, '프리셋 이름 변경에 실패했습니다.'),
      });
    },
  });
}

/**
 * Undo 토스트 기반 옵티미스틱 삭제.
 *
 *   1. UI 캐시에서 즉시 제거 (옵티미스틱)
 *   2. 5초 "되돌리기" 토스트 노출
 *   3. 5초 경과 시 실제 DELETE 호출
 *   4. "되돌리기" 탭 시 타이머 취소 + 캐시 복원
 *
 * ⚠️ 진행 중 삭제는 ref 에만 있어 렌더를 트리거하지 않는다 — "삭제 중" 스피너 같은 파생 상태를
 * 여기서 만들 수 없다(옛 `isDeletingTemplate: false` 하드코딩이 그래서 거짓말이었고 제거했다).
 */
export function useDeleteTemplateWithUndo() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  // 진행 중인 삭제 (Undo 지원) — 타이머 + 즉시 커밋 함수를 함께 보관해
  // 언마운트 시 flush 할 수 있게 한다.
  const pendingDeletesRef = useRef<
    Map<string, { timer: ReturnType<typeof setTimeout>; commit: () => void }>
  >(new Map());

  // 언마운트 시 남아 있는 삭제를 즉시 커밋한다(타이머 누수 방지).
  // 사용자는 이미 목록에서 사라진 상태로 화면을 떠났으므로 삭제 의도로 간주.
  useEffect(() => {
    const pending = pendingDeletesRef.current;
    return () => {
      pending.forEach(({ timer, commit }) => {
        clearTimeout(timer);
        commit();
      });
      pending.clear();
    };
  }, []);

  const handleDeleteTemplate = useCallback(
    async (templateId: string, templateNameToDelete: string): Promise<boolean> => {
      requireAuth(user?.uid, 'useDeleteTemplateWithUndo');
      const userId = user.uid;
      const listKey = queryKeys.templates.list(userId);

      const currentList = queryClient.getQueryData<JobPostingTemplate[]>(listKey);
      const index = currentList?.findIndex((t) => t.id === templateId) ?? -1;
      const deletedTemplate = index >= 0 && currentList ? currentList[index] : undefined;

      if (!currentList || !deletedTemplate) {
        return false;
      }

      // 삭제 항목을 현재 캐시의 원래 위치에 다시 끼워 넣어 복원한다.
      // (전체 스냅샷 덮어쓰기 금지 — 연속 삭제 시 다른 대기 항목이 되살아나는 경쟁 방지)
      const restore = () => {
        const latest = queryClient.getQueryData<JobPostingTemplate[]>(listKey) ?? [];
        if (latest.some((t) => t.id === templateId)) {
          return;
        }
        const next = [...latest];
        next.splice(Math.min(index, next.length), 0, deletedTemplate);
        queryClient.setQueryData<JobPostingTemplate[]>(listKey, next);
      };

      // 1. 캐시에서 즉시 제거 (옵티미스틱)
      queryClient.setQueryData<JobPostingTemplate[]>(
        listKey,
        currentList.filter((t) => t.id !== templateId)
      );

      // 실제 DELETE 커밋 (타이머 만료 또는 언마운트 시 1회만 실행).
      let committed = false;
      const commit = () => {
        if (committed) {
          return;
        }
        committed = true;
        pendingDeletesRef.current.delete(templateId);
        deleteTemplate(templateId, userId)
          .then(() => {
            logger.info('템플릿 삭제 완료', { templateId });
            queryClient.invalidateQueries({ queryKey: queryKeys.templates.all });
          })
          .catch((error) => {
            logger.error('템플릿 삭제 실패', toError(error));
            // 실패 시 캐시 복원
            restore();
            addToast({
              type: 'error',
              message: extractErrorMessage(error, '템플릿 삭제에 실패했습니다.'),
            });
          });
      };

      // 2. 실제 DELETE 스케줄
      const timer = setTimeout(commit, UNDO_DELAY_MS);
      pendingDeletesRef.current.set(templateId, { timer, commit });

      // 3. Undo 토스트
      addToast({
        type: 'success',
        message: `'${templateNameToDelete}' 템플릿을 삭제했습니다.`,
        duration: UNDO_DELAY_MS,
        action: {
          label: '되돌리기',
          onPress: () => {
            // 관리 시트는 조건부 마운트라 닫는 순간 이 훅이 언마운트되고 flush 가 DELETE 를 확정한다.
            // 그런데 토스트는 앱 루트에 남아 계속 눌린다 — 커밋 후 복원은 거짓 안내가 된다.
            if (committed) {
              addToast({
                type: 'info',
                message: `'${templateNameToDelete}' 템플릿은 이미 삭제되어 되돌릴 수 없습니다.`,
              });
              return;
            }

            const pending = pendingDeletesRef.current.get(templateId);
            if (pending) {
              clearTimeout(pending.timer);
              pendingDeletesRef.current.delete(templateId);
            }
            restore();
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

  return { handleDeleteTemplate };
}

/**
 * 템플릿 관련 UI 상태와 액션을 통합 관리합니다.
 *
 * 삭제는 useDeleteTemplateWithUndo 를 그대로 합성한다(관리 시트도 같은 훅을 쓴다 —
 * Undo 규칙이 진입점마다 갈라지지 않게).
 */
export function useTemplateManager() {
  const { addToast } = useToastStore();

  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  const templatesQuery = useTemplates();
  const saveMutation = useSaveTemplate();
  const { handleDeleteTemplate } = useDeleteTemplateWithUndo();

  const openTemplateModal = useCallback(() => {
    setIsTemplateModalOpen(true);
  }, []);

  const closeTemplateModal = useCallback(() => {
    setIsTemplateModalOpen(false);
    setTemplateName('');
    setTemplateDescription('');
  }, []);

  const handleSaveTemplate = useCallback(
    async (draft: JobPostingDraft) => {
      // 이름 검증 SSOT — 이름변경 경로와 같은 스키마를 쓴다(templateNameSchema).
      const parsed = templateNameSchema.safeParse(templateName);
      if (!parsed.success) {
        // 아직 아무것도 입력하지 않은 상태(모달이 막 열림)는 조용히 무시하고,
        // 뭔가 입력했는데 통과 못 한 경우에만 사유를 말한다.
        if (templateName.trim().length > 0) {
          addToast({
            type: 'error',
            message: parsed.error.issues[0]?.message ?? '프리셋 이름을 확인해주세요.',
          });
        }
        return;
      }
      const trimmedName = parsed.data;
      const templates = templatesQuery.data ?? [];

      // 중복이면 막기만 하지 않는다 — 모달을 연 채로 회피 이름을 넣어 주고,
      // 사용자는 '저장'을 다시 누르거나 그 자리에서 고치면 된다.
      if (isDuplicateTemplateName(trimmedName, templates)) {
        const suggestion = suggestUniqueTemplateName(trimmedName, templates);
        setTemplateName(suggestion);
        addToast({
          type: 'error',
          message: `같은 이름의 프리셋이 있어 '${suggestion}'(으)로 바꿨어요. 그대로 저장하거나 수정해주세요.`,
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

  return {
    templates: templatesQuery.data ?? [],
    templatesLoading: templatesQuery.isLoading,

    isTemplateModalOpen,
    templateName,
    templateDescription,
    setTemplateName,
    setTemplateDescription,
    openTemplateModal,
    closeTemplateModal,
    handleSaveTemplate,
    isSavingTemplate: saveMutation.isPending,

    handleDeleteTemplate,
  };
}
