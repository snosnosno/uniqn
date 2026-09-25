/**
 * 채팅 안 읽음 합계(99 캡) — 소통 탭 배지
 *
 * 플래그가 켜져 있고 로그인했을 때만 조회한다(비로그인이면 RPC 가 PERMISSION_DENIED).
 */
import { useQuery } from '@tanstack/react-query';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { chatRepository } from '@/repositories/chat';
import { useAuthStore } from '@/stores/authStore';

export function useChatUnreadTotal(enabled: boolean): number {
  const uid = useAuthStore((s) => s.user?.uid);
  const query = useQuery({
    queryKey: queryKeys.chat.unread(uid ?? ''),
    queryFn: () => chatRepository.getUnreadTotal(),
    enabled: enabled && !!uid,
    staleTime: cachingPolicies.realtime,
  });
  return enabled ? (query.data ?? 0) : 0;
}
