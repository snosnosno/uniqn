/**
 * Jobs home page object.
 */
import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../../base.page';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class HomePage extends BasePage {
  readonly searchInput: Locator;
  readonly header: Locator;

  constructor(page: Page) {
    super(page);
    this.searchInput = page.getByPlaceholder('제목, 장소로 검색');
    this.header = page.getByText('구인구직').first();
  }

  async goto(): Promise<void> {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
    // featureFlags.home_dashboard_enabled=true(default) → staff 가 (app)/home (standalone screen)
    // 으로 redirect 됨. /home 에서 (tabs) 진입 경로:
    //   1) NextWorkWidget empty-state CTA "공고 보기" (스케줄 없는 경우)
    //   2) HomeTabBar "구인구직 탭으로 이동" (스케줄 유무 무관 항상 표시)
    // QA staff 는 데이터 상태에 따라 (1)이 없을 수 있으므로 (2) 우선 시도.
    // 이미 (tabs) 페이지면 (구 entry 호환) 둘 다 없으므로 그대로 진행.
    const jobsTabButton = this.page.getByRole('button', { name: '구인구직 탭으로 이동' }).first();
    const tabBarVisible = await jobsTabButton.isVisible().catch(() => false);
    if (tabBarVisible) {
      await jobsTabButton.click();
      await this.page.waitForLoadState('domcontentloaded');
      await this.page.waitForTimeout(800);
      return;
    }

    const viewJobsButton = this.page.getByRole('button', { name: '공고 보기' }).first();
    const ctaVisible = await viewJobsButton.isVisible().catch(() => false);
    if (ctaVisible) {
      await viewJobsButton.click();
      await this.page.waitForLoadState('domcontentloaded');
      await this.page.waitForTimeout(800);
    }
  }

  async selectTypeChip(label: '긴급' | '대회' | '일반' | '고정'): Promise<void> {
    await this.getTypeChip(label).click();
  }

  /**
   * PostingTypeChips a11y label:
   *   - count 있음: `긴급 공고 12건`
   *   - count 없음: `긴급 공고 필터`
   * 둘 다 매칭하려면 regex 에 `(필터|\d+건)` 분기 필요.
   */
  getTypeChip(label: string): Locator {
    return this.page.getByRole('button', {
      name: new RegExp(`^${escapeRegExp(label)}\\s*공고\\s*(필터|\\d+건)$`),
    });
  }

  async search(text: string): Promise<void> {
    await this.searchInput.fill(text);
  }

  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
  }

  getEmptySearchMessage(searchText: string): Locator {
    return this.page.getByText(`'${searchText}' 검색 결과가 없습니다`);
  }

  async clickJobCard(index: number): Promise<void> {
    const cards = this.page.locator('[accessibilityRole="button"]');
    await cards.nth(index).click();
  }

  async waitForJobsLoaded(): Promise<void> {
    const spinner = this.page.locator('ActivityIndicator, [role="progressbar"]');
    try {
      await spinner.waitFor({ state: 'hidden', timeout: 10_000 });
    } catch {
      // The list was already stable.
    }
  }

  isDateCalendarVisible(): Promise<boolean> {
    return this.page.locator('[aria-label*="날짜"]').isVisible();
  }
}
