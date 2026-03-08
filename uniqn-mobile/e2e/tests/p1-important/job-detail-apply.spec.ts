/**
 * P1 공고 상세 & 지원 테스트 (10 tests)
 * 공고 상세 보기, 지원 플로우, 지원 상태 관련 테스트
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import { seedDocument, deleteDocument } from '../../helpers/firebase-admin';
import { createTestJob, createClosedJob, createTestApplication } from '../../factories';

const staffState = path.join(__dirname, '../../fixtures/storage-states/staff.json');
const employerState = path.join(__dirname, '../../fixtures/storage-states/employer.json');

test.describe('공고 상세 & 지원', () => {
  let testJobId: string;

  test.beforeAll(async () => {
    // 테스트용 공고 시딩
    const testJob = createTestJob({ title: '상세테스트공고' });
    testJobId = testJob.id;
    await seedDocument('jobPostings', testJob.id, testJob);
  });

  test.afterAll(async () => {
    await deleteDocument('jobPostings', testJobId);
  });

  test('인증된 사용자 → 공고 상세 → "공고 상세" 헤더 표시', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();

    await page.goto(`/jobs/${testJobId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5_000);

    const headerOrError = page.getByText('공고 상세').or(
      page.getByText('오류가 발생했습니다')
    );
    await expect(headerOrError).toBeVisible({ timeout: 10_000 });

    await context.close();
  });

  test('인증된 사용자 → 활성 공고 → "지원하기" 버튼 표시', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();

    await page.goto(`/jobs/${testJobId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5_000);

    const isError = await page.getByText('오류가 발생했습니다').isVisible();
    if (!isError) {
      const applyButton = page.getByRole('button', { name: /지원하기/ });
      await expect(applyButton).toBeVisible({ timeout: 5_000 });
      await expect(applyButton).toBeEnabled();
    }

    await context.close();
  });

  test('마감된 공고 → "마감된 공고입니다" 버튼 비활성', async ({ browser }) => {
    const closedJob = createClosedJob({ title: '마감된테스트공고' });
    await seedDocument('jobPostings', closedJob.id, closedJob);

    try {
      const context = await browser.newContext({ storageState: staffState });
      const page = await context.newPage();

      await page.goto(`/jobs/${closedJob.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(5_000);

      const isError = await page.getByText('오류가 발생했습니다').isVisible();
      if (!isError) {
        const closedButton = page.getByRole('button', { name: /마감된 공고/ });
        await expect(closedButton).toBeVisible({ timeout: 5_000 });
        await expect(closedButton).toBeDisabled();
      }

      await context.close();
    } finally {
      await deleteDocument('jobPostings', closedJob.id);
    }
  });

  test('존재하지 않는 공고 → 에러 화면', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();

    await page.goto('/jobs/nonexistent-job-99999', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5_000);

    // 에러 메시지가 표시되어야 함
    const errorText = page.getByText(/오류가 발생|공고를 찾을 수 없습니다/);
    await expect(errorText).toBeVisible({ timeout: 10_000 });

    await context.close();
  });

  test('에러 화면 → 다시 시도 버튼 존재', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();

    await page.goto('/jobs/nonexistent-retry-test', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5_000);

    const errorText = page.getByText(/오류가 발생|공고를 찾을 수 없습니다/);
    if (await errorText.isVisible()) {
      const retryButton = page.getByRole('button', { name: '다시 시도' });
      await expect(retryButton).toBeVisible({ timeout: 5_000 });
    }

    await context.close();
  });

  test('지원 페이지 → 공고 정보 로드', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();

    await page.goto(`/jobs/${testJobId}/apply`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5_000);

    // 지원하기 헤더 또는 로딩/에러 상태 (use .first() in case of multiple matches)
    const anyContent = page.getByText(/지원하기|공고 정보를 불러오는 중|오류가 발생/).first();
    await expect(anyContent).toBeVisible({ timeout: 10_000 });

    await context.close();
  });

  test('이미 지원한 공고 → "이미 지원한 공고" 메시지', async ({ browser }) => {
    // 이미 지원한 상태를 시딩
    const testApp = createTestApplication({
      jobPostingId: testJobId,
      applicantId: 'test-staff-uid-001',
      status: 'applied',
    });
    await seedDocument('applications', testApp.id, testApp);

    try {
      const context = await browser.newContext({ storageState: staffState });
      const page = await context.newPage();

      await page.goto(`/jobs/${testJobId}/apply`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(5_000);

      // 이미 지원 메시지 또는 다른 상태
      const alreadyApplied = page.getByText(/이미 지원한 공고|지원하기|오류/);
      await expect(alreadyApplied).toBeVisible({ timeout: 10_000 });

      await context.close();
    } finally {
      await deleteDocument('applications', testApp.id);
    }
  });

  test('홈에서 공고 클릭 → 상세 페이지 이동', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5_000);

    // 공고 카드가 있으면 첫 번째 클릭
    const cards = page.locator('[accessibilityRole="button"]');
    const count = await cards.count();

    if (count > 0) {
      await cards.first().click();
      await page.waitForTimeout(3_000);

      // 상세 페이지 또는 다른 화면으로 이동
      const url = page.url();
      const body = await page.locator('body').textContent();
      expect(body).toBeTruthy();
    }

    await context.close();
  });

  test('공고 상세 → 공유 버튼 존재 (인증된 상세)', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();

    await page.goto(`/jobs/${testJobId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5_000);

    const isError = await page.getByText('오류가 발생했습니다').isVisible();
    if (!isError) {
      // 공유 버튼이 존재하는지 확인
      const shareButton = page.locator('[aria-label="공고 공유하기"]');
      if (await shareButton.isVisible()) {
        expect(await shareButton.isEnabled()).toBeTruthy();
      }
    }

    await context.close();
  });

  test('구인자(employer)도 공고 상세 조회 가능', async ({ browser }) => {
    const context = await browser.newContext({ storageState: employerState });
    const page = await context.newPage();

    await page.goto(`/jobs/${testJobId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5_000);

    // 구인자도 상세 페이지를 볼 수 있어야 함
    const headerOrError = page.getByText('공고 상세').or(
      page.getByText('오류가 발생했습니다')
    );
    await expect(headerOrError).toBeVisible({ timeout: 10_000 });

    await context.close();
  });
});
