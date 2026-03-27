import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../base.page';

export class CreatePostingPage extends BasePage {
  readonly postingTypeRegular: Locator;
  readonly postingTypeFixed: Locator;
  readonly postingTypeTournament: Locator;
  readonly postingTypeUrgent: Locator;
  readonly titleInput: Locator;
  readonly descriptionInput: Locator;
  readonly loadTemplateButton: Locator;
  readonly saveTemplateButton: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);

    this.postingTypeRegular = page.locator('[role="radio"]:visible').nth(0);
    this.postingTypeFixed = page.locator('[role="radio"]:visible', { hasText: /고정/ }).first();
    this.postingTypeTournament = page.locator('[role="radio"]:visible').nth(1);
    this.postingTypeUrgent = page.locator('[role="radio"]:visible').nth(2);

    this.titleInput = page.locator('input[placeholder*="딜러 구합니다"]').last();
    this.descriptionInput = page
      .locator('textarea[placeholder*="근무 환경"], input[placeholder*="근무 환경"]')
      .last();

    this.loadTemplateButton = page.getByRole('button', { name: /불러오기/ }).first();
    this.saveTemplateButton = page.getByRole('button', { name: /^저장$/ }).first();
    this.submitButton = page.getByRole('button', {
      name: /공고 등록|확인 요청/,
    });
  }

  async goto(): Promise<void> {
    await this.page.goto('/my-postings/create', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  async selectPostingType(type: 'regular' | 'fixed' | 'tournament' | 'urgent'): Promise<void> {
    const typeMap = {
      regular: this.postingTypeRegular,
      fixed: this.postingTypeFixed,
      tournament: this.postingTypeTournament,
      urgent: this.postingTypeUrgent,
    };
    await typeMap[type].click();
  }

  async fillTitle(title: string): Promise<void> {
    await this.titleInput.fill(title);
  }

  async fillDescription(description: string): Promise<void> {
    await this.descriptionInput.fill(description);
  }

  async selectLocation(locationName: string): Promise<void> {
    await this.page
      .getByText(/근무지/)
      .first()
      .click();
    await this.page.getByText(locationName).first().click();
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async waitForSubmitSuccess(): Promise<void> {
    await this.page
      .locator('[role="alert"]')
      .filter({ hasText: /공고가 등록되었습니다/ })
      .waitFor({ state: 'visible', timeout: 10_000 });
  }

  async waitForSubmitError(): Promise<void> {
    await this.page
      .locator('[role="alert"]')
      .filter({ hasText: /실패|오류|입력/ })
      .waitFor({ state: 'visible', timeout: 10_000 });
  }

  getValidationError(message: string | RegExp): Locator {
    return this.page.getByText(message).first();
  }

  async openSaveTemplateModal(): Promise<void> {
    await this.saveTemplateButton.click();
  }

  async openLoadTemplateModal(): Promise<void> {
    await this.loadTemplateButton.click();
  }

  async scrollToElement(text: string): Promise<void> {
    await this.page.getByText(text).first().scrollIntoViewIfNeeded();
  }
}
