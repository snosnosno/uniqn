/**
 * My Postings Page Object (구인자 공고 목록)
 * 참조: app/(employer)/my-postings/index.tsx
 */
import type { Page, Locator } from '@playwright/test';
import { BasePage } from '../base.page';

export class MyPostingsPage extends BasePage {
  /** 헤더 제목 */
  readonly headerTitle: Locator;
  /** 새 공고 작성 버튼 */
  readonly createButton: Locator;

  constructor(page: Page) {
    super(page);
    this.headerTitle = page.getByText('내 공고 관리');
    this.createButton = page.getByRole('button', { name: /새 공고/ });
  }

  async goto(): Promise<void> {
    await this.page.goto('/my-postings', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /**
   * 필터 탭 클릭 (전체, 진행중, 마감, 대회)
   */
  async selectFilter(
    label: '전체' | '진행중' | '마감' | '대회'
  ): Promise<void> {
    await this.page.getByText(label, { exact: false }).first().click();
  }

  /**
   * 결과 개수 텍스트 반환
   */
  getResultCount(): Locator {
    return this.page.getByText(/\d+개의 공고/);
  }

  /**
   * 공고 카드 클릭 (제목으로 찾기)
   */
  async clickPostingCard(title: string): Promise<void> {
    await this.page
      .getByRole('button', { name: new RegExp(`${title}.*상세`) })
      .click();
  }

  /**
   * 공고 카드가 보이는지 확인
   */
  getPostingCard(title: string): Locator {
    return this.page.getByText(title).first();
  }

  /**
   * 빈 상태 메시지 확인
   */
  getEmptyState(): Locator {
    return this.page.getByText(/등록된 공고가 없습니다|공고가 없습니다/);
  }

  /**
   * 총 공고 수 텍스트 반환
   */
  getTotalCountText(): Locator {
    return this.page.getByText(/총 \d+개의 공고/);
  }
}
