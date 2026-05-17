/**
 * Admin Announcements Management Page Object
 * 참조: app/(admin)/announcements/index.tsx, app/(admin)/announcements/create.tsx
 */
import type { Page, Locator } from '@playwright/test';
import { BasePage } from '../base.page';

export class AdminAnnouncementsPage extends BasePage {
  readonly header: Locator;
  readonly createButton: Locator;
  readonly emptyState: Locator;
  readonly emptyCreateButton: Locator;

  constructor(page: Page) {
    super(page);
    // StackHeader 는 plain <Text> 로 렌더 (accessibilityRole="header" 미적용)
    // → getByRole('heading') 불가, getByText.first() 로 매칭
    this.header = page.getByText('공지사항 관리', { exact: true }).first();
    this.createButton = page.locator('[aria-label*="추가"]');
    this.emptyState = page.getByText('공지사항이 없습니다', { exact: true });
    this.emptyCreateButton = page.getByText('공지사항 작성', { exact: true });
  }

  async goto(): Promise<void> {
    await this.page.goto('/admin/announcements', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /** 상태 탭 클릭 */
  async clickStatusTab(status: '전체' | '초안' | '발행됨' | '보관됨'): Promise<void> {
    const label = this.page.getByText(status, { exact: true }).first();
    await label.evaluate((element) => {
      (element as HTMLElement).click();
    });
  }

  /** 상태 탭 카운트 가져오기 */
  getStatusTab(status: string): Locator {
    return this.page.getByText(status, { exact: true }).first();
  }

  /** 공지사항 카드 클릭 (제목으로) */
  async clickAnnouncementCard(title: string): Promise<void> {
    await this.page.getByText(title).click();
  }

  /** 공지사항 작성 페이지로 이동 */
  async gotoCreate(): Promise<void> {
    await this.page.goto('/admin/announcements/create', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /** 작성 페이지 헤더 (StackHeader plain Text) */
  get createHeader(): Locator {
    return this.page.getByText('공지사항 작성', { exact: true }).first();
  }

  /** 저장 버튼 */
  get saveButton(): Locator {
    return this.page.getByText('저장', { exact: true });
  }

  /** 취소 버튼 */
  get cancelButton(): Locator {
    return this.page.getByText('취소', { exact: true });
  }
}
