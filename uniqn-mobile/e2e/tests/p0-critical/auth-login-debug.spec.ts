import fs from 'fs';
import path from 'path';
import { test } from '@playwright/test';

test('debug login state after submit', async ({ page }) => {
  const consoleLogs: Array<{ type: string; text: string }> = [];
  const pageErrors: string[] = [];
  const requestFailures: Array<{ url: string; method: string; errorText: string | null }> = [];

  page.on('console', (message) => {
    consoleLogs.push({ type: message.type(), text: message.text() });
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  page.on('requestfailed', (request) => {
    requestFailures.push({
      url: request.url(),
      method: request.method(),
      errorText: request.failure()?.errorText ?? null,
    });
  });

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[placeholder="이메일을 입력하세요"]').first().fill('staff@test.com');
  await page.locator('input[placeholder="비밀번호를 입력하세요"]').first().fill('TestPass1!');
  await page.getByRole('button', { name: /^로그인/ }).click();
  await page.waitForTimeout(8_000);

  const snapshot = await page.evaluate(() => {
    const alertTexts = Array.from(document.querySelectorAll('[role="alert"]')).map((node) =>
      node.textContent?.trim()
    );

    return {
      url: window.location.href,
      bodyText: document.body?.innerText?.slice(0, 1200) ?? null,
      alertTexts,
      localStorageEntries: Object.fromEntries(
        Object.keys(window.localStorage).map((key) => [key, window.localStorage.getItem(key)])
      ),
    };
  });

  const outputDir = path.join(process.cwd(), 'output', 'playwright', 'logs');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, 'auth-login-debug.json'),
    JSON.stringify(
      {
        snapshot,
        consoleLogs,
        pageErrors,
        requestFailures,
      },
      null,
      2
    )
  );

  await page.screenshot({
    path: path.join(outputDir, 'auth-login-debug.png'),
    fullPage: true,
  });
});
