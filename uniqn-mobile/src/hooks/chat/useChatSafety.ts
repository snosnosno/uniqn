/**
 * (S4) 방 안전 상태 — 차단(방 단위)·내 알림 끄기 조회와 변경
 *
 * - 조회는 읽기 전용이라 Repository 직접(CLAUDE.md 아키텍처 예외). 새 방(id 없음)은 조회하지 않는다.
 * - 변경은 서비스 경유 RPC. 성공하면 안전 상태·목록(blocked 컬럼)·방 메타를 무효화한다.
 * - 실패는 toast 로 알리고 던지지 않는다(메뉴에서 부르는 동작이라 받을 곳이 없다).
 */
import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { chatRepository } from '@/repositories/chat';
import { chatService } from '@/services/chat';
import { requireOnlineForMutation } from '@/services/offline/remoteMutationGuard';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { chatBlockState, isChatMuted, type ChatBlockState } from '@/domains/chat';
import { extractUserMessage } from '@/errors';
import { logger } from '@/utils/logger';
import type { ChatSide } from '@/types/chat';

type SafetyAction = { type: 'mute'; muted: boolean } | { type: 'block' } | { type: 'unblock' };

const SUCCESS_MESSAGES = {
  mute: '이 대화 알림을 껐어요',
  unmute: '이 대화 알림을 켰어요',
  block: '대화를 차단했어요',
  unblock: '차단을 해제했어요',
} as const;

function successMessage(action: SafetyAction): string {
  if (action.type === 'mute') return action.muted ? SUCCESS_MESSAGES.mute : SUCCESS_MESSAGES.unmute;
  return SUCCESS_MESSAGES[action.type];
}

function runAction(conversationId: string, action: SafetyAction): Promise<void> {
  requireOnlineForMutation(action.type === 'mute' ? '채팅 알림 설정' : '채팅 차단');
  if (action.type === 'mute') return chatService.setMuted(conversationId, action.muted);
  if (action.type === 'block') return chatService.block(conversationId);
  return chatService.unblock(conversationId);
}

export interface UseChatSafetyReturn {
  blockState: ChatBlockState;
  muted: boolean;
  isLoading: boolean;
  isMutating: boolean;
  setMuted: (muted: boolean) => Promise<void>;
  block: () => Promise<void>;
  unblock: () => Promise<void>;
}

export function useChatSafety(
  conversationId: string | null,
  mySide: ChatSide | null
): UseChatSafetyReturn {
  const queryClient = useQueryClient();
  const uid = useAuthStore((s) => s.user?.uid) ?? '';
  const id = conversationId ?? '';

  const query = useQuery({
    queryKey: queryKeys.chat.safety(id, uid),
    queryFn: () => chatRepository.getSafetyState(id),
    enabled: !!conversationId && !!uid,
    staleTime: 30 * 1000,
  });

  const mutation = useMutation({
    mutationFn: (action: SafetyAction) => runAction(id, action),
    onSuccess: (_data, action) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.safetyPrefix(id) });
      if (action.type !== 'mute') {
        void queryClient.invalidateQueries({ queryKey: [...queryKeys.chat.all, 'list'] });
        void queryClient.invalidateQueries({
          queryKey: [...queryKeys.chat.all, 'conversation', id],
        });
      }
      useToastStore.getState().success(successMessage(action));
    },
    onError: (error, action) => {
      logger.warn('채팅 안전 설정 실패', { component: 'useChatSafety', action: action.type });
      useToastStore.getState().error(extractUserMessage(error) || '처리하지 못했어요');
    },
  });

  const { mutateAsync } = mutation;
  const perform = useCallback(
    async (action: SafetyAction) => {
      if (!conversationId) return;
      // 실패는 onError 가 알린다 — 호출자(메뉴)에게 던지지 않는다
      await mutateAsync(action).catch(() => undefined);
    },
    [conversationId, mutateAsync]
  );

  const setMuted = useCallback((muted: boolean) => perform({ type: 'mute', muted }), [perform]);
  const block = useCallback(() => perform({ type: 'block' }), [perform]);
  const unblock = useCallback(() => perform({ type: 'unblock' }), [perform]);

  const state = query.data;
  return {
    blockState: chatBlockState(state?.blockedBySides ?? [], mySide),
    muted: isChatMuted(state?.mutedUntil ?? null),
    isLoading: query.isLoading,
    isMutating: mutation.isPending,
    setMuted,
    block,
    unblock,
  };
}
