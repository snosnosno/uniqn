/**
 * Posting Detail Page Object (공고 상세)
 * 참조: app/(employer)/my-postings/[id]/index.tsx
 */
import type { Page, Locator } from '@playwright/test';
import { BasePage } from '../base.page';

export class PostingDetailPage extends BasePage {
  /** 상태 뱃지 */
  readonly statusBadge: Locator;
  /** 상세 펼치기/접기 버튼 */
  readonly toggleInfoButton: Locator;

  /** 관리 메뉴 액션 카드들 */
  readonly applicantsAction: Locator;
  readonly cancellationAction: Locator;
  readonly settlementAction: Locator;
  readonly editAction: Locator;

  /** 공고 삭제 버튼 */
  readonly deleteButton: Locator;

  /** 모집 현황 숫자 */
  readonly applicantCount: Locator;
  readonly confirmedCount: Locator;
  readonly pendingCount: Locator;

  constructor(page: Page) {
    super(page);

    // 상태 뱃지
    this.statusBadge = page.getByText(/모집중|마감|취소됨/).first();

    // 상세 토글
    this.toggleInfoButton = page.getByText(/상세|접기/).first();

    // 관리 액션 카드
    this.applicantsAction = page.getByRole('button', {
      name: /지원자 관리/,
    });
    this.cancellationAction = page.getByRole('button', {
      name: /취소 요청 관리/,
    });
    this.settlementAction = page.getByRole('button', {
      name: /스태프\/정산 관리/,
    });
    this.editAction = page.getByRole('button', { name: /공고 수정/ });

    // 삭제 버튼
    this.deleteButton = page.getByRole('button', { name: '공고 삭제' });

    // 모집 현황
    this.applicantCount = page.getByText('지원자').locator('..');
    this.confirmedCount = page.getByText('확정').locator('..');
    this.pendingCount = page.getByText('대기중').locator('..');
  }

  async goto(postingId: string, options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit' }): Promise<void> {
    await this.page.goto(`/my-postings/${postingId}`, { waitUntil: options?.waitUntil ?? 'domcontentloaded' });
    await this.waitForReady();
  }

  /**
   * 공고 제목 텍스트 반환
   */
  getTitle(): Locator {
    return this.page.locator('text').first();
  }

  /**
   * 상세 정보 펼치기
   */
  async expandInfo(): Promise<void> {
    const isCollapsed = await this.page.getByText('상세').isVisible();
    if (isCollapsed) {
      await this.toggleInfoButton.click();
    }
  }

  /**
   * 상세 정보 접기
   */
  async collapseInfo(): Promise<void> {
    const isExpanded = await this.page.getByText('접기').isVisible();
    if (isExpanded) {
      await this.toggleInfoButton.click();
    }
  }

  /**
   * 지원자 관리 화면으로 이동
   */
  async goToApplicants(): Promise<void> {
    await this.applicantsAction.click();
    await this.page.waitForURL(/applicants/, { timeout: 15_000 });
  }

  /**
   * 정산 관리 화면으로 이동
   */
  async goToSettlements(): Promise<void> {
    await this.settlementAction.click();
    await this.page.waitForURL(/settlements/, { timeout: 15_000 });
  }

  /**
   * 공고 수정 화면으로 이동
   */
  async goToEdit(): Promise<void> {
    await this.editAction.click();
    await this.page.waitForURL(/edit/, { timeout: 15_000 });
  }

  /**
   * 공고 삭제 클릭 (확인 모달 표시됨)
   */
  async clickDelete(): Promise<void> {
    await this.deleteButton.scrollIntoViewIfNeeded();
    await this.deleteButton.click();
  }

  /**
   * 삭제 확인 모달에서 삭제 확정
   */
  async confirmDelete(): Promise<void> {
    await this.page
      .locator('[role="dialog"]')
      .getByRole('button', { name: '삭제' })
      .click();
  }

  /**
   * 삭제 확인 모달에서 취소
   */
  async cancelDelete(): Promise<void> {
    await this.page
      .locator('[role="dialog"]')
      .getByRole('button', { name: '취소' })
      .click();
  }

  /**
   * 장소 정보 표시 확인
   */
  getLocationText(): Locator {
    return this.page.locator('[data-testid="location"]').or(
      this.page.getByText(/📍/).first()
    );
  }

  /**
   * 관리 섹션 제목 확인
   */
  getManagementSection(): Locator {
    return this.page.getByText('관리');
  }

  /**
   * 공고 내용 섹션 확인
   */
  getDescriptionSection(): Locator {
    return this.page.getByText('공고 내용');
  }

  /**
   * 에러 상태 표시 확인
   * app/(employer)/my-postings/[id]/index.tsx의 ErrorState 참조:
   * - title: "공고를 불러올 수 없습니다"
   * - message: "공고 정보를 찾을 수 없습니다."
   */
  getErrorState(): Locator {
    return this.page.getByText('공고를 불러올 수 없습니다');
  }
}
