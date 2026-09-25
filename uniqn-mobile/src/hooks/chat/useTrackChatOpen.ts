/**
 * `chat_open` 계측 — 방 화면(기존 방·새 방) 마운트당 1회
 *
 * 사용자당 시간당 240건 상한을 모든 이벤트가 나눠 쓰므로 재렌더·재조회마다 보내면 안 된다
 * (선례: 공고 상세 job_view 의 ref 가드). method 는 진입점(src 파라미터)이고, 모르는 값이면 'list'.
 */
import { useEffect, useRef } from 'react';
import { trackEvent } from '@/services/observability/analyticsService';
import { chatUuidSchema } from '@/schemas/chat.schema';
import type { ChatOpenMethod } from '@/types/chat';

const METHODS: ReadonlySet<string> = new Set<ChatOpenMethod>([
  'job_detail',
  'work_tab',
  'applicants',
  'posting_tile',
  'board_tab',
  'list',
]);

export function toChatOpenMethod(src: string | undefined): ChatOpenMethod {
  return src && METHODS.has(src) ? (src as ChatOpenMethod) : 'list';
}

export function useTrackChatOpen(jobPostingId: string | null, src: string | undefined): void {
  const trackedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!jobPostingId || trackedRef.current === jobPostingId) return;
    // 계측 테이블은 보존 기한이 없다 — uuid 가 아닌 값(조작된 딥링크의 자유 텍스트)은 싣지 않는다
    if (!chatUuidSchema.safeParse(jobPostingId).success) return;
    trackedRef.current = jobPostingId;
    void trackEvent('chat_open', { job_id: jobPostingId, method: toChatOpenMethod(src) });
  }, [jobPostingId, src]);
}
