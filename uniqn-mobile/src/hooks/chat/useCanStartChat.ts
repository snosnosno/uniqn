/**
 * 공고 상세 '채팅' 버튼을 보여 줄지 — 서버 chat_open_conversation 의 거부 조건을 클라에서 먼저 거른다
 *
 * 서버는 구인자 측(소유자 · 공고의 워크스페이스 멤버 · 공고 협업자 — S1 `chat_is_employer_side`)이
 * 자기 공고에 "문의"하는 것을 막는다. 소유자만 거르면 매니저·협업자는 버튼을 눌러 첫 메시지를
 * 보낸 뒤에야 "내 공고에는 문의할 수 없습니다" 실패 말풍선을 본다(코드 리뷰 M3).
 * 게시 상태도 서버 허용 목록과 같게 둔다.
 */
import { useMemo } from 'react';
import { useWorkspaces } from '@/hooks/workspace/useWorkspaces';
import { useSharedJobPostings } from '@/hooks/job-posting/useSharedJobPostings';

/** 채팅방을 열 수 있는 공고 상태 — 서버 chat_open_conversation 의 허용 목록과 같다 */
const CHAT_OPENABLE_STATUSES: ReadonlySet<string> = new Set([
  'approved',
  'active',
  'capacity_full',
  'closed',
]);

export interface CanStartChatJob {
  id: string;
  status: string;
  ownerId?: string | null;
  workspaceId?: string | null;
}

export function useCanStartChat(job: CanStartChatJob | null, uid: string | null): boolean {
  const { workspaces } = useWorkspaces();
  const { sharedPostings } = useSharedJobPostings();

  return useMemo(() => {
    if (!job || !uid) return false;
    if (!CHAT_OPENABLE_STATUSES.has(job.status)) return false;
    if (job.ownerId === uid) return false;
    if (job.workspaceId && workspaces.some((w) => w.id === job.workspaceId)) return false;
    if (sharedPostings.some((p) => p.jobPostingId === job.id)) return false;
    return true;
  }, [job, uid, workspaces, sharedPostings]);
}
