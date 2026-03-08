/**
 * Employer Tab Page Object
 * 참조: app/(app)/(tabs)/employer.tsx
 */
import type { Page, Locator } from '@playwright/test';
import { BasePage } from '../../base.page';

export class EmployerTabPage extends BasePage {
  /** 헤더 제목 */
  readonly headerTitle: Locator;
  /** 새 공고 작성 CTA 버튼 */
  readonly createPostingButton: Locator;
  /** 비구인자 안내 - 구인자 등록 버튼 */
  readonly registerEmployerButton: Locator;

  constructor(page: Page) {
    super(page);
    this.headerTitle = page.getByText('내 공고').first();
    this.createPostingButton = page.getByRole('button', { name: /새 공고 작성/ });
    this.registerEmployerButton = page.getByRole('button', { name: /구인자로 등록하기/ });
  }

  async goto(): Promise<void> {
    await this.page.goto('/employer', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /**
   * 필터 탭 클릭 (전체, 모집중, 마감)
   */
  async selectFilter(label: '전체' | '모집중' | '마감'): Promise<void> {
    await this.page.getByRole('tab', { name: new RegExp(label) }).click();
  }

  /**
   * 필터 탭의 카운트 텍스트 반환
   */
  async getFilterCount(label: '전체' | '모집중' | '마감'): Promise<string | null> {
    const tab = this.page.getByRole('tab', { name: new RegExp(label) });
    return tab.textContent();
  }

  /**
   * 공고 카드 클릭 (제목으로 찾기)
   */
  async clickPostingCard(title: string): Promise<void> {
    await this.page
      .getByRole('button', { name: new RegExp(`${title}.*상세보기`) })
      .click();
  }

  /**
   * 공고 카드의 마감하기 버튼 클릭
   */
  async clickClosePosting(title: string): Promise<void> {
    await this.page
      .getByRole('button', { name: new RegExp(`${title}.*마감하기`) })
      .click();
  }

  /**
   * 공고 카드의 재오픈 버튼 클릭
   */
  async clickReopenPosting(title: string): Promise<void> {
    await this.page
      .getByRole('button', { name: new RegExp(`${title}.*재오픈하기`) })
      .click();
  }

  /**
   * 빈 상태 메시지 확인
   */
  getEmptyStateMessage(): Locator {
    return this.page.getByText(/등록된 공고가 없습니다/);
  }

  /**
   * 비구인자 안내 텍스트 확인
   */
  getNonEmployerMessage(): Locator {
    return this.page.getByText('구인자 전용 기능입니다');
  }

  /**
   * 공고 카드가 보이는지 확인
   */
  getPostingCard(title: string): Locator {
    return this.page.getByText(title).first();
  }

  /**
   * QR 버튼 클릭
   */
  async clickQRButton(): Promise<void> {
    await this.page
      .getByRole('button', { name: '현장 QR 표시' })
      .first()
      .click();
  }
}
