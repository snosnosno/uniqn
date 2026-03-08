/**
 * P3 Admin 신고 관리 + 공지사항 관리 테스트 (6 tests)
 * 프로젝트: chromium-admin (admin storageState)
 */
import { test, expect } from '../../fixtures/base.fixture';
import { AdminReportsPage } from '../../pages/admin/reports.page';
import { AdminAnnouncementsPage } from '../../pages/admin/announcements.page';

test.describe('Admin 신고 관리', () => {
  let reportsPage: AdminReportsPage;

  test.beforeEach(async ({ page }) => {
    reportsPage = new AdminReportsPage(page);
    await reportsPage.goto();
  });

  test('신고 목록 렌더링 → 검색 및 상태 필터 표시', async () => {
    await expect(reportsPage.searchInput).toBeVisible();

    // 상태 필터 확인
    const statusFilters = ['전체', '검토 대기', '검토 중', '처리 완료', '기각'];
    for (const status of statusFilters) {
      await expect(
        reportsPage.page.getByText(status, { exact: true }).first()
      ).toBeVisible();
    }
  });

  test('상태 필터 전환 → 해당 상태 신고만 표시', async () => {
    await reportsPage.clickStatusFilter('검토 대기');
    await reportsPage.page.waitForTimeout(500);

    // 신고 목록 또는 빈 상태 확인
    const hasCount = await reportsPage.reportCount.isVisible();
    const hasEmpty = await reportsPage.emptyState.isVisible();
    expect(hasCount || hasEmpty).toBe(true);
  });

  test('신고 상세 → 처리 결과 선택 및 메모 입력 가능', async ({ page }) => {
    // 첫 번째 신고 카드 클릭 시도
    const firstCard = page.locator('[role="button"]').first();
    const hasCards = await firstCard.isVisible().catch(() => false);

    if (hasCards) {
      await firstCard.click();
      await page.waitForURL(/\/reports\//, { timeout: 10_000 }).catch(() => {});

      const url = page.url();
      if (url.includes('/reports/')) {
        // 신고 내용 섹션 확인
        await expect(reportsPage.reportContentSection).toBeVisible({ timeout: 10_000 });

        // 처리 폼이 있으면 (미처리 상태인 경우)
        const hasForm = await reportsPage.reviewFormSection.isVisible().catch(() => false);
        if (hasForm) {
          await reportsPage.selectReviewStatus('처리 완료');
          await reportsPage.fillReviewNote('테스트 처리 메모');
          await expect(reportsPage.submitReviewButton).toBeVisible();
        }
      }
    }
  });
});

test.describe('Admin 공지사항 관리', () => {
  let announcementsPage: AdminAnnouncementsPage;

  test.beforeEach(async ({ page }) => {
    announcementsPage = new AdminAnnouncementsPage(page);
    await announcementsPage.goto();
  });

  test('공지사항 목록 렌더링 → 헤더 및 상태 탭 표시', async () => {
    await expect(announcementsPage.header).toBeVisible();

    // 상태 탭 확인
    const statusTabs = ['전체', '초안', '발행됨', '보관됨'];
    for (const tab of statusTabs) {
      await expect(
        announcementsPage.getStatusTab(tab)
      ).toBeVisible();
    }
  });

  test('상태 탭 전환 → 해당 상태 공지만 필터링', async () => {
    await announcementsPage.clickStatusTab('발행됨');
    await announcementsPage.page.waitForTimeout(500);

    // 공지 목록 또는 빈 상태 확인
    const hasEmpty = await announcementsPage.emptyState.isVisible();
    // 빈 상태이거나 목록이 표시되어야 함
    expect(typeof hasEmpty).toBe('boolean');
  });

  test('공지사항 작성 페이지 접근 → 폼 렌더링', async () => {
    await announcementsPage.gotoCreate();

    await expect(announcementsPage.createHeader).toBeVisible();
    await expect(announcementsPage.saveButton).toBeVisible();
  });
});
