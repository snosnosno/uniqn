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
  readonly notificationSettingsItem: Locator;
  readonly autoLoginLabel: Locator;
  readonly autoLoginHelperText: Locator;

  constructor(page: Page) {
    super(page);
    this.changePasswordItem = page.getByRole('button', { name: /^비밀번호 변경$/ }).first();
    this.darkModeLabel = page.getByText('다크 모드').last();
    this.cacheClearItem = page.getByRole('button', { name: /^캐시 삭제$/ }).first();
    this.termsItem = page.getByRole('button', { name: /^이용약관$/ }).first();
    this.privacyItem = page.getByRole('button', { name: /^개인정보처리방침$/ }).first();
    this.businessInfoItem = page.getByRole('button', { name: /^사업자정보$/ }).first();
    this.deleteAccountButton = page.getByRole('button', { name: /^계정 삭제$/ }).last();
    this.versionItem = page.getByText('버전').last();
    // 2026-07-25(#328): 푸시·마케팅 토글은 /settings/notifications 로 분리 —
    // 메인에는 진입 행만 남는다. 토글 검증은 NotificationSettingsPage 사용.
    this.notificationSettingsItem = page.getByRole('button', { name: /^알림 설정$/ }).first();
    this.autoLoginLabel = page.getByText('자동 로그인').last();
    this.autoLoginHelperText = page.getByText('끄면 다음 실행부터 다시 로그인해야 합니다.').last();
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /** 비밀번호 변경 페이지로 이동 */
  async goToChangePassword(): Promise<void> {
    await Promise.all([
      this.page.waitForURL(/change-password/, { timeout: 10_000 }),
      this.changePasswordItem.click(),
    ]);
  }

  /** 알림 설정 페이지로 이동 */
  async goToNotificationSettings(): Promise<void> {
    await Promise.all([
      this.page.waitForURL(/settings\/notifications/, { timeout: 10_000 }),
      this.notificationSettingsItem.click(),
    ]);
  }

  /** 이용약관 페이지로 이동 */
  async goToTerms(): Promise<void> {
    await Promise.all([this.page.waitForURL(/terms/, { timeout: 10_000 }), this.termsItem.click()]);
  }

  /** 개인정보처리방침 페이지로 이동 */
  async goToPrivacy(): Promise<void> {
    await Promise.all([
      this.page.waitForURL(/privacy/, { timeout: 10_000 }),
      this.privacyItem.click(),
    ]);
  }

  /** 사업자정보 페이지로 이동 */
  async goToBusinessInfo(): Promise<void> {
    await Promise.all([
      this.page.waitForURL(/business-info/, { timeout: 10_000 }),
      this.businessInfoItem.click(),
    ]);
  }

  /** 계정 삭제 페이지로 이동 */
  async goToDeleteAccount(): Promise<void> {
    await this.deleteAccountButton.scrollIntoViewIfNeeded();

    try {
      await Promise.all([
        this.page.waitForURL(/delete-account/, { timeout: 10_000 }),
        this.deleteAccountButton.click({ force: true }),
      ]);
    } catch {
      await Promise.all([
        this.page.waitForURL(/delete-account/, { timeout: 10_000 }),
        this.deleteAccountButton.evaluate((element) => {
          (element as HTMLElement).click();
        }),
      ]);
    }
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

  private getSwitch(label: string): Locator {
    return this.page
      .getByText(label)
      .locator('..')
      .locator('..')
      .locator('input[role="switch"], [role="switch"]');
  }
}
