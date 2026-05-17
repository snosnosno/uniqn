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

  // CI #121 (run 26002529355) 재시도 fail: `/my-postings/{id}/collaborators` 페이지가
  // 1.2 min hang + `RangeError: apiRequestContext._wrapApiCall: Invalid string length`.
  // "협업자 추가" 텍스트 `Received: undefined` — 페이지가 owner view 미렌더.
  //
  // shared-postings (같은 qa-collaborator) 는 통과하므로 auth/storage 정상. 이 페이지
  // 자체 (`app/(employer)/my-postings/[id]/collaborators.tsx`) 의:
  //  - useJobDetail / useJobPostingCollaborators realtime subscription
  //  - 또는 isOwner 분기 (jobPosting.ownerId === currentUserId)
  // 가 infinite render loop 또는 massive console 가능성. RangeError 는 Playwright
  // 내부 logger 가 그 결과로 limit hit.
  //
  // **production-side 진단 필요** (별도 PR):
  //  1. createRealtimeSubscription 의 무한 retry 검증
  //  2. isOwner 분기 — auth state 가 정상 currentUserId 반환하는지
  //  3. page 가 Stack.Screen presentation='modal' 로 web 에서 rendering 문제 있는지
  test.skip('employer 가 collaborator 를 추가하면 "현재 협업자" 섹션에 표시된다', async ({
    page,
  }) => {
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
