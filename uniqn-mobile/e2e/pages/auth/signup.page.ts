import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../base.page';

export class SignupPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/signup', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  get selectAllCheckbox(): Locator {
    return this.page.getByRole('checkbox', { name: /전체 동의하기/ }).first();
  }

  get termsCheckbox(): Locator {
    return this.page.getByRole('checkbox', { name: /이용약관 동의/ }).first();
  }

  get privacyCheckbox(): Locator {
    return this.page.getByRole('checkbox', { name: /개인정보처리방침 동의/ }).first();
  }

  get marketingCheckbox(): Locator {
    return this.page.getByRole('checkbox', { name: /마케팅 정보 수신 동의/ }).first();
  }

  get nextButton(): Locator {
    return this.page.getByRole('button', { name: /다음|가입완료/ }).first();
  }

  get backButton(): Locator {
    return this.page.getByRole('button', { name: /이전/ }).first();
  }

  async acceptAllTerms(): Promise<void> {
    await this.selectAllCheckbox.click();
  }

  async acceptRequiredTermsOnly(): Promise<void> {
    await this.termsCheckbox.click();
    await this.privacyCheckbox.click();
  }

  async clickNext(): Promise<void> {
    await this.nextButton.click();
  }

  async clickBack(): Promise<void> {
    await this.backButton.click();
  }

  get emailInput(): Locator {
    return this.page.locator('input[placeholder="이메일을 입력하세요"]:visible').first();
  }

  get passwordInput(): Locator {
    return this.page.locator('input[placeholder="비밀번호를 입력하세요"]:visible').first();
  }

  get passwordConfirmInput(): Locator {
    return this.page.locator('input[placeholder="비밀번호를 다시 입력하세요"]:visible').first();
  }

  async fillAccountInfo(email: string, password: string, confirmPassword?: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.passwordConfirmInput.fill(confirmPassword ?? password);
  }

  get nameInput(): Locator {
    return this.page.locator('input[placeholder="실명을 입력해주세요"]:visible').first();
  }

  get birthDateSelector(): Locator {
    return this.page.getByText('생년월일').first();
  }

  get genderSelector(): Locator {
    return this.page.getByText('성별').first();
  }

  get submitButton(): Locator {
    return this.page.getByRole('button', { name: /가입완료|다음/ }).first();
  }

  async fillIdentityInfo(name: string): Promise<void> {
    await this.nameInput.fill(name);
  }

  async getCurrentStep(): Promise<number> {
    const accountVisible = await this.page
      .getByText('계정정보')
      .isVisible()
      .catch(() => false);
    const identityVisible = await this.page
      .getByText('본인인증')
      .isVisible()
      .catch(() => false);
    if (identityVisible) {
      return 3;
    }
    if (accountVisible) {
      return 2;
    }
    return 1;
  }

  async waitForStep(step: number, timeout = 5_000): Promise<void> {
    const stepTexts: Record<number, string> = {
      1: '약관동의',
      2: '계정정보',
      3: '본인인증',
    };
    const text = stepTexts[step];
    if (text) {
      await this.page.getByText(text).first().waitFor({ state: 'visible', timeout });
    }
  }

  async getValidationError(): Promise<string | null> {
    const error = this.page.locator('[role="alert"]').first();
    try {
      await error.waitFor({ state: 'visible', timeout: 3_000 });
      return error.textContent();
    } catch {
      return null;
    }
  }
}
