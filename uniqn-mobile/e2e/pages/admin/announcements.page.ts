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
    this.header = page.getByText('공지사항 관리');
    this.createButton = page.locator('[aria-label*="추가"]');
    this.emptyState = page.getByText('공지사항이 없습니다');
    this.emptyCreateButton = page.getByText('공지사항 작성');
  }

  async goto(): Promise<void> {
    await this.page.goto('/announcements', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /** 상태 탭 클릭 */
  async clickStatusTab(
    status: '전체' | '초안' | '발행됨' | '보관됨'
  ): Promise<void> {
    // Use .first() to target the filter tab (appears before content)
    await this.page.getByText(status, { exact: true }).first().click();
  }

  /** 상태 탭 카운트 가져오기 */
  getStatusTab(status: string): Locator {
    // Use .first() since regex can match multiple elements
    return this.page.getByText(new RegExp(`${status}\\s*\\d*`)).first();
  }

  /** 공지사항 카드 클릭 (제목으로) */
  async clickAnnouncementCard(title: string): Promise<void> {
    await this.page.getByText(title).click();
  }

  /** 공지사항 작성 페이지로 이동 */
  async gotoCreate(): Promise<void> {
    await this.page.goto('/announcements/create', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /** 작성 페이지 헤더 */
  get createHeader(): Locator {
    return this.page.getByText('공지사항 작성');
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
