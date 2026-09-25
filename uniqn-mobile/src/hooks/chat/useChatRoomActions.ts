/**
 * 방 동작 — 읽음 처리·나가기
 *
 * - 읽음(mark_read): 방에서 본 가장 최신 **상대** 메시지까지. 같은 id 로는 한 번만 부른다.
 *   서버가 내 채팅 알림도 함께 읽음 처리하므로 알림 배지도 무효화한다.
 * - 나가기: 확인 후 hide → 목록 무효화. 상대가 새 메시지를 보내면 목록에 다시 나타난다.
 */
import { useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { chatService } from '@/services/chat';
import { requireOnlineForMutation } from '@/services/offline/remoteMutationGuard';
import { useToastStore } from '@/stores/toastStore';
import { extractUserMessage } from '@/errors';
import { logger } from '@/utils/logger';

export function useChatRoomActions(conversationId: string | null) {
  const queryClient = useQueryClient();
  const lastMarkedRef = useRef<string | null>(null);

  const invalidateCounts = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [...queryKeys.chat.all, 'list'] });
    void queryClient.invalidateQueries({ queryKey: [...queryKeys.chat.all, 'unread'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
  }, [queryClient]);

  const markRead = useCallback(
    async (lastMessageId: string | null) => {
      if (!conversationId || !lastMessageId || lastMarkedRef.current === lastMessageId) return;
      lastMarkedRef.current = lastMessageId;
      try {
        await chatService.markRead(conversationId, lastMessageId);
        invalidateCounts();
      } catch (error) {
        // 읽음 실패는 조용히 — 다음 메시지에서 다시 시도한다
        lastMarkedRef.current = null;
        logger.warn('채팅 읽음 처리 실패', {
          component: 'useChatRoomActions',
          message: extractUserMessage(error),
        });
      }
    },
    [conversationId, invalidateCounts]
  );

  const hideMutation = useMutation({
    mutationFn: async () => {
      if (!conversationId) return;
      requireOnlineForMutation('채팅방 나가기');
      await chatService.hide(conversationId);
    },
    onSuccess: () => {
      invalidateCounts();
      useToastStore.getState().success('채팅방에서 나갔어요');
    },
    onError: (error) => {
      useToastStore.getState().error(extractUserMessage(error) || '나가기에 실패했어요');
    },
  });

  return {
    markRead,
    hide: hideMutation.mutateAsync,
    isHiding: hideMutation.isPending,
  };
}
