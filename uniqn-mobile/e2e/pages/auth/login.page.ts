import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../base.page';

export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly signupLink: Locator;
  readonly forgotPasswordLink: Locator;
  readonly passwordToggle: Locator;
  readonly autoLoginCheckbox: Locator;
  readonly autoLoginHelperText: Locator;

  constructor(page: Page) {
    super(page);

    this.emailInput = page.locator('input[placeholder="이메일을 입력하세요"]:visible').first();
    this.passwordInput = page.locator('input[placeholder="비밀번호를 입력하세요"]:visible').first();
    this.loginButton = page.locator('button:visible', { hasText: /^로그인/ }).first();
    this.signupLink = page.getByRole('link', { name: '회원가입' }).first();
    this.forgotPasswordLink = page.getByRole('link', { name: '비밀번호를 잊으셨나요?' }).first();
    this.passwordToggle = page
      .locator('input[placeholder="비밀번호를 입력하세요"]:visible')
      .first()
      .locator('..')
      .locator('[role="button"]')
      .first();
    this.autoLoginCheckbox = page.getByRole('checkbox', { name: '자동 로그인' }).first();
    this.autoLoginHelperText = page.locator('div:visible', { hasText: /다시 로그인/ }).first();
  }

  async goto(): Promise<void> {
    await this.page.goto('/login', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  async login(email: string, password: string, autoLoginEnabled?: boolean): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    if (typeof autoLoginEnabled === 'boolean') {
      await this.setAutoLogin(autoLoginEnabled);
    }
    await this.loginButton.click();
  }

  async waitForLoginSuccess(): Promise<void> {
    await this.page.waitForURL(
      (url) => !url.pathname.includes('/login') && !url.pathname.includes('/signup'),
      { timeout: 15_000 }
    );
  }

  async waitForLoginError(): Promise<void> {
    await this.page.locator('[role="alert"]').first().waitFor({
      state: 'visible',
      timeout: 5_000,
    });
  }

  async getErrorMessage(): Promise<string | null> {
    const errorAlert = this.page.locator('[role="alert"]').first();
    try {
      await errorAlert.waitFor({ state: 'visible', timeout: 5_000 });
      return errorAlert.textContent();
    } catch {
      return null;
    }
  }

  async goToSignup(): Promise<void> {
    await this.signupLink.click();
    await this.page.waitForURL(/signup/, { timeout: 5_000 });
  }

  async goToForgotPassword(): Promise<void> {
    await this.forgotPasswordLink.click();
    await this.page.waitForURL(/forgot-password/, { timeout: 5_000 });
  }

  async togglePasswordVisibility(): Promise<void> {
    await this.passwordToggle.click();
  }

  async isAutoLoginChecked(): Promise<boolean> {
    const ariaChecked = await this.autoLoginCheckbox.getAttribute('aria-checked');
    return ariaChecked === 'true';
  }

  async setAutoLogin(enabled: boolean): Promise<void> {
    const checked = await this.isAutoLoginChecked();
    if (checked !== enabled) {
      await this.autoLoginCheckbox.click();
      await this.autoLoginCheckbox.waitFor({ state: 'visible', timeout: 5_000 });
      await this.page.waitForTimeout(250);
    }
  }

  async isLoginButtonDisabled(): Promise<boolean> {
    return this.loginButton.isDisabled();
  }

  async isLoginButtonLoading(): Promise<boolean> {
    const text = await this.loginButton.textContent();
    return text?.includes('로그인 중') ?? false;
  }
}
