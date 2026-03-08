/**
 * Create Posting Page Object (공고 작성)
 * 참조: app/(employer)/my-postings/create.tsx
 */
import type { Page, Locator } from '@playwright/test';
import { BasePage } from '../base.page';

export class CreatePostingPage extends BasePage {
  /** 공고 타입 선택 버튼들 */
  readonly postingTypeRegular: Locator;
  readonly postingTypeFixed: Locator;
  readonly postingTypeTournament: Locator;
  readonly postingTypeUrgent: Locator;

  /** 기본 정보 폼 필드 */
  readonly titleInput: Locator;
  readonly descriptionInput: Locator;

  /** 하단 액션 버튼 */
  readonly loadTemplateButton: Locator;
  readonly saveTemplateButton: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);

    // 공고 타입 버튼
    this.postingTypeRegular = page.getByText('지원', { exact: true });
    this.postingTypeFixed = page.getByText('고정', { exact: true });
    this.postingTypeTournament = page.getByText('대회', { exact: true });
    this.postingTypeUrgent = page.getByText('긴급', { exact: true });

    // 기본 정보
    this.titleInput = page.getByPlaceholder(/강남 홀덤펍 딜러 구합니다/);
    this.descriptionInput = page.getByPlaceholder(/근무 환경, 우대 조건/);

    // 하단 버튼
    this.loadTemplateButton = page.getByText('불러오기');
    this.saveTemplateButton = page.getByText('저장');
    this.submitButton = page.getByRole('button', {
      name: /공고 등록|승인 요청/,
    });
  }

  async goto(): Promise<void> {
    await this.page.goto('/my-postings/create', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /**
   * 공고 타입 선택
   */
  async selectPostingType(
    type: 'regular' | 'fixed' | 'tournament' | 'urgent'
  ): Promise<void> {
    const typeMap = {
      regular: this.postingTypeRegular,
      fixed: this.postingTypeFixed,
      tournament: this.postingTypeTournament,
      urgent: this.postingTypeUrgent,
    };
    await typeMap[type].click();
  }

  /**
   * 제목 입력
   */
  async fillTitle(title: string): Promise<void> {
    await this.titleInput.fill(title);
  }

  /**
   * 설명 입력
   */
  async fillDescription(description: string): Promise<void> {
    await this.descriptionInput.fill(description);
  }

  /**
   * 근무지 선택 (텍스트 버튼 클릭 후 선택)
   */
  async selectLocation(locationName: string): Promise<void> {
    // 근무지 선택 영역 클릭
    await this.page.getByText(/근무지를 선택/).click();
    // 목록에서 선택
    await this.page.getByText(locationName).click();
  }

  /**
   * 폼 제출 (공고 등록)
   */
  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  /**
   * 성공 토스트 메시지 확인
   */
  async waitForSubmitSuccess(): Promise<void> {
    await this.page
      .locator('[role="alert"]')
      .filter({ hasText: /공고가 등록되었습니다/ })
      .waitFor({ state: 'visible', timeout: 10_000 });
  }

  /**
   * 에러 토스트 메시지 확인
   */
  async waitForSubmitError(): Promise<void> {
    await this.page
      .locator('[role="alert"]')
      .filter({ hasText: /실패|오류|누락/ })
      .waitFor({ state: 'visible', timeout: 10_000 });
  }

  /**
   * 검증 에러 메시지 확인
   */
  getValidationError(message: string | RegExp): Locator {
    return this.page.getByText(message);
  }

  /**
   * 템플릿 저장 모달 열기
   */
  async openSaveTemplateModal(): Promise<void> {
    await this.saveTemplateButton.click();
  }

  /**
   * 템플릿 불러오기 모달 열기
   */
  async openLoadTemplateModal(): Promise<void> {
    await this.loadTemplateButton.click();
  }

  /**
   * 스크롤하여 요소 찾기
   */
  async scrollToElement(text: string): Promise<void> {
    const element = this.page.getByText(text);
    await element.scrollIntoViewIfNeeded();
  }
}
