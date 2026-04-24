import { expect, test, type Locator, type Page } from '@playwright/test';
import { getAdminClient } from '../../helpers/supabase-admin';
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
  const settlementTab = page.getByRole('tab', { name: /^정산$/ });
  if ((await settlementTab.count().catch(() => 0)) > 0) {
    await settlementTab.first().click();
  }
}

async function seedJobPosting(title: string): Promise<string> {
  const admin = getAdminClient();
  if (!admin) throw new Error('E2E_SUPABASE_SERVICE_ROLE_KEY 필요 — job_postings 시드 불가');

  const workDate = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);

  const { data, error } = await admin
    .from('job_postings')
    .insert({
      title,
      status: 'active',
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
        name: '테스트포커룸',
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

  test('공고 상세에서 정산 관리 화면으로 이동한다', async ({ page }) => {
    await page.goto(`/my-postings/${testJobId}`, { waitUntil: 'domcontentloaded' });
    await waitForReady(page);

    const settlementAction = page.locator('button:visible', { hasText: /정산 관리/ }).first();
    await expect(settlementAction).toBeVisible();
    await settlementAction.click();
    await page.waitForURL(/settlements/, { timeout: 15_000 });
    await expect(page.getByRole('tab', { name: /^정산$/ }).first()).toBeVisible();
  });

  test('정산 화면은 요약 또는 필터 UI를 보여준다', async ({ page }) => {
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

      await expectAnyVisible(
        [
          page.getByRole('tab', { name: /미정산/ }),
          page.getByRole('tab', { name: /완료/ }),
          page.getByText(/정산요약테스트 스태프|정산완료테스트 스태프/),
        ],
        15_000
      );
    } finally {
      await cleanupWorkLog(pendingId);
      await cleanupWorkLog(completedId);
    }
  });

  test('일괄 정산 선택 모드를 토글할 수 있다', async ({ page }) => {
    const workLogId = await seedWorkLog(
      testJobId,
      TEST_ACCOUNTS.staff.uid,
      '일괄정산 테스트',
      'pending'
    );

    try {
      await page.goto(`/my-postings/${testJobId}/settlements`, { waitUntil: 'domcontentloaded' });
      await waitForReady(page);
      await openSettlementTab(page);

      const batchButton = page.getByText(/일괄 정산 선택|선택 취소/).first();
      if (await batchButton.isVisible().catch(() => false)) {
        await batchButton.click();
        await expect(page.getByText(/선택 취소|전체 선택|일괄 정산/).first()).toBeVisible({
          timeout: 10_000,
        });
      }
    } finally {
      await cleanupWorkLog(workLogId);
    }
  });

  test('개별 근무기록에서 정산 상세 UI가 열린다', async ({ page }) => {
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

      const card = page.locator('[aria-label*="정산 상세 보기"]:visible').first();
      await expect(card).toBeVisible({ timeout: 10_000 });
      await card.click();

      await expectAnyVisible(
        [
          page.getByText('정산 상세', { exact: true }),
          page.getByLabel(/정산 금액 수정/),
          page.getByLabel(/정산하기/),
          page.getByText('정산 금액', { exact: true }),
        ],
        10_000
      );
    } finally {
      await cleanupWorkLog(workLogId);
    }
  });
});
