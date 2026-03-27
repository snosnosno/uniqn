/**
 * Settings Page Object
 * 참조: app/(app)/settings/index.tsx
 */
import type { Page, Locator } from '@playwright/test';
import { BasePage } from '../../base.page';

export class SettingsPage extends BasePage {
  readonly changePasswordItem: Locator;
  readonly darkModeLabel: Locator;
  readonly cacheClearItem: Locator;
  readonly termsItem: Locator;
  readonly privacyItem: Locator;
  readonly businessInfoItem: Locator;
  readonly deleteAccountButton: Locator;
  readonly versionItem: Locator;
  readonly pushNotificationLabel: Locator;
  readonly autoLoginLabel: Locator;
  readonly autoLoginHelperText: Locator;
  readonly marketingLabel: Locator;

  constructor(page: Page) {
    super(page);
    this.changePasswordItem = page.getByRole('button', { name: /^비밀번호 변경$/ }).first();
    this.darkModeLabel = page.getByText('다크 모드').last();
    this.cacheClearItem = page.getByRole('button', { name: /^캐시 삭제$/ }).first();
    this.termsItem = page.getByRole('button', { name: /^이용약관$/ }).first();
    this.privacyItem = page.getByRole('button', { name: /^개인정보처리방침$/ }).first();
    this.businessInfoItem = page.getByRole('button', { name: /^사업자정보$/ }).first();
    this.deleteAccountButton = page.getByRole('button', { name: /^계정 삭제$/ }).first();
    this.versionItem = page.getByText('버전').last();
    this.pushNotificationLabel = page.getByText('푸시 알림').last();
    this.autoLoginLabel = page.getByText('자동 로그인').last();
    this.autoLoginHelperText = page.getByText('끄면 다음 실행부터 다시 로그인해야 합니다.').last();
    this.marketingLabel = page.getByText('마케팅 정보 수신').last();
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /** 비밀번호 변경 페이지로 이동 */
  async goToChangePassword(): Promise<void> {
    await this.changePasswordItem.click();
    await this.page.waitForURL(/change-password/, { timeout: 5_000 });
  }

  /** 이용약관 페이지로 이동 */
  async goToTerms(): Promise<void> {
    await this.termsItem.click();
    await this.page.waitForURL(/terms/, { timeout: 5_000 });
  }

  /** 개인정보처리방침 페이지로 이동 */
  async goToPrivacy(): Promise<void> {
    await this.privacyItem.click();
    await this.page.waitForURL(/privacy/, { timeout: 5_000 });
  }

  /** 사업자정보 페이지로 이동 */
  async goToBusinessInfo(): Promise<void> {
    await this.businessInfoItem.click();
    await this.page.waitForURL(/business-info/, { timeout: 5_000 });
  }

  /** 계정 삭제 페이지로 이동 */
  async goToDeleteAccount(): Promise<void> {
    await this.deleteAccountButton.click();
    await this.page.waitForURL(/delete-account/, { timeout: 5_000 });
  }

  /** 섹션 제목 가져오기 */
  getSectionTitle(title: '알림' | '계정' | '앱 설정' | '정보'): Locator {
    return this.page.getByText(title, { exact: true }).last();
  }

  /** Switch 토글 (label 기반) */
  async toggleSwitch(label: string): Promise<void> {
    await this.getSwitch(label).click();
  }

  async isSwitchChecked(label: string): Promise<boolean> {
    const autoLoginSwitch = this.page.getByTestId('settings-auto-login-switch');
    const switchElement =
      (await autoLoginSwitch.count()) > 0 && (await autoLoginSwitch.isVisible().catch(() => false))
        ? autoLoginSwitch
        : this.getSwitch(label);
    const ariaChecked = await switchElement.getAttribute('aria-checked');

    if (ariaChecked !== null) {
      return ariaChecked === 'true';
    }

    return switchElement.isChecked();
  }

  /** 버전 정보 값 확인 */
  getVersionValue(): Locator {
    return this.page.getByText(/\d+\.\d+\.\d+ \(\d+\)/).last();
  }

  /** 알림 권한 거부 경고 확인 */
  getPermissionDeniedAlert(): Locator {
    return this.page.getByText('알림 권한이 거부되었습니다');
  }

  /** 알림 권한 미설정 안내 확인 */
  getPermissionUndeterminedAlert(): Locator {
    return this.page.getByText('푸시 알림이 꺼져있습니다');
  }

  private getSwitch(label: string): Locator {
    return this.page
      .getByText(label)
      .locator('..')
      .locator('..')
      .locator('input[role="switch"], [role="switch"]');
  }
}
