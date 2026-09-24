/**
 * 내 채팅 목록 (인박스) — `chat_list_conversations` 커서 페이지
 *
 * 공고 관리 타일은 전체 목록을 받아 클라에서 공고로 거른다(결정 D-d — 안 읽음 수가 그대로 보인다).
 * 30건 페이지 밖의 방은 "더 보기"로 불러와야 나타난다.
 * S3 전까지 실시간 갱신은 없다 — 30초 staleTime + 포커스 refetch + 내 행동 뒤 무효화.
 */
import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { chatRepository } from '@/repositories/chat';
import { useAuthStore } from '@/stores/authStore';
import { CHAT_PAGE_SIZE } from '@/constants/chat';
import type { ChatConversationSummary } from '@/types/chat';

export interface UseChatConversationsReturn {
  conversations: ChatConversationSummary[];
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  fetchMore: () => void;
  refetch: () => Promise<unknown>;
}

export function useChatConversations(options: {
  enabled: boolean;
  postingId?: string | null;
}): UseChatConversationsReturn {
  const uid = useAuthStore((s) => s.user?.uid);
  const enabled = options.enabled && !!uid;

  const query = useInfiniteQuery({
    queryKey: queryKeys.chat.list(uid ?? ''),
    queryFn: ({ pageParam }) =>
      chatRepository.listConversations({ limit: CHAT_PAGE_SIZE, before: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.length < CHAT_PAGE_SIZE ? undefined : lastPage[lastPage.length - 1]?.lastMessageAt,
    enabled,
    staleTime: cachingPolicies.realtime,
  });

  const postingId = options.postingId ?? null;
  const conversations = useMemo(() => {
    const all = query.data?.pages.flat() ?? [];
    return postingId ? all.filter((c) => c.jobPostingId === postingId) : all;
  }, [query.data, postingId]);

  return {
    conversations,
    isLoading: enabled && query.isLoading,
    error: (query.error as Error | null) ?? null,
    hasMore: !!query.hasNextPage,
    fetchMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    },
    refetch: query.refetch,
  };
}
