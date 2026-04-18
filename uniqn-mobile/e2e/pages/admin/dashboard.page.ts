/**
 * Admin Dashboard Page Object
 * 참조: app/(admin)/index.tsx, app/(admin)/stats/index.tsx
 *
 * NOTE: admin 레이아웃은 권한 체크 후 렌더링되므로
 * 앱 초기화(15-20초)가 완료될 때까지 대기가 필요합니다.
 */
import type { Page, Locator } from '@playwright/test';
import { BasePage } from '../base.page';

export class AdminDashboardPage extends BasePage {
  readonly title: Locator;
  readonly subtitle: Locator;

  constructor(page: Page) {
    super(page);
    // app/(admin)/index.tsx: 신고 관리 링크 카드 (항상 표시, link role로 접근)
    this.title = page.getByRole('link', { name: /신고 관리/ });
    // app/(admin)/index.tsx: 서브텍스트
    this.subtitle = page.getByText('주요 운영 화면을 한 곳에서 빠르게 확인합니다.');
  }

  async goto(): Promise<void> {
    await this.page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /** 대시보드 메뉴 카드 클릭 */
  async clickMenuCard(
    label:
      | '대회공고 승인'
      | '사용자 관리'
      | '신고 관리'
      | '문의 관리'
      | '시스템 설정'
      | '통계'
      | '보안 로그'
      | '공지사항 관리'
  ): Promise<void> {
    await this.page.getByText(label).click();
  }

  /** 메뉴 카드 표시 여부 확인 (link role 사용 — Text 요소는 hidden 처리됨) */
  getMenuCard(label: string): Locator {
    return this.page.getByRole('link', { name: new RegExp(label) });
  }

  /** 통계 페이지로 이동 */
  async gotoStats(): Promise<void> {
    await this.page.goto('/admin/stats', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /** 주요 지표 섹션 (stats/index.tsx: "주요 지표") */
  get statsSection(): Locator {
    return this.page.getByText('주요 지표');
  }

  /** 통계 카드 값 가져오기 */
  getStatCard(label: string): Locator {
    return this.page.getByText(label);
  }

  /** 7일 트렌드 섹션 (stats/index.tsx: "7일 트렌드") */
  get trendSection(): Locator {
    return this.page.getByText('7일 트렌드');
  }

  /** 최근 가입자 섹션 (stats/index.tsx: "최근 가입자") */
  get recentUsersSection(): Locator {
    return this.page.getByText('최근 가입자');
  }

  /** 마지막 업데이트 시간 (stats/index.tsx: "마지막 업데이트:") */
  get lastUpdateTime(): Locator {
    return this.page.getByText(/마지막 업데이트:/);
  }

  /** 에러 메시지 확인 (stats/index.tsx: "데이터를 불러오는데 실패했습니다") */
  get errorMessage(): Locator {
    return this.page.getByText(/데이터를 불러오는데 실패했습니다/);
  }
}
