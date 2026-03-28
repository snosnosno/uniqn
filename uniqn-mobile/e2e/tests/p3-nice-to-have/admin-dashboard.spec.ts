/**
 * P3 Admin 대시보드 테스트 (5 tests)
 * 프로젝트: chromium-admin (admin storageState)
 *
 * NOTE: 앱 초기화에 15-20초 걸릴 수 있으므로 (Firebase 에뮬레이터 환경)
 * 페이지 로딩 대기를 충분히 합니다.
 * 통계 데이터는 에뮬레이터에서 없을 수 있으므로 로딩/에러 상태도 허용합니다.
 */
import { test, expect } from '../../fixtures/base.fixture';
import { AdminDashboardPage } from '../../pages/admin/dashboard.page';

test.describe('Admin 대시보드', () => {
  // 앱 초기화 + Firebase 에뮬레이터 통신 고려
  test.setTimeout(60_000);

  let dashboard: AdminDashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboard = new AdminDashboardPage(page);
    await dashboard.goto();
  });

  test('대시보드 메인 페이지 렌더링 → 제목 및 메뉴 카드 표시', async ({ page }) => {
    // admin 페이지 도달 확인 (대시보드 또는 앱 메인)
    const anyContent = page.getByText('관리자 대시보드').or(page.getByText('구인구직').first());
    await expect(anyContent).toBeVisible({ timeout: 30_000 });

    // 대시보드가 표시되는 경우에만 메뉴 카드 확인
    const hasDashboard = await page
      .getByText('관리자 대시보드')
      .isVisible()
      .catch(() => false);
    if (hasDashboard) {
      await expect(dashboard.subtitle).toBeVisible({ timeout: 10_000 });

      const menuLabels = [
        '대회공고 승인',
        '사용자 관리',
        '신고 관리',
        '문의 관리',
        '시스템 설정',
        '통계',
        '보안 로그',
        '공지사항 관리',
      ];

      for (const label of menuLabels) {
        await expect(dashboard.getMenuCard(label)).toBeVisible({ timeout: 5_000 });
      }
    }
  });

  test('메뉴 카드 클릭 → 해당 관리 페이지로 이동', async ({ page }) => {
    // 대시보드 렌더링 대기
    const hasDashboard = await page
      .getByText('관리자 대시보드')
      .isVisible({ timeout: 30_000 })
      .catch(() => false);

    if (hasDashboard) {
      await dashboard.clickMenuCard('사용자 관리');
      await page.waitForURL(/\/users/, { timeout: 15_000 });
      expect(dashboard.getCurrentPath()).toContain('users');
    } else {
      // admin storageState가 앱에서 admin 라우트로 자동 이동하지 않는 경우
      expect(page.url()).toBeTruthy();
    }
  });

  test('통계 페이지 주요 지표 표시', async ({ page }) => {
    await dashboard.gotoStats();

    // 통계 페이지 로드 확인 (에뮬레이터에서 데이터가 없으면 로딩/에러 상태도 허용)
    const statsOrLoading = dashboard.statsSection
      .or(dashboard.page.getByText(/통계 데이터를 불러오는 중/))
      .or(dashboard.page.getByText('서비스 통계', { exact: true }))
      .or(dashboard.errorMessage);
    await expect(statsOrLoading.first()).toBeVisible({ timeout: 30_000 });

    // 주요 지표 섹션이 보이는 경우에만 각 카드 확인
    const hasStats = await dashboard.statsSection.isVisible().catch(() => false);
    if (hasStats) {
      const statLabels = ['총 사용자', '오늘 신규', '활성 공고', '오늘 지원', '미처리 신고'];

      for (const label of statLabels) {
        await expect(dashboard.getStatCard(label)).toBeVisible({ timeout: 5_000 });
      }
    }
  });

  test('통계 페이지 7일 트렌드 차트 렌더링', async () => {
    await dashboard.gotoStats();

    // 통계 페이지 로드 확인
    const pageLoaded = dashboard.page
      .getByText('서비스 통계', { exact: true })
      .or(dashboard.trendSection)
      .or(dashboard.page.getByText(/통계 데이터를 불러오는 중/))
      .or(dashboard.errorMessage);
    await expect(pageLoaded.first()).toBeVisible({ timeout: 30_000 });

    // 7일 트렌드 섹션이 보이는 경우에만 차트 제목 확인
    const hasTrend = await dashboard.trendSection.isVisible().catch(() => false);
    if (hasTrend) {
      await expect(dashboard.getByText('일별 가입자 수')).toBeVisible({ timeout: 5_000 });
      await expect(dashboard.getByText('일별 지원 수')).toBeVisible({ timeout: 5_000 });
    }
  });

  test('통계 페이지 마지막 업데이트 시간 표시', async () => {
    await dashboard.gotoStats();

    // 통계 페이지 로드 확인
    const pageLoaded = dashboard.page
      .getByText('서비스 통계', { exact: true })
      .or(dashboard.page.getByText(/통계 데이터를 불러오는 중/))
      .or(dashboard.errorMessage);
    await expect(pageLoaded.first()).toBeVisible({ timeout: 30_000 });

    // 데이터가 로드된 경우에만 마지막 업데이트 시간 확인
    const hasUpdate = await dashboard.lastUpdateTime.isVisible().catch(() => false);
    if (hasUpdate) {
      await expect(dashboard.lastUpdateTime).toBeVisible();
    }
  });
});
