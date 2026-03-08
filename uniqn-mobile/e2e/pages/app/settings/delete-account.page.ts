/**
 * Delete Account Page Object
 * 참조: app/(app)/settings/delete-account.tsx
 */
import type { Page, Locator } from '@playwright/test';
import { BasePage } from '../../base.page';

export class DeleteAccountPage extends BasePage {
  readonly warningTitle: Locator;
  readonly passwordInput: Locator;
  readonly requestButton: Locator;
  readonly dataLink: Locator;

  constructor(page: Page) {
    super(page);
    this.warningTitle = page.getByText('회원탈퇴 안내');
    this.passwordInput = page.getByPlaceholder('현재 비밀번호를 입력해주세요');
    this.requestButton = page.getByRole('button', { name: '회원탈퇴 요청' });
    this.dataLink = page.getByText('탈퇴 전 내 데이터 확인하기');
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/delete-account', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /** 탈퇴 사유 선택 */
  async selectReason(
    reason:
      | '더 이상 서비스를 이용하지 않아요'
      | '다른 서비스를 이용하게 되었어요'
      | '개인정보가 걱정돼요'
      | '알림이 너무 많아요'
      | '사용하기 어려워요'
      | '기타'
  ): Promise<void> {
    await this.page.getByText(reason).click();
  }

  /** 탈퇴 사유 라디오 가져오기 */
  getReasonOption(reason: string): Locator {
    return this.page.getByText(reason);
  }

  /** 비밀번호 입력 */
  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  /** 탈퇴 요청 클릭 */
  async requestDeletion(): Promise<void> {
    await this.requestButton.click();
  }

  /** 확인 모달의 확인 버튼 클릭 */
  async confirmDeletion(): Promise<void> {
    await this.page.getByText('네, 탈퇴하겠습니다').click();
  }

  /** 확인 모달의 취소 버튼 클릭 */
  async cancelDeletion(): Promise<void> {
    // 모달 내 취소 버튼
    const modal = this.page.locator('[role="dialog"]');
    await modal.getByText('취소').click();
  }

  /** 확인 모달 제목 확인 */
  getConfirmModalTitle(): Locator {
    return this.page.getByText('정말 탈퇴하시겠습니까?');
  }

  /** 경고 내용 bullet point 확인 */
  getWarningBullet(text: string): Locator {
    return this.page.getByText(text);
  }

  /** 기타 사유 입력 필드 */
  getOtherReasonInput(): Locator {
    return this.page.getByPlaceholder('탈퇴 사유를 입력해주세요');
  }

  /** 탈퇴 성공 토스트 대기 */
  async waitForDeletionSuccess(): Promise<void> {
    await this.page.getByText('회원탈퇴가 요청되었습니다').waitFor({
      state: 'visible',
      timeout: 5_000,
    });
  }

  /** 사유 미선택 에러 토스트 대기 */
  async waitForReasonError(): Promise<void> {
    await this.page.getByText('탈퇴 사유를 선택해주세요').waitFor({
      state: 'visible',
      timeout: 5_000,
    });
  }
}
