/**
 * Change Password Page Object
 * 참조: app/(app)/settings/change-password.tsx
 */
import type { Page, Locator } from '@playwright/test';
import { BasePage } from '../../base.page';

export class ChangePasswordPage extends BasePage {
  readonly currentPasswordInput: Locator;
  readonly newPasswordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);
    this.currentPasswordInput = page.getByPlaceholder('현재 비밀번호를 입력해주세요');
    this.newPasswordInput = page.getByPlaceholder('새 비밀번호를 입력해주세요');
    this.confirmPasswordInput = page.getByPlaceholder('새 비밀번호를 다시 입력해주세요');
    // 버튼이 raw Pressable이므로 role="button"이 없음
    // ScrollView 내부의 마지막 '비밀번호 변경' 텍스트 = 제출 버튼
    this.submitButton = page.getByText('비밀번호 변경', { exact: true }).last();
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/change-password', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /** 비밀번호 변경 폼 채우기 */
  async fillForm(
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<void> {
    await this.currentPasswordInput.fill(currentPassword);
    await this.newPasswordInput.fill(newPassword);
    await this.confirmPasswordInput.fill(confirmPassword);
  }

  /** 변경 버튼 클릭 */
  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  /** 비밀번호 정책 항목 확인 */
  getPolicyItem(text: string): Locator {
    return this.page.getByText(text);
  }

  /** 안내 문구 확인 */
  getGuideText(): Locator {
    return this.page.getByText('보안을 위해 비밀번호를 주기적으로 변경해주세요');
  }

  /** 비밀번호 정책 섹션 확인 */
  getPolicySection(): Locator {
    return this.page.getByText('비밀번호 정책');
  }

  /** 성공 토스트 대기 */
  async waitForSuccess(): Promise<void> {
    await this.page.getByText('비밀번호가 변경되었습니다').waitFor({
      state: 'visible',
      timeout: 5_000,
    });
  }

  /** 현재 비밀번호 오류 토스트 대기 */
  async waitForCurrentPasswordError(): Promise<void> {
    await this.page.getByText('현재 비밀번호가 올바르지 않습니다').waitFor({
      state: 'visible',
      timeout: 5_000,
    });
  }
}
