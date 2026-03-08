/**
 * Modal Component Page Object
 */
import type { Page, Locator } from '@playwright/test';

export class ModalComponent {
  constructor(private readonly page: Page) {}

  private get modal(): Locator {
    return this.page.locator('[role="dialog"]').first();
  }

  async isVisible(): Promise<boolean> {
    return this.modal.isVisible();
  }

  async waitForOpen(timeout = 5_000): Promise<void> {
    await this.modal.waitFor({ state: 'visible', timeout });
  }

  async waitForClose(timeout = 5_000): Promise<void> {
    await this.modal.waitFor({ state: 'hidden', timeout });
  }

  async getTitle(): Promise<string | null> {
    const title = this.modal.locator('h2, [role="heading"]').first();
    return title.textContent();
  }

  async clickConfirm(): Promise<void> {
    await this.modal.getByRole('button', { name: /확인|네|동의/ }).click();
  }

  async clickCancel(): Promise<void> {
    await this.modal.getByRole('button', { name: /취소|아니오|닫기/ }).click();
  }

  async clickBackdrop(): Promise<void> {
    // 모달 바깥 영역 클릭
    await this.page.mouse.click(10, 10);
  }
}
