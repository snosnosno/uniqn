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
    // TabHeader title('구인구직')과 하단 탭바 라벨('구인구직')이 동시에 존재 → .first() 로 스코프.
    this.header = page.getByText('구인구직').filter({ visible: true }).first();
  }

  async goto(): Promise<void> {
    // 홈 대시보드 삭제(2026-07-19) 이후 구인구직 탭이 앱 진입점이며 URL 은 '/home-jobs'.
    // 경유(splash '/' → 로고/CTA 클릭) 없이 탭으로 직접 이동한다.
    await this.page.goto('/home-jobs', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
    await this.searchInput.waitFor({ state: 'visible', timeout: 15_000 });
  }

  async selectTypeChip(label: '급구' | '대회' | '지원' | '고정'): Promise<void> {
    await this.getTypeChip(label).click();
  }

  /**
   * PostingTypeChips a11y label:
   *   - count 있음: `급구 공고 12건`
   *   - count 없음: `급구 공고 필터`
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
