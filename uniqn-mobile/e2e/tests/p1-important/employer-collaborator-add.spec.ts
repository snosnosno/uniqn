/**
 * E2E — employer 가 공고에 협업자를 추가
 *
 * 시나리오:
 * 1. qa-employer 로 로그인 (storageState)
 * 2. service_role 로 자기 공고 사전 시드
 * 3. /(employer)/my-postings/{id}/collaborators 진입
 * 4. 이메일 검색 → qa-collaborator 선택 → 추가
 * 5. "현재 협업자" 섹션에 1명 표시 + collaborator 이름 가시
 *
 * 사전 요구:
 * - supabase/seed.sql 의 qa-collaborator 페르소나 시드 적용 (CI 자동, 로컬은 `supabase db reset`)
 * - E2E_SUPABASE_SERVICE_ROLE_KEY 환경 변수
 */

import { expect, test, type Page } from '@playwright/test';
import { getAdminClient } from '../../helpers/supabase-admin';
import { ensureE2EWorkspace } from '../../helpers/workspace-seed';
import { TEST_ACCOUNTS } from '../../fixtures/test-accounts';

async function waitForReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('body').waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(500);
}

test.describe('Employer Collaborator Add', () => {
  let jobPostingId: string;

  test.beforeEach(async () => {
    const admin = getAdminClient();
    if (!admin) throw new Error('E2E_SUPABASE_SERVICE_ROLE_KEY 필요');

    const workDate = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const workspaceId = await ensureE2EWorkspace(admin, TEST_ACCOUNTS.employer.uid);
    const { data, error } = await admin
      .from('job_postings')
      .insert({
        title: 'e2e collab add posting',
        status: 'active',
        workspace_id: workspaceId,
        owner_id: TEST_ACCOUNTS.employer.uid,
        owner_name: TEST_ACCOUNTS.employer.displayName,
        posting_type: 'regular',
        work_date: workDate,
        work_dates: [workDate],
        total_positions: 2,
        filled_positions: 0,
        view_count: 0,
        schema_version: 3,
        description: 'E2E — collaborator add scenario',
        contact_phone: '+82109999999',
        location: {
          name: '테스트포커룸',
          district: '강남구',
          detailedAddress: '테스트로 100',
        },
        schedule: {
          kind: 'dated',
          primaryDate: workDate,
          allDates: [workDate],
          requirements: [
            {
              date: workDate,
              timeSlots: [
                {
                  startTime: '18:00',
                  roles: [{ role: 'dealer', count: 2, filled: 0 }],
                },
              ],
            },
          ],
        },
      })
      .select('id')
      .single();
    if (error || !data) throw error ?? new Error('job_postings 시드 실패');
    jobPostingId = data.id;
  });

  test.afterEach(async () => {
    const admin = getAdminClient();
    if (admin && jobPostingId) {
      // job_posting_collaborators 는 FK CASCADE 로 자동 정리됨
      await admin.from('job_postings').delete().eq('id', jobPostingId);
    }
  });

  // 2026-05-19 fix: my-postings/[id]/_layout 의 isManageableByUser client guard
  // 제거 → RLS-only. employer (owner) 가 collaborators 페이지 진입 시 더 이상
  // false redirect 안 됨 (이미 통과해야 했으나 layout 의 useWorkspaces race 로
  // userWorkspaceIds=[] 인 첫 frame 에 isManageableByUser=false 가 잡혔던 추정).
  test('employer 가 collaborator 를 추가하면 "현재 협업자" 섹션에 표시된다', async ({ page }) => {
    await page.goto(`/my-postings/${jobPostingId}/collaborators`);
    await waitForReady(page);

    // 협업자 추가 섹션 + 검색 입력
    await expect(page.getByText('협업자 추가')).toBeVisible({ timeout: 10_000 });
    const searchInput = page.getByPlaceholder(/이메일로 검색/);
    await searchInput.fill('qa-coll');

    // 디바운스 (COLLABORATOR_LIMITS.SEARCH_DEBOUNCE_MS=300ms 기본)
    await page.waitForTimeout(800);

    // 검색 결과 후보 — qa-collaborator 이메일 표시
    const candidateRow = page.getByText(TEST_ACCOUNTS.collaborator.email);
    await expect(candidateRow).toBeVisible({ timeout: 10_000 });

    // "추가" 버튼 클릭 → mutation 발사
    await page.getByText('추가').first().click();

    // toast 성공 또는 "현재 협업자" 섹션의 collaborator displayName 표시
    await expect(page.getByText('현재 협업자')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(TEST_ACCOUNTS.collaborator.displayName)).toBeVisible({
      timeout: 10_000,
    });
  });
});
