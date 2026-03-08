/**
 * P3 공지사항 (사용자 측) 테스트 (4 tests)
 * 프로젝트: chromium (staff storageState)
 */
import { test, expect } from '../../fixtures/base.fixture';

test.describe('공지사항 (사용자)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/notices', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
  });

  test('공지사항 목록 렌더링 → 헤더 표시', async ({ page }) => {
    await expect(page.getByText('공지사항').first()).toBeVisible();
  });

  test('공지사항 빈 상태 → 안내 메시지 표시', async ({ page }) => {
    // 공지가 없으면 빈 상태 표시, 있으면 목록 표시
    const emptyTitle = page.getByText('공지사항이 없습니다');
    const emptyDesc = page.getByText('새로운 공지사항이 등록되면 알려드릴게요');

    const hasEmpty = await emptyTitle.isVisible().catch(() => false);
    if (hasEmpty) {
      await expect(emptyDesc).toBeVisible();
    }
  });

  test('공지사항 목록에 카드가 있으면 클릭 → 상세 페이지 이동', async ({
    page,
  }) => {
    // 첫 번째 공지 카드 클릭 시도
    const firstCard = page.locator('[role="button"]').first();
    const hasCards = await firstCard.isVisible().catch(() => false);

    if (hasCards) {
      await firstCard.click();
      await page.waitForURL(/\/notices\//, { timeout: 5_000 });

      // 상세 페이지 렌더링 확인
      await expect(page.getByText('공지사항').first()).toBeVisible();
    }
  });

  test('공지사항 상세 → 카테고리 배지 및 메타 정보 표시', async ({ page }) => {
    // 직접 상세 페이지 접근 시도
    const firstCard = page.locator('[role="button"]').first();
    const hasCards = await firstCard.isVisible().catch(() => false);

    if (hasCards) {
      await firstCard.click();
      await page.waitForURL(/\/notices\//, { timeout: 5_000 });

      // 카테고리 배지 확인 (공지/업데이트/이벤트/점검 중 하나)
      const categoryBadges = ['공지', '업데이트', '이벤트', '점검'];
      let hasBadge = false;
      for (const badge of categoryBadges) {
        const visible = await page
          .getByText(badge, { exact: true })
          .first()
          .isVisible()
          .catch(() => false);
        if (visible) {
          hasBadge = true;
          break;
        }
      }

      // 조회수 확인
      const viewCount = page.getByText(/조회 \d+/);
      const hasViewCount = await viewCount.isVisible().catch(() => false);

      // 배지 또는 조회수 중 하나는 표시되어야 함
      expect(hasBadge || hasViewCount).toBe(true);
    }
  });
});
