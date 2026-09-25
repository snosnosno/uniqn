/**
 * (공고, 구직자) 의 기존 방 찾기 — `new` 화면이 이미 있는 방으로 바꿀지 판단한다
 *
 * RLS SELECT 라 구인자 측에게는 메시지 없는 남의 빈 방이 안 보인다(S1 정책) — 그런 경우엔
 * 새 방 화면이 뜨고, 첫 전송 때 open RPC 가 기존 방 id 를 멱등으로 돌려준다.
 */
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { chatRepository } from '@/repositories/chat';
import { useAuthStore } from '@/stores/authStore';

export function useChatLookup(postingId: string | null, seekerId: string | null) {
  const uid = useAuthStore((s) => s.user?.uid);
  const seeker = seekerId ?? uid ?? null;
  const enabled = !!uid && !!postingId && !!seeker;

  const query = useQuery({
    queryKey: queryKeys.chat.lookup(uid ?? '', postingId ?? '', seeker ?? ''),
    queryFn: () => chatRepository.findConversation(postingId as string, seeker as string),
    enabled,
    staleTime: 0,
  });

  return {
    conversationId: query.data ?? null,
    isLoading: enabled && query.isLoading,
    error: (query.error as Error | null) ?? null,
  };
}
