/**
 * 채팅 전송 — 낙관적 말풍선(아웃박스) + 실패 + 같은 clientMessageId 재전송
 *
 * - 오프라인 큐는 없다. 실패하면 말풍선이 실패 상태로 남고 사용자가 "재전송"을 누른다.
 * - 새 방(conversationId=null)은 첫 전송 때 연다. 열기는 성공하고 보내기만 실패했으면 받은 방 id 를
 *   기억해 두고, 재전송은 보내기만 한다(열기 재호출 없음).
 * - 성공 후 캐시는 무효화만 한다(꼬리·목록·배지). onSent 는 새 방 화면이 방 화면으로 바꿀 때 쓴다.
 * - (S2b) 사진: 재인코딩 → (방 열기) → 업로드 → 보내기. 재전송은 끝난 단계를 건너뛴다 —
 *   재인코딩 결과와 업로드 경로를 clientMessageId 별로 기억해 두므로 **다시 올리지 않는다**.
 */
import { useCallback, useReducer, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import {
  chatService,
  prepareChatImage,
  uploadChatImage,
  type PickedChatImage,
  type PreparedChatImage,
} from '@/services/chat';
import { requireOnlineForMutation } from '@/services/offline/remoteMutationGuard';
import { chatOutboxReducer } from '@/domains/chat';
import { extractUserMessage } from '@/errors';
import { useAuthStore } from '@/stores/authStore';
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
  /** (S2b) 고른 사진 1장을 보낸다 */
  sendImage: (picked: PickedChatImage) => Promise<void>;
  retry: (clientMessageId: string) => Promise<void>;
  discard: (clientMessageId: string) => void;
}

/** 재전송에 필요한 원재료 — 화면 상태가 아니라 ref 에 둔다(렌더와 무관) */
type ImagePending = {
  kind: 'image';
  picked: PickedChatImage;
  prepared?: PreparedChatImage;
  uploadedPath?: string;
};
type Pending = { kind: 'text'; body: string } | ImagePending;

export function useSendChatMessage(params: UseSendChatMessageParams): UseSendChatMessageReturn {
  const { jobPostingId, seekerId, onSent } = params;
  const queryClient = useQueryClient();
  const uid = useAuthStore((s) => s.user?.uid);
  const [outbox, dispatch] = useReducer(chatOutboxReducer, []);
  const conversationRef = useRef<string | null>(params.conversationId);
  const pendingRef = useRef<Map<string, Pending>>(new Map());

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

  const afterSent = useCallback(
    (conversationId: string, clientMessageId: string) => {
      dispatch({ type: 'markSent', clientMessageId });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.chat.messagesTailPrefix(conversationId),
      });
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.chat.all, 'list'] });
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.chat.all, 'unread'] });
      onSent?.(conversationId);
    },
    [queryClient, onSent]
  );

  /** 사진 단계 진행 — 끝난 단계(재인코딩·업로드)는 pending 에 기록돼 재전송 때 건너뛴다 */
  const deliverImage = useCallback(
    async (clientMessageId: string, pending: ImagePending) => {
      if (!uid) throw new Error('로그인 정보가 없습니다');
      const remember = (next: ImagePending) => pendingRef.current.set(clientMessageId, next);

      let current = pending;
      let prepared = current.prepared;
      if (!prepared) {
        dispatch({ type: 'setStage', clientMessageId, stage: 'preparing' });
        prepared = await prepareChatImage(current.picked);
        current = { ...current, prepared };
        remember(current);
      }

      const conversationId = await ensureConversation();
      if (!current.uploadedPath) {
        dispatch({ type: 'setStage', clientMessageId, stage: 'uploading' });
        const uploadedPath = await uploadChatImage({
          conversationId,
          uid,
          clientMessageId,
          image: prepared,
        });
        current = { ...current, uploadedPath };
        remember(current);
      }

      dispatch({ type: 'setStage', clientMessageId, stage: 'sending' });
      await chatService.sendImage({
        conversationId,
        clientMessageId,
        imagePath: current.uploadedPath ?? '',
        width: prepared.width,
        height: prepared.height,
      });
      return conversationId;
    },
    [uid, ensureConversation]
  );

  const deliver = useCallback(
    async (clientMessageId: string) => {
      const pending = pendingRef.current.get(clientMessageId);
      if (!pending) return;
      try {
        requireOnlineForMutation('채팅 보내기');
        let conversationId: string;
        if (pending.kind === 'image') {
          conversationId = await deliverImage(clientMessageId, pending);
        } else {
          conversationId = await ensureConversation();
          await chatService.sendText({ conversationId, clientMessageId, body: pending.body });
        }
        afterSent(conversationId, clientMessageId);
      } catch (error) {
        logger.warn('채팅 전송 실패', { component: 'useSendChatMessage', kind: pending.kind });
        dispatch({
          type: 'markFailed',
          clientMessageId,
          errorMessage: extractUserMessage(error) || '보내지 못했어요',
        });
      }
    },
    [deliverImage, ensureConversation, afterSent]
  );

  const enqueue = useCallback(
    (
      pending: Pending,
      item: Omit<ChatOutboxItem, 'clientMessageId' | 'status' | 'createdAtLocal'>
    ) => {
      const clientMessageId = generateUUID().toLowerCase();
      pendingRef.current.set(clientMessageId, pending);
      dispatch({
        type: 'enqueue',
        item: {
          ...item,
          clientMessageId,
          status: 'sending',
          createdAtLocal: new Date().toISOString(),
        },
      });
      return clientMessageId;
    },
    []
  );

  const send = useCallback(
    async (body: string) => {
      const clientMessageId = enqueue({ kind: 'text', body }, { kind: 'text', body });
      await deliver(clientMessageId);
    },
    [enqueue, deliver]
  );

  const sendImage = useCallback(
    async (picked: PickedChatImage) => {
      const clientMessageId = enqueue(
        { kind: 'image', picked },
        {
          kind: 'image',
          body: '',
          stage: 'preparing',
          image: { localUri: picked.uri, width: picked.width, height: picked.height },
        }
      );
      await deliver(clientMessageId);
    },
    [enqueue, deliver]
  );

  const retry = useCallback(
    async (clientMessageId: string) => {
      if (!pendingRef.current.has(clientMessageId)) return;
      dispatch({ type: 'retry', clientMessageId });
      await deliver(clientMessageId);
    },
    [deliver]
  );

  const discard = useCallback((clientMessageId: string) => {
    pendingRef.current.delete(clientMessageId);
    dispatch({ type: 'remove', clientMessageId });
  }, []);

  return { outbox, send, sendImage, retry, discard };
}
