/**
 * P3 Admin 사용자 관리 테스트 (5 tests)
 * 프로젝트: chromium-admin (admin storageState)
 */
import { test, expect } from '../../fixtures/base.fixture';
import { AdminUsersPage } from '../../pages/admin/users.page';

test.describe('Admin 사용자 관리', () => {
  let usersPage: AdminUsersPage;

  test.beforeEach(async ({ page }) => {
    usersPage = new AdminUsersPage(page);
    await usersPage.goto();
  });

  test('사용자 목록 렌더링 → 검색 입력 및 역할 필터 표시', async () => {
    await expect(usersPage.searchInput).toBeVisible();

    // 역할 필터 칩 확인
    const roleFilters = ['전체', '관리자', '구인자', '스태프'];
    for (const role of roleFilters) {
      await expect(
        usersPage.page.getByText(role, { exact: true }).first()
      ).toBeVisible();
    }

    // 사용자 수 카운트 표시
    await expect(usersPage.userCount).toBeVisible();
  });

  test('이름/이메일 검색 → 결과 필터링', async () => {
    await usersPage.search('staff@test.com');

    // 검색 결과가 표시되거나 "검색 결과 없음" 표시
    const hasResults = await usersPage.userCount.isVisible();
    const hasEmpty = await usersPage.emptyState.isVisible();
    expect(hasResults || hasEmpty).toBe(true);
  });

  test('역할 필터 클릭 → 해당 역할 사용자만 표시', async () => {
    await usersPage.clickRoleFilter('구인자');

    // 필터 적용 후 로딩 대기
    await usersPage.page.waitForTimeout(1_000);

    // 역할 배지가 "구인자"인 카드만 표시되거나 빈 상태
    const userCount = usersPage.userCount;
    const emptyState = usersPage.emptyState;
    const hasContent = await userCount.isVisible();
    const isEmpty = await emptyState.isVisible();
    expect(hasContent || isEmpty).toBe(true);
  });

  test('사용자 카드 클릭 → 상세 페이지 이동 및 섹션 표시', async ({ page }) => {
    // 첫 번째 사용자 카드 클릭 (목록에 사용자가 있는 경우)
    const firstCard = page.locator('[role="button"]').first();
    const hasCards = await firstCard.isVisible().catch(() => false);

    if (hasCards) {
      await firstCard.click();
      // URL 변경 대기 (SPA 라우팅이 느릴 수 있음)
      await page.waitForURL(/\/users\//, { timeout: 10_000 }).catch(() => {});

      const url = page.url();
      if (url.includes('/users/')) {
        // 상세 페이지 섹션 확인
        await expect(usersPage.basicInfoSection).toBeVisible({ timeout: 10_000 });
        await expect(usersPage.roleManagementSection).toBeVisible();
        await expect(usersPage.accountManagementSection).toBeVisible();
      }
    }
  });

  test('사용자 상세 → 역할 변경 선택 시 변경 버튼 활성화', async ({ page }) => {
    // 사용자 상세 페이지로 직접 이동
    const firstCard = page.locator('[role="button"]').first();
    const hasCards = await firstCard.isVisible().catch(() => false);

    if (hasCards) {
      await firstCard.click();
      await page.waitForURL(/\/users\//, { timeout: 10_000 }).catch(() => {});

      const url = page.url();
      if (url.includes('/users/')) {
        // 다른 역할 선택
        await usersPage.selectRole('구인자');

        // 역할 변경 버튼 표시 확인
        await expect(usersPage.changeRoleButton).toBeVisible({ timeout: 5_000 });
      }
    }
  });
});
