/**
 * Notifications Page Object
 * 참조: app/(app)/notifications.tsx
 */
import type { Page, Locator } from '@playwright/test';
import { BasePage } from '../base.page';

export class NotificationsPage extends BasePage {
  readonly header: Locator;
  readonly markAllReadButton: Locator;

  constructor(page: Page) {
    super(page);
    this.header = page.getByText(/^알림/).last();
    this.markAllReadButton = page.getByRole('button', { name: /모두 읽음/ }).first();
  }

  async goto(): Promise<void> {
    await this.page.goto('/notifications', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /** 카테고리 탭 클릭 */
  async selectCategory(
    category: '전체' | '지원/확정' | '출퇴근' | '정산' | '공고' | '시스템'
  ): Promise<void> {
    await this.getCategoryTab(category).click();
  }

  /** 카테고리 탭 가져오기 */
  getCategoryTab(category: string): Locator {
    return this.page.getByRole('button', {
      name: new RegExp(`^${escapeRegExp(category)}(?:\\s|$|,)`),
    });
  }

  /** 읽지 않은 수 뱃지 확인 */
  getUnreadCount(): Locator {
    // 헤더의 (N) 형식
    return this.page.locator('text=/\\(\\d+\\)/');
  }

  /** 모두 읽음 버튼 클릭 */
  async markAllAsRead(): Promise<void> {
    await this.markAllReadButton.click();
  }

  /** 빈 상태 확인 */
  getEmptyState(): Locator {
    return this.page.getByText('알림이 없습니다');
  }

  /** 빈 상태 설명 확인 */
  getEmptyDescription(): Locator {
    return this.page.getByText('새로운 알림이 오면 여기에 표시됩니다');
  }

  /** 에러 상태 확인 */
  getErrorState(): Locator {
    return this.page.getByText('알림을 불러오는데 실패했습니다');
  }

  /** 알림 아이템 클릭 */
  async clickNotification(index: number): Promise<void> {
    const items = this.page.locator('[accessibilityRole="button"]');
    await items.nth(index).click();
  }

  /** 모두 읽음 버튼이 보이는지 확인 */
  async isMarkAllReadVisible(): Promise<boolean> {
    return this.markAllReadButton.isVisible();
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
