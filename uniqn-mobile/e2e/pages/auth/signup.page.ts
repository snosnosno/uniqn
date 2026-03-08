/**
 * Signup Page Object (3단계)
 * 참조: app/(auth)/signup.tsx, SignupStepTerms, SignupStepAccount, SignupStepIdentity
 */
import type { Page, Locator } from '@playwright/test';
import { BasePage } from '../base.page';

export class SignupPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/signup', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  // ============================================================
  // Step 1: 약관 동의
  // ============================================================

  get selectAllCheckbox(): Locator {
    return this.page.getByText('전체 동의하기');
  }

  get termsCheckbox(): Locator {
    // [필수] is a separate Text component, not part of the label
    return this.page.getByText('이용약관 동의');
  }

  get privacyCheckbox(): Locator {
    // [필수] is a separate Text component, not part of the label
    return this.page.getByText('개인정보처리방침 동의');
  }

  get marketingCheckbox(): Locator {
    // [선택] is a separate Text component, not part of the label
    return this.page.getByText('마케팅 정보 수신 동의');
  }

  get nextButton(): Locator {
    return this.page.getByRole('button', { name: /다음|가입완료/ });
  }

  get backButton(): Locator {
    return this.page.getByRole('button', { name: /이전/ });
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

  // ============================================================
  // Step 2: 계정 정보
  // ============================================================

  get emailInput(): Locator {
    return this.page.getByPlaceholder('이메일을 입력하세요');
  }

  get passwordInput(): Locator {
    return this.page.getByPlaceholder('비밀번호를 입력하세요');
  }

  get passwordConfirmInput(): Locator {
    return this.page.getByPlaceholder('비밀번호를 다시 입력하세요');
  }

  async fillAccountInfo(
    email: string,
    password: string,
    confirmPassword?: string
  ): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.passwordConfirmInput.fill(confirmPassword ?? password);
  }

  // ============================================================
  // Step 3: 본인인증
  // ============================================================

  get nameInput(): Locator {
    return this.page.getByPlaceholder('실명을 입력해주세요');
  }

  get birthDateSelector(): Locator {
    return this.page.getByText('생년월일');
  }

  get genderSelector(): Locator {
    return this.page.getByText('성별');
  }

  get submitButton(): Locator {
    return this.page.getByRole('button', { name: /가입완료|다음/ });
  }

  async fillIdentityInfo(name: string): Promise<void> {
    await this.nameInput.fill(name);
  }

  // ============================================================
  // 유틸리티
  // ============================================================

  async getCurrentStep(): Promise<number> {
    // 단계 인디케이터에서 현재 단계 추출
    const terms = await this.page.getByText('약관동의').isVisible();
    const account = await this.page.getByText('계정정보').isVisible();
    const identity = await this.page.getByText('본인인증').isVisible();

    if (terms) return 1;
    if (account) return 2;
    if (identity) return 3;
    return 0;
  }

  async waitForStep(step: number, timeout = 5_000): Promise<void> {
    const stepTexts: Record<number, string> = {
      1: '약관동의',
      2: '계정정보',
      3: '본인인증',
    };
    const text = stepTexts[step];
    if (text) {
      await this.page.getByText(text).waitFor({ state: 'visible', timeout });
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
