import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../../base.page';

export class EmployerTabPage extends BasePage {
  readonly headerTitle: Locator;
  readonly createPostingButton: Locator;
  readonly registerEmployerButton: Locator;

  constructor(page: Page) {
    super(page);
    this.headerTitle = page.getByText(/내 공고/).first();
    this.createPostingButton = page.getByRole('button', { name: /공고 작성/ }).first();
    this.registerEmployerButton = page.getByRole('button', { name: /구인자로 등록하기/ }).first();
  }

  async goto(): Promise<void> {
    await this.page.goto('/employer', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  async selectFilter(label: '전체' | '모집중' | '마감'): Promise<void> {
    await this.page
      .getByRole('tab', { name: new RegExp(label) })
      .first()
      .click();
  }

  async getFilterCount(label: '전체' | '모집중' | '마감'): Promise<string | null> {
    return this.page
      .getByRole('tab', { name: new RegExp(label) })
      .first()
      .textContent();
  }

  async clickPostingCard(title: string): Promise<void> {
    await this.page
      .getByRole('button', { name: new RegExp(`${title}.*상세보기`) })
      .first()
      .click();
  }

  async clickClosePosting(title: string): Promise<void> {
    await this.page
      .getByRole('button', { name: new RegExp(`${title}.*마감하기`) })
      .first()
      .click();
  }

  async clickReopenPosting(title: string): Promise<void> {
    await this.page
      .getByRole('button', { name: new RegExp(`${title}.*재오픈하기`) })
      .first()
      .click();
  }

  getEmptyStateMessage(): Locator {
    return this.page.getByText(/등록된 공고가 없습니다|공고가 없습니다/).first();
  }

  getNonEmployerMessage(): Locator {
    return this.page.getByText(/구인자 전용 기능/).first();
  }

  getPostingCard(title: string): Locator {
    return this.page.getByText(title).first();
  }

  async clickQRButton(): Promise<void> {
    await this.page.getByRole('button', { name: /QR/ }).first().click();
  }
}
