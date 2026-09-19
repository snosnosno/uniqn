import { expect, test, type Locator, type Page } from '@playwright/test';
import { getAdminClient } from '../../helpers/supabase-admin';
import { ensureE2EWorkspace } from '../../helpers/workspace-seed';
import { TEST_ACCOUNTS } from '../../fixtures/test-accounts';

async function waitForReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  const loading = page.getByText(/로딩 중|데이터를 불러오는 중/).first();
  await loading.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  await loading.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
}

async function expectAnyVisible(locators: Locator[], timeout = 10_000): Promise<void> {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    for (const locator of locators) {
      const count = await locator.count().catch(() => 0);

      for (let index = 0; index < count; index += 1) {
        if (
          await locator
            .nth(index)
            .isVisible()
            .catch(() => false)
        ) {
          return;
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error('Expected at least one locator to become visible');
}

async function openSettlementTab(page: Page): Promise<void> {
  // 구인자 IA S2 — 탭 이름이 `정산` 에서 `금액` 으로 바뀌었다.
  const settlementTab = page.getByRole('tab', { name: /^금액$/ });
  if ((await settlementTab.count().catch(() => 0)) > 0) {
    await settlementTab.first().click();
  }
}

async function seedJobPosting(title: string): Promise<string> {
  const admin = getAdminClient();
  if (!admin) throw new Error('E2E_SUPABASE_SERVICE_ROLE_KEY 필요 — job_postings 시드 불가');

  const workDate = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  const workspaceId = await ensureE2EWorkspace(admin, TEST_ACCOUNTS.employer.uid);

  const { data, error } = await admin
    .from('job_postings')
    .insert({
      title,
      status: 'active',
      workspace_id: workspaceId,
      owner_id: TEST_ACCOUNTS.employer.uid,
      owner_name: TEST_ACCOUNTS.employer.displayName,
      work_date: workDate,
      work_dates: [workDate],
      posting_type: 'regular',
      total_positions: 2,
      filled_positions: 0,
      view_count: 0,
      schema_version: 3,
      description: `E2E 테스트 공고 — ${title}`,
      contact_phone: '+82101234567',
      location: {
        name: '테스트홀덤펍',
        district: '강남구',
        detailedAddress: '테스트로 123',
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
      role_catalog: [{ role: 'dealer', salary: { type: 'daily', amount: 150000 } }],
      compensation: { mode: 'shared', defaultSalary: { type: 'daily', amount: 150000 } },
      questions: { items: [] },
      stats: {
        totalApplicants: 0,
        activeApplicants: 0,
        confirmedApplicants: 0,
        cancellationPendingApplicants: 0,
        filledPositions: 0,
      },
    })
    .select('id')
    .single();

  if (error) throw new Error(`job_postings INSERT 실패: ${error.message}`);
  return data.id as string;
}

async function cleanupJobPosting(id: string): Promise<void> {
  const admin = getAdminClient();
  await admin?.from('job_postings').delete().eq('id', id);
}

async function seedWorkLog(
  jobPostingId: string,
  staffId: string,
  staffName: string,
  payrollStatus: 'pending' | 'completed'
): Promise<string> {
  const admin = getAdminClient();
  if (!admin) throw new Error('E2E_SUPABASE_SERVICE_ROLE_KEY 필요 — work_logs 시드 불가');

  const workDate = '2026-04-01';

  const { data, error } = await admin
    .from('work_logs')
    .insert({
      job_posting_id: jobPostingId,
      staff_id: staffId,
      staff_name: staffName,
      owner_id: TEST_ACCOUNTS.employer.uid,
      date: workDate,
      check_in_ts: `${workDate}T18:00:00+09:00`,
      check_out_ts: `${workDate}T23:00:00+09:00`,
      status: payrollStatus === 'completed' ? 'completed' : 'checked_out',
      payroll_status: payrollStatus,
      role: 'dealer',
      ...(payrollStatus === 'completed'
        ? {
            payroll_amount: 150000,
            payroll_date: new Date().toISOString(),
          }
        : {}),
    })
    .select('id')
    .single();

  if (error) throw new Error(`work_logs INSERT 실패: ${error.message}`);
  return data.id as string;
}

async function cleanupWorkLog(id: string): Promise<void> {
  const admin = getAdminClient();
  await admin?.from('work_logs').delete().eq('id', id);
}

test.describe('구인자 정산 관리', () => {
  test.setTimeout(60_000);

  let testJobId: string;

  test.beforeAll(async () => {
    testJobId = await seedJobPosting('정산관리 테스트공고');
  });

  test.afterAll(async () => {
    await cleanupJobPosting(testJobId);
  });

  test('공고 상세 [근무] 타일에서 근무 화면으로 이동한다', async ({ page }) => {
    await page.goto(`/my-postings/${testJobId}`, { waitUntil: 'domcontentloaded' });
    await waitForReady(page);

    // 타일 이름이 `근무` 로 짧아져 텍스트로 찾으면 "근무 일정" 같은 문구와 섞인다 — testID 로 잡는다.
    const settlementAction = page
      .locator('[data-testid="job-posting-manage-settlements"]:visible')
      .first();
    await expect(settlementAction).toBeVisible();
    await settlementAction.click();
    await page.waitForURL(/settlements/, { timeout: 15_000 });
    await expect(page.getByRole('tab', { name: /^금액$/ }).first()).toBeVisible();
  });

  test('금액 탭은 지급 예정 합계를 보여준다', async ({ page }) => {
    const pendingId = await seedWorkLog(
      testJobId,
      TEST_ACCOUNTS.staff.uid,
      '정산요약테스트 스태프',
      'pending'
    );
    const completedId = await seedWorkLog(
      testJobId,
      TEST_ACCOUNTS.staff.uid,
      '정산완료테스트 스태프',
      'completed'
    );

    try {
      await page.goto(`/my-postings/${testJobId}/settlements`, { waitUntil: 'domcontentloaded' });
      await waitForReady(page);
      await openSettlementTab(page);

      // 지급 상태 필터(미정산/완료)는 구인자 IA S2 에서 없앴다 — 합계 한 줄과 사람별 카드만 남는다.
      await expectAnyVisible(
        [
          page.getByText('지급 예정 합계', { exact: true }),
          page.getByText(/정산요약테스트 스태프|정산완료테스트 스태프/),
        ],
        15_000
      );
    } finally {
      await cleanupWorkLog(pendingId);
      await cleanupWorkLog(completedId);
    }
  });

  // 구인자 IA S2 — 앱은 돈을 보내지 않는다. 일괄 정산·지급 완료 진입점이 없어야 한다.
  test('금액 탭에는 일괄 정산·지급 완료 진입점이 없다', async ({ page }) => {
    const workLogId = await seedWorkLog(
      testJobId,
      TEST_ACCOUNTS.staff.uid,
      '지급없음 테스트',
      'pending'
    );

    try {
      await page.goto(`/my-postings/${testJobId}/settlements`, { waitUntil: 'domcontentloaded' });
      await waitForReady(page);
      await openSettlementTab(page);

      // 대조군 — 화면이 실제로 그려진 뒤에 "없음" 을 본다(빈 화면에서의 0건은 증거가 아니다).
      await expect(page.getByText('지급 예정 합계', { exact: true }).first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText(/일괄 정산|지급 완료로 표시/)).toHaveCount(0);
    } finally {
      await cleanupWorkLog(workLogId);
    }
  });

  test('사람별 카드에서 계산 근거가 열린다', async ({ page }) => {
    const workLogId = await seedWorkLog(
      testJobId,
      TEST_ACCOUNTS.staff.uid,
      '정산상세 테스트',
      'pending'
    );

    try {
      await page.goto(`/my-postings/${testJobId}/settlements`, { waitUntil: 'domcontentloaded' });
      await waitForReady(page);
      await openSettlementTab(page);

      const card = page.locator('[aria-label*="근무 금액 상세 보기"]:visible').first();
      await expect(card).toBeVisible({ timeout: 10_000 });
      await card.click();

      await expectAnyVisible(
        [
          page.getByText('계산 근거', { exact: true }),
          page.getByLabel(/근무 금액 수정/),
          page.getByLabel(/^근무 수정$/),
        ],
        10_000
      );
    } finally {
      await cleanupWorkLog(workLogId);
    }
  });
});
