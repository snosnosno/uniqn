import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../base.page';

export class MyPostingsPage extends BasePage {
  readonly headerTitle: Locator;
  readonly createButton: Locator;

  constructor(page: Page) {
    super(page);
    this.headerTitle = page.locator('button:visible', { hasText: /공고 작성/ }).first();
    this.createButton = page.locator('button:visible', { hasText: /공고 작성/ }).first();
  }

  async goto(): Promise<void> {
    await this.page.goto('/my-postings', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  async selectFilter(label: '전체' | '진행중' | '모집중' | '마감' | '대기'): Promise<void> {
    await this.page
      .getByRole('tab', { name: new RegExp(label) })
      .first()
      .click();
  }

  getResultCount(): Locator {
    return this.page.locator('[role="tab"]:visible', { hasText: /전체.*\d/ }).first();
  }

  async clickPostingCard(title: string): Promise<void> {
    await this.page
      .getByRole('button', { name: new RegExp(`${title}.*상세보기`) })
      .first()
      .click();
  }

  getPostingCard(title: string): Locator {
    return this.page.getByText(title).first();
  }

  getEmptyState(): Locator {
    return this.page.getByText(/등록된 공고가 없습니다|공고가 없습니다/).first();
  }

  getTotalCountText(): Locator {
    return this.page.locator('[role="tab"]:visible', { hasText: /전체.*\d/ }).first();
  }
}
