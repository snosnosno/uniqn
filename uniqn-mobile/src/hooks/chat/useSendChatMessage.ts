/**
 * 채팅 전송 — 낙관적 말풍선(아웃박스) + 실패 + 같은 clientMessageId 재전송
 *
 * - 오프라인 큐는 없다. 실패하면 말풍선이 실패 상태로 남고 사용자가 "재전송"을 누른다.
 * - 새 방(conversationId=null)은 첫 전송 때 연다. 열기는 성공하고 보내기만 실패했으면 받은 방 id 를
 *   기억해 두고, 재전송은 보내기만 한다(열기 재호출 없음).
 * - 성공 후 캐시는 무효화만 한다(꼬리·목록·배지). onSent 는 새 방 화면이 방 화면으로 바꿀 때 쓴다.
 */
import { useCallback, useReducer, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { chatService } from '@/services/chat';
import { requireOnlineForMutation } from '@/services/offline/remoteMutationGuard';
import { chatOutboxReducer } from '@/domains/chat';
import { extractUserMessage } from '@/errors';
import { generateUUID } from '@/utils/generateId';
import { logger } from '@/utils/logger';
import type { ChatOutboxItem } from '@/types/chat';

export interface UseSendChatMessageParams {
  conversationId: string | null;
  jobPostingId: string;
  /** 구인자가 지원자에게 걸 때만. 구직자 본인이면 null */
  seekerId: string | null;
  onSent?: (conversationId: string) => void;
}

export interface UseSendChatMessageReturn {
  outbox: ChatOutboxItem[];
  send: (body: string) => Promise<void>;
  retry: (clientMessageId: string) => Promise<void>;
  discard: (clientMessageId: string) => void;
}

export function useSendChatMessage(params: UseSendChatMessageParams): UseSendChatMessageReturn {
  const { jobPostingId, seekerId, onSent } = params;
  const queryClient = useQueryClient();
  const [outbox, dispatch] = useReducer(chatOutboxReducer, []);
  const conversationRef = useRef<string | null>(params.conversationId);
  const bodiesRef = useRef<Map<string, string>>(new Map());

  if (params.conversationId && conversationRef.current !== params.conversationId) {
    conversationRef.current = params.conversationId;
  }

  // 첫 open 이 끝나기 전에 두 번째 전송이 오면 같은 Promise 를 기다린다 — open 을 두 번 부르면
  // 서버의 새 방 한도 토큰(하루 20개)이 두 개 빠진다
  const openingRef = useRef<Promise<string> | null>(null);
  const ensureConversation = useCallback(async (): Promise<string> => {
    if (conversationRef.current) return conversationRef.current;
    if (!openingRef.current) {
      openingRef.current = chatService
        .openConversation({ jobPostingId, seekerId })
        .then((opened) => {
          conversationRef.current = opened;
          return opened;
        })
        .finally(() => {
          openingRef.current = null;
        });
    }
    return openingRef.current;
  }, [jobPostingId, seekerId]);

  const deliver = useCallback(
    async (clientMessageId: string, body: string) => {
      try {
        requireOnlineForMutation('채팅 보내기');
        const conversationId = await ensureConversation();
        await chatService.sendText({ conversationId, clientMessageId, body });
        dispatch({ type: 'markSent', clientMessageId });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.chat.messagesTailPrefix(conversationId),
        });
        void queryClient.invalidateQueries({ queryKey: [...queryKeys.chat.all, 'list'] });
        void queryClient.invalidateQueries({ queryKey: [...queryKeys.chat.all, 'unread'] });
        onSent?.(conversationId);
      } catch (error) {
        logger.warn('채팅 전송 실패', { component: 'useSendChatMessage' });
        dispatch({
          type: 'markFailed',
          clientMessageId,
          errorMessage: extractUserMessage(error) || '보내지 못했어요',
        });
      }
    },
    [ensureConversation, queryClient, onSent]
  );

  const send = useCallback(
    async (body: string) => {
      const clientMessageId = generateUUID().toLowerCase();
      bodiesRef.current.set(clientMessageId, body);
      dispatch({
        type: 'enqueue',
        item: {
          clientMessageId,
          kind: 'text',
          body,
          status: 'sending',
          createdAtLocal: new Date().toISOString(),
        },
      });
      await deliver(clientMessageId, body);
    },
    [deliver]
  );

  const retry = useCallback(
    async (clientMessageId: string) => {
      const body = bodiesRef.current.get(clientMessageId);
      if (body === undefined) return;
      dispatch({ type: 'retry', clientMessageId });
      await deliver(clientMessageId, body);
    },
    [deliver]
  );

  const discard = useCallback((clientMessageId: string) => {
    bodiesRef.current.delete(clientMessageId);
    dispatch({ type: 'remove', clientMessageId });
  }, []);

  return { outbox, send, retry, discard };
}
