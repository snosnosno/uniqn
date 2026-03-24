/**
 * Employer my-postings page object.
 */
import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../base.page';

export class MyPostingsPage extends BasePage {
  readonly headerTitle: Locator;
  readonly createButton: Locator;

  constructor(page: Page) {
    super(page);
    this.headerTitle = page.getByRole('heading', { name: '내 공고 관리' });
    this.createButton = page.getByRole('button', { name: /새 공고 작성|내 공고/ });
  }

  async goto(): Promise<void> {
    await this.page.goto('/my-postings', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  async selectFilter(label: '전체' | '진행중' | '마감' | '대회'): Promise<void> {
    await this.page.getByText(label, { exact: false }).first().click();
  }

  getResultCount(): Locator {
    return this.page.getByText(/\d+개의 공고/);
  }

  async clickPostingCard(title: string): Promise<void> {
    await this.page.getByRole('button', { name: new RegExp(`${title}.*상세`) }).click();
  }

  getPostingCard(title: string): Locator {
    return this.page.getByText(title).first();
  }

  getEmptyState(): Locator {
    return this.page.getByText(/등록된 공고가 없습니다|공고가 없습니다/);
  }

  getTotalCountText(): Locator {
    return this.page.getByText(/총\s*\d+개의 공고/);
  }
}
