/**
 * Jobs home page object.
 */
import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../../base.page';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class HomePage extends BasePage {
  readonly searchInput: Locator;
  readonly header: Locator;

  constructor(page: Page) {
    super(page);
    this.searchInput = page.getByPlaceholder('제목, 장소로 검색');
    // 탭 진입 시 이전 /home 화면이 DOM 에 mounted-hidden 으로 남아 HomeTabBar 의 '구인구직'
    // 라벨이 .first() 로 잡히는 문제 → 보이는 요소로 스코프.
    this.header = page.getByText('구인구직').filter({ visible: true }).first();
  }

  async goto(): Promise<void> {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();

    // 이미 jobs 화면(검색바 노출)이면 바로 종료.
    if (await this.searchInput.isVisible().catch(() => false)) {
      return;
    }

    // featureFlags.home_dashboard_enabled=true(default) → staff 가 (app)/home (standalone screen)
    // 으로 redirect 됨. /home 에서 (tabs) 진입 경로:
    //   1) NextWorkWidget empty-state CTA "공고 보기" (스케줄 없는 경우)
    //   2) HomeTabBar "구인구직 탭으로 이동" (스케줄 유무 무관 항상 표시)
    //
    // ⚠️ storageState 부팅 시 page.goto('/') 직후엔 URL 이 아직 '/'(splash) 이고
    // useAuthGuard 의 '/' → /home redirect 가 waitForReady 이후 비동기로 일어난다.
    // redirect 전에 버튼을 찾으면 splash 위라 버튼이 없어 click 이 no-op 으로 사라진다.
    // → 홈 대시보드 진입(버튼 등장)을 먼저 기다린 뒤 클릭한다.
    const jobsTabButton = this.page.getByRole('button', { name: '구인구직 탭으로 이동' }).first();
    const viewJobsButton = this.page.getByRole('button', { name: '공고 보기' }).first();

    await Promise.race([
      jobsTabButton.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {}),
      this.searchInput.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {}),
    ]);

    if (await this.searchInput.isVisible().catch(() => false)) {
      return;
    }

    // no-op click 방어: jobs 화면(검색바) 도달까지 최대 2회 클릭 시도.
    const navigateToJobs = async (): Promise<boolean> => {
      if (await jobsTabButton.isVisible().catch(() => false)) {
        await jobsTabButton.click();
      } else if (await viewJobsButton.isVisible().catch(() => false)) {
        await viewJobsButton.click();
      } else {
        return false;
      }
      await this.searchInput.waitFor({ state: 'visible', timeout: 8_000 }).catch(() => {});
      return this.searchInput.isVisible().catch(() => false);
    };

    if (!(await navigateToJobs())) {
      await navigateToJobs();
    }
  }

  async selectTypeChip(label: '긴급' | '대회' | '일반' | '고정'): Promise<void> {
    await this.getTypeChip(label).click();
  }

  /**
   * PostingTypeChips a11y label:
   *   - count 있음: `긴급 공고 12건`
   *   - count 없음: `긴급 공고 필터`
   * 둘 다 매칭하려면 regex 에 `(필터|\d+건)` 분기 필요.
   */
  getTypeChip(label: string): Locator {
    return this.page.getByRole('button', {
      name: new RegExp(`^${escapeRegExp(label)}\\s*공고\\s*(필터|\\d+건)$`),
    });
  }

  async search(text: string): Promise<void> {
    await this.searchInput.fill(text);
  }

  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
  }

  getEmptySearchMessage(searchText: string): Locator {
    return this.page.getByText(`'${searchText}' 검색 결과가 없습니다`);
  }

  async clickJobCard(index: number): Promise<void> {
    const cards = this.page.locator('[accessibilityRole="button"]');
    await cards.nth(index).click();
  }

  async waitForJobsLoaded(): Promise<void> {
    const spinner = this.page.locator('ActivityIndicator, [role="progressbar"]');
    try {
      await spinner.waitFor({ state: 'hidden', timeout: 10_000 });
    } catch {
      // The list was already stable.
    }
  }

  isDateCalendarVisible(): Promise<boolean> {
    return this.page.locator('[aria-label*="날짜"]').isVisible();
  }
}
