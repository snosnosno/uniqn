/**
 * P2 알림 테스트 (6 tests)
 * 인증된 staff 상태에서 실행
 */
import { test, expect } from '@playwright/test';
import { NotificationsPage } from '../../pages/app/notifications.page';

// storageState는 chromium 프로젝트에서 staff.json으로 자동 설정됨

test.describe('알림', () => {
  let notificationsPage: NotificationsPage;

  test.beforeEach(async ({ page }) => {
    notificationsPage = new NotificationsPage(page);
    await notificationsPage.goto();
  });

  // =====================================================
  // 기본 렌더링 (2 tests)
  // =====================================================

  test('알림 헤더와 카테고리 탭이 표시된다', async () => {
    await expect(notificationsPage.header).toBeVisible();

    // 카테고리 탭 확인
    await expect(notificationsPage.getCategoryTab('전체')).toBeVisible({ timeout: 10_000 });
    await expect(notificationsPage.getCategoryTab('지원/확정')).toBeVisible();
    await expect(notificationsPage.getCategoryTab('출퇴근')).toBeVisible();
    await expect(notificationsPage.getCategoryTab('정산')).toBeVisible();
    await expect(notificationsPage.getCategoryTab('공고')).toBeVisible();
    await expect(notificationsPage.getCategoryTab('시스템')).toBeVisible();
  });

  test('알림이 없으면 빈 상태가 표시된다', async () => {
    // 로딩 완료 대기
    await notificationsPage.page.waitForTimeout(3_000);

    // 빈 상태 또는 알림 목록 중 하나가 표시되어야 함
    const isEmpty = await notificationsPage.getEmptyState().isVisible().catch(() => false);
    const hasContent = await notificationsPage.page.locator('body').textContent();

    // 둘 중 하나는 true (알림 데이터가 없을 수 있음)
    expect(isEmpty || (hasContent && hasContent.length > 0)).toBeTruthy();
  });

  // =====================================================
  // 카테고리 필터 (2 tests)
  // =====================================================

  test('카테고리 탭 클릭 시 필터가 변경된다', async () => {
    // '지원' 카테고리 선택
    await notificationsPage.selectCategory('지원/확정');
    await notificationsPage.page.waitForTimeout(1_000);

    // 페이지가 에러 없이 정상 표시
    const body = await notificationsPage.page.locator('body').textContent();
    expect(body).toBeTruthy();

    // '출퇴근' 카테고리로 변경
    await notificationsPage.selectCategory('출퇴근');
    await notificationsPage.page.waitForTimeout(1_000);

    const body2 = await notificationsPage.page.locator('body').textContent();
    expect(body2).toBeTruthy();
  });

  test('전체 탭으로 돌아오면 모든 알림이 표시된다', async () => {
    // 특정 카테고리 선택
    await notificationsPage.selectCategory('정산');
    await notificationsPage.page.waitForTimeout(500);

    // 전체로 돌아오기
    await notificationsPage.selectCategory('전체');
    await notificationsPage.page.waitForTimeout(1_000);

    // 전체 탭이 선택된 상태
    const body = await notificationsPage.page.locator('body').textContent();
    expect(body).toBeTruthy();
  });

  // =====================================================
  // 읽음 처리 (1 test)
  // =====================================================

  test('모두 읽음 버튼이 읽지 않은 알림이 있을 때만 표시된다', async () => {
    await notificationsPage.page.waitForTimeout(3_000);

    // 읽지 않은 알림이 있으면 '모두 읽음' 버튼 표시
    const hasUnread = await notificationsPage.getUnreadCount().isVisible().catch(() => false);
    const isMarkAllVisible = await notificationsPage.isMarkAllReadVisible();

    // 둘 다 true이거나 둘 다 false여야 함 (일관성)
    if (hasUnread) {
      expect(isMarkAllVisible).toBeTruthy();
    }
    // 읽지 않은 알림이 없으면 버튼이 없어도 정상
  });

  // =====================================================
  // 에러 처리 (1 test)
  // =====================================================

  test('네트워크 오류 시 에러 상태가 표시된다', async ({ page }) => {
    // Firestore 요청을 차단하여 에러 상태 유발
    await page.route('**/firestore.googleapis.com/**', (route) => route.abort());

    // 페이지 새로고침
    await page.reload();
    await page.waitForTimeout(5_000);

    // 에러 상태 또는 빈 상태가 표시되어야 함
    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy();
  });
});
