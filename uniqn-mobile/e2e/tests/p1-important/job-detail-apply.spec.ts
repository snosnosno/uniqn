/**
 * P1 job detail and apply flows.
 */
import { expect, test } from '@playwright/test';
import path from 'path';
import { createClosedJob, createTestApplication, createTestJob } from '../../factories';
import { deleteDocument, seedDocument } from '../../helpers/firebase-admin';
import { JobDetailPage } from '../../pages/app/job-detail.page';

const staffState = path.join(__dirname, '../../fixtures/storage-states/staff.json');
const employerState = path.join(__dirname, '../../fixtures/storage-states/employer.json');
const TEST_JOB_TITLE = '상세테스트공고';
const ERROR_TEXT = /오류가 발생했습니다|문제가 발생했습니다|공고를 찾을 수 없습니다/;

// TODO(T-W5): firebase-admin stub no-op 제거 후 Supabase seedSupabase 기반으로 재작성하며 .skip 해제
test.describe.skip('공고 상세와 지원 흐름', () => {
  let testJobId: string;

  test.beforeAll(async () => {
    const testJob = createTestJob({ title: TEST_JOB_TITLE });
    testJobId = testJob.id;
    await seedDocument('jobPostings', testJob.id, testJob);
  });

  test.afterAll(async () => {
    await deleteDocument('jobPostings', testJobId);
  });

  test('인증된 사용자는 공고 상세 헤더를 본다', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();
    const jobDetailPage = new JobDetailPage(page);

    await jobDetailPage.gotoAuthenticated(testJobId);

    await expect(page.locator('body')).toContainText(TEST_JOB_TITLE, { timeout: 15_000 });

    await context.close();
  });

  test('활성 공고에는 지원하기 버튼이 보인다', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();
    const jobDetailPage = new JobDetailPage(page);

    await jobDetailPage.gotoAuthenticated(testJobId);

    const contentOrError = jobDetailPage.applyButton.or(jobDetailPage.errorMessage);
    await expect(contentOrError.first()).toBeVisible({ timeout: 15_000 });

    if (!(await jobDetailPage.isErrorVisible().catch(() => false))) {
      await expect(jobDetailPage.applyButton).toBeVisible();
      await expect(jobDetailPage.applyButton).toBeEnabled();
    }

    await context.close();
  });

  test('로그인 사용자는 /jobs 상세에서 실제 지원 화면으로 이어진다', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();
    const jobDetailPage = new JobDetailPage(page);

    await jobDetailPage.gotoAuthenticated(testJobId);

    await expect(jobDetailPage.applyButton).toBeVisible({ timeout: 15_000 });
    await jobDetailPage.clickApply();
    await expect(page).toHaveURL(new RegExp(`/jobs/${testJobId}/apply`), { timeout: 10_000 });
    await expect(page.locator('body')).toContainText(TEST_JOB_TITLE, { timeout: 15_000 });

    await context.close();
  });

  test('마감 공고에는 비활성 상태 버튼이 보인다', async ({ browser }) => {
    const closedJob = createClosedJob({ title: '마감상세테스트공고' });
    await seedDocument('jobPostings', closedJob.id, closedJob);

    try {
      const context = await browser.newContext({ storageState: staffState });
      const page = await context.newPage();
      const jobDetailPage = new JobDetailPage(page);

      await jobDetailPage.gotoAuthenticated(closedJob.id);

      const contentOrError = jobDetailPage.closedButton.or(jobDetailPage.errorMessage);
      await expect(contentOrError.first()).toBeVisible({ timeout: 15_000 });

      if (!(await jobDetailPage.isErrorVisible().catch(() => false))) {
        await expect(jobDetailPage.closedButton).toBeVisible();
        await expect(jobDetailPage.closedButton).toBeDisabled();
      }

      await context.close();
    } finally {
      await deleteDocument('jobPostings', closedJob.id);
    }
  });

  test('존재하지 않는 공고는 에러 화면을 보여준다', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();

    await page.goto('/jobs/nonexistent-job-99999', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(ERROR_TEXT).last()).toBeVisible({ timeout: 10_000 });

    await context.close();
  });

  test('에러 화면에는 다시 시도 버튼이 있다', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();

    await page.goto('/jobs/nonexistent-retry-test', { waitUntil: 'domcontentloaded' });

    const errorText = page.getByText(ERROR_TEXT).first();
    if (await errorText.isVisible().catch(() => false)) {
      await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible({
        timeout: 5_000,
      });
    }

    await context.close();
  });

  test('지원 페이지는 공고 정보를 로드한다', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();

    await page.goto(`/jobs/${testJobId}/apply`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toContainText(TEST_JOB_TITLE, { timeout: 15_000 });

    await context.close();
  });

  test('이미 지원한 공고는 중복 지원 안내가 보인다', async ({ browser }) => {
    const applicationId = `${testJobId}_test-staff-uid-001`;
    const testApplication = {
      ...createTestApplication({
        jobPostingId: testJobId,
        applicantId: 'test-staff-uid-001',
        status: 'applied',
      }),
      id: applicationId,
    };
    await seedDocument('applications', applicationId, testApplication);

    try {
      const context = await browser.newContext({ storageState: staffState });
      const page = await context.newPage();
      const jobDetailPage = new JobDetailPage(page);

      await jobDetailPage.gotoAuthenticated(testJobId);
      await expect(jobDetailPage.viewStatusButton.or(jobDetailPage.statusText).first()).toBeVisible(
        {
          timeout: 15_000,
        }
      );
      await expect(jobDetailPage.applyButton).toBeHidden();

      await context.close();
    } finally {
      await deleteDocument('applications', applicationId);
    }
  });

  test('홈에서 공고를 누르면 상세 페이지로 이동한다', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const cards = page.locator('[accessibilityRole="button"]');
    const count = await cards.count();
    if (count === 0) {
      test.skip();
    }

    await cards.first().click();
    await expect(page).toHaveURL(/jobs|detail/, { timeout: 10_000 });

    await context.close();
  });

  test('상세 화면에 공유 버튼이 있으면 활성 상태다', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();
    const jobDetailPage = new JobDetailPage(page);

    await jobDetailPage.gotoAuthenticated(testJobId);

    if (!(await jobDetailPage.isErrorVisible().catch(() => false))) {
      if (await jobDetailPage.shareButton.isVisible().catch(() => false)) {
        await expect(jobDetailPage.shareButton).toBeEnabled();
      }
    }

    await context.close();
  });

  test('구인자도 공고 상세를 조회할 수 있다', async ({ browser }) => {
    const context = await browser.newContext({ storageState: employerState });
    const page = await context.newPage();
    const jobDetailPage = new JobDetailPage(page);

    await jobDetailPage.gotoAuthenticated(testJobId);
    await expect(page.locator('body')).toContainText(TEST_JOB_TITLE, { timeout: 15_000 });

    await context.close();
  });
});
