/**
 * E2E 테스트용 workspace 시드 헬퍼.
 *
 * 2026-05-14 migration 으로 `job_postings.workspace_id NOT NULL` 전환되어
 * job_postings 시드 전에 workspace 가 사전 보장되어야 한다.
 *
 * 본 헬퍼는 (owner_id, name) 매칭으로 멱등 — 동일 owner 의 'E2E 테스트 워크스페이스'
 * 가 이미 있으면 재사용. job_postings 시드 시 반환된 workspace_id 를 함께 INSERT.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const E2E_TEST_WORKSPACE_NAME = 'E2E 테스트 워크스페이스';

/**
 * 주어진 owner 의 E2E 워크스페이스를 보장하고 ID 반환 (멱등).
 *
 * @throws workspace SELECT/INSERT 실패 시 (admin client 권한/네트워크 문제 등)
 */
export async function ensureE2EWorkspace(
  adminClient: SupabaseClient,
  ownerId: string
): Promise<string> {
  const { data: existing, error: selectError } = await adminClient
    .from('workspaces')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('name', E2E_TEST_WORKSPACE_NAME)
    .maybeSingle();

  if (selectError) {
    throw new Error(`workspace SELECT 실패: ${selectError.message}`);
  }
  if (existing?.id) {
    return existing.id as string;
  }

  const { data, error } = await adminClient
    .from('workspaces')
    .insert({
      name: E2E_TEST_WORKSPACE_NAME,
      owner_id: ownerId,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw new Error(`workspace 시드 실패: ${error?.message ?? '응답 데이터 없음'}`);
  }
  return data.id as string;
}
