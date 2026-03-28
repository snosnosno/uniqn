/**
 * Job detail page object shared by authenticated and public routes.
 */
import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../base.page';

export class JobDetailPage extends BasePage {
  readonly headerTitle: Locator;
  readonly applyButton: Locator;
  readonly loginToApplyButton: Locator;
  readonly closedButton: Locator;
  readonly statusText: Locator;
  readonly retryButton: Locator;
  readonly viewStatusButton: Locator;
  readonly shareButton: Locator;
  readonly backButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.headerTitle = page.getByText(/^공고 상세$/).last();
    this.applyButton = page.getByRole('button', { name: '지원하기' });
    this.loginToApplyButton = page.getByRole('button', { name: '로그인하고 지원하기' });
    this.closedButton = page.getByRole('button', { name: '마감된 공고입니다' });
    this.statusText = page.getByText(/지원 완료|지원 확정|지원이 거절|지원 완료 - 검토 중/).last();
    this.retryButton = page.getByRole('button', { name: '다시 시도' });
    this.viewStatusButton = page.getByRole('button', { name: /내 지원 확인|지원 현황 보기/ });
    this.shareButton = page.locator('[aria-label="공고 공유하기"]');
    this.backButton = page.locator('button').first();
    this.errorMessage = page
      .getByText(/오류가 발생했습니다|문제가 발생했습니다|공고를 찾을 수 없습니다/)
      .first();
  }

  async gotoPublic(jobId: string): Promise<void> {
    await this.page.goto(`/jobs/${jobId}`, { waitUntil: 'commit' });
    await this.page.locator('#root').waitFor({ state: 'attached', timeout: 10_000 });
    await this.waitForDetailLoaded();
  }

  async gotoAuthenticated(jobId: string): Promise<void> {
    await this.page.goto(`/jobs/${jobId}`, { waitUntil: 'commit' });
    await this.page.locator('#root').waitFor({ state: 'attached', timeout: 10_000 });
    await this.waitForDetailLoaded();
  }

  async waitForDetailLoaded(): Promise<void> {
    await this.page.waitForFunction(
      (markers) => {
        const bodyText = document.body?.innerText ?? '';
        return markers.some((marker) => bodyText.includes(marker));
      },
      [
        '지원하기',
        '로그인하고 지원하기',
        '마감된 공고입니다',
        '내 지원 확인',
        '지원 현황 보기',
        '공고를 찾을 수 없습니다',
        '오류가 발생했습니다',
        '문제가 발생했습니다',
        '다시 시도',
      ],
      { timeout: 30_000 }
    );
  }

  async clickApply(): Promise<void> {
    await this.applyButton.first().click();
  }

  async clickLoginToApply(): Promise<void> {
    await this.loginToApplyButton.click();
    await this.page.waitForURL(/login/, { timeout: 5_000 });
  }

  async isJobTitleVisible(title: string): Promise<boolean> {
    return this.page.getByText(title).isVisible();
  }

  async isErrorVisible(): Promise<boolean> {
    return this.errorMessage.isVisible();
  }

  async isLoading(): Promise<boolean> {
    return this.page.getByText('공고 정보를 불러오는 중...').isVisible();
  }

  async isAlreadyApplied(): Promise<boolean> {
    return this.viewStatusButton.isVisible().catch(() => false);
  }
}
