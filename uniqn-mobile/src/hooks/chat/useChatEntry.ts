/**
 * 채팅 진입점 공용 훅 — 공고 상세·WorkTab·지원자 행이 같은 방식으로 방을 연다
 *
 * 방은 여기서 만들지 않는다. `new` 화면이 기존 방을 찾아 있으면 그 방으로 바꾸고, 없으면
 * 빈 방을 보여 주다가 **첫 전송 때** 연다(빈 방 남발 방지 — 설계 §8).
 */
import { useCallback } from 'react';
import { router } from 'expo-router';
import { useChatEnabled } from './useChatEnabled';
import type { ChatOpenMethod } from '@/types/chat';

export interface OpenChatParams {
  postingId: string;
  /** 구인자가 지원자에게 걸 때 지원자 uid. 구직자 본인이면 생략 */
  seekerId?: string | null;
  method: ChatOpenMethod;
}

export function useChatEntry() {
  const { enabled } = useChatEnabled();

  const openChat = useCallback(
    ({ postingId, seekerId, method }: OpenChatParams) => {
      if (!enabled) return;
      router.push({
        pathname: '/(app)/chat/new',
        params: seekerId ? { postingId, seekerId, src: method } : { postingId, src: method },
      });
    },
    [enabled]
  );

  return { enabled, openChat };
}
