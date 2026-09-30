/**
 * 내가 관리하는 UNIQN 공고 — 대회↔공고 연결 피커용(모바일 PostingPickerSheet → useMyJobPostings 대응).
 *
 * ⚠️ `job_postings` 는 active·capacity_full·closed 가 **전원 조회 가능**(RLS job_postings_select_all)이라
 *    필터 없이 읽으면 남의 공고까지 나온다. 모바일은 활성 워크스페이스로 거르고, 웹은 **내 소유 +
 *    내가 속한 워크스페이스**로 명시 필터한다(서버 ops_set_tournament_posting 가 최종 권한 게이트).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { handleSupabaseError } from '@/lib/supabaseUtils';

export interface ManagedPosting {
  id: string;
  title: string;
  status: string;
}

/** 모바일 관리 목록과 같은 상태 3종(capacity_full 누락 시 정원 찬 공고가 사라진다). */
const MANAGED_STATUSES = ['active', 'capacity_full', 'closed'] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PostgREST `or` 필터 — 내 소유 공고 ∪ 내 워크스페이스 공고.
 * 필터 문자열에 값이 그대로 들어가므로 UUID 가 아닌 값은 거부한다(필터 주입 방지).
 */
export function buildManagedFilter(userId: string, workspaceIds: readonly string[]): string {
  const ids = [userId, ...workspaceIds];
  if (!ids.every((id) => UUID_RE.test(id))) throw new Error('UUID 가 아닌 식별자');
  return [
    `owner_id.eq.${userId}`,
    ...(workspaceIds.length > 0 ? [`workspace_id.in.(${workspaceIds.join(',')})`] : []),
  ].join(',');
}

export async function fetchManagedPostings(
  client: SupabaseClient,
  userId: string
): Promise<ManagedPosting[]> {
  // 서버 is_workspace_member 와 같은 정의: 워크스페이스 소유자(workspaces.owner_id) ∪ 멤버.
  // 소유자는 workspace_members 에 행이 없다(enum workspace_role = editor 뿐).
  const [members, owned] = await Promise.all([
    client.from('workspace_members').select('workspace_id').eq('user_id', userId),
    client.from('workspaces').select('id').eq('owner_id', userId),
  ]);
  if (members.error) {
    handleSupabaseError(members.error, {
      operation: '내 워크스페이스 조회',
      table: 'workspace_members',
    });
  }
  if (owned.error) {
    handleSupabaseError(owned.error, { operation: '내 워크스페이스 조회', table: 'workspaces' });
  }
  const workspaceIds = [
    ...new Set([
      ...(members.data ?? []).map((m) => m.workspace_id as string),
      ...(owned.data ?? []).map((w) => w.id as string),
    ]),
  ];

  const { data, error } = await client
    .from('job_postings')
    .select('id, title, status')
    .in('status', MANAGED_STATUSES)
    .or(buildManagedFilter(userId, workspaceIds))
    .order('created_at', { ascending: false });
  if (error) handleSupabaseError(error, { operation: '관리 공고 조회', table: 'job_postings' });
  return (data ?? []) as ManagedPosting[];
}
