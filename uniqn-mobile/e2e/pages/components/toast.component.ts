/**
 * Toast Component Page Object
 */
import type { Page } from '@playwright/test';

export class ToastComponent {
  constructor(private readonly page: Page) {}

  private get toasts() {
    return this.page.locator('[role="alert"]');
  }

  private get latestToast() {
    return this.toasts.last();
  }

  private async getToastContents(): Promise<string[]> {
    await this.waitForVisible();
    const contents = await this.toasts.evaluateAll((nodes) =>
      nodes.map((node) => node.textContent?.trim() ?? '').filter((content) => content.length > 0)
    );

    return contents;
  }

  async waitForVisible(timeout = 5_000): Promise<void> {
    await this.latestToast.waitFor({ state: 'visible', timeout });
  }

  async waitForHidden(timeout = 6_000): Promise<void> {
    await this.latestToast.waitFor({ state: 'hidden', timeout });
  }

  async getMessage(): Promise<string | null> {
    try {
      const contents = await this.getToastContents();
      return contents.at(-1) ?? null;
    } catch {
      return null;
    }
  }

  async hasMessage(text: string | RegExp): Promise<boolean> {
    try {
      const contents = await this.getToastContents();

      return contents.some((content) =>
        typeof text === 'string' ? content.includes(text) : text.test(content)
      );
    } catch {
      return false;
    }
  }

  async dismiss(): Promise<void> {
    const button = this.latestToast.locator('button').first();
    try {
      await button.click({ timeout: 2_000 });
    } catch {
      // 자동 사라짐 대기
    }
  }
}
