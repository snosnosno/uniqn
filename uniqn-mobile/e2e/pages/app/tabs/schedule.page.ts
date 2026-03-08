/**
 * Schedule Page Object
 * 참조: app/(app)/(tabs)/schedule.tsx
 */
import type { Page, Locator } from '@playwright/test';
import { BasePage } from '../../base.page';

export class SchedulePage extends BasePage {
  readonly header: Locator;
  readonly prevMonthButton: Locator;
  readonly nextMonthButton: Locator;
  readonly todayButton: Locator;

  constructor(page: Page) {
    super(page);
    this.header = page.getByText('내 스케줄').first();
    this.prevMonthButton = page.locator('[aria-label="이전 달"]');
    this.nextMonthButton = page.locator('[aria-label="다음 달"]');
    this.todayButton = page.locator('[aria-label="오늘로 이동"]');
  }

  async goto(): Promise<void> {
    await this.page.goto('/schedule', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /** 현재 월 제목 가져오기 */
  getMonthTitle(): Locator {
    return this.page.locator('text=/\\d+년 \\d+월/');
  }

  /** 이전 달 이동 */
  async goToPrevMonth(): Promise<void> {
    await this.prevMonthButton.click();
  }

  /** 다음 달 이동 */
  async goToNextMonth(): Promise<void> {
    await this.nextMonthButton.click();
  }

  /** 오늘로 이동 */
  async goToToday(): Promise<void> {
    await this.todayButton.click();
  }

  /** 뷰 모드 토글 (캘린더 ↔ 목록) */
  async toggleViewMode(): Promise<void> {
    const toggleButton = this.page.locator(
      '[aria-label="캘린더 보기"], [aria-label="목록 보기"]'
    );
    await toggleButton.click();
  }

  /** 뷰 모드 토글 버튼 라벨 가져오기 */
  getViewToggleLabel(): Locator {
    return this.page.locator(
      '[aria-label="캘린더 보기"], [aria-label="목록 보기"]'
    );
  }

  /** 통계 카드에서 특정 항목 값 가져오기 */
  getStatLabel(label: '지원' | '확정' | '완료' | '수익'): Locator {
    return this.page.getByText(label, { exact: true });
  }

  /** 빈 상태 메시지 확인 */
  getEmptyState(): Locator {
    return this.page.getByText('스케줄이 없습니다');
  }

  /** 빈 상태 상세 메시지 확인 */
  getEmptyDescription(year: number, month: number): Locator {
    return this.page.getByText(`${year}년 ${month}월에 예정된 스케줄이 없습니다`);
  }

  /** 스케줄 카드 클릭 */
  async clickScheduleCard(index: number): Promise<void> {
    const cards = this.page.locator('[accessibilityRole="button"]');
    await cards.nth(index).click();
  }

  /** 에러 상태 확인 */
  getErrorState(): Locator {
    return this.page.getByText('스케줄을 불러올 수 없습니다');
  }
}
