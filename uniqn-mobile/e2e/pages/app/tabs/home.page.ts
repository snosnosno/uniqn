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
    // staff/employer 가 인증 후 (app)/home 으로 redirect 되는 경우 구인구직 탭 click
    // (jobs 페이지는 tabs/index — '구인구직' tab name)
    const jobsTab = this.page.getByRole('tab', { name: '구인구직' });
    const tabVisible = await jobsTab.isVisible().catch(() => false);
    if (tabVisible) {
      await jobsTab.click();
      await this.page.waitForTimeout(500);
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
