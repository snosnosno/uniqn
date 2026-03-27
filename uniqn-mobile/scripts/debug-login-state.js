const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:4101';
  const outputPath = path.join(
    process.cwd(),
    'output',
    'playwright',
    'logs',
    'debug-login-state.json'
  );

  const consoleLogs = [];
  const pageErrors = [];
  const requestFailures = [];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  });

  page.on('console', (message) => {
    consoleLogs.push({
      type: message.type(),
      text: message.text(),
    });
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  page.on('requestfailed', (request) => {
    requestFailures.push({
      url: request.url(),
      method: request.method(),
      failure: request.failure(),
    });
  });

  await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[placeholder="이메일을 입력하세요"]').fill('staff@test.com');
  await page.locator('input[placeholder="비밀번호를 입력하세요"]').fill('TestPass1!');
  await page.getByRole('button', { name: /^로그인/ }).click();
  await page.waitForTimeout(8_000);

  const state = await page.evaluate(() => {
    const alertTexts = Array.from(document.querySelectorAll('[role="alert"]')).map((node) =>
      node.textContent?.trim()
    );

    const localStorageEntries = Object.fromEntries(
      Object.keys(window.localStorage).map((key) => [key, window.localStorage.getItem(key)])
    );

    return {
      url: window.location.href,
      title: document.title,
      bodyText: document.body?.innerText?.slice(0, 1000) ?? null,
      alertTexts,
      localStorageEntries,
    };
  });

  await page.screenshot({
    path: path.join(process.cwd(), 'output', 'playwright', 'logs', 'debug-login-state.png'),
    fullPage: true,
  });

  await browser.close();

  const payload = {
    baseURL,
    state,
    consoleLogs,
    pageErrors,
    requestFailures,
  };

  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
