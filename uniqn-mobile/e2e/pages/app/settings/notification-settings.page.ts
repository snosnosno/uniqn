/**
 * Notification Settings Page Object
 * 참조: app/(app)/settings/notifications.tsx
 *
 * 2026-07-25(#328): 푸시/마케팅 토글이 설정 메인에서 이 전용 화면으로 분리됐다.
 * 설정 메인을 보는 SettingsPage 와 반드시 구분할 것 — 메인에는 진입 행만 남는다.
 */
import type { Page, Locator } from '@playwright/test';
import { BasePage } from '../../base.page';

export class NotificationSettingsPage extends BasePage {
  readonly pushMasterLabel: Locator;
  readonly marketingLabel: Locator;

  constructor(page: Page) {
    super(page);
    this.pushMasterLabel = page.getByText('푸시 알림', { exact: true }).last();
    this.marketingLabel = page.getByText('마케팅 정보 수신').last();
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/notifications', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /** 알림 권한 거부 경고 확인 */
  getPermissionDeniedAlert(): Locator {
    return this.page.getByText('알림 권한이 거부되었습니다');
  }

  /** 알림 권한 미설정 안내 확인 */
  getPermissionUndeterminedAlert(): Locator {
    return this.page.getByText('푸시 알림이 꺼져있습니다');
  }
}
