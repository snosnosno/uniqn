/**
 * Public Jobs Page Object
 * 참조: app/(public)/jobs/index.tsx
 */
import type { Page, Locator } from '@playwright/test';
import { BasePage } from '../base.page';

export class PublicJobsPage extends BasePage {
  readonly headerTitle: Locator;
  readonly jobList: Locator;

  constructor(page: Page) {
    super(page);
    this.headerTitle = page.getByText('구인공고');
    this.jobList = page.locator('[data-testid="job-list"]').or(
      page.locator('[role="list"]')
    );
  }

  async goto(): Promise<void> {
    await this.page.goto('/jobs', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /**
   * 공고 타입 칩 클릭
   */
  async selectPostingType(type: '긴급' | '대회' | '지원' | '고정'): Promise<void> {
    await this.page.getByText(type, { exact: true }).click();
    // 목록 갱신 대기
    await this.page.waitForTimeout(1_000);
  }

  /**
   * 공고 카드 클릭
   */
  async clickJobCard(index = 0): Promise<void> {
    const cards = this.page.locator('[accessibilityRole="button"]').or(
      this.page.locator('[role="button"]')
    );
    await cards.nth(index).click();
  }

  /**
   * 공고 카드 제목으로 클릭
   */
  async clickJobByTitle(title: string): Promise<void> {
    await this.page.getByText(title).click();
  }

  /**
   * 공고 목록이 로드되었는지 확인
   */
  async waitForJobsLoaded(): Promise<void> {
    // 로딩 스피너가 사라질 때까지 대기
    try {
      await this.page.locator('[accessibilityRole="progressbar"]').waitFor({
        state: 'hidden',
        timeout: 10_000,
      });
    } catch {
      // 이미 로드 완료
    }
  }

  /**
   * 빈 목록 메시지 확인
   */
  async isEmptyMessageVisible(): Promise<boolean> {
    const emptyText = this.page.getByText(/데이터가 없습니다|공고가 없습니다|검색 결과가 없습니다/);
    return emptyText.isVisible();
  }

  /**
   * 공고 카드 개수 반환
   */
  async getJobCardCount(): Promise<number> {
    await this.waitForJobsLoaded();
    // JobCard는 Pressable로 렌더링됨
    const cards = this.page.locator('[accessibilityRole="button"]');
    return cards.count();
  }
}
