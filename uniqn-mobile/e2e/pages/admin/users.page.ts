/**
 * Admin Users Management Page Object
 * 참조: app/(admin)/users/index.tsx, app/(admin)/users/[id].tsx
 */
import type { Page, Locator } from '@playwright/test';
import { BasePage } from '../base.page';

export class AdminUsersPage extends BasePage {
  readonly searchInput: Locator;
  readonly userCount: Locator;
  readonly loadMoreButton: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    super(page);
    this.searchInput = page.getByPlaceholder('이름 또는 이메일로 검색');
    this.userCount = page.getByText(/총 \d+명의 사용자/);
    this.loadMoreButton = page.getByText('더 보기');
    this.emptyState = page.getByText('검색 결과 없음');
  }

  async goto(): Promise<void> {
    await this.page.goto('/users', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /** 역할 필터 탭 클릭 */
  async clickRoleFilter(
    role: '전체' | '관리자' | '구인자' | '스태프'
  ): Promise<void> {
    // Use .first() to target the filter chip at top (appears before content)
    await this.page.getByText(role, { exact: true }).first().click();
  }

  /** 검색 실행 */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500);
  }

  /** 사용자 카드 클릭 (이름으로) */
  async clickUserCard(userName: string): Promise<void> {
    await this.page.getByText(userName).click();
  }

  /** 사용자 카드가 존재하는지 확인 */
  getUserCard(userName: string): Locator {
    return this.page.getByText(userName);
  }

  /** 역할 배지 확인 */
  getRoleBadge(roleName: '관리자' | '구인자' | '스태프'): Locator {
    return this.page.getByText(roleName, { exact: true });
  }

  // ── 상세 페이지 ──

  /** 사용자 상세 페이지로 이동 */
  async gotoUserDetail(userId: string): Promise<void> {
    await this.page.goto(`/users/${userId}`, { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /** 기본 정보 섹션 */
  get basicInfoSection(): Locator {
    return this.page.getByText('기본 정보');
  }

  /** 역할 관리 섹션 */
  get roleManagementSection(): Locator {
    return this.page.getByText('역할 관리');
  }

  /** 계정 관리 섹션 */
  get accountManagementSection(): Locator {
    return this.page.getByText('계정 관리');
  }

  /** 역할 변경 선택 */
  async selectRole(role: '스태프' | '구인자' | '관리자'): Promise<void> {
    await this.page.getByText(role, { exact: true }).click();
  }

  /** 역할 변경 버튼 */
  get changeRoleButton(): Locator {
    return this.page.getByText('역할 변경', { exact: true });
  }

  /** 계정 비활성화/활성화 버튼 */
  get toggleAccountButton(): Locator {
    return this.page.getByText(/계정 비활성화|계정 활성화/);
  }
}
