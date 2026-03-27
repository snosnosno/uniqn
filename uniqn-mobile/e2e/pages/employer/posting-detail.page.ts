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

    this.statusBadge = page.getByText(/모집중|마감|취소|승인 완료/).first();
    this.toggleInfoButton = page.locator('button:visible', {
      hasText: /^상세$/,
    });
    this.applicantsAction = page.locator('button:visible', { hasText: /지원자 관리/ }).first();
    this.cancellationAction = page.locator('button:visible', { hasText: /취소 요청 관리/ }).first();
    this.settlementAction = page.locator('button:visible', { hasText: /정산 관리/ }).first();
    this.editAction = page.locator('button:visible', { hasText: /공고 수정/ }).first();
    this.deleteButton = page.locator('button:visible', { hasText: /^공고 삭제$/ }).first();
    this.applicantCount = page.getByText('지원자').first().locator('..');
    this.confirmedCount = page.getByText('확정').first().locator('..');
    this.pendingCount = page.getByText('대기중').first().locator('..');
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
    return this.page.locator('h1, [role="heading"]').first();
  }

  async expandInfo(): Promise<void> {
    const expandButton = this.page.getByRole('button', { name: /상세 정보 펼치기/ }).first();
    if (await expandButton.isVisible().catch(() => false)) {
      await expandButton.click();
    }
  }

  async collapseInfo(): Promise<void> {
    const collapseButton = this.page.getByRole('button', { name: /상세 정보 접기/ }).first();
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
    return this.page.getByText(/정말 이 공고를 삭제하시겠습니까/).first();
  }

  getLocationText(): Locator {
    return this.page.locator('[data-testid="location"]').or(this.page.getByText(/포커룸/).first());
  }

  getManagementSection(): Locator {
    return this.page.locator('div:visible', { hasText: /^관리$/ }).first();
  }

  getDescriptionSection(): Locator {
    return this.page.getByText('공고 내용').first();
  }

  getErrorState(): Locator {
    return this.page.getByText(/공고를 불러오지 못했습니다|문제가 발생/).first();
  }
}
