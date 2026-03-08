/**
 * Toast Component Page Object
 */
import type { Page } from '@playwright/test';

export class ToastComponent {
  constructor(private readonly page: Page) {}

  private get toast() {
    return this.page.locator('[role="alert"]').first();
  }

  async waitForVisible(timeout = 5_000): Promise<void> {
    await this.toast.waitFor({ state: 'visible', timeout });
  }

  async waitForHidden(timeout = 6_000): Promise<void> {
    await this.toast.waitFor({ state: 'hidden', timeout });
  }

  async getMessage(): Promise<string | null> {
    try {
      await this.waitForVisible();
      return this.toast.textContent();
    } catch {
      return null;
    }
  }

  async hasMessage(text: string | RegExp): Promise<boolean> {
    try {
      await this.waitForVisible();
      const content = await this.toast.textContent();
      if (!content) return false;
      return typeof text === 'string'
        ? content.includes(text)
        : text.test(content);
    } catch {
      return false;
    }
  }

  async dismiss(): Promise<void> {
    const button = this.toast.locator('button').first();
    try {
      await button.click({ timeout: 2_000 });
    } catch {
      // 자동 사라짐 대기
    }
  }
}
