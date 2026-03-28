import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../base.page';

export class CreatePostingPage extends BasePage {
  readonly postingTypeRegular: Locator;
  readonly postingTypeTournament: Locator;
  readonly postingTypeUrgent: Locator;
  readonly titleInput: Locator;
  readonly descriptionInput: Locator;
  readonly addDateButton: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);

    this.postingTypeRegular = page.locator('[role="radio"]:visible').nth(0);
    this.postingTypeTournament = page.locator('[role="radio"]:visible').nth(1);
    this.postingTypeUrgent = page.locator('[role="radio"]:visible').nth(2);
    this.titleInput = page.getByTestId('job-posting-title-input');
    this.descriptionInput = page.getByTestId('job-posting-description-input');
    this.addDateButton = page.getByTestId('job-posting-add-date-button');
    this.submitButton = page.getByTestId('job-posting-create-submit');
  }

  async goto(): Promise<void> {
    await this.page.goto('/my-postings/create', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  async selectPostingType(type: 'regular' | 'tournament' | 'urgent'): Promise<void> {
    const typeMap = {
      regular: this.postingTypeRegular,
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

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  getValidationError(message: string | RegExp): Locator {
    return this.page.getByText(message).first();
  }
}
