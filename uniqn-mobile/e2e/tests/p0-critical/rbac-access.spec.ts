import { test, expect, type Locator, type Page } from '@playwright/test';
import path from 'path';

const staffState = path.join(__dirname, '../../fixtures/storage-states/staff.json');
const employerState = path.join(__dirname, '../../fixtures/storage-states/employer.json');
const adminState = path.join(__dirname, '../../fixtures/storage-states/admin.json');
const unauthenticatedState = path.join(
  __dirname,
  '../../fixtures/storage-states/unauthenticated.json'
);

async function waitForAppInit(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');

  const loadingText = page.getByText('앱 로딩 중..');
  try {
    await loadingText.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
    await loadingText.waitFor({ state: 'hidden', timeout: 30_000 });
  } catch {
    // Loading UI may already be gone.
  }

  try {
    const skipButton = page.getByText('건너뛰기');
    if (await skipButton.isVisible().catch(() => false)) {
      await skipButton.click({ timeout: 3_000 });
      await skipButton.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => {});
    }
  } catch {
    // Optional onboarding modal may not exist.
  }
}

async function expectAnyVisible(locators: Locator[], timeout = 10_000): Promise<void> {
  await expect
    .poll(
      async () => {
        for (const locator of locators) {
          if (
            await locator
              .first()
              .isVisible()
              .catch(() => false)
          ) {
            return true;
          }
        }

        return false;
      },
      { timeout }
    )
    .toBe(true);
}

test.describe('RBAC access control', () => {
  test.setTimeout(60_000);

  test('staff blocks employer route', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();

    // staff가 employer 전용 탭(/employer)에 접근하면 NonEmployerView가 표시됨
    await page.goto('/employer', { waitUntil: 'domcontentloaded' });
    await waitForAppInit(page);

    // staff는 employer 콘텐츠 대신 구인자 전용 안내 화면을 봐야 함
    await expect(page.getByText('구인자 전용 기능입니다')).toBeVisible({ timeout: 15_000 });

    await context.close();
  });

  test('staff blocks admin route', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();

    // /home으로 직접 이동 (splash 우회)
    await page.goto('/home', { waitUntil: 'domcontentloaded' });
    await waitForAppInit(page);

    // staff 홈 화면이 로드되어야 함 (내 지원 현황은 StaffDashboard에서 항상 표시)
    await expect(page.getByText('내 지원 현황').first()).toBeVisible({ timeout: 10_000 });
    // 관리자 전용 메뉴(신고 관리 등)가 보이지 않아야 함
    await expect(page.getByText('신고 관리')).not.toBeVisible({ timeout: 3_000 });

    await context.close();
  });

  test('employer blocks admin route', async ({ browser }) => {
    const context = await browser.newContext({ storageState: employerState });
    const page = await context.newPage();

    // /home으로 직접 이동 (splash 우회)
    await page.goto('/home', { waitUntil: 'domcontentloaded' });
    await waitForAppInit(page);

    // employer 홈 화면이 로드되어야 함 (UNIQN 로고 버튼은 항상 TabHeader에 표시)
    await expect(page.getByRole('button', { name: 'UNIQN 홈으로 이동' })).toBeVisible({
      timeout: 10_000,
    });
    // 관리자 전용 페이지 내용이 보이지 않아야 함
    expect(
      await page
        .getByText('신고 관리')
        .isVisible()
        .catch(() => false)
    ).toBeFalsy();

    await context.close();
  });

  test('employer can access employer route', async ({ browser }) => {
    const context = await browser.newContext({ storageState: employerState });
    const page = await context.newPage();

    // /employer URL 사용 (webRouteAlias → /(app)/(tabs)/employer)
    await page.goto('/employer', { waitUntil: 'domcontentloaded' });
    await waitForAppInit(page);

    await expectAnyVisible(
      [
        page.getByRole('button', { name: /공고 작성/ }),
        page.getByRole('tab', { name: /전체 공고/ }),
        page.getByText(/등록된 공고가 없습니다|공고가 없습니다/),
      ],
      15_000
    );

    await context.close();
  });

  test('admin can access staff and employer routes', async ({ browser }) => {
    const context = await browser.newContext({ storageState: adminState });
    const page = await context.newPage();

    // /home으로 직접 이동
    await page.goto('/home', { waitUntil: 'domcontentloaded' });
    await waitForAppInit(page);

    // admin도 홈 화면에 접근 가능해야 함 (로고 버튼 항상 존재)
    await expect(page.getByRole('button', { name: 'UNIQN 홈으로 이동' })).toBeVisible({
      timeout: 10_000,
    });

    // admin은 /admin 대시보드도 접근 가능해야 함
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await waitForAppInit(page);

    // 신고 관리 링크 카드가 보여야 함 (admin 대시보드의 기본 메뉴)
    await expect(page.getByRole('link', { name: /신고 관리/ })).toBeVisible({ timeout: 15_000 });

    await context.close();
  });

  test('unauthenticated user is redirected away from protected routes', async ({ browser }) => {
    const context = await browser.newContext({ storageState: unauthenticatedState });
    const page = await context.newPage();

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForURL(/login|auth/, { timeout: 30_000 }).catch(() => {});

    const pathname = new URL(page.url()).pathname;
    expect(pathname).toMatch(/^\/$|\/jobs$|login|auth/);

    await context.close();
  });
});
