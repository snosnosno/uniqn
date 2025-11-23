/**
 * 고정공고 상세보기 E2E 테스트
 *
 * Phase 4 - 전체 플로우 검증
 *
 * 테스트 시나리오:
 * 1. 고정공고 카드 클릭
 * 2. 조회수 1 증가 확인
 * 3. 모달 오픈 확인
 * 4. 근무 조건 표시 확인
 * 5. 모집 역할 목록 표시 확인
 * 6. 빈 역할 목록 메시지 확인
 * 7. 다크모드 전환 테스트
 */

import { test, expect } from '@playwright/test';

test.describe('고정공고 상세보기 E2E', () => {
  test.beforeEach(async ({ page }) => {
    // 로그인 및 홈페이지 이동
    await page.goto('/');

    // TODO: 실제 로그인 플로우 추가
    // await page.fill('input[name="email"]', 'test@example.com');
    // await page.fill('input[name="password"]', 'password');
    // await page.click('button[type="submit"]');

    // 구인구직 페이지로 이동
    await page.goto('/job-board');
    await page.waitForLoadState('networkidle');
  });

  test('고정공고 카드 클릭 시 상세보기 모달이 열린다', async ({ page }) => {
    // 첫 번째 고정공고 카드 찾기
    const firstCard = page.locator('[data-testid="fixed-job-card"]').first();
    await expect(firstCard).toBeVisible();

    // 카드 클릭 전 조회수 확인
    const viewCountBefore = await page
      .locator('[data-testid="view-count"]')
      .first()
      .textContent();

    // 카드 클릭
    await firstCard.click();

    // 모달이 열렸는지 확인
    const modal = page.locator('[data-testid="job-detail-modal"]');
    await expect(modal).toBeVisible();

    // 조회수가 1 증가했는지 확인 (약간의 지연 후)
    await page.waitForTimeout(1000);
    const viewCountAfter = await page
      .locator('[data-testid="view-count"]')
      .first()
      .textContent();

    // 조회수 증가 검증 (문자열 → 숫자 변환)
    const countBefore = parseInt(viewCountBefore || '0', 10);
    const countAfter = parseInt(viewCountAfter || '0', 10);
    expect(countAfter).toBe(countBefore + 1);
  });

  test('모달에 근무 조건이 올바르게 표시된다', async ({ page }) => {
    // 첫 번째 고정공고 카드 클릭
    const firstCard = page.locator('[data-testid="fixed-job-card"]').first();
    await firstCard.click();

    // 모달이 열릴 때까지 대기
    const modal = page.locator('[data-testid="job-detail-modal"]');
    await expect(modal).toBeVisible();

    // 근무 조건 섹션 확인
    const workConditions = modal.locator('text="🏢 근무 조건"');
    await expect(workConditions).toBeVisible();

    // 주 출근일수 확인
    const daysPerWeek = modal.locator('label:has-text("주 출근일수")');
    await expect(daysPerWeek).toBeVisible();

    // 근무시간 확인
    const workTime = modal.locator('label:has-text("근무시간")');
    await expect(workTime).toBeVisible();
  });

  test('모달에 모집 역할 목록이 올바르게 표시된다', async ({ page }) => {
    // 첫 번째 고정공고 카드 클릭
    const firstCard = page.locator('[data-testid="fixed-job-card"]').first();
    await firstCard.click();

    // 모달이 열릴 때까지 대기
    const modal = page.locator('[data-testid="job-detail-modal"]');
    await expect(modal).toBeVisible();

    // 모집 역할 섹션 확인
    const rolesSection = modal.locator('text="👥 모집 역할"');
    await expect(rolesSection).toBeVisible();

    // 역할 목록 또는 빈 상태 메시지가 있는지 확인
    const roleList = modal.locator('ul');
    const emptyMessage = modal.locator('text="모집 역할이 없습니다"');

    // 둘 중 하나는 반드시 보여야 함
    const hasRoles = await roleList.count() > 0;
    const hasEmptyMessage = await emptyMessage.isVisible();

    expect(hasRoles || hasEmptyMessage).toBeTruthy();
  });

  test('빈 역할 목록일 때 적절한 메시지가 표시된다', async ({ page: _page }) => {
    // TODO: 빈 역할 목록을 가진 테스트 데이터 설정
    // 현재는 스킵하거나 테스트 데이터 준비 후 실행

    test.skip();
  });

  test('다크모드 전환 시 UI가 올바르게 변경된다', async ({ page }) => {
    // 첫 번째 고정공고 카드 클릭
    const firstCard = page.locator('[data-testid="fixed-job-card"]').first();
    await firstCard.click();

    // 모달이 열릴 때까지 대기
    const modal = page.locator('[data-testid="job-detail-modal"]');
    await expect(modal).toBeVisible();

    // 다크모드 토글 버튼 찾기
    const darkModeToggle = page.locator('[data-testid="dark-mode-toggle"]');

    // 다크모드 활성화
    await darkModeToggle.click();

    // HTML에 dark 클래스가 추가되었는지 확인
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/);

    // 모달 배경색이 다크모드 색상인지 확인 (Tailwind CSS dark:bg-gray-800)
    const modalBgColor = await modal.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // RGB 값 확인 (gray-800은 대략 rgb(31, 41, 55))
    // 정확한 값은 Tailwind CSS 버전에 따라 다를 수 있음
    expect(modalBgColor).not.toBe('rgb(255, 255, 255)'); // 흰색이 아님
  });

  test('모달 닫기 버튼이 정상 동작한다', async ({ page }) => {
    // 첫 번째 고정공고 카드 클릭
    const firstCard = page.locator('[data-testid="fixed-job-card"]').first();
    await firstCard.click();

    // 모달이 열릴 때까지 대기
    const modal = page.locator('[data-testid="job-detail-modal"]');
    await expect(modal).toBeVisible();

    // 닫기 버튼 클릭
    const closeButton = modal.locator('[data-testid="close-modal"]');
    await closeButton.click();

    // 모달이 닫혔는지 확인
    await expect(modal).not.toBeVisible();
  });

  test('조회수 증가가 여러 번 호출되어도 정상 동작한다', async ({ page }) => {
    // 첫 번째 고정공고 카드 찾기
    const firstCard = page.locator('[data-testid="fixed-job-card"]').first();

    // 초기 조회수 확인
    const initialViewCount = await page
      .locator('[data-testid="view-count"]')
      .first()
      .textContent();
    const initialCount = parseInt(initialViewCount || '0', 10);

    // 카드를 3번 클릭 (모달 열고 닫기 반복)
    for (let i = 0; i < 3; i++) {
      await firstCard.click();
      await page.waitForTimeout(500);

      const closeButton = page.locator('[data-testid="close-modal"]');
      await closeButton.click();
      await page.waitForTimeout(500);
    }

    // 최종 조회수 확인
    const finalViewCount = await page
      .locator('[data-testid="view-count"]')
      .first()
      .textContent();
    const finalCount = parseInt(finalViewCount || '0', 10);

    // 조회수가 3 증가했는지 확인
    expect(finalCount).toBe(initialCount + 3);
  });

  test('네트워크 오류 시에도 모달은 정상적으로 열린다 (fire-and-forget)', async ({
    page,
  }) => {
    // Firestore 요청 차단 (네트워크 오류 시뮬레이션)
    await page.route('**/firestore.googleapis.com/**', (route) => {
      route.abort('failed');
    });

    // 첫 번째 고정공고 카드 클릭
    const firstCard = page.locator('[data-testid="fixed-job-card"]').first();
    await firstCard.click();

    // 모달이 여전히 열리는지 확인 (조회수 증가 실패와 무관)
    const modal = page.locator('[data-testid="job-detail-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });
});
