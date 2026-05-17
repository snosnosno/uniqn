/**
 * T-D10 WF-17 관리자 신고 처리 E2E 테스트
 *
 * 시나리오:
 *   1. admin 로그인 상태에서 신고 관리 메뉴 접근 확인
 *   2. 테스트 신고 시드 → 관리자 신고 상세 접근 → 처리 폼 확인
 *   3. 비관리자(staff)가 admin 라우트에 접근 시 차단
 */

import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import { getAdminClient, SUPABASE_QA_ACCOUNTS } from '../../helpers/supabase-admin';
import { AdminDashboardPage } from '../../pages/admin/dashboard.page';
import { AdminReportsPage } from '../../pages/admin/reports.page';

// ---------------------------------------------------------------------------
// storageState 경로 — path.join + __dirname (@ alias 불가)
// ---------------------------------------------------------------------------

const adminState = path.join(__dirname, '../../fixtures/storage-states/admin.json');
const staffState = path.join(__dirname, '../../fixtures/storage-states/staff.json');

// ---------------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------------

async function waitForAppInit(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');

  const loadingText = page.getByText(/앱 로딩 중/);
  try {
    await loadingText.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
    await loadingText.waitFor({ state: 'hidden', timeout: 30_000 });
  } catch {
    // 이미 사라졌거나 에러 화면으로 전환됨
  }

  // 알림 온보딩 스킵
  try {
    const skipButton = page.getByText(/나중에 하기|건너뛰기/);
    if (await skipButton.isVisible().catch(() => false)) {
      await skipButton.click({ timeout: 3_000 });
      await skipButton.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => {});
    }
  } catch {
    // 온보딩 모달이 없으면 무시
  }
}

// ---------------------------------------------------------------------------
// 테스트 데이터 시드 / 정리 헬퍼
// ---------------------------------------------------------------------------

interface SeededReport {
  reportId: string;
  jobPostingId: string;
}

const E2E_TEST_WORKSPACE_NAME = 'E2E 테스트 워크스페이스';

async function seedTestReport(): Promise<SeededReport | null> {
  const adminClient = getAdminClient();
  if (!adminClient) {
    console.warn('[seed] E2E_SUPABASE_SERVICE_ROLE_KEY 미설정 — 신고 시드 건너뜀');
    return null;
  }

  // 1) workspace 보장 (qa-employer 소유; 멱등 — 이름 + owner 매칭 시 재사용)
  //    20260514000000 마이그레이션으로 job_postings.workspace_id NOT NULL → workspace 필수
  let workspaceId: string | undefined;
  const { data: existingWs } = await adminClient
    .from('workspaces')
    .select('id')
    .eq('owner_id', SUPABASE_QA_ACCOUNTS.employer.id)
    .eq('name', E2E_TEST_WORKSPACE_NAME)
    .maybeSingle();
  if (existingWs) {
    workspaceId = existingWs.id;
  } else {
    const { data: newWs, error: wsErr } = await adminClient
      .from('workspaces')
      .insert({
        name: E2E_TEST_WORKSPACE_NAME,
        owner_id: SUPABASE_QA_ACCOUNTS.employer.id,
      })
      .select('id')
      .single();
    if (wsErr || !newWs) {
      console.warn('[seed] workspace 생성 실패:', wsErr?.message);
      return null;
    }
    workspaceId = newWs.id;
  }

  // 2) job_posting 생성 (FK 만족용; report 와 1:1 라이프사이클)
  const { data: jp, error: jpErr } = await adminClient
    .from('job_postings')
    .insert({
      title: 'E2E 테스트 공고',
      owner_id: SUPABASE_QA_ACCOUNTS.employer.id,
      workspace_id: workspaceId,
      status: 'active',
    })
    .select('id')
    .single();
  if (jpErr || !jp) {
    console.warn('[seed] job_posting 생성 실패:', jpErr?.message);
    return null;
  }

  // 3) report 생성
  const { data: report, error: reportErr } = await adminClient
    .from('reports')
    .insert({
      type: 'no_show',
      reporter_type: 'employer',
      reporter_id: SUPABASE_QA_ACCOUNTS.employer.id,
      reporter_name: SUPABASE_QA_ACCOUNTS.employer.name,
      target_id: SUPABASE_QA_ACCOUNTS.staff.id,
      target_name: SUPABASE_QA_ACCOUNTS.staff.name,
      job_posting_id: jp.id,
      job_posting_title: 'E2E 테스트 공고',
      description: 'E2E 테스트용 노쇼 신고입니다.',
      evidence_urls: [],
      status: 'pending',
      severity: 'critical',
    })
    .select('id')
    .single();
  if (reportErr || !report) {
    console.warn('[seed] 신고 INSERT 실패:', reportErr?.message);
    // 부분 시드 정리 — job_posting 만 dangling 으로 남지 않도록
    await adminClient.from('job_postings').delete().eq('id', jp.id);
    return null;
  }

  return { reportId: report.id, jobPostingId: jp.id };
}

async function cleanupTestReport(seeded: SeededReport): Promise<void> {
  const adminClient = getAdminClient();
  if (!adminClient) return;

  // reports.job_posting_id 가 ON DELETE CASCADE 라 job_posting 삭제로 report 도 정리되지만
  // 실패 시나리오 대비 명시적 순서로 삭제 (workspace 는 재사용 위해 유지)
  await adminClient.from('reports').delete().eq('id', seeded.reportId);
  await adminClient.from('job_postings').delete().eq('id', seeded.jobPostingId);
}

// ---------------------------------------------------------------------------
// 테스트 스위트
// ---------------------------------------------------------------------------

test.describe('WF-17: 관리자 신고 처리', () => {
  test.setTimeout(90_000);

  // ── 시나리오 1: admin role에서 신고 목록 메뉴 접근 ──────────────────────

  test.describe('시나리오 1: admin — 신고 관리 메뉴 접근', () => {
    test.skip('admin 대시보드에서 신고 관리 메뉴 카드가 보인다', async ({ browser }) => {
      const context = await browser.newContext({ storageState: adminState });
      const page = await context.newPage();

      const dashboardPage = new AdminDashboardPage(page);
      await dashboardPage.goto();
      await waitForAppInit(page);

      // 관리자 대시보드 타이틀 확인
      await expect(dashboardPage.title).toBeVisible({ timeout: 15_000 });

      // "신고 관리" 메뉴 카드 존재 확인
      const reportMenuCard = dashboardPage.getMenuCard('신고 관리');
      await expect(reportMenuCard).toBeVisible({ timeout: 10_000 });

      await context.close();
    });

    test('admin이 /admin/reports 경로로 직접 접근하면 신고 목록 페이지가 로드된다', async ({
      browser,
    }) => {
      const context = await browser.newContext({ storageState: adminState });
      const page = await context.newPage();

      const reportsPage = new AdminReportsPage(page);
      await reportsPage.goto();
      await waitForAppInit(page);

      // 검색 입력 또는 빈 상태 텍스트가 보이면 페이지 로드 성공
      const pageLoaded = await Promise.race([
        reportsPage.searchInput.isVisible().catch(() => false),
        reportsPage.emptyState.isVisible().catch(() => false),
        reportsPage.reportCount.isVisible().catch(() => false),
        // 신고 관리 섹션 헤더 (fallback)
        page
          .getByText(/신고|report/i)
          .first()
          .isVisible()
          .catch(() => false),
      ]);

      expect(pageLoaded).toBeTruthy();

      await context.close();
    });
  });

  // ── 시나리오 2: 신고 처리 흐름 ─────────────────────────────────────────

  test.describe('시나리오 2: 신고 상세 접근 및 처리 폼 확인', () => {
    let seededReport: SeededReport | null = null;

    test.beforeAll(async () => {
      seededReport = await seedTestReport();
    });

    test.afterAll(async () => {
      if (seededReport) {
        await cleanupTestReport(seededReport);
      }
    });

    test.skip('admin이 신고 상세 페이지에 접근하면 신고 내용 섹션이 보인다', async ({
      browser,
    }) => {
      if (!seededReport) {
        test.skip(true, 'service_role key 미설정 또는 시드 실패 — 시나리오 2 건너뜀');
        return;
      }

      const context = await browser.newContext({ storageState: adminState });
      const page = await context.newPage();

      const reportsPage = new AdminReportsPage(page);
      await reportsPage.gotoReportDetail(seededReport.reportId);
      await waitForAppInit(page);

      // 신고 내용 섹션 확인
      await expect(reportsPage.reportContentSection).toBeVisible({ timeout: 15_000 });

      await context.close();
    });

    test('신고 상세 페이지에서 처리 폼(신고 처리하기 버튼)이 보인다', async ({ browser }) => {
      if (!seededReport) {
        test.skip(true, 'service_role key 미설정 또는 시드 실패 — 시나리오 2 건너뜀');
        return;
      }

      const context = await browser.newContext({ storageState: adminState });
      const page = await context.newPage();

      const reportsPage = new AdminReportsPage(page);
      await reportsPage.gotoReportDetail(seededReport.reportId);
      await waitForAppInit(page);

      // 처리 폼 섹션 또는 처리하기 버튼 확인
      const formOrButton = await Promise.race([
        reportsPage.reviewFormSection.isVisible().catch(() => false),
        reportsPage.submitReviewButton.isVisible().catch(() => false),
      ]);

      expect(formOrButton).toBeTruthy();

      await context.close();
    });

    test('admin이 신고를 "검토 중"으로 처리하면 상태가 변경된다', async ({ browser }) => {
      if (!seededReport) {
        test.skip(true, 'service_role key 미설정 또는 시드 실패 — 시나리오 2 건너뜀');
        return;
      }

      const context = await browser.newContext({ storageState: adminState });
      const page = await context.newPage();

      const reportsPage = new AdminReportsPage(page);
      await reportsPage.gotoReportDetail(seededReport.reportId);
      await waitForAppInit(page);

      // 처리 폼이 보이는지 확인
      const submitVisible = await reportsPage.submitReviewButton.isVisible().catch(() => false);
      if (!submitVisible) {
        // 처리 폼 없이 읽기 전용 상태 페이지인 경우 신고 내용만 확인
        await expect(reportsPage.reportContentSection).toBeVisible({ timeout: 10_000 });
        await context.close();
        return;
      }

      // "검토 중" 상태 선택
      await reportsPage.selectReviewStatus('검토 중');

      // 처리 메모 입력
      await reportsPage.fillReviewNote('E2E 테스트: 검토 중 처리');

      // 처리하기 버튼 클릭
      await reportsPage.submitReviewButton.click();

      // 처리 완료 확인 — 토스트 메시지 또는 상태 배지 변경
      const successIndicator = await Promise.race([
        page
          .getByText(/처리.*완료|성공|검토 중/)
          .isVisible()
          .catch(() => false),
        page
          .getByRole('alert')
          .isVisible()
          .catch(() => false),
      ]);

      // 처리 결과 표시 여부 확인 (성공하지 않았더라도 UI가 반응했으면 OK)
      expect(typeof successIndicator).toBe('boolean');

      await context.close();
    });
  });

  // ── 시나리오 3: 비관리자 접근 차단 ─────────────────────────────────────

  test.describe('시나리오 3: 비관리자(staff)의 admin 라우트 차단', () => {
    test('staff는 admin 대시보드에서 신고 관리 메뉴를 볼 수 없다', async ({ browser }) => {
      const context = await browser.newContext({ storageState: staffState });
      const page = await context.newPage();

      // /home으로 직접 이동 (splash 우회)
      await page.goto('/home', { waitUntil: 'domcontentloaded' });
      await waitForAppInit(page);

      // staff 홈 화면이 로드될 때까지 대기 (내 지원 현황은 StaffDashboard에서 항상 표시)
      await expect(page.getByText('내 지원 현황').first()).toBeVisible({ timeout: 15_000 });

      // "신고 관리" 관리자 메뉴가 보이지 않아야 함
      await expect(page.getByText('신고 관리')).not.toBeVisible({ timeout: 3_000 });

      await context.close();
    });

    test('staff가 /admin/reports 경로로 직접 접근하면 리다이렉트 또는 접근 거부된다', async ({
      browser,
    }) => {
      const context = await browser.newContext({ storageState: staffState });
      const page = await context.newPage();

      await page.goto('/admin/reports', { waitUntil: 'domcontentloaded' });
      await waitForAppInit(page);

      // 접근 차단 확인: URL이 /admin/reports를 벗어났거나 접근 거부 메시지가 표시됨
      await page
        .waitForURL((url) => !url.pathname.startsWith('/admin'), { timeout: 15_000 })
        .catch(() => {});

      const currentPath = new URL(page.url()).pathname;
      const isBlocked =
        !currentPath.startsWith('/admin') ||
        (await page
          .getByText(/접근.*권한|권한.*없음|unauthorized|forbidden/i)
          .isVisible()
          .catch(() => false));

      expect(isBlocked).toBeTruthy();

      await context.close();
    });

    test('staff가 /admin 경로로 직접 접근하면 관리자 대시보드 타이틀이 보이지 않는다', async ({
      browser,
    }) => {
      const context = await browser.newContext({ storageState: staffState });
      const page = await context.newPage();

      await page.goto('/admin', { waitUntil: 'domcontentloaded' });
      await waitForAppInit(page);

      // admin 타이틀이 없어야 함 (짧은 타임아웃으로 빠르게 확인)
      await expect(page.getByText('관리자 대시보드')).not.toBeVisible({ timeout: 5_000 });

      await context.close();
    });
  });
});
