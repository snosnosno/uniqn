/**
 * 방 메타 + 목록 요약(공고 상태·상대 이름·내 쪽) + 진입 시점의 내 읽음 커서
 *
 * 공고 상태는 목록 RPC(SECDEF 조인)가 준다 — 구직자는 cancelled/expired 공고를 RLS 로 못 읽기 때문.
 * 목록 캐시에 없으면(깊은 링크 등) 상태는 null → 카드는 상태 배지 없이 보인다.
 * 읽음 커서는 "여기까지 읽었어요" 구분선 기준이라 진입 때 한 번만 받는다.
 */
import { useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { chatRepository } from '@/repositories/chat';
import { useAuthStore } from '@/stores/authStore';
import type { ChatConversationMeta, ChatConversationSummary, ChatSide } from '@/types/chat';

export interface UseChatRoomReturn {
  meta: ChatConversationMeta | null;
  summary: ChatConversationSummary | null;
  mySide: ChatSide | null;
  readCursor: string | null;
  isLoading: boolean;
  error: Error | null;
}

function findSummary(
  data: InfiniteData<ChatConversationSummary[]> | undefined,
  conversationId: string
): ChatConversationSummary | null {
  for (const page of data?.pages ?? []) {
    const hit = page.find((c) => c.conversationId === conversationId);
    if (hit) return hit;
  }
  return null;
}

export function useChatRoom(conversationId: string | null): UseChatRoomReturn {
  const queryClient = useQueryClient();
  const uid = useAuthStore((s) => s.user?.uid);
  const enabled = !!conversationId && !!uid;
  const id = conversationId ?? '';
  const user = uid ?? '';

  const metaQuery = useQuery({
    queryKey: queryKeys.chat.conversation(id, user),
    queryFn: () => chatRepository.getConversation(id),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const readQuery = useQuery({
    queryKey: queryKeys.chat.readState(id, user),
    queryFn: () => chatRepository.getReadCursor(id),
    enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  });

  const summary = findSummary(
    queryClient.getQueryData<InfiniteData<ChatConversationSummary[]>>(queryKeys.chat.list(user)),
    id
  );
  const meta = metaQuery.data ?? null;
  const mySide: ChatSide | null =
    summary?.mySide ?? (meta && uid ? (meta.seekerId === uid ? 'seeker' : 'employer') : null);

  return {
    meta,
    summary,
    mySide,
    readCursor: readQuery.data ?? null,
    isLoading: enabled && metaQuery.isLoading,
    error: (metaQuery.error as Error | null) ?? null,
  };
}
