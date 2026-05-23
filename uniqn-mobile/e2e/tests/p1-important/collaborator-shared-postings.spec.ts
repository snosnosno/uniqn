/**
 * E2E — collaborator 시점 "공유받은 공고" 섹션 표시
 *
 * 시나리오:
 * 1. service_role 로 사전 시드: qa-employer 의 공고 + qa-collaborator JPC 등록
 * 2. qa-collaborator 로 로그인 (storageState)
 * 3. /(app)/(tabs)/employer 탭 진입
 * 4. "공유받은 공고" 섹션 + 해당 공고 가시
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

test.describe('Collaborator Shared Postings', () => {
  let jobPostingId: string;

  test.beforeEach(async () => {
    const admin = getAdminClient();
    if (!admin) throw new Error('E2E_SUPABASE_SERVICE_ROLE_KEY 필요');

    const workDate = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const workspaceId = await ensureE2EWorkspace(admin, TEST_ACCOUNTS.employer.uid);
    const { data: jp, error: jpErr } = await admin
      .from('job_postings')
      .insert({
        title: 'e2e shared posting',
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
        description: 'E2E — shared posting scenario',
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

  test('collaborator 시점 employer 탭에 "공유받은 공고" 섹션 + 해당 공고 표시', async ({
    page,
  }) => {
    await page.goto('/(app)/(tabs)/employer');
    await waitForReady(page);

    // "공유받은 공고 (1)" 섹션 헤더
    await expect(page.getByText(/공유받은 공고/)).toBeVisible({ timeout: 10_000 });
    // 시드한 공고 카드
    await expect(page.getByText('e2e shared posting')).toBeVisible({ timeout: 10_000 });
  });
});
