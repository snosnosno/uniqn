/**
 * P1 public pages tests
 * Unauthenticated users can browse the public jobs surface and protected actions stay on the web install flow.
 */
import path from 'path';
import { test, expect } from '@playwright/test';

const PUBLIC_SEED_JOB_ID = 'seed-job-urgent-001';
const PUBLIC_SEED_JOB_TITLE = '긴급 딜러 모집';
const staffState = path.join(__dirname, '../../fixtures/storage-states/staff.json');

test.describe('퍼블릭 페이지', () => {
  test('비로그인 /jobs 진입 → 로그인 페이지로 리다이렉트', async ({ page }) => {
    // a465d82c7 (2026-03-29) 이후 (public)/jobs 는 LegacyPublicJobsEntryRoute 로
    // 비로그인 사용자를 무조건 /(auth)/login 으로 redirect 한다.
    // 공개 목록은 더 이상 제공하지 않으며, 공개 상세(/jobs/:id) 만 비로그인 접근 가능.
    await page.goto('/jobs', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/login(?:[/?#]|$)/, { timeout: 10_000 });
  });

  test.skip('공개 공고 상세 페이지에서 비로그인 사용자도 공고를 볼 수 있다', async ({ page }) => {
    await page.goto(`/jobs/${PUBLIC_SEED_JOB_ID}`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(PUBLIC_SEED_JOB_TITLE).last()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '지원하기' })).toBeVisible({
      timeout: 10_000,
    });
  });

  test.skip('공개 공고 상세에서 지원하기 클릭 시 설치 유도 모달이 열린다', async ({ page }) => {
    await page.goto(`/jobs/${PUBLIC_SEED_JOB_ID}`, { waitUntil: 'domcontentloaded' });

    const applyButton = page.getByRole('button', { name: '지원하기' });
    await expect(applyButton).toBeVisible({ timeout: 10_000 });
    await applyButton.click();

    await expect(page.getByText('UNIQN 앱에서 계속 이용할 수 있어요')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole('button', { name: '로그인' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '앱 설치' })).toBeVisible({ timeout: 10_000 });
    expect(page.url()).toContain(`/jobs/${PUBLIC_SEED_JOB_ID}`);
  });

  test('로그인한 사용자는 /jobs 진입 시 실제 구인 페이지를 본다', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();

    await page.goto('/jobs', { waitUntil: 'domcontentloaded' });

    await expect(page).not.toHaveURL(/\/jobs(?:\/)?$/);
    await expect(page).toHaveURL(/\/(?:[?#].*)?$/);
    await expect(page.locator('input').first()).toBeVisible({ timeout: 10_000 });

    await context.close();
  });

  test('존재하지 않는 공고 경로도 앱이 깨지지 않고 렌더된다', async ({ page }) => {
    await page.goto('/jobs/nonexistent-job-id-12345', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#root')).toBeAttached({ timeout: 10_000 });
    await expect(page.locator('body')).not.toBeEmpty();
    expect(page.url()).toContain('/jobs/nonexistent-job-id-12345');
  });
});
