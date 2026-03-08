/**
 * Base Page Object — 모든 Page Object의 부모 클래스
 */
import type { Page, Locator } from '@playwright/test';

export class BasePage {
  constructor(public readonly page: Page) {}

  /**
   * 앱 초기화 완료 대기
   * useAppInitialize가 완료될 때까지 대기 (최대 30초)
   * 이후 알림 온보딩 모달이 떠있으면 자동으로 스킵 처리
   */
  async waitForReady(): Promise<void> {
    // DOM 로드 대기
    await this.page.waitForLoadState('domcontentloaded');

    const loadingText = this.page.getByText('앱 로딩 중...');
    try {
      // 로딩 텍스트가 나타날 때까지 짧게 대기 (이미 사라졌으면 스킵)
      await loadingText.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
      // 로딩 텍스트가 사라질 때까지 대기
      await loadingText.waitFor({ state: 'hidden', timeout: 30_000 });
    } catch {
      // 이미 사라졌거나 에러 화면으로 전환됨
    }

    // 알림 온보딩 모달이 남아있으면 스킵
    await this.dismissNotificationOnboarding();
  }

  /**
   * 알림 권한 온보딩 모달 자동 스킵
   * storageState에 플래그가 없는 경우의 안전장치
   */
  async dismissNotificationOnboarding(): Promise<void> {
    try {
      const skipButton = this.page.getByText('나중에 하기');
      const isVisible = await skipButton.isVisible().catch(() => false);
      if (isVisible) {
        await skipButton.click({ timeout: 3_000 });
        await this.page.waitForTimeout(500);
      }
    } catch {
      // 온보딩 모달이 없으면 무시
    }
  }

  /**
   * 토스트 메시지 텍스트 반환
   */
  async getToastMessage(): Promise<string | null> {
    const toast = this.page.locator('[role="alert"]').first();
    try {
      await toast.waitFor({ state: 'visible', timeout: 5_000 });
      return toast.textContent();
    } catch {
      return null;
    }
  }

  /**
   * 토스트 닫기
   */
  async dismissToast(): Promise<void> {
    const dismissButton = this.page.locator('[role="alert"] button').first();
    try {
      await dismissButton.click({ timeout: 2_000 });
    } catch {
      // 닫기 버튼이 없으면 자동 사라짐 대기
    }
  }

  /**
   * 모달 표시 여부 확인
   */
  async isModalVisible(): Promise<boolean> {
    const modal = this.page.locator('[role="dialog"]');
    return modal.isVisible();
  }

  /**
   * 현재 URL 경로 반환
   */
  getCurrentPath(): string {
    return new URL(this.page.url()).pathname;
  }

  /**
   * 스크린샷 촬영
   */
  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({
      path: `e2e/test-results/screenshots/${name}.png`,
      fullPage: true,
    });
  }

  /**
   * 뒤로가기
   */
  async goBack(): Promise<void> {
    await this.page.goBack();
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * 텍스트 요소가 보이는지 확인
   */
  getByText(text: string | RegExp): Locator {
    return this.page.getByText(text);
  }
}
