/**
 * P1 public pages tests
 * Unauthenticated users can browse the public jobs surface and protected actions stay on the web install flow.
 */
import { test, expect } from '@playwright/test';

const PUBLIC_SEED_JOB_ID = 'seed-job-urgent-001';
const PUBLIC_SEED_JOB_TITLE = '긴급 딜러 모집';

test.describe('퍼블릭 페이지', () => {
  test('공개 공고 목록 페이지 접근 가능', async ({ page }) => {
    await page.goto('/jobs', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: '구인공고' })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('공개 공고 상세 페이지에서 비로그인 사용자도 공고를 볼 수 있다', async ({ page }) => {
    await page.goto(`/jobs/${PUBLIC_SEED_JOB_ID}`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(PUBLIC_SEED_JOB_TITLE).last()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '지원하기' })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('공개 공고 상세에서 지원하기 클릭 시 설치 유도 모달이 열린다', async ({ page }) => {
    await page.goto(`/jobs/${PUBLIC_SEED_JOB_ID}`, { waitUntil: 'domcontentloaded' });

    const applyButton = page.getByRole('button', { name: '지원하기' });
    await expect(applyButton).toBeVisible({ timeout: 10_000 });
    await applyButton.click();

    await expect(page.getByText('UNIQN 앱에서 계속 이용할 수 있어요')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole('button', { name: '앱 설치' })).toBeVisible({ timeout: 10_000 });
    expect(page.url()).toContain(`/jobs/${PUBLIC_SEED_JOB_ID}`);
  });

  test('존재하지 않는 공고 경로도 앱이 깨지지 않고 렌더된다', async ({ page }) => {
    await page.goto('/jobs/nonexistent-job-id-12345', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#root')).toBeAttached({ timeout: 10_000 });
    await expect(page.locator('body')).not.toBeEmpty();
    expect(page.url()).toContain('/jobs/nonexistent-job-id-12345');
  });
});
