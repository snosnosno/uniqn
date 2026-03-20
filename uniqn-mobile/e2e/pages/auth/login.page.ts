/**
 * Login Page Object
 * 참조: src/components/auth/LoginForm.tsx
 */
import type { Page, Locator } from '@playwright/test';
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
    this.emailInput = page.getByPlaceholder('이메일을 입력하세요');
    this.passwordInput = page.getByPlaceholder('비밀번호를 입력하세요');
    this.loginButton = page.getByRole('button', { name: /^로그인$|^로그인 중/ });
    this.signupLink = page.getByText('회원가입');
    this.forgotPasswordLink = page.getByText('비밀번호를 잊으셨나요?');
    // Password toggle button has no accessibilityLabel in Input.tsx
    // Locate by finding the button near password input
    this.passwordToggle = page
      .getByPlaceholder('비밀번호를 입력하세요')
      .locator('..')
      .locator('[role="button"]');
    this.autoLoginCheckbox = page.getByTestId('auto-login-checkbox');
    this.autoLoginHelperText = page.getByText('끄면 다음 실행부터 다시 로그인해야 합니다.');
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
    // Expo Router route groups는 URL에서 투명 — /(app)/(tabs) → /
    await this.page.waitForURL(
      (url) => !url.pathname.includes('/login') && !url.pathname.includes('/signup'),
      { timeout: 15_000 }
    );
  }

  async waitForLoginError(): Promise<void> {
    // 에러 토스트 또는 에러 메시지 대기
    await this.page.locator('[role="alert"]').waitFor({
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
