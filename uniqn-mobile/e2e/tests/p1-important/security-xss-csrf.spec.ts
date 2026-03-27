/**
 * P1 security tests - XSS/CSRF protection
 * Focus on ensuring malicious input does not execute and does not escape the login surface.
 */
import { test, expect, type Page } from '@playwright/test';
import { XSS_PAYLOADS } from '../../factories';

test.use({ storageState: { cookies: [], origins: [] } });

async function navigateToLogin(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
  await page.getByPlaceholder('이메일을 입력하세요').last().waitFor({
    state: 'visible',
    timeout: 15_000,
  });
}

async function expectMaliciousLoginInputRejected(page: Page, payload: string) {
  let dialogOpened = false;
  page.on('dialog', async (dialog) => {
    dialogOpened = true;
    await dialog.dismiss();
  });

  const emailInput = page.getByPlaceholder('이메일을 입력하세요').last();
  const passwordInput = page.getByPlaceholder('비밀번호를 입력하세요').last();
  const loginButton = page.getByRole('button', { name: /^로그인$/ });

  await emailInput.fill(payload);
  await passwordInput.fill('WrongPassword1!');
  await loginButton.click({ force: true });
  await page.waitForTimeout(1_000);

  const injectedPayloadNodes = await page.evaluate(() => {
    return document.querySelectorAll('script[src="x"], img[src="x"]').length;
  });

  expect(dialogOpened).toBe(false);
  expect(page.url()).toMatch(/login|auth/);
  await expect(loginButton).toBeVisible();
  await expect(emailInput).toBeVisible();
  expect(injectedPayloadNodes).toBe(0);
}

test.describe('보안 - XSS 방어', () => {
  test('로그인 폼: <script> 태그 입력 → 실행되지 않고 차단된다', async ({ page }) => {
    await navigateToLogin(page);
    await expectMaliciousLoginInputRejected(page, XSS_PAYLOADS[0]);
  });

  test('로그인 폼: javascript: 프로토콜 입력 → 실행되지 않고 차단된다', async ({ page }) => {
    await navigateToLogin(page);
    await expectMaliciousLoginInputRejected(page, XSS_PAYLOADS[1]);
  });

  test('로그인 폼: onerror 이벤트 핸들러 입력 → 실행되지 않고 차단된다', async ({ page }) => {
    await navigateToLogin(page);
    await expectMaliciousLoginInputRejected(page, XSS_PAYLOADS[2]);
  });

  test('XSS 페이로드가 DOM에 주입되지 않는다', async ({ page }) => {
    await navigateToLogin(page);

    const emailInput = page.getByPlaceholder('이메일을 입력하세요').last();

    for (const payload of XSS_PAYLOADS) {
      await emailInput.fill(payload);
      await page.waitForTimeout(200);

      const injectedPayloadNodes = await page.evaluate(() => {
        return document.querySelectorAll('script[src="x"], img[src="x"]').length;
      });

      expect(injectedPayloadNodes).toBe(0);
    }
  });

  test('검색/로그인 표면에서 XSS 문자열이 DOM 실행으로 이어지지 않는다', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3_000);

    const searchInput = page.getByPlaceholder(/검색.*제목|장소/);
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('<script>alert("xss")</script>');
      await page.waitForTimeout(500);

      const injectedPayloadNodes = await page.evaluate(() => {
        return document.querySelectorAll('script[src="x"], img[src="x"]').length;
      });

      expect(injectedPayloadNodes).toBe(0);
    }

    const emailInput = page.getByPlaceholder('이메일을 입력하세요').last();
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill('<script>alert("xss")</script>');
      await page.waitForTimeout(500);

      const injectedPayloadNodes = await page.evaluate(() => {
        return document.querySelectorAll('script[src="x"], img[src="x"]').length;
      });

      expect(injectedPayloadNodes).toBe(0);
    }
  });

  test('SQL Injection 패턴 입력 → 로그인 폼에서 차단된다', async ({ page }) => {
    await navigateToLogin(page);
    await expectMaliciousLoginInputRejected(page, "'; DROP TABLE users; --");
  });
});
