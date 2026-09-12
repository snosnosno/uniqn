/**
 * P3 공지 (사용자 측) 테스트 (4 tests)
 * 프로젝트: chromium (staff storageState)
 *
 * ⚠️ 공지는 더 이상 독립 화면이 아니다 — `/notices` 는 소통 탭의 공지로,
 *    `/notices/[id]` 는 `/board/post/<boardNoticePostId>` 로 **리다이렉트**된다
 *    (`app/(app)/notices/index.tsx` · `[id].tsx`). 그래서 헤더는 "공지사항"이 아니라
 *    "소통"이고, 상세 URL 도 `/notices/...` 가 아니다.
 *    eslint ignores 에 `e2e/` 가 있어 `npm run quality` 가 이 어긋남을 못 잡는다.
 */
import { test, expect } from '../../fixtures/base.fixture';

test.describe('공지 (사용자)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/notices', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
  });

  test('공지 경로는 소통 탭의 공지로 리다이렉트된다', async ({ page }) => {
    await page.waitForURL(/\/board\/notice$/, { timeout: 10_000 });
    await expect(page.getByText('소통').first()).toBeVisible();
    await expect(page.getByLabel('공지 탭')).toBeVisible();
  });

  test('공지 빈 상태 → 안내 메시지 표시', async ({ page }) => {
    // 공지가 없으면 빈 상태 표시, 있으면 목록 표시
    const emptyTitle = page.getByText('공지사항이 없습니다');
    const emptyDesc = page.getByText('새로운 공지사항이 등록되면 알려드릴게요');

    const hasEmpty = await emptyTitle.isVisible().catch(() => false);
    if (hasEmpty) {
      await expect(emptyDesc).toBeVisible();
    }
  });

  test('공지 목록에 카드가 있으면 클릭 → 게시글 상세로 이동', async ({ page }) => {
    await page.waitForURL(/\/board\/notice$/, { timeout: 10_000 });

    const firstCard = page.locator('[role="button"]').first();
    const hasCards = await firstCard.isVisible().catch(() => false);

    if (hasCards) {
      await firstCard.click();
      // 상세는 `/board/post/<id>` 다 — 구 `/notices/<id>` 는 리다이렉트 경유 경로일 뿐이다
      await page.waitForURL(/\/board\/post\//, { timeout: 5_000 });
      await expect(page.getByText('소통').first()).toBeVisible();
    }
  });

  test('공지 상세 → 카테고리 배지 및 메타 정보 표시', async ({ page }) => {
    await page.waitForURL(/\/board\/notice$/, { timeout: 10_000 });

    const firstCard = page.locator('[role="button"]').first();
    const hasCards = await firstCard.isVisible().catch(() => false);

    if (hasCards) {
      await firstCard.click();
      await page.waitForURL(/\/board\/post\//, { timeout: 5_000 });

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
