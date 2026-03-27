const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { addDays, format } = require('date-fns');
const { ko } = require('date-fns/locale');
const {
  createDiagnosticsBucket,
  finalizeDiagnosticsReport,
  attachDiagnostics,
  normalizeText,
} = require('./live-verify-diagnostics');

const projectRoot = path.resolve(__dirname, '..');
const accountsPath = path.join(projectRoot, 'output', 'playwright', 'live-test-users.json');
const artifactRoot = path.join(projectRoot, 'output', 'playwright', 'live-deep');
const baseUrl = process.env.LIVE_BASE_URL || 'http://localhost:4101';
const adminEmail = process.env.LIVE_ADMIN_EMAIL;
const adminPassword = process.env.LIVE_ADMIN_PASSWORD;
const headless = process.env.LIVE_HEADLESS === 'true';
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

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractPostingId(url) {
  const match = url.match(/\/my-postings\/([^/?#]+)/);
  return match ? match[1] : null;
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

async function expectBodyText(page, timeout = 15000) {
  await page.locator('body').waitFor({ state: 'attached', timeout });
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const bodyText = normalizeText(await page.locator('body').textContent());
    if (bodyText.length > 0) {
      return bodyText;
    }
    await page.waitForTimeout(500);
  }

  throw new Error('Page body did not render visible text');
}

async function fillLoginForm(page, account) {
  const inputs = page.locator('input:visible');
  await inputs.nth(0).waitFor({ state: 'visible', timeout: 15000 });
  await inputs.nth(0).fill(account.email);
  await inputs.nth(1).fill(account.password);
}

async function login(page, account) {
  await page.goto(makeUrl('/login'), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  await fillLoginForm(page, account);
  await page.getByRole('button', { name: /^로그인(?: 중\.\.\.)?$/ }).click({ force: true });
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
  await waitForAppReady(page);
  await page.waitForTimeout(1500);
}

async function resetSession(page) {
  await page.context().clearCookies();
  await page
    .evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    })
    .catch(() => {});
}

async function captureFailure(page, fileStem, error) {
  ensureDir(artifactRoot);

  const failureDetails = {
    error: error instanceof Error ? error.stack || error.message : String(error),
    url: null,
    title: null,
    bodyText: null,
    alerts: [],
  };

  failureDetails.url = page.url();
  failureDetails.title = await page.title().catch(() => null);
  failureDetails.bodyText = await page
    .locator('body')
    .textContent()
    .then((text) => normalizeText(text).slice(0, 4000))
    .catch(() => null);
  failureDetails.alerts = await page
    .locator('[role="alert"]')
    .evaluateAll((nodes) =>
      nodes
        .map((node) => (node.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, 20)
    )
    .catch(() => []);

  await page
    .screenshot({
      path: path.join(artifactRoot, `${fileStem}-failure.png`),
      fullPage: true,
    })
    .catch(() => {});

  fs.writeFileSync(
    path.join(artifactRoot, `${fileStem}-failure.txt`),
    JSON.stringify(failureDetails, null, 2)
  );
}

async function clickPostingCard(page, title) {
  const card = page.locator(`button[aria-label*="${title}"]`).first();
  await card.waitFor({ state: 'visible', timeout: 30000 });
  await card.click();
}

async function openPostingDetail(page, title) {
  await page.goto(makeUrl('/employer'), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  await clickPostingCard(page, title);
  await page.waitForURL(/\/my-postings\/[^/]+$/, { timeout: 20000 });
  await waitForAppReady(page);

  const postingId = extractPostingId(page.url());
  if (!postingId) {
    throw new Error(`Unable to extract posting id from ${page.url()}`);
  }

  return postingId;
}

async function selectNextWorkDate(page) {
  const tomorrow = addDays(new Date(), 1);
  const targetDateLabel = format(tomorrow, 'yyyy년 M월 d일 EEEE', { locale: ko });

  await page.getByRole('button', { name: /날짜 추가/ }).click();
  await page.getByText('날짜 선택').first().waitFor({ state: 'visible', timeout: 10000 });
  await page.getByRole('button', { name: targetDateLabel }).click();
  await page.locator('button:visible').last().click();
  await page.getByText('날짜 선택').first().waitFor({ state: 'hidden', timeout: 10000 });
}

async function fillEmployerCreateForm(page, title) {
  await page.goto(makeUrl('/my-postings/create'), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);

  const visibleInputs = page.locator('input:visible');
  await visibleInputs.nth(0).fill(title);
  await visibleInputs.nth(1).fill('Codex Live Lounge');
  await visibleInputs.nth(2).fill('서울시 강남구 테헤란로 123');
  await visibleInputs.nth(3).fill('3층');
  await visibleInputs.nth(4).fill('010-5555-0002');

  const descriptionInput = page
    .locator('textarea:visible, input[placeholder*="근무 환경"]:visible')
    .last();
  await descriptionInput.fill('Codex live deep verify employer posting');

  await selectNextWorkDate(page);

  const salaryInputs = page.locator('input[placeholder="0"]:visible');
  const salaryCount = await salaryInputs.count();
  if (salaryCount === 0) {
    throw new Error('No visible salary inputs found on create posting screen');
  }

  for (let index = 0; index < salaryCount; index += 1) {
    await salaryInputs.nth(index).fill('12000');
  }

  await page
    .locator('button:visible', { hasText: /공고 등록|확인 요청/ })
    .first()
    .click();
  await page.waitForURL((url) => !url.pathname.includes('/my-postings/create'), { timeout: 20000 });
  await waitForAppReady(page);
}

async function editEmployerPosting(page, postingId, updatedTitle) {
  await page.goto(makeUrl(`/my-postings/${postingId}/edit`), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);

  const visibleInputs = page.locator('input:visible');
  await visibleInputs.nth(0).fill(updatedTitle);
  await page
    .getByRole('button', { name: /공고 수정/ })
    .last()
    .click();
  await page.waitForURL((url) => !url.pathname.endsWith('/edit'), { timeout: 20000 });
  await waitForAppReady(page);
}

async function openApplicantsPage(page, postingId) {
  await page.goto(makeUrl(`/my-postings/${postingId}/applicants`), {
    waitUntil: 'domcontentloaded',
  });
  await waitForAppReady(page);
}

async function closePostingFromEmployerTab(page, title) {
  await page.goto(makeUrl('/employer'), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);

  const buttons = page.locator(`button[aria-label*="${title}"]:visible`);
  const count = await buttons.count();
  if (count < 2) {
    throw new Error(`Expected close button for "${title}", but found ${count} matching buttons`);
  }

  await buttons.last().click();
  await page
    .getByRole('button', { name: /^마감하기$/ })
    .last()
    .click();
  await page.waitForTimeout(2000);
}

async function cleanupPosting(page, postingId, diagnostics) {
  try {
    await page.goto(makeUrl(`/my-postings/${postingId}`), { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    const deleteButton = page.getByRole('button', { name: /공고 삭제/ }).first();
    if (!(await deleteButton.isVisible().catch(() => false))) {
      diagnostics.cleanupSkipped = true;
      return;
    }

    await deleteButton.click();
    await page
      .getByRole('button', { name: /^삭제$/ })
      .last()
      .click();
    await page.waitForTimeout(2000);
    diagnostics.cleanupCompleted = true;
  } catch (error) {
    diagnostics.cleanupError = error instanceof Error ? error.message : String(error);
  }
}

async function verifyPublic(page, diagnostics) {
  await page.goto(makeUrl('/jobs'), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  const bodyText = await expectBodyText(page, 30000);
  diagnostics.public.url = page.url();
  diagnostics.public.bodyText = bodyText.slice(0, 500);
  await page.screenshot({ path: path.join(artifactRoot, 'public-jobs.png'), fullPage: true });
}

async function verifyEmployer(context, account, diagnostics) {
  const page = await context.newPage();
  await attachDiagnostics(page, diagnostics.employer);

  const createdTitle = `Codex Live Deep ${Date.now()}`;
  const updatedTitle = `${createdTitle} Edited`;

  diagnostics.employer.createdTitle = createdTitle;
  diagnostics.employer.updatedTitle = updatedTitle;

  try {
    await login(page, account);
    await fillEmployerCreateForm(page, createdTitle);
    await page.screenshot({
      path: path.join(artifactRoot, 'employer-created-list.png'),
      fullPage: true,
    });

    const postingId = await openPostingDetail(page, createdTitle);
    diagnostics.employer.postingId = postingId;
    diagnostics.employer.detailUrl = page.url();
    diagnostics.employer.detailText = (await expectBodyText(page, 20000)).slice(0, 500);
    await page.screenshot({ path: path.join(artifactRoot, 'employer-detail.png'), fullPage: true });

    await editEmployerPosting(page, postingId, updatedTitle);
    diagnostics.employer.editedDetailText = (await expectBodyText(page, 20000)).slice(0, 500);
    await page.screenshot({
      path: path.join(artifactRoot, 'employer-edited-detail.png'),
      fullPage: true,
    });

    await openApplicantsPage(page, postingId);
    diagnostics.employer.applicantsText = (await expectBodyText(page, 20000)).slice(0, 500);
    await page.screenshot({
      path: path.join(artifactRoot, 'employer-applicants.png'),
      fullPage: true,
    });

    await closePostingFromEmployerTab(page, updatedTitle);
    diagnostics.employer.closedListText = (await expectBodyText(page, 20000)).slice(0, 500);
    await page.screenshot({
      path: path.join(artifactRoot, 'employer-closed-list.png'),
      fullPage: true,
    });

    await cleanupPosting(page, postingId, diagnostics.employer);
    await resetSession(page);
  } catch (error) {
    diagnostics.employer.error = error instanceof Error ? error.message : String(error);
    await captureFailure(page, 'employer-deep', error);
    throw error;
  } finally {
    await page.close().catch(() => {});
  }
}

async function verifyStaff(context, account, diagnostics, employerDiagnostics) {
  const page = await context.newPage();
  await attachDiagnostics(page, diagnostics.staff);

  const postingId = employerDiagnostics.postingId;
  if (!postingId) {
    throw new Error('Employer verification did not produce a posting id');
  }

  try {
    await login(page, account);
    await page.goto(makeUrl(`/jobs/${postingId}`), { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    diagnostics.staff.detailUrl = page.url();
    diagnostics.staff.detailText = (await expectBodyText(page, 20000)).slice(0, 500);
    if (!diagnostics.staff.detailText.includes(employerDiagnostics.updatedTitle)) {
      throw new Error('Staff detail page did not render the updated posting title');
    }

    await page.screenshot({
      path: path.join(artifactRoot, 'staff-job-detail.png'),
      fullPage: true,
    });
    await resetSession(page);
  } catch (error) {
    diagnostics.staff.error = error instanceof Error ? error.message : String(error);
    await captureFailure(page, 'staff-deep', error);
    throw error;
  } finally {
    await page.close().catch(() => {});
  }
}

async function verifyAdmin(context, diagnostics) {
  const page = await context.newPage();
  await attachDiagnostics(page, diagnostics.admin);

  try {
    await login(page, { email: adminEmail, password: adminPassword });

    await page.goto(makeUrl('/admin'), { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    diagnostics.admin.dashboardUrl = page.url();
    diagnostics.admin.dashboardText = (await expectBodyText(page, 20000)).slice(0, 500);
    await page.screenshot({ path: path.join(artifactRoot, 'admin-dashboard.png'), fullPage: true });

    await page.goto(makeUrl('/admin/users'), { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    diagnostics.admin.usersUrl = page.url();
    diagnostics.admin.usersText = (await expectBodyText(page, 20000)).slice(0, 500);
    await page.screenshot({ path: path.join(artifactRoot, 'admin-users.png'), fullPage: true });

    await page.goto(makeUrl('/profile'), { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    diagnostics.admin.profileUrl = page.url();
    diagnostics.admin.profileText = (await expectBodyText(page, 20000)).slice(0, 500);
    await page.screenshot({ path: path.join(artifactRoot, 'admin-profile.png'), fullPage: true });

    await resetSession(page);
  } catch (error) {
    diagnostics.admin.error = error instanceof Error ? error.message : String(error);
    await captureFailure(page, 'admin-deep', error);
    throw error;
  } finally {
    await page.close().catch(() => {});
  }
}

async function main() {
  if (!adminEmail || !adminPassword) {
    throw new Error('LIVE_ADMIN_EMAIL and LIVE_ADMIN_PASSWORD are required');
  }

  if (!fs.existsSync(accountsPath)) {
    throw new Error(`Missing live test accounts file: ${accountsPath}`);
  }

  ensureDir(artifactRoot);

  const accountPayload = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
  const accounts = Object.fromEntries(
    accountPayload.accounts.map((account) => [account.key, account])
  );
  const diagnostics = {
    public: createDiagnosticsBucket(),
    employer: createDiagnosticsBucket(),
    staff: createDiagnosticsBucket(),
    admin: createDiagnosticsBucket(),
  };

  const browser = await chromium.launch({
    headless,
    slowMo: headless ? 0 : 150,
  });

  try {
    const publicContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const publicPage = await publicContext.newPage();
    await attachDiagnostics(publicPage, diagnostics.public);
    try {
      await verifyPublic(publicPage, diagnostics);
    } catch (error) {
      diagnostics.public.error = error instanceof Error ? error.message : String(error);
      await captureFailure(publicPage, 'public-deep', error);
      throw error;
    } finally {
      await publicContext.close();
    }

    const employerContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    try {
      await verifyEmployer(employerContext, accounts.employer, diagnostics);
    } finally {
      await employerContext.close();
    }

    const staffContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    try {
      await verifyStaff(staffContext, accounts.staff, diagnostics, diagnostics.employer);
    } finally {
      await staffContext.close();
    }

    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    try {
      await verifyAdmin(adminContext, diagnostics);
    } finally {
      await adminContext.close();
    }
  } finally {
    await browser.close();
    writeJson(path.join(artifactRoot, 'diagnostics.json'), finalizeDiagnosticsReport(diagnostics));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
