/**
 * E2E 테스트용 workspace 시드 헬퍼.
 *
 * 2026-05-14 migration 으로 `job_postings.workspace_id NOT NULL` 전환되어
 * job_postings 시드 전에 workspace 가 사전 보장되어야 한다.
 *
 * 본 헬퍼는 (owner_id, name) 매칭으로 멱등 — 동일 owner 의 'E2E 테스트 워크스페이스'
 * 가 이미 있으면 재사용. job_postings 시드 시 반환된 workspace_id 를 함께 INSERT.
 *
 * 2026-05-17 race fix: Playwright workers=4 병렬 환경에서 같은 owner 로 다중
 * `ensureE2EWorkspace` 가 동시 INSERT 하면 duplicate workspaces 생성됨.
 * 후속 SELECT 가 `.maybeSingle()` 에 다중 row 매칭으로 fail. workspaces 에
 * (owner_id, name) unique 제약이 없어 INSERT 자체는 막을 수 없음 → 읽기 측
 * `.order().limit(1)` 로 가장 오래된 것 1건 deterministic 선택.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const E2E_TEST_WORKSPACE_NAME = 'E2E 테스트 워크스페이스';

/**
 * 주어진 owner 의 E2E 워크스페이스를 보장하고 ID 반환 (멱등 + race-safe).
 *
 * @throws workspace SELECT/INSERT 실패 시 (admin client 권한/네트워크 문제 등)
 */
export async function ensureE2EWorkspace(
  adminClient: SupabaseClient,
  ownerId: string
): Promise<string> {
  // race-safe: limit(1) + order 로 다중 duplicate 시에도 deterministic 선택
  const { data: existingRows, error: selectError } = await adminClient
    .from('workspaces')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('name', E2E_TEST_WORKSPACE_NAME)
    .order('created_at', { ascending: true })
    .limit(1);

  if (selectError) {
    throw new Error(`workspace SELECT 실패: ${selectError.message}`);
  }
  if (existingRows && existingRows.length > 0 && existingRows[0]?.id) {
    return existingRows[0].id as string;
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
    // race: 동시에 다른 worker 가 INSERT 했을 가능성 — 재SELECT 로 회복
    const { data: retryRows } = await adminClient
      .from('workspaces')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('name', E2E_TEST_WORKSPACE_NAME)
      .order('created_at', { ascending: true })
      .limit(1);
    if (retryRows && retryRows.length > 0 && retryRows[0]?.id) {
      return retryRows[0].id as string;
    }
    throw new Error(`workspace 시드 실패: ${error?.message ?? '응답 데이터 없음'}`);
  }
  return data.id as string;
}
