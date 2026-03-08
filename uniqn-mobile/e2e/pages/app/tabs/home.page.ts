/**
 * Jobs Home Page Object
 * 참조: app/(app)/(tabs)/index.tsx
 */
import type { Page, Locator } from '@playwright/test';
import { BasePage } from '../../base.page';

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
  }

  /** 타입 칩 필터 클릭 */
  async selectTypeChip(label: '긴급' | '대회' | '지원' | '고정'): Promise<void> {
    await this.page.getByText(label, { exact: true }).click();
  }

  /** 타입 칩이 보이는지 확인 */
  getTypeChip(label: string): Locator {
    return this.page.getByText(label, { exact: true });
  }

  /** 검색 수행 */
  async search(text: string): Promise<void> {
    await this.searchInput.fill(text);
  }

  /** 검색 초기화 */
  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
  }

  /** 검색 결과 없음 메시지 확인 */
  getEmptySearchMessage(searchText: string): Locator {
    return this.page.getByText(`'${searchText}' 검색 결과가 없습니다`);
  }

  /** 구인 공고 카드 클릭 */
  async clickJobCard(index: number): Promise<void> {
    const cards = this.page.locator('[accessibilityRole="button"]');
    await cards.nth(index).click();
  }

  /** 공고 목록 로딩 완료 대기 */
  async waitForJobsLoaded(): Promise<void> {
    // 로딩 스피너가 사라질 때까지 대기
    const spinner = this.page.locator('ActivityIndicator, [role="progressbar"]');
    try {
      await spinner.waitFor({ state: 'hidden', timeout: 10_000 });
    } catch {
      // 스피너가 없었으면 이미 로드 완료
    }
  }

  /** DateSlider가 보이는지 확인 */
  isDateSliderVisible(): Promise<boolean> {
    // DateSlider는 '지원' 타입 선택 시에만 표시됨
    return this.page.locator('[aria-label*="날짜"]').isVisible();
  }
}
