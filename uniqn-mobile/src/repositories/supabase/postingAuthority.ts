/**
 * UNIQN Mobile — 공고 권한(authority) 단일 판정
 *
 * @description 공고/근무기록 쓰기 권한을 한 곳에서 판정한다.
 * prod RLS 실측(2026-07-10)과 앱레이어를 일치시킨다.
 *
 *   job_postings UPDATE : is_workspace_member OR is_posting_collaborator OR is_admin
 *   work_logs    UPDATE : owner_id OR is_workspace_member OR is_posting_collaborator (admin 없음)
 *
 * admin 은 이 모듈이 다루지 않는다. 호출부가 명시적으로 거부한다(PR3-A.2):
 * 후속 RLS 에 admin 분기가 없어 UPDATE 가 0행 silent no-op 이 되고
 * caller 가 false success 를 인식하기 때문이다.
 *
 * 호출 비용: owner 면 RPC 0회, 멤버면 1회, 협업자/외부인이면 2회.
 */
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/utils/supabase';

const TABLE = 'job_postings';

export interface PostingAuthority {
  isPostingOwner: boolean;
  isWorkspaceMember: boolean;
  isPostingCollaborator: boolean;
}

export interface ResolveAuthorityInput {
  jobPostingId: string;
  workspaceId: string;
  postingOwnerId: string;
  actorId: string;
  operation: string;
}

/**
 * 액터의 공고 권한 플래그를 해석한다. owner 는 RPC 없이 즉시 반환(short-circuit).
 */
export async function resolvePostingAuthority(
  input: ResolveAuthorityInput
): Promise<PostingAuthority> {
  const { jobPostingId, workspaceId, postingOwnerId, actorId, operation } = input;

  if (postingOwnerId === actorId) {
    return { isPostingOwner: true, isWorkspaceMember: false, isPostingCollaborator: false };
  }

  const memberResult = await supabase.rpc('is_workspace_member', {
    _workspace_id: workspaceId,
    _user_id: actorId,
  });
  if (memberResult.error) handleSupabaseError(memberResult.error, { operation, table: TABLE });
  if (memberResult.data === true) {
    return { isPostingOwner: false, isWorkspaceMember: true, isPostingCollaborator: false };
  }

  const collaboratorResult = await supabase.rpc('is_posting_collaborator', {
    p_posting_id: jobPostingId,
    p_user_id: actorId,
  });
  if (collaboratorResult.error) {
    handleSupabaseError(collaboratorResult.error, { operation, table: TABLE });
  }

  return {
    isPostingOwner: false,
    isWorkspaceMember: false,
    isPostingCollaborator: collaboratorResult.data === true,
  };
}

/** 공고 수정·마감·재오픈·정산설정 및 근무기록 쓰기 역량. admin 은 포함하지 않는다. */
export function canManagePosting(authority: PostingAuthority): boolean {
  return authority.isPostingOwner || authority.isWorkspaceMember || authority.isPostingCollaborator;
}
