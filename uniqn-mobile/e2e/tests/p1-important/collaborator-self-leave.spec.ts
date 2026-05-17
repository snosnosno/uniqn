/**
 * E2E — collaborator 자가 나가기 → "공유받은 공고" 에서 제거
 *
 * 시나리오:
 * 1. service_role 로 사전 시드: qa-employer 의 공고 + qa-collaborator JPC 등록
 * 2. qa-collaborator 로 로그인 (storageState)
 * 3. /(employer)/my-postings/{id}/collaborators 진입
 * 4. "나가기" 버튼 클릭 → leaveSelf 실행
 * 5. /(app)/(tabs)/employer 로 이동 시 "공유받은 공고" 에서 해당 공고 사라짐
 *
 * 사전 요구:
 * - qa-collaborator 페르소나 시드 (CI 자동, 로컬은 `supabase db reset`)
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

test.describe('Collaborator Self Leave', () => {
  let jobPostingId: string;

  test.beforeEach(async () => {
    const admin = getAdminClient();
    if (!admin) throw new Error('E2E_SUPABASE_SERVICE_ROLE_KEY 필요');

    const workDate = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const workspaceId = await ensureE2EWorkspace(admin, TEST_ACCOUNTS.employer.uid);
    const { data: jp, error: jpErr } = await admin
      .from('job_postings')
      .insert({
        title: 'e2e self leave posting',
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
        description: 'E2E — self-leave scenario',
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
    if (jpErr || !jp) throw jpErr ?? new Error('job_postings 시드 실패');
    jobPostingId = jp.id;

    const { error: jpcErr } = await admin.from('job_posting_collaborators').insert({
      job_posting_id: jobPostingId,
      user_id: TEST_ACCOUNTS.collaborator.uid,
      added_by: TEST_ACCOUNTS.employer.uid,
    });
    if (jpcErr) throw jpcErr;
  });

  test.afterEach(async () => {
    const admin = getAdminClient();
    if (admin && jobPostingId) {
      await admin.from('job_postings').delete().eq('id', jobPostingId);
    }
  });

  test('collaborator 가 "나가기" 버튼 클릭 후 공유받은 공고에서 사라진다', async ({ page }) => {
    // 1) 협업자 관리 페이지 (collaborator 시점 — owner 아님)
    await page.goto(`/my-postings/${jobPostingId}/collaborators`);
    await waitForReady(page);

    // 본인 행의 "나가기" 버튼 (accessibilityLabel="공고 관리에서 나가기")
    const leaveButton = page.getByRole('button', { name: '공고 관리에서 나가기' });
    await expect(leaveButton).toBeVisible({ timeout: 10_000 });
    await leaveButton.click();

    // 2) employer 탭에서 해당 공고가 "공유받은 공고" 에서 사라짐
    await page.goto('/(app)/(tabs)/employer');
    await waitForReady(page);

    // 시드한 제목이 보이지 않아야 함 (Realtime 으로 자동 invalidate)
    await expect(page.getByText('e2e self leave posting')).toHaveCount(0, { timeout: 15_000 });
  });
});
