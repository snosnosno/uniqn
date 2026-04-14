import { expect, test, type Locator, type Page } from '@playwright/test';
import { createTestJob } from '../../factories';
import { createCompletedWorkLog, createTestWorkLog } from '../../factories/work-log.factory';
import { deleteDocument, seedDocument } from '../../helpers/firebase-admin';

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

// TODO(T-W5): firebase-admin stub no-op 제거 후 Supabase seedSupabase 기반으로 재작성하며 .skip 해제
test.describe.skip('구인자 정산 관리', () => {
  test.setTimeout(60_000);

  let testJob: ReturnType<typeof createTestJob>;

  test.beforeAll(async () => {
    testJob = createTestJob({ title: '정산관리 테스트공고', status: 'active' });
    await seedDocument('jobPostings', testJob.id, testJob);
  });

  test.afterAll(async () => {
    await deleteDocument('jobPostings', testJob.id);
  });

  test('공고 상세에서 정산 관리 화면으로 이동한다', async ({ page }) => {
    await page.goto(`/my-postings/${testJob.id}`, { waitUntil: 'domcontentloaded' });
    await waitForReady(page);

    const settlementAction = page.locator('button:visible', { hasText: /정산 관리/ }).first();
    await expect(settlementAction).toBeVisible();
    await settlementAction.click();
    await page.waitForURL(/settlements/, { timeout: 15_000 });
    await expect(page.getByRole('tab', { name: /^정산$/ }).first()).toBeVisible();
  });

  test('정산 화면은 요약 또는 필터 UI를 보여준다', async ({ page }) => {
    const pendingWorkLog = createTestWorkLog({
      jobPostingId: testJob.id,
      staffName: '정산요약테스트 스태프',
      payrollStatus: 'pending',
    });
    const completedWorkLog = createCompletedWorkLog({
      jobPostingId: testJob.id,
      staffName: '정산완료테스트 스태프',
    });

    await seedDocument('workLogs', pendingWorkLog.id, pendingWorkLog);
    await seedDocument('workLogs', completedWorkLog.id, completedWorkLog);

    try {
      await page.goto(`/my-postings/${testJob.id}/settlements`, { waitUntil: 'domcontentloaded' });
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
      await deleteDocument('workLogs', pendingWorkLog.id);
      await deleteDocument('workLogs', completedWorkLog.id);
    }
  });

  test('일괄 정산 선택 모드를 토글할 수 있다', async ({ page }) => {
    const workLog = createTestWorkLog({
      jobPostingId: testJob.id,
      staffName: '일괄정산 테스트',
      payrollStatus: 'pending',
    });
    await seedDocument('workLogs', workLog.id, workLog);

    try {
      await page.goto(`/my-postings/${testJob.id}/settlements`, { waitUntil: 'domcontentloaded' });
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
      await deleteDocument('workLogs', workLog.id);
    }
  });

  test('개별 근무기록에서 정산 상세 UI가 열린다', async ({ page }) => {
    const workLog = createTestWorkLog({
      jobPostingId: testJob.id,
      staffName: '정산상세 테스트',
      payrollStatus: 'pending',
    });
    await seedDocument('workLogs', workLog.id, workLog);

    try {
      await page.goto(`/my-postings/${testJob.id}/settlements`, { waitUntil: 'domcontentloaded' });
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
      await deleteDocument('workLogs', workLog.id);
    }
  });
});
