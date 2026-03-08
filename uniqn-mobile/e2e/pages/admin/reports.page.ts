/**
 * Admin Reports Management Page Object
 * 참조: app/(admin)/reports/index.tsx, app/(admin)/reports/[id].tsx
 */
import type { Page, Locator } from '@playwright/test';
import { BasePage } from '../base.page';

export class AdminReportsPage extends BasePage {
  readonly searchInput: Locator;
  readonly filterButton: Locator;
  readonly reportCount: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    super(page);
    this.searchInput = page.getByPlaceholder('신고자, 피신고자, 공고명 검색');
    this.filterButton = page.locator('[aria-label="필터"]');
    this.reportCount = page.getByText(/총 \d+건의 신고/);
    this.emptyState = page.getByText('신고 없음');
  }

  async goto(): Promise<void> {
    await this.page.goto('/reports', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /** 상태 필터 클릭 */
  async clickStatusFilter(
    status: '전체' | '검토 대기' | '검토 중' | '처리 완료' | '기각'
  ): Promise<void> {
    // Use .first() to target the filter tab (appears before content)
    await this.page.getByText(status, { exact: true }).first().click();
  }

  /** 심각도 필터 클릭 (필터 패널 열린 상태에서) */
  async clickSeverityFilter(
    severity: '전체' | '심각' | '높음' | '보통' | '낮음'
  ): Promise<void> {
    // Use .first() to target the filter option (appears before content)
    await this.page.getByText(severity, { exact: true }).first().click();
  }

  /** 검색 실행 */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500);
  }

  /** 신고 카드 클릭 */
  async clickReportCard(index = 0): Promise<void> {
    const cards = this.page.locator('[role="button"]');
    await cards.nth(index).click();
  }

  // ── 상세 페이지 ──

  /** 신고 상세 페이지로 이동 */
  async gotoReportDetail(reportId: string): Promise<void> {
    await this.page.goto(`/reports/${reportId}`, { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /** 신고 내용 섹션 */
  get reportContentSection(): Locator {
    return this.page.getByText('신고 내용');
  }

  /** 처리 이력 섹션 */
  get reviewHistorySection(): Locator {
    return this.page.getByText('처리 이력');
  }

  /** 신고 처리 섹션 */
  get reviewFormSection(): Locator {
    return this.page.getByText('신고 처리', { exact: true });
  }

  /** 처리 결과 선택 */
  async selectReviewStatus(
    status: '검토 중' | '처리 완료' | '기각'
  ): Promise<void> {
    await this.page.getByText(status, { exact: true }).click();
  }

  /** 처리 메모 입력 */
  async fillReviewNote(note: string): Promise<void> {
    const input = this.page.getByPlaceholder('처리에 대한 메모를 입력하세요');
    await input.fill(note);
  }

  /** 신고 처리하기 버튼 */
  get submitReviewButton(): Locator {
    return this.page.getByText('신고 처리하기');
  }
}
