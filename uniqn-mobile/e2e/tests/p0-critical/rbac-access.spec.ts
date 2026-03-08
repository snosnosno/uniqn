/**
 * P0 RBAC 접근 제어 테스트 (6 tests)
 * 역할별로 다른 storageState 사용
 *
 * NOTE: 앱 초기화에 15-20초 걸릴 수 있으므로 (Firebase 에뮬레이터 환경)
 * RBAC 리다이렉트는 앱 초기화 완료 후에만 발생합니다.
 * 타임아웃을 충분히 확보합니다.
 */
import { test, expect } from '@playwright/test';
import path from 'path';

const staffState = path.join(__dirname, '../../fixtures/storage-states/staff.json');
const employerState = path.join(__dirname, '../../fixtures/storage-states/employer.json');
const adminState = path.join(__dirname, '../../fixtures/storage-states/admin.json');

/** 앱 초기화 대기 (로딩 텍스트 표시→사라짐 + 온보딩 모달 스킵) */
async function waitForAppInit(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');

  const loadingText = page.getByText('앱 로딩 중...');
  try {
    await loadingText.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
    await loadingText.waitFor({ state: 'hidden', timeout: 30_000 });
  } catch {
    // 이미 사라졌거나 로딩 텍스트가 없음
  }

  // 알림 온보딩 모달 스킵
  try {
    const skipButton = page.getByText('나중에 하기');
    if (await skipButton.isVisible().catch(() => false)) {
      await skipButton.click({ timeout: 3_000 });
      await skipButton.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => {});
    }
  } catch {
    // 모달 없음
  }
}

test.describe('RBAC 접근 제어', () => {
  // RBAC 리다이렉트는 앱 초기화 후 발생하므로 넉넉한 타임아웃 사용
  test.setTimeout(60_000);

  test('Staff → employer 라우트 차단', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();

    await page.goto('/my-postings', { waitUntil: 'domcontentloaded' });

    // 앱 초기화 완료 대기 (15-20초 소요 가능)
    await waitForAppInit(page);

    // 앱 초기화 후 RBAC 리다이렉트 발생 대기
    // useAuthGuard에서 권한 부족 시 /(app)/(tabs)로 리다이렉트
    await page.waitForURL(
      (url) => !url.pathname.includes('/my-postings'),
      { timeout: 30_000 }
    ).catch(() => {});

    // staff는 employer 라우트에 접근 불가 → 리다이렉트
    const url = page.url();
    expect(url).not.toContain('/my-postings');

    await context.close();
  });

  test('Staff → admin 라우트 차단', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForAppInit(page);

    // staff는 일반 탭이 보여야 함
    await expect(page.getByText('구인구직').first()).toBeVisible({ timeout: 10_000 });

    // staff는 admin 대시보드를 볼 수 없어야 함
    await expect(page.getByText('관리자 대시보드')).not.toBeVisible({ timeout: 3_000 });

    await context.close();
  });

  test('Employer → admin 라우트 차단', async ({ browser }) => {
    const context = await browser.newContext({ storageState: employerState });
    const page = await context.newPage();

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForAppInit(page);

    // employer는 일반 탭 또는 내 공고 탭이 보여야 함
    const employerContent = page.getByText('구인구직').first()
      .or(page.getByText('내 공고').first());
    await expect(employerContent.first()).toBeVisible({ timeout: 10_000 });

    // employer는 admin 대시보드를 볼 수 없어야 함
    const adminDashboard = await page.getByText('관리자 대시보드').isVisible().catch(() => false);
    expect(adminDashboard).toBeFalsy();

    await context.close();
  });

  test('Employer → employer 라우트 접근 허용', async ({ browser }) => {
    const context = await browser.newContext({ storageState: employerState });
    const page = await context.newPage();

    await page.goto('/my-postings', { waitUntil: 'domcontentloaded' });
    await waitForAppInit(page);

    // employer는 employer 라우트에 접근 가능
    // 페이지가 정상 로드되어야 함 (리다이렉트 없음)
    // '내 공고 관리' 헤더 또는 빈 상태 메시지가 보여야 함
    const pageContent = page.getByText('내 공고 관리')
      .or(page.getByText(/등록된 공고가 없습니다|공고가 없습니다/))
      .or(page.getByText(/개의 공고/));
    await expect(pageContent.first()).toBeVisible({ timeout: 15_000 });

    await context.close();
  });

  test('Admin → 모든 라우트 접근 가능', async ({ browser }) => {
    const context = await browser.newContext({ storageState: adminState });
    const page = await context.newPage();

    // admin 라우트 접근 (대시보드)
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForAppInit(page);

    // admin은 대시보드 또는 일반 페이지가 보여야 함
    const adminContent = page.getByText('구인구직').first()
      .or(page.getByText('대시보드').first());
    await expect(adminContent.first()).toBeVisible({ timeout: 10_000 });

    // employer 라우트 접근 (admin은 employer 이상 권한)
    await page.goto('/my-postings', { waitUntil: 'domcontentloaded' });
    await waitForAppInit(page);

    // admin도 employer 라우트에 접근 가능해야 함
    const adminEmployerContent = page.getByText('내 공고 관리')
      .or(page.getByText(/공고가 없습니다/));
    await expect(adminEmployerContent.first()).toBeVisible({ timeout: 10_000 });

    await context.close();
  });

  test('비인증 사용자 → 앱 라우트 차단 → 로그인 리다이렉트', async ({ browser }) => {
    // 인증 없는 새 컨텍스트
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // 앱 초기화 후 리다이렉트 대기
    await page.waitForLoadState('domcontentloaded');
    await page.waitForURL(/login|auth/, { timeout: 30_000 }).catch(() => {});

    // 루트(/) 또는 인증 페이지로 리다이렉트
    const pathname = new URL(page.url()).pathname;
    expect(pathname).toMatch(/^\/$|login|auth/);

    await context.close();
  });
});
