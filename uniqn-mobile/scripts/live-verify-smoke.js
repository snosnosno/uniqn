const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const projectRoot = path.resolve(__dirname, '..');
const accountsPath = path.join(projectRoot, 'output', 'playwright', 'live-test-users.json');
const artifactRoot = path.join(projectRoot, 'output', 'playwright', 'live-smoke');
const baseUrl = process.env.LIVE_BASE_URL || 'http://localhost:4101';
const MAX_DIAGNOSTIC_EVENTS = 120;
const LOADING_TEXTS = [
  '로딩 중...',
  '공고 정보를 불러오는 중...',
  '잠시만 기다려주세요...',
  '로그인 정보를 확인하는 중...',
];

function makeUrl(routePath) {
  const normalizedPath = routePath.startsWith('/') ? routePath : `/${routePath}`;
  const url = new URL(normalizedPath, `${baseUrl}/`);
  url.searchParams.set('emulator', 'false');
  return url.toString();
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function normalizeText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function pushLimited(collection, item, key, limit = MAX_DIAGNOSTIC_EVENTS) {
  const existing = collection.find((entry) => entry.key === key);
  if (existing) {
    existing.count += 1;
    existing.lastSeenAt = new Date().toISOString();
    return;
  }

  if (collection.length >= limit) {
    return;
  }

  collection.push({
    ...item,
    key,
    count: 1,
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  });
}

async function waitForAppReady(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('body').waitFor({ state: 'attached', timeout: 30000 });

  for (const loadingText of LOADING_TEXTS) {
    await page
      .getByText(loadingText)
      .waitFor({ state: 'hidden', timeout: 10000 })
      .catch(() => {});
  }
}

async function attachDiagnostics(page, bucket) {
  page.on('dialog', (dialog) => {
    pushLimited(
      bucket.console,
      {
        type: 'dialog',
        text: `${dialog.type()}: ${normalizeText(dialog.message())}`,
      },
      `dialog:${dialog.type()}:${normalizeText(dialog.message())}`
    );

    void dialog.accept().catch(() => {});
  });

  page.on('console', (message) => {
    const text = normalizeText(message.text());
    if (!text) {
      return;
    }

    pushLimited(
      bucket.console,
      {
        type: message.type(),
        text,
      },
      `${message.type()}:${text}`
    );
  });

  page.on('requestfailed', (request) => {
    const failure = request.failure();
    const key = `${request.method()}:${request.url()}:${failure?.errorText ?? 'unknown'}`;

    pushLimited(
      bucket.failedRequests,
      {
        url: request.url(),
        method: request.method(),
        failure,
      },
      key
    );
  });
}

async function fillVisibleInput(page, placeholder, value) {
  const locator = page.locator(`input[placeholder="${placeholder}"]:visible`).last();
  await locator.waitFor({ state: 'visible', timeout: 15000 });
  await locator.fill(value);
}

async function expectAnyText(page, patterns, timeout = 15000) {
  await page.locator('body').waitFor({ state: 'attached', timeout });
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const bodyText = normalizeText(await page.locator('body').textContent());
    if (bodyText && patterns.some((pattern) => pattern.test(bodyText))) {
      return bodyText;
    }
    await page.waitForTimeout(500);
  }

  throw new Error(
    `None of the expected patterns matched: ${patterns.map((p) => p.source).join(', ')}`
  );
}

async function login(page, account) {
  await page.goto(makeUrl('/login'), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  await fillVisibleInput(page, '이메일을 입력하세요', account.email);
  await fillVisibleInput(page, '비밀번호를 입력하세요', account.password);
  await page.getByRole('button', { name: /^로그인(?: 중\.\.\.)?$/ }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
  await waitForAppReady(page);
  await page.waitForTimeout(1500);
}

async function logout(page) {
  await page.goto(makeUrl('/profile'), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);

  const logoutButton = page.getByRole('button', { name: /^로그아웃(?: 중\.\.\.)?$/ });
  if (await logoutButton.isVisible().catch(() => false)) {
    await logoutButton.click();

    const confirmButton = page.getByRole('button', { name: /^로그아웃$/ }).last();
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
    }

    await page.waitForURL(/login|^\//, { timeout: 20000 }).catch(() => {});
  } else {
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }
}

async function verifyPublic(page, diagnostics) {
  try {
    await page.goto(makeUrl('/jobs'), { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    const bodyText = await expectAnyText(page, [/공고/, /로그인/, /회원가입/], 30000);
    await page.screenshot({ path: path.join(artifactRoot, 'public-home.png'), fullPage: true });
    diagnostics.public = {
      url: page.url(),
      bodyText: bodyText.slice(0, 500),
    };
  } catch (error) {
    await page
      .screenshot({
        path: path.join(artifactRoot, 'public-home-failure.png'),
        fullPage: true,
      })
      .catch(() => {});
    diagnostics.public = {
      url: page.url(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function verifyStaff(context, account, diagnostics) {
  const page = await context.newPage();
  await attachDiagnostics(page, diagnostics.staff);
  await login(page, account);

  const landingText = await expectAnyText(page, [/홈/, /내 스케줄/, /프로필/, /설정/], 20000);
  diagnostics.staff.landingUrl = page.url();
  diagnostics.staff.landingText = landingText.slice(0, 500);
  await page.screenshot({ path: path.join(artifactRoot, 'staff-landing.png'), fullPage: true });

  await page.goto(makeUrl('/schedule'), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  diagnostics.staff.scheduleText = (
    await expectAnyText(page, [/내 스케줄/, /스케줄이 없습니다/, /지원 현황/, /출근/], 20000)
  ).slice(0, 500);
  await page.screenshot({ path: path.join(artifactRoot, 'staff-schedule.png'), fullPage: true });

  await page.goto(makeUrl('/notifications'), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  diagnostics.staff.notificationsText = (
    await expectAnyText(page, [/알림/, /카테고리/, /읽음/, /알림이 없습니다/], 20000)
  ).slice(0, 500);
  await page.screenshot({
    path: path.join(artifactRoot, 'staff-notifications.png'),
    fullPage: true,
  });

  await page.goto(makeUrl('/qr'), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  diagnostics.staff.qrText = (
    await expectAnyText(page, [/QR/, /스캔/, /출근/, /퇴근/, /카메라/], 20000)
  ).slice(0, 500);
  await page.screenshot({ path: path.join(artifactRoot, 'staff-qr.png'), fullPage: true });

  await page.goto(makeUrl('/profile'), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  diagnostics.staff.profileText = (
    await expectAnyText(page, [/프로필/, /설정 센터/, /로그아웃/], 20000)
  ).slice(0, 500);
  await page.screenshot({ path: path.join(artifactRoot, 'staff-profile.png'), fullPage: true });

  await logout(page);
  await page.close();
}

async function verifyEmployer(context, account, diagnostics) {
  const page = await context.newPage();
  await attachDiagnostics(page, diagnostics.employer);
  await login(page, account);

  await page.goto(makeUrl('/employer'), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  diagnostics.employer.employerTabText = (
    await expectAnyText(page, [/내 공고/, /새 공고 작성/, /구인자/], 20000)
  ).slice(0, 500);
  await page.screenshot({ path: path.join(artifactRoot, 'employer-tab.png'), fullPage: true });

  await page.goto(makeUrl('/my-postings/create'), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  diagnostics.employer.createText = (
    await expectAnyText(page, [/공고 작성/, /공고 등록/, /새 공고/, /제목/], 20000)
  ).slice(0, 500);
  await page.screenshot({ path: path.join(artifactRoot, 'employer-create.png'), fullPage: true });

  await page.goto(makeUrl('/profile'), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  diagnostics.employer.profileText = (
    await expectAnyText(page, [/프로필/, /설정 센터/, /로그아웃/], 20000)
  ).slice(0, 500);
  await page.screenshot({ path: path.join(artifactRoot, 'employer-profile.png'), fullPage: true });

  await logout(page);
  await page.close();
}

async function verifyAdmin(context, account, diagnostics) {
  const page = await context.newPage();
  await attachDiagnostics(page, diagnostics.admin);
  await login(page, account);

  await page.goto(makeUrl('/admin'), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  diagnostics.admin.adminText = (
    await expectAnyText(page, [/관리자/, /대시보드/, /사용자/, /신고/], 20000)
  ).slice(0, 500);
  diagnostics.admin.adminUrl = page.url();
  await page.screenshot({ path: path.join(artifactRoot, 'admin-dashboard.png'), fullPage: true });

  await page.goto(makeUrl('/profile'), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  diagnostics.admin.profileText = (
    await expectAnyText(page, [/프로필/, /설정 센터/, /관리자/, /로그아웃/], 20000)
  ).slice(0, 500);
  await page.screenshot({ path: path.join(artifactRoot, 'admin-profile.png'), fullPage: true });

  await logout(page);
  await page.close();
}

async function main() {
  if (!fs.existsSync(accountsPath)) {
    throw new Error(`Missing live test accounts file: ${accountsPath}`);
  }

  ensureDir(artifactRoot);

  const accountPayload = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
  const accounts = Object.fromEntries(
    accountPayload.accounts.map((account) => [account.key, account])
  );
  const diagnostics = {
    public: { console: [], failedRequests: [] },
    staff: { console: [], failedRequests: [] },
    employer: { console: [], failedRequests: [] },
    admin: { console: [], failedRequests: [] },
  };

  const browser = await chromium.launch({
    headless: false,
    slowMo: 150,
  });

  try {
    const publicContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const publicPage = await publicContext.newPage();
    await attachDiagnostics(publicPage, diagnostics.public);
    await verifyPublic(publicPage, diagnostics);
    await publicContext.close();

    try {
      const staffContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
      await verifyStaff(staffContext, accounts.staff, diagnostics);
      await staffContext.close();
    } catch (error) {
      diagnostics.staff.error = error instanceof Error ? error.message : String(error);
    }

    try {
      const employerContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
      await verifyEmployer(employerContext, accounts.employer, diagnostics);
      await employerContext.close();
    } catch (error) {
      diagnostics.employer.error = error instanceof Error ? error.message : String(error);
    }

    try {
      const adminContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
      await verifyAdmin(adminContext, accounts.admin, diagnostics);
      await adminContext.close();
    } catch (error) {
      diagnostics.admin.error = error instanceof Error ? error.message : String(error);
    }
  } finally {
    await browser.close();
  }

  writeJson(path.join(artifactRoot, 'diagnostics.json'), diagnostics);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
