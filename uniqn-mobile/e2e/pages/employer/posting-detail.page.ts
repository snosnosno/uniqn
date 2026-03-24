/**
 * Employer posting detail page object.
 */
import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../base.page';

export class PostingDetailPage extends BasePage {
  readonly statusBadge: Locator;
  readonly toggleInfoButton: Locator;
  readonly applicantsAction: Locator;
  readonly cancellationAction: Locator;
  readonly settlementAction: Locator;
  readonly editAction: Locator;
  readonly deleteButton: Locator;
  readonly applicantCount: Locator;
  readonly confirmedCount: Locator;
  readonly pendingCount: Locator;

  constructor(page: Page) {
    super(page);

    this.statusBadge = page.getByText(/모집중|마감|취소/).first();
    this.toggleInfoButton = page.getByRole('button', {
      name: /상세 정보 (펼치기|접기)/,
    });

    this.applicantsAction = page.getByRole('button', { name: /지원자 관리/ });
    this.cancellationAction = page.getByRole('button', { name: /취소 요청 관리/ });
    this.settlementAction = page.getByRole('button', { name: /스태프\s*\/?\s*정산 관리/ });
    this.editAction = page.getByRole('button', { name: /공고 수정/ });

    this.deleteButton = page.getByRole('button', { name: '공고 삭제' });

    this.applicantCount = page.getByText('지원자').locator('..');
    this.confirmedCount = page.getByText('확정').locator('..');
    this.pendingCount = page.getByText('대기중').locator('..');
  }

  async goto(
    postingId: string,
    options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit' }
  ): Promise<void> {
    await this.page.goto(`/my-postings/${postingId}`, {
      waitUntil: options?.waitUntil ?? 'domcontentloaded',
    });
    await this.waitForReady();
  }

  getTitle(): Locator {
    return this.page.locator('text').first();
  }

  async expandInfo(): Promise<void> {
    const expandButton = this.page.getByRole('button', { name: '상세 정보 펼치기' });
    if (await expandButton.isVisible().catch(() => false)) {
      await expandButton.click();
    }
  }

  async collapseInfo(): Promise<void> {
    const collapseButton = this.page.getByRole('button', { name: '상세 정보 접기' });
    if (await collapseButton.isVisible().catch(() => false)) {
      await collapseButton.click();
    }
  }

  async goToApplicants(): Promise<void> {
    await this.applicantsAction.click();
    await this.page.waitForURL(/applicants/, { timeout: 15_000 });
  }

  async goToSettlements(): Promise<void> {
    await this.settlementAction.click();
    await this.page.waitForURL(/settlements/, { timeout: 15_000 });
  }

  async goToEdit(): Promise<void> {
    await this.editAction.click();
    await this.page.waitForURL(/edit/, { timeout: 15_000 });
  }

  async clickDelete(): Promise<void> {
    await this.deleteButton.scrollIntoViewIfNeeded();
    await this.deleteButton.click();
  }

  async confirmDelete(): Promise<void> {
    await this.getDeleteModalMessage().waitFor({ state: 'visible', timeout: 10_000 });
    await this.page.getByRole('button', { name: '삭제', exact: true }).click();
  }

  async cancelDelete(): Promise<void> {
    await this.getDeleteModalMessage().waitFor({ state: 'visible', timeout: 10_000 });
    await this.page.getByRole('button', { name: '취소', exact: true }).click();
  }

  getDeleteModalTitle(): Locator {
    return this.page.getByText('공고 삭제').last();
  }

  getDeleteModalMessage(): Locator {
    return this.page.getByText(/정말 이 공고를 삭제하시겠습니까/);
  }

  getLocationText(): Locator {
    return this.page.locator('[data-testid="location"]').or(this.page.getByText(/향/).first());
  }

  getManagementSection(): Locator {
    return this.page.getByText('관리');
  }

  getDescriptionSection(): Locator {
    return this.page.getByText('공고 내용');
  }

  getErrorState(): Locator {
    return this.page.getByText('공고를 불러올 수 없습니다');
  }
}
