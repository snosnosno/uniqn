import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../base.page';

export class ForgotPasswordPage extends BasePage {
  readonly emailInput: Locator;
  readonly submitButton: Locator;
  readonly backToLoginLink: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.locator('input[placeholder="이메일을 입력하세요"]:visible').first();
    this.submitButton = page.getByRole('button', { name: /재설정 링크 발송|발송 중/ });
    this.backToLoginLink = page.getByText('로그인으로 돌아가기').first();
  }

  async goto(): Promise<void> {
    await this.page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  async requestReset(email: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.submitButton.click();
  }

  async waitForSuccessMessage(): Promise<void> {
    await this.page.getByText('이메일이 발송되었습니다').waitFor({
      state: 'visible',
      timeout: 5_000,
    });
  }

  async isSuccessVisible(): Promise<boolean> {
    return this.page.getByText('이메일이 발송되었습니다').isVisible();
  }

  async goBackToLogin(): Promise<void> {
    await this.backToLoginLink.click();
    await this.page.waitForURL(/login/, { timeout: 5_000 });
  }

  async getRetryButton(): Promise<Locator> {
    return this.page.getByText('다시 시도하기').first();
  }
}
