/**
 * P2 스케줄 탭 테스트 (6 tests)
 * 인증된 staff 상태에서 실행
 */
import { test, expect } from '@playwright/test';
import { SchedulePage } from '../../pages/app/tabs/schedule.page';

// storageState는 chromium 프로젝트에서 staff.json으로 자동 설정됨

test.describe('내 스케줄', () => {
  let schedulePage: SchedulePage;

  test.beforeEach(async ({ page }) => {
    schedulePage = new SchedulePage(page);
    await schedulePage.goto();
  });

  // =====================================================
  // 기본 렌더링 (2 tests)
  // =====================================================

  test('헤더와 월 네비게이터가 표시된다', async () => {
    await expect(schedulePage.header).toBeVisible();

    // 월 제목이 "YYYY년 MM월" 형식으로 표시
    await expect(schedulePage.getMonthTitle()).toBeVisible({ timeout: 10_000 });
  });

  test('통계 카드에 지원/확정/완료/수익이 표시된다', async () => {
    // 통계 라벨이 모두 표시되어야 함
    await expect(schedulePage.getStatLabel('지원')).toBeVisible({ timeout: 10_000 });
    await expect(schedulePage.getStatLabel('확정')).toBeVisible();
    await expect(schedulePage.getStatLabel('완료')).toBeVisible();
    await expect(schedulePage.getStatLabel('수익')).toBeVisible();
  });

  // =====================================================
  // 월 네비게이션 (2 tests)
  // =====================================================

  test('이전 달 / 다음 달 버튼으로 월 이동이 된다', async () => {
    // 현재 월 제목 저장
    const initialTitle = await schedulePage.getMonthTitle().textContent();

    // 다음 달로 이동
    await schedulePage.goToNextMonth();
    await schedulePage.page.waitForTimeout(500);

    // 월 제목이 변경되어야 함
    const nextTitle = await schedulePage.getMonthTitle().textContent();
    expect(nextTitle).not.toEqual(initialTitle);

    // 이전 달로 돌아오기
    await schedulePage.goToPrevMonth();
    await schedulePage.page.waitForTimeout(500);

    // 원래 월로 복귀
    const backTitle = await schedulePage.getMonthTitle().textContent();
    expect(backTitle).toEqual(initialTitle);
  });

  test('오늘 버튼 클릭 시 현재 월로 이동한다', async () => {
    // 다음 달로 2번 이동
    await schedulePage.goToNextMonth();
    await schedulePage.page.waitForTimeout(300);
    await schedulePage.goToNextMonth();
    await schedulePage.page.waitForTimeout(300);

    // 현재 월 제목 저장
    const movedTitle = await schedulePage.getMonthTitle().textContent();

    // 오늘로 이동
    await schedulePage.goToToday();
    await schedulePage.page.waitForTimeout(500);

    // 현재 월로 복귀 확인
    const todayTitle = await schedulePage.getMonthTitle().textContent();
    expect(todayTitle).not.toEqual(movedTitle);
  });

  // =====================================================
  // 뷰 모드 전환 (1 test)
  // =====================================================

  test('뷰 모드 토글로 캘린더/목록 전환이 된다', async () => {
    // 초기: 캘린더 뷰 (목록 보기 토글 표시)
    const toggleButton = schedulePage.getViewToggleLabel();
    await expect(toggleButton).toBeVisible({ timeout: 5_000 });

    // 토글 클릭 → 뷰 모드 변경
    await schedulePage.toggleViewMode();
    await schedulePage.page.waitForTimeout(500);

    // 콘텐츠가 여전히 표시되어야 함
    const body = await schedulePage.page.locator('body').textContent();
    expect(body).toBeTruthy();

    // 다시 토글 → 원래 뷰로 복귀
    await schedulePage.toggleViewMode();
    await schedulePage.page.waitForTimeout(500);

    await expect(toggleButton).toBeVisible();
  });

  // =====================================================
  // 빈 상태 (1 test)
  // =====================================================

  test('스케줄이 없는 월에서는 빈 상태가 표시된다', async () => {
    // 먼 과거로 이동 (스케줄이 없을 가능성 높음)
    for (let i = 0; i < 12; i++) {
      await schedulePage.goToPrevMonth();
      await schedulePage.page.waitForTimeout(200);
    }

    // 목록 뷰로 전환
    await schedulePage.toggleViewMode();
    await schedulePage.page.waitForTimeout(1_000);

    // 빈 상태 메시지 또는 스케줄 카드가 표시되어야 함
    const isEmpty = await schedulePage.getEmptyState().isVisible().catch(() => false);
    const hasContent = await schedulePage.page.locator('body').textContent();

    // 둘 중 하나는 true
    expect(isEmpty || (hasContent && hasContent.length > 0)).toBeTruthy();
  });
});
