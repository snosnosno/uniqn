/**
 * 채팅 전송 — 낙관적 말풍선(아웃박스) + 실패 + 같은 clientMessageId 재전송
 *
 * - 오프라인 큐는 없다. 실패하면 말풍선이 실패 상태로 남고 사용자가 "재전송"을 누른다.
 * - 새 방(conversationId=null)은 첫 전송 때 연다. 열기는 성공하고 보내기만 실패했으면 받은 방 id 를
 *   기억해 두고, 재전송은 보내기만 한다(열기 재호출 없음).
 * - 성공 후 캐시는 무효화만 한다(꼬리·목록·배지). onSent 는 새 방 화면이 방 화면으로 바꿀 때 쓴다.
 * - (S2b) 사진: 재인코딩 → (방 열기) → 업로드 → 보내기. 재전송은 끝난 단계를 건너뛴다 —
 *   재인코딩 결과와 업로드 경로를 clientMessageId 별로 기억해 두므로 **다시 올리지 않는다**.
 * - (S4 M1) 업로드는 inbox 로 가고, 정화 EF 를 거친 뒤 EF 가 잰 크기로 보낸다. 정화가 실패하면
 *   재전송은 EF 부터 다시 한다(EF 는 멱등).
 */
import { useCallback, useReducer, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import {
  buildChatImagePath,
  chatService,
  prepareChatImage,
  sanitizeChatImage,
  uploadChatImage,
  type PickedChatImage,
  type PreparedChatImage,
} from '@/services/chat';
import { requireOnlineForMutation } from '@/services/offline/remoteMutationGuard';
import { chatOutboxReducer } from '@/domains/chat';
import { ERROR_CODES, extractUserMessage, isAppError } from '@/errors';
import { CHAT_ERROR_CODES } from '@/errors/chat';
import { useAuthStore } from '@/stores/authStore';
import { generateUUID } from '@/utils/generateId';
import { logger } from '@/utils/logger';
import type { ChatOutboxItem, ChatSanitizedImage } from '@/types/chat';

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
  /** inbox 에 올린 경로 */
  uploadedPath?: string;
  /** (M1) 정화 EF 결과 — 있으면 chat-media 에 이미 있다 */
  sanitized?: ChatSanitizedImage;
};
type Pending = { kind: 'text'; body: string } | ImagePending;

/**
 * 업로드. 한도(storage 정책 거부 E6157)에 막히면 **이미 올라간 객체일 수 있다** — 업로드는 됐는데
 * 응답만 잃은 재전송이 한도 경계에 걸리면, RLS WITH CHECK 가 unique 검사보다 먼저라 409 가 아니라
 * 403 이 온다. 그때는 경로와 한도 에러를 함께 돌려주고, 정화 EF 의 inbox/chat-media 실재 확인이 판정한다.
 */
async function uploadOrAssumeExisting(
  input: Parameters<typeof uploadChatImage>[0]
): Promise<{ path: string; limitError: unknown }> {
  try {
    return { path: await uploadChatImage(input), limitError: null };
  } catch (error) {
    if (!isAppError(error) || error.code !== CHAT_ERROR_CODES.CHAT_IMAGE_LIMIT) throw error;
    return {
      path: buildChatImagePath(input.conversationId, input.uid, input.clientMessageId),
      limitError: error,
    };
  }
}

/**
 * (M1) 정화 EF. 실패하면 원인을 고른다:
 * - 업로드가 한도에 막혔던 시도였다면 사용자에게는 원래 원인(한도)을 보여 준다
 * - inbox 객체가 없다(E6160)면 업로드 완료 기록을 지워 재전송이 다시 올리게 한다
 */
async function sanitizeOrExplain(
  path: string,
  limitError: unknown,
  forgetUpload: () => void
): Promise<ChatSanitizedImage> {
  try {
    return await sanitizeChatImage(path);
  } catch (error) {
    if (isAppError(error) && error.code === CHAT_ERROR_CODES.CHAT_IMAGE_MISSING) forgetUpload();
    throw limitError ?? error;
  }
}

/** 다시 보내도 결과가 같은 실패 — 재전송 버튼 대신 삭제만 보인다 */
const NON_RETRYABLE_CODES: ReadonlySet<string> = new Set([
  CHAT_ERROR_CODES.CHAT_IMAGE_INVALID,
  CHAT_ERROR_CODES.CHAT_COUNTERPART_GONE,
  CHAT_ERROR_CODES.CHAT_POSTING_UNAVAILABLE,
  CHAT_ERROR_CODES.CHAT_BLOCKED,
  ERROR_CODES.VALIDATION_SCHEMA,
]);

function isRetryableFailure(error: unknown): boolean {
  return !(isAppError(error) && NON_RETRYABLE_CODES.has(error.code));
}

export function useSendChatMessage(params: UseSendChatMessageParams): UseSendChatMessageReturn {
  const { jobPostingId, seekerId, onSent } = params;
  const queryClient = useQueryClient();
  const uid = useAuthStore((s) => s.user?.uid);
  const [outbox, dispatch] = useReducer(chatOutboxReducer, []);
  const conversationRef = useRef<string | null>(params.conversationId);
  const pendingRef = useRef<Map<string, Pending>>(new Map());
  // 재전송 연타 방어 — 같은 id 가 진행 중이면 두 번째 호출은 무시한다(재인코딩·업로드 중복 방지)
  const inFlightRef = useRef<Set<string>>(new Set());

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
      // 보낸 뒤에는 재전송 재료(사진 바이트 최대 1.5MB)를 들고 있을 이유가 없다
      pendingRef.current.delete(clientMessageId);
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

  /** 사진 단계 진행 — 끝난 단계(재인코딩·업로드·정화)는 pending 에 기록돼 재전송 때 건너뛴다 */
  const deliverImage = useCallback(
    async (clientMessageId: string, pending: ImagePending) => {
      if (!uid) throw new Error('로그인 정보가 없습니다');
      // 진행 중에 삭제(discard)됐으면 되살리지 않는다
      const remember = (next: ImagePending) => {
        if (pendingRef.current.has(clientMessageId)) pendingRef.current.set(clientMessageId, next);
      };

      let current = pending;
      if (!current.prepared) {
        dispatch({ type: 'setStage', clientMessageId, stage: 'preparing' });
        current = { ...current, prepared: await prepareChatImage(current.picked) };
        remember(current);
      }
      const prepared = current.prepared as PreparedChatImage;

      const conversationId = await ensureConversation();
      let sanitized = current.sanitized;
      if (!sanitized) {
        dispatch({ type: 'setStage', clientMessageId, stage: 'uploading' });
        let limitError: unknown = null;
        if (!current.uploadedPath) {
          const uploaded = await uploadOrAssumeExisting({
            conversationId,
            uid,
            clientMessageId,
            image: prepared,
          });
          limitError = uploaded.limitError;
          current = { ...current, uploadedPath: uploaded.path };
          if (!limitError) remember(current);
        }
        sanitized = await sanitizeOrExplain(current.uploadedPath as string, limitError, () =>
          remember({ ...current, uploadedPath: undefined })
        );
        remember({ ...current, sanitized });
      }

      dispatch({ type: 'setStage', clientMessageId, stage: 'sending' });
      await chatService.sendImage({
        conversationId,
        clientMessageId,
        imagePath: sanitized.path,
        // 서버(EF)가 다시 잰 크기로 보낸다 — 클라 재인코딩 결과를 믿지 않는다
        width: sanitized.width,
        height: sanitized.height,
      });
      return conversationId;
    },
    [uid, ensureConversation]
  );

  const deliver = useCallback(
    async (clientMessageId: string) => {
      const pending = pendingRef.current.get(clientMessageId);
      if (!pending || inFlightRef.current.has(clientMessageId)) return;
      inFlightRef.current.add(clientMessageId);
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
          retryable: isRetryableFailure(error),
        });
      } finally {
        inFlightRef.current.delete(clientMessageId);
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
      if (!pendingRef.current.has(clientMessageId) || inFlightRef.current.has(clientMessageId)) {
        return;
      }
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
