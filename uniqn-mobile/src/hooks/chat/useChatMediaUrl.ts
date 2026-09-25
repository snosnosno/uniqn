/**
 * 채팅 사진 서명 URL — TTL 5분(보안 리뷰 L9). 만료 1분 전부터는 stale 이라 다시 그릴 때 새로 받는다.
 *
 * 읽기 전용 조회라 Repository 를 직접 부른다(CLAUDE.md 아키텍처 예외).
 * 말풍선의 expo-image 는 cacheKey 를 경로로 두므로 **네이티브는** URL 이 바뀌어도 이미지를 다시 받지 않는다.
 * ⚠️ 웹은 cacheKey 를 지원하지 않아 URL 이 갱신되면 다시 내려받는다. 말풍선마다 서명을 따로 요청한다 —
 *    계획 §3-3 의 묶음 서명(createSignedUrls)은 사진이 많은 방의 요청 수가 문제 될 때 후속 과제.
 */
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { chatRepository } from '@/repositories/chat';
import { useAuthStore } from '@/stores/authStore';
import { CHAT_SIGNED_URL_TTL_SEC } from '@/constants/chat';

const REFRESH_BEFORE_MS = 60_000;
const STALE_MS = CHAT_SIGNED_URL_TTL_SEC * 1000 - REFRESH_BEFORE_MS;

export interface UseChatMediaUrlResult {
  url: string | null;
  isError: boolean;
}

export function useChatMediaUrl(imagePath: string | null): UseChatMediaUrlResult {
  const uid = useAuthStore((s) => s.user?.uid) ?? '';
  const query = useQuery({
    queryKey: queryKeys.chat.media(imagePath ?? '', uid),
    queryFn: () => chatRepository.createSignedImageUrl(imagePath ?? '', CHAT_SIGNED_URL_TTL_SEC),
    enabled: !!imagePath && !!uid,
    staleTime: STALE_MS,
    gcTime: CHAT_SIGNED_URL_TTL_SEC * 1000,
    refetchOnWindowFocus: false,
  });
  return { url: query.data ?? null, isError: query.isError };
}
