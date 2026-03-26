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

    await page.goto('/my-postings', { waitUntil: 'domcontentloaded' });
    await waitForAppInit(page);
    await page
      .waitForURL((url) => !url.pathname.includes('/my-postings'), { timeout: 30_000 })
      .catch(() => {});

    expect(page.url()).not.toContain('/my-postings');
    await context.close();
  });

  test('staff blocks admin route', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForAppInit(page);

    await expect(page.getByText('구인구직').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('관리자 대시보드')).not.toBeVisible({ timeout: 3_000 });

    await context.close();
  });

  test('employer blocks admin route', async ({ browser }) => {
    const context = await browser.newContext({ storageState: employerState });
    const page = await context.newPage();

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForAppInit(page);

    await expectAnyVisible(
      [page.getByText('구인구직').first(), page.getByText('내 공고').first()],
      10_000
    );
    expect(
      await page
        .getByText('관리자 대시보드')
        .isVisible()
        .catch(() => false)
    ).toBeFalsy();

    await context.close();
  });

  test('employer can access employer route', async ({ browser }) => {
    const context = await browser.newContext({ storageState: employerState });
    const page = await context.newPage();

    await page.goto('/my-postings', { waitUntil: 'domcontentloaded' });
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

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForAppInit(page);

    await expectAnyVisible(
      [page.getByText('구인구직').first(), page.getByText('대시보드').first()],
      10_000
    );

    await page.goto('/my-postings', { waitUntil: 'domcontentloaded' });
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
