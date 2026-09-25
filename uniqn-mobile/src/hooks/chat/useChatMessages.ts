/**
 * 방 메시지 — 과거 페이지(keyset) + 실시간 꼬리 + realtime 구독
 *
 * - 과거 페이지: 최신순 30건씩. 한 번 받은 페이지는 다시 받지 않는다(staleTime Infinity).
 * - 꼬리: 첫 페이지의 가장 최신 created_at 이후를 오름차순으로. realtime·전송 성공·재연결 때 무효화.
 * - realtime 콜백은 **꼬리 접두사 무효화만** 한다(D7=R1). payload 로 캐시를 직접 고치지 않는다 —
 *   화면에 들어가는 모든 행이 RLS SELECT 를 거치게 한다.
 */
import { useEffect, useMemo } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { chatRepository, type ChatMessageCursor } from '@/repositories/chat';
import { createRealtimeSubscription } from '@/utils/supabase';
import { useAuthStore } from '@/stores/authStore';
import { mergeChatTimeline } from '@/domains/chat';
import { CHAT_PAGE_SIZE, CHAT_TAIL_CAP } from '@/constants/chat';
import type { ChatMessage } from '@/types/chat';

/** 빈 방의 꼬리 기준 — 어떤 메시지보다도 이르다 */
const EMPTY_ANCHOR = '1970-01-01T00:00:00.000Z';

/** 구독 직후 따라잡기 재조회 지연 */
const SUBSCRIBE_CATCH_UP_MS = 1500;

export interface UseChatMessagesReturn {
  /** 오래된 → 최신 오름차순 */
  messages: ChatMessage[];
  isLoading: boolean;
  /** 과거 페이지 오류(받은 메시지가 없을 때만 전체 화면 오류로 쓴다) */
  error: Error | null;
  /** 꼬리 조회 오류 — 이미 받은 메시지는 그대로 두고 배너로 알린다 */
  tailError: Error | null;
  retry: () => void;
  hasOlder: boolean;
  isFetchingOlder: boolean;
  fetchOlder: () => void;
}

export function useChatMessages(conversationId: string | null): UseChatMessagesReturn {
  const queryClient = useQueryClient();
  const uid = useAuthStore((s) => s.user?.uid);
  const enabled = !!conversationId && !!uid;
  const id = conversationId ?? '';
  const user = uid ?? '';

  const pagesQuery = useInfiniteQuery({
    queryKey: queryKeys.chat.messagesPages(id, user),
    queryFn: ({ pageParam }) => chatRepository.getMessagesPage(id, pageParam, CHAT_PAGE_SIZE),
    initialPageParam: null as ChatMessageCursor | null,
    getNextPageParam: (lastPage): ChatMessageCursor | undefined => {
      if (lastPage.length < CHAT_PAGE_SIZE) return undefined;
      const oldest = lastPage[lastPage.length - 1];
      return oldest ? { createdAt: oldest.createdAt, id: oldest.id } : undefined;
    },
    enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const anchor = pagesQuery.data?.pages[0]?.[0]?.createdAt ?? EMPTY_ANCHOR;

  const tailQuery = useQuery({
    queryKey: queryKeys.chat.messagesTail(id, user, anchor),
    queryFn: () => chatRepository.getMessagesAfter(id, anchor, CHAT_TAIL_CAP),
    enabled: enabled && pagesQuery.isSuccess,
    staleTime: 0,
  });

  // 꼬리가 상한에 닿으면 과거 페이지를 새로 받아 anchor 를 앞당긴다
  const tailLength = tailQuery.data?.length ?? 0;
  useEffect(() => {
    if (!enabled || tailLength < CHAT_TAIL_CAP) return;
    queryClient.resetQueries({ queryKey: queryKeys.chat.messagesPages(id, user) });
  }, [enabled, tailLength, queryClient, id, user]);

  useEffect(() => {
    if (!conversationId) return undefined;
    const invalidateTail = () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.chat.messagesTailPrefix(conversationId),
      });
    };
    const unsubscribe = createRealtimeSubscription(
      'chat_messages',
      `conversation_id=eq.${conversationId}`,
      invalidateTail,
      (status) => {
        if (status === 'RECOVERED') invalidateTail();
      }
    );
    // 꼬리 조회 ~ 첫 구독 완료 사이에 들어온 메시지를 놓치지 않도록 한 번 더 당긴다
    const catchUp = setTimeout(invalidateTail, SUBSCRIBE_CATCH_UP_MS);
    return () => {
      clearTimeout(catchUp);
      unsubscribe();
    };
  }, [conversationId, queryClient]);

  const messages = useMemo(
    () =>
      mergeChatTimeline(pagesQuery.data?.pages ?? [], tailQuery.data ?? [], []).flatMap((item) =>
        item.type === 'message' ? [item.message] : []
      ),
    [pagesQuery.data, tailQuery.data]
  );

  return {
    messages,
    isLoading: enabled && pagesQuery.isLoading,
    error: (pagesQuery.error as Error | null) ?? null,
    tailError: (tailQuery.error as Error | null) ?? null,
    retry: () => {
      if (pagesQuery.error) void pagesQuery.refetch();
      else void tailQuery.refetch();
    },
    hasOlder: !!pagesQuery.hasNextPage,
    isFetchingOlder: pagesQuery.isFetchingNextPage,
    fetchOlder: () => {
      if (pagesQuery.hasNextPage && !pagesQuery.isFetchingNextPage) {
        void pagesQuery.fetchNextPage();
      }
    },
  };
}
