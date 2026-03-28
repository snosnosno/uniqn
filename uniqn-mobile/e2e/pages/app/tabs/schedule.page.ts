/**
 * Schedule Page Object
 * Reference: app/(app)/(tabs)/schedule.tsx
 */
import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../../base.page';

export class SchedulePage extends BasePage {
  readonly header: Locator;
  readonly prevMonthButton: Locator;
  readonly nextMonthButton: Locator;
  readonly todayButton: Locator;
  readonly viewToggleButton: Locator;
  readonly monthTitle: Locator;

  constructor(page: Page) {
    super(page);
    this.header = page.getByText('내 스케줄').first();
    this.prevMonthButton = page.getByTestId('schedule-prev-month-button');
    this.nextMonthButton = page.getByTestId('schedule-next-month-button');
    this.todayButton = page.getByTestId('schedule-today-button');
    this.viewToggleButton = page.getByTestId('schedule-view-toggle-button');
    this.monthTitle = page.getByTestId('schedule-month-title');
  }

  async goto(): Promise<void> {
    await this.page.goto('/schedule', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  getMonthTitle(): Locator {
    return this.monthTitle;
  }

  async goToPrevMonth(): Promise<void> {
    await this.prevMonthButton.click();
  }

  async goToNextMonth(): Promise<void> {
    await this.nextMonthButton.click();
  }

  async goToToday(): Promise<void> {
    await this.todayButton.click();
  }

  async toggleViewMode(): Promise<void> {
    await this.viewToggleButton.click();
  }

  getViewToggleLabel(): Locator {
    return this.viewToggleButton;
  }

  getStatLabel(label: '지원' | '확정' | '완료' | '수익'): Locator {
    const accessibilityLabelMap = {
      지원: '지원 통계',
      확정: '확정 통계',
      완료: '완료 통계',
      수익: '수익 통계',
    } as const;

    return this.page.getByLabel(accessibilityLabelMap[label]);
  }

  getEmptyState(): Locator {
    return this.page.getByText('스케줄이 없습니다');
  }

  getEmptyDescription(year: number, month: number): Locator {
    return this.page.getByText(`${year}년 ${month}월에 예정된 스케줄이 없습니다.`, {
      exact: false,
    });
  }

  async clickScheduleCard(index: number): Promise<void> {
    const cards = this.page.locator('[accessibilityRole="button"]');
    await cards.nth(index).click();
  }

  getErrorState(): Locator {
    return this.page.getByText('스케줄을 불러오지 못했습니다');
  }
}
