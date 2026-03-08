/**
 * Job Detail Page Object (인증/비인증 공통)
 * 참조: app/(app)/jobs/[id]/index.tsx, app/(public)/jobs/[id].tsx
 */
import type { Page, Locator } from '@playwright/test';
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
    this.headerTitle = page.getByText('공고 상세');
    this.applyButton = page.getByRole('button', { name: '지원하기' });
    this.loginToApplyButton = page.getByRole('button', { name: '로그인 후 지원하기' });
    this.closedButton = page.getByRole('button', { name: '마감된 공고입니다' });
    this.statusText = page.getByText(/지원 완료|지원 승인|지원이 거절|검토 중/);
    this.retryButton = page.getByRole('button', { name: '다시 시도' });
    this.viewStatusButton = page.getByRole('button', { name: /내 지원 현황/ });
    this.shareButton = page.locator('[aria-label="공고 공유하기"]');
    this.backButton = page.locator('button').first();
    this.errorMessage = page.getByText('오류가 발생했습니다');
  }

  async gotoPublic(jobId: string): Promise<void> {
    await this.page.goto(`/jobs/${jobId}`, { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  async gotoAuthenticated(jobId: string): Promise<void> {
    await this.page.goto(`/jobs/${jobId}`, { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /**
   * 공고 상세 로드 대기
   */
  async waitForDetailLoaded(): Promise<void> {
    try {
      // Use .first() in case loading text appears multiple times
      const loading = this.page.getByText('공고 정보를 불러오는 중...').first();
      await loading.waitFor({ state: 'hidden', timeout: 10_000 });
    } catch {
      // 이미 로드 완료
    }
  }

  /**
   * 지원 버튼 클릭
   */
  async clickApply(): Promise<void> {
    // Use .first() since "지원하기" might appear multiple times
    await this.applyButton.first().click();
  }

  /**
   * 비로그인 상태에서 지원 → 로그인 리다이렉트 확인
   */
  async clickLoginToApply(): Promise<void> {
    await this.loginToApplyButton.click();
    await this.page.waitForURL(/login/, { timeout: 5_000 });
  }

  /**
   * 공고 제목이 표시되는지 확인
   */
  async isJobTitleVisible(title: string): Promise<boolean> {
    return this.page.getByText(title).isVisible();
  }

  /**
   * 에러 상태인지 확인
   */
  async isErrorVisible(): Promise<boolean> {
    return this.errorMessage.isVisible();
  }

  /**
   * 로딩 상태인지 확인
   */
  async isLoading(): Promise<boolean> {
    return this.page.getByText('공고 정보를 불러오는 중...').isVisible();
  }

  /**
   * 이미 지원한 상태인지 확인
   */
  async isAlreadyApplied(): Promise<boolean> {
    return this.statusText.isVisible();
  }
}
