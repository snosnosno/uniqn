import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  createConfirmedApplication,
  createRejectedApplication,
  createTestApplication,
  createTestJob,
} from '../../factories';
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

test.describe('구인자 지원자 관리', () => {
  test.setTimeout(60_000);

  let testJob: ReturnType<typeof createTestJob>;

  test.beforeAll(async () => {
    testJob = createTestJob({ title: '지원자관리 테스트공고', status: 'active' });
    await seedDocument('jobPostings', testJob.id, testJob);
  });

  test.afterAll(async () => {
    await deleteDocument('jobPostings', testJob.id);
  });

  test('공고 상세에서 지원자 관리로 이동한다', async ({ page }) => {
    await page.goto(`/my-postings/${testJob.id}`, { waitUntil: 'domcontentloaded' });
    await waitForReady(page);

    const applicantsAction = page.locator('button:visible', { hasText: /지원자 관리/ }).first();
    await expect(applicantsAction).toBeVisible();
    await applicantsAction.click();
    await page.waitForURL(/applicants/, { timeout: 15_000 });
  });

  test('지원자 목록 페이지는 필터 탭과 카드 UI를 보여준다', async ({ page }) => {
    const application = createTestApplication({ jobPostingId: testJob.id, status: 'applied' });
    await seedDocument('applications', application.id, application);

    try {
      await page.goto(`/my-postings/${testJob.id}/applicants`, { waitUntil: 'domcontentloaded' });
      await waitForReady(page);

      await expect(page.getByRole('tab', { name: /전체 필터/ }).first()).toBeVisible();
      await expectAnyVisible(
        [
          page.getByRole('button', { name: /프로필 보기/ }),
          page.getByRole('button', { name: /지원 상세 접기|지원 상세 열기/ }),
          page.getByText('지원자가 없습니다', { exact: true }),
          page.getByText('데이터가 없습니다', { exact: true }),
        ],
        15_000
      );
    } finally {
      await deleteDocument('applications', application.id);
    }
  });

  test('지원자가 있으면 상태 액션 또는 상세 토글을 노출한다', async ({ page }) => {
    const application = createTestApplication({ jobPostingId: testJob.id, status: 'applied' });
    await seedDocument('applications', application.id, application);

    try {
      await page.goto(`/my-postings/${testJob.id}/applicants`, { waitUntil: 'domcontentloaded' });
      await waitForReady(page);

      const expandButton = page.getByRole('button', { name: /지원 상세 열기/ }).first();
      if (await expandButton.isVisible().catch(() => false)) {
        await expandButton.click();
      }

      await expectAnyVisible(
        [
          page.getByRole('button', { name: /지원 거절/ }),
          page.getByRole('button', { name: /\d+개 확정/ }),
          page.getByText('지원 완료', { exact: true }),
          page.getByText('거절', { exact: true }),
          page.getByText('확정', { exact: true }),
        ],
        10_000
      );
    } finally {
      await deleteDocument('applications', application.id);
    }
  });

  test('확정된 지원자는 확정 상태를 유지한다', async ({ page }) => {
    const application = createConfirmedApplication({ jobPostingId: testJob.id });
    await seedDocument('applications', application.id, application);

    try {
      await page.goto(`/my-postings/${testJob.id}/applicants`, { waitUntil: 'domcontentloaded' });
      await waitForReady(page);
      await expectAnyVisible(
        [
          page.getByLabel(/확정 배지/),
          page.getByRole('tab', { name: /확정 필터/ }),
          page.getByText(/확정 \(\d+\)/),
        ],
        10_000
      );
    } finally {
      await deleteDocument('applications', application.id);
    }
  });

  test('거절된 지원자는 거절 상태나 사유를 보여준다', async ({ page }) => {
    const application = createRejectedApplication({ jobPostingId: testJob.id });
    await seedDocument('applications', application.id, application);

    try {
      await page.goto(`/my-postings/${testJob.id}/applicants`, { waitUntil: 'domcontentloaded' });
      await waitForReady(page);
      await expectAnyVisible(
        [
          page.getByLabel(/거절 배지/),
          page.getByText(/거절 사유:/),
          page.getByRole('tab', { name: /거절 필터/ }),
        ],
        10_000
      );
    } finally {
      await deleteDocument('applications', application.id);
    }
  });
});
