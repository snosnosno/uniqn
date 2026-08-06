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
  readonly dashboardToggle: Locator;

  constructor(page: Page) {
    super(page);
    this.header = page.getByText('내 스케줄').first();
    this.prevMonthButton = page.getByTestId('schedule-prev-month-button');
    this.nextMonthButton = page.getByTestId('schedule-next-month-button');
    this.todayButton = page.getByTestId('schedule-today-button');
    this.viewToggleButton = page.getByTestId('schedule-view-toggle-button');
    this.monthTitle = page.getByTestId('schedule-month-title');
    this.dashboardToggle = page.getByTestId('schedule-dashboard-toggle');
  }

  /**
   * '이번 달 요약'을 펼친다 (통계 밴드는 펼쳤을 때만 렌더된다).
   *
   * 요약의 기본값은 **접힘**이다 — 히어로 카드 + 월 네비 + 요약이 뷰포트를 다 먹으면
   * 정작 근무 목록이 시작할 세로가 남지 않기 때문. 접힘/펼침은 기기에 저장되므로
   * 현재 상태를 가정하지 않는다.
   *
   * ⚠️ `aria-expanded` 로 판별하지 말 것 — 토글은 `accessibilityState={{ expanded }}` 를 쓰는데
   * react-native-web 0.21 은 **accessibilityState 를 아예 처리하지 않아** 웹 DOM 에 그 속성이
   * 없다(네이티브에서만 유효). 그래서 판정 대상 자체(통계 밴드)의 가시성으로 판단한다.
   */
  async expandSummary(): Promise<void> {
    if (await this.getStatLabel('지원').isVisible()) {
      return;
    }

    await this.dashboardToggle.waitFor({ state: 'visible', timeout: 10_000 });
    await this.dashboardToggle.click();
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

  /**
   * 통계 밴드의 각 지표를 접근성 라벨로 집는다.
   *
   * '완료'와 '수익'은 라벨이 "○○ 통계" 고정 문구가 아니다 — 스크린리더가 값까지
   * 읽도록 건수·금액을 라벨에 넣었기 때문이다(완료는 '건'과 '일' 단위가 달라 함께 밝히고,
   * 수익은 한 숫자로 합치면 입금 예정액으로 오해돼 정산 완료/예정을 분리한다).
   * 그래서 고정 문자열이 아니라 형태를 정규식으로 고정한다 — 값이 바뀌어도 견디고,
   * 라벨 구조가 무너지면 잡힌다.
   */
  getStatLabel(label: '지원' | '확정' | '완료' | '수익'): Locator {
    const accessibilityLabelMap = {
      지원: /^지원 통계$/,
      확정: /^확정 통계$/,
      완료: /^완료 \d+건, 근무 \d+일$/,
      수익: /^정산 완료 .+, 정산 예정 .+$/,
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
