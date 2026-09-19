import { test, expect } from '../../fixtures/base.fixture';

test.describe('소통 사용자 흐름', () => {
  test('일정과 공지만 제공하고 커뮤니티 게시판은 노출하지 않는다', async ({ page, basePage }) => {
    await page.goto('/board', { waitUntil: 'domcontentloaded' });
    await basePage.waitForReady();

    await page.waitForURL(/\/board\/schedule$/, { timeout: 10_000 });
    await expect(page.getByText('소통').first()).toBeVisible();
    await expect(page.getByLabel('일정 탭')).toBeVisible();
    await expect(page.getByLabel('공지 탭')).toBeVisible();
    await expect(page.getByLabel('자유 탭')).toHaveCount(0);
    await expect(page.getByLabel('TDA 탭')).toHaveCount(0);
    await expect(page.getByLabel('대타 탭')).toHaveCount(0);

    await page.getByLabel('공지 탭').click();
    await page.waitForURL(/\/board\/notice$/, { timeout: 10_000 });
    await expect(page.getByText('소통').first()).toBeVisible();
  });

  test('지원하지 않는 소통 경로는 안내 화면을 표시한다', async ({ page, basePage }) => {
    await page.goto('/board/free', { waitUntil: 'domcontentloaded' });
    await basePage.waitForReady();

    await expect(page.getByText(/소통 화면을 찾을 수 없/)).toBeVisible();
  });
});
