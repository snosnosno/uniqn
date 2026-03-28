/**
 * Loading Component Page Object
 */
import type { Page } from '@playwright/test';

export class LoadingComponent {
  constructor(private readonly page: Page) {}

  /**
   * 로딩 오버레이가 보이는지 확인
   */
  async isVisible(): Promise<boolean> {
    const loading = this.page.getByText('로딩 중...');
    return loading.isVisible();
  }

  /**
   * 로딩 완료 대기
   */
  async waitForComplete(timeout = 15_000): Promise<void> {
    const loading = this.page.getByText(/로딩 중|앱 로딩 중|앱을 불러오는 중/);
    try {
      await loading.waitFor({ state: 'hidden', timeout });
    } catch {
      // 로딩이 없었으면 이미 완료
    }
  }

  /**
   * 앱 초기화 완료 대기 (스플래시 + 로딩)
   */
  async waitForAppInitialized(timeout = 20_000): Promise<void> {
    await this.waitForComplete(timeout);
    // 추가 네트워크 안정화 대기
    try {
      await this.page.waitForLoadState('networkidle', { timeout: 5_000 });
    } catch {
      // 타임아웃은 무시
    }
  }
}
