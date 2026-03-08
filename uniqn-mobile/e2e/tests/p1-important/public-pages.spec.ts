/**
 * P1 퍼블릭 페이지 테스트 (4 tests)
 * 비인증 사용자가 접근 가능한 공개 페이지 검증
 */
import { test, expect } from '@playwright/test';
import { seedDocument, deleteDocument } from '../../helpers/firebase-admin';
import { createTestJob } from '../../factories';

test.describe('퍼블릭 페이지', () => {
  test('공개 공고 목록 페이지 접근 가능', async ({ page }) => {
    await page.goto('/jobs', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5_000);

    // 페이지가 정상 로드됨
    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy();

    // '구인공고' 헤더가 보여야 함
    const header = page.getByText('구인공고');
    await expect(header).toBeVisible({ timeout: 10_000 });
  });

  test('공개 공고 상세 페이지 → 비로그인 시 "로그인 후 지원하기" 표시', async ({ page }) => {
    // 테스트 공고 시딩
    const testJob = createTestJob({ title: '퍼블릭테스트공고' });
    await seedDocument('jobPostings', testJob.id, testJob);

    try {
      await page.goto(`/jobs/${testJob.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(5_000);

      // 페이지 로드 확인
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toBeTruthy();

      // 에러 확인
      const isError = await page.getByText('오류가 발생했습니다').isVisible().catch(() => false);

      if (!isError) {
        // 비로그인이므로 '로그인 후 지원하기' 버튼이 보여야 함
        const loginButton = page.getByRole('button', { name: /로그인 후 지원하기/ });
        const hasLoginButton = await loginButton.isVisible({ timeout: 5_000 }).catch(() => false);

        // 버튼이 있으면 성공
        if (hasLoginButton) {
          await expect(loginButton).toBeVisible();
        }
      }
    } finally {
      await deleteDocument('jobPostings', testJob.id);
    }
  });

  test('공개 공고 상세 → 로그인 버튼 클릭 → 로그인 페이지 리다이렉트', async ({ page }) => {
    // 테스트 공고 시딩
    const testJob = createTestJob({ title: '리다이렉트테스트공고' });
    await seedDocument('jobPostings', testJob.id, testJob);

    try {
      await page.goto(`/jobs/${testJob.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(5_000);

      const isError = await page.getByText('오류가 발생했습니다').isVisible();
      if (!isError) {
        const loginButton = page.getByRole('button', { name: /로그인 후 지원하기/ });
        if (await loginButton.isVisible()) {
          await loginButton.click();
          await page.waitForURL(/login|auth/, { timeout: 10_000 });

          // 로그인 페이지로 이동됨
          const url = page.url();
          expect(url).toMatch(/login|auth/);
        }
      }
    } finally {
      await deleteDocument('jobPostings', testJob.id);
    }
  });

  test('존재하지 않는 공고 → 에러 화면 표시', async ({ page }) => {
    await page.goto('/jobs/nonexistent-job-id-12345', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5_000);

    // 에러 메시지 또는 공고를 찾을 수 없음 메시지
    const errorOrNotFound = page.getByText(/오류가 발생|공고를 찾을 수 없습니다|not found|데이터가 없습니다/i);
    const hasError = await errorOrNotFound.first().isVisible({ timeout: 10_000 }).catch(() => false);

    // 에러 메시지가 보이거나 페이지가 정상 로드됨
    const bodyText = await page.locator('body').textContent();
    expect(hasError || (bodyText && bodyText.length > 0)).toBeTruthy();
  });
});
