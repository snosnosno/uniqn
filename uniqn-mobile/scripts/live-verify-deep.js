const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { addDays, format } = require('date-fns');
const { ko } = require('date-fns/locale');
const { ensureFreshFirebaseAccessToken } = require('./firebase-tools-auth');
const {
  createDiagnosticsBucket,
  finalizeDiagnosticsReport,
  attachDiagnostics,
  normalizeText,
} = require('./live-verify-diagnostics');

const projectRoot = path.resolve(__dirname, '..');
const envFilePath = path.join(projectRoot, '.env.local');
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

function readEnvFile(filePath) {
  const entries = {};
  const content = fs.readFileSync(filePath, 'utf8');

  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    entries[key] = value;
  }

  return entries;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function findLivePostingIdByTitle(title, timeout = 20000) {
  const env = readEnvFile(envFilePath);
  const accessToken = ensureFreshFirebaseAccessToken({ cwd: projectRoot });
  const projectId = env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const payload = await requestJson(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'jobPostings' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'title' },
                op: 'EQUAL',
                value: { stringValue: title },
              },
            },
            limit: 1,
          },
        }),
      }
    );

    const document = payload.find((entry) => entry.document)?.document;
    if (document?.name) {
      return document.name.split('/').pop();
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Unable to resolve live posting id for title: ${title}`);
}

function enableDialogAcceptance(page, diagnosticsBucket) {
  page.on('dialog', async (dialog) => {
    diagnosticsBucket.dialogs = diagnosticsBucket.dialogs || [];
    diagnosticsBucket.dialogs.push({
      type: dialog.type(),
      message: dialog.message(),
      accepted: true,
      seenAt: new Date().toISOString(),
    });

    await dialog.accept().catch(() => {});
  });
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

async function waitForLoginInputs(page, timeout = 15000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const inputs = page.locator('input:visible');
    const count = await inputs.count().catch(() => 0);
    if (count >= 2) {
      const firstVisible = await inputs
        .nth(0)
        .isVisible()
        .catch(() => false);
      const secondVisible = await inputs
        .nth(1)
        .isVisible()
        .catch(() => false);
      if (firstVisible && secondVisible) {
        return;
      }
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`Login inputs did not become visible: ${page.url()}`);
}

async function waitForPathname(page, matcher, timeout = 20000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const pathname = new URL(page.url()).pathname;
    if (matcher(pathname)) {
      return pathname;
    }
    await page.waitForTimeout(250);
  }

  throw new Error(`Timed out waiting for pathname transition: ${page.url()}`);
}

async function fillVisibleField(locator, value, timeout = 15000) {
  await locator.waitFor({ state: 'visible', timeout });
  await locator.fill(value);

  const start = Date.now();
  while (Date.now() - start < timeout) {
    const currentValue = await locator.inputValue().catch(() => null);
    if (currentValue === value) {
      return;
    }

    await locator.fill(value);
    await locator.page().waitForTimeout(150);
  }

  throw new Error(`Failed to persist field value: ${value}`);
}

function normalizeNumericValue(value) {
  return String(value).replace(/[^\d.-]/g, '');
}

async function fillVisibleNumericField(locator, value, timeout = 15000) {
  await locator.waitFor({ state: 'visible', timeout });
  await locator.fill(value);

  const expectedValue = normalizeNumericValue(value);
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const currentValue = await locator.inputValue().catch(() => null);
    if (currentValue !== null && normalizeNumericValue(currentValue) === expectedValue) {
      return;
    }

    await locator.fill(value);
    await locator.page().waitForTimeout(150);
  }

  throw new Error(`Failed to persist numeric field value: ${value}`);
}

async function findVisibleLocator(page, selector, timeout = 15000) {
  const locator = page.locator(selector);
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`No visible locator found for selector: ${selector}`);
}

async function fillFieldBySelector(page, selector, value, timeout = 15000) {
  const locator = await findVisibleLocator(page, selector, timeout);
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await fillVisibleField(locator, value, timeout);
  return locator;
}

async function setVisibleControlValue(page, selector, value, timeout = 15000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const updated = await page.evaluate(
      ({ selector: query, value: nextValue }) => {
        const controls = Array.from(document.querySelectorAll(query));
        const target = controls.find((node) => {
          const style = window.getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            rect.width > 0 &&
            rect.height > 0
          );
        });

        if (!target) {
          return false;
        }

        const prototype =
          target instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
        descriptor?.set?.call(target, nextValue);
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));

        if (typeof target.blur === 'function') {
          target.blur();
        }

        return true;
      },
      { selector, value }
    );

    if (updated) {
      return;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`No visible control found for selector: ${selector}`);
}

async function waitForVisibleInputCount(page, minimum, timeout = 15000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const inputs = page.locator('input:visible');
    const count = await inputs.count().catch(() => 0);

    if (count >= minimum) {
      return inputs;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`Timed out waiting for ${minimum} visible inputs on ${page.url()}`);
}

async function login(page, account) {
  await page.goto(makeUrl('/login'), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  await fillLoginForm(page, account);
  await page.getByRole('button', { name: /^로그인(?: 중\.\.\.)?$/ }).click({ force: true });
  await waitForPathname(page, (pathname) => !pathname.includes('/login'));
  await waitForAppReady(page);
  await page.waitForTimeout(1500);
}

async function login(page, account) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await page.goto(makeUrl('/login'), { waitUntil: 'domcontentloaded' });
      await waitForAppReady(page);
      await waitForLoginInputs(page, 10000);
      await fillLoginForm(page, account);
      await page.getByRole('button', { name: /^로그인(?: 중\.\.\.)?$/ }).click({ force: true });
      await waitForPathname(page, (pathname) => !pathname.includes('/login'));
      await waitForAppReady(page);
      await page.waitForTimeout(1500);
      return;
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }

      await page.waitForTimeout(1000);
    }
  }
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
  const start = Date.now();

  while (Date.now() - start < 30000) {
    const card = page.locator(`button[aria-label*="${title}"]`).first();
    if (await card.isVisible().catch(() => false)) {
      await card.click({ force: true });
      return;
    }

    await page.waitForTimeout(1000);
  }

  throw new Error(`Unable to find posting card for "${title}" on employer list`);
}

async function openPostingDetail(page, title) {
  await page.goto(makeUrl('/employer'), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  await clickPostingCard(page, title).catch(() => null);
  const detailPath = await waitForPathname(
    page,
    (pathname) => /^\/my-postings\/[^/]+$/.test(pathname),
    5000
  ).catch(() => null);

  if (detailPath) {
    await waitForAppReady(page);

    const postingId = extractPostingId(page.url());
    if (!postingId) {
      throw new Error(`Unable to extract posting id from ${page.url()}`);
    }

    return postingId;
  }

  const postingId = await findLivePostingIdByTitle(title);
  await page.goto(makeUrl(`/my-postings/${postingId}`), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
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
    .last()
    .click({ force: true });
  const nextPath = await waitForPathname(
    page,
    (pathname) => !pathname.includes('/my-postings/create'),
    5000
  ).catch(() => null);

  if (nextPath) {
    await waitForAppReady(page);
  } else {
    await page.waitForTimeout(3000);
  }
}

async function fillEmployerCreateForm(page, title) {
  await page.goto(makeUrl('/my-postings/create'), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);

  const titleInput = page.locator('input[placeholder*="강남 홀덤펍 딜러 구합니다"]:visible').last();
  const locationNameInput = page.locator('input[placeholder*="홀덤펍 강남점"]:visible').last();
  const locationAddressInput = page
    .locator('input[placeholder*="서울시 강남구 테헤란로 123"]:visible')
    .last();
  const detailedAddressInput = page.locator('input[placeholder*="건물명, 층수 등"]:visible').last();
  const phoneInput = page.locator('input[placeholder="010-0000-0000"]:visible').last();
  const descriptionInput = page
    .locator('textarea[placeholder*="근무 환경"]:visible, input[placeholder*="근무 환경"]:visible')
    .last();

  await fillVisibleField(titleInput, title);
  await fillVisibleField(locationNameInput, 'Codex Live Lounge');
  await page.waitForTimeout(250);
  await fillVisibleField(locationAddressInput, '서울시 강남구 테헤란로 123');
  await page.waitForTimeout(250);
  await fillVisibleField(detailedAddressInput, '3층');
  await fillVisibleField(phoneInput, '010-5555-0002');
  await fillVisibleField(descriptionInput, 'Codex live deep verify employer posting');

  await selectNextWorkDate(page);

  const salaryInputs = page.locator('input[placeholder="0"]:visible');
  const salaryCount = await salaryInputs.count();
  if (salaryCount === 0) {
    throw new Error('No visible salary inputs found on create posting screen');
  }

  for (let index = 0; index < salaryCount; index += 1) {
    await fillVisibleField(salaryInputs.nth(index), '12000');
  }

  await page
    .locator('button:visible', { hasText: /공고 등록|확인 요청/ })
    .first()
    .click();
  await waitForPathname(page, (pathname) => !pathname.includes('/my-postings/create'));
  await waitForAppReady(page);
}

async function fillEmployerCreateForm(page, title) {
  await page.goto(makeUrl('/my-postings/create'), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);

  await fillFieldBySelector(page, 'input[placeholder*="강남 홀덤펍 딜러 구합니다"]', title);
  await fillFieldBySelector(page, 'input[placeholder*="홀덤펍 강남점"]', 'Codex Live Lounge');
  await page.waitForTimeout(250);
  await fillFieldBySelector(
    page,
    'input[placeholder*="서울시 강남구 테헤란로 123"]',
    '서울시 강남구 테헤란로 123'
  );
  await page.waitForTimeout(250);
  await fillFieldBySelector(page, 'input[placeholder*="홀덤펍 강남점"]', 'Codex Live Lounge');
  await fillFieldBySelector(page, 'input[placeholder*="건물명, 층수 등"]', '3층');
  await fillFieldBySelector(page, 'input[placeholder="010-0000-0000"]', '010-5555-0002');
  await fillFieldBySelector(
    page,
    'textarea[placeholder*="근무 환경"], input[placeholder*="근무 환경"]',
    'Codex live deep verify employer posting'
  );

  await selectNextWorkDate(page);

  const salaryInputs = page.locator('input[placeholder="0"]');
  const salaryCount = await salaryInputs.count();
  let filledSalaryCount = 0;
  for (let index = 0; index < salaryCount; index += 1) {
    const candidate = salaryInputs.nth(index);
    if (!(await candidate.isVisible().catch(() => false))) {
      continue;
    }

    await candidate.scrollIntoViewIfNeeded().catch(() => {});
    await fillVisibleNumericField(candidate, '12000');
    filledSalaryCount += 1;
  }

  if (filledSalaryCount === 0) {
    throw new Error('No visible salary inputs found on create posting screen');
  }

  await fillFieldBySelector(page, 'input[placeholder*="강남 홀덤펍 딜러 구합니다"]', title);
  await page.waitForTimeout(250);

  await page
    .locator('button:visible', { hasText: /공고 등록|확인 요청/ })
    .first()
    .click();
  await waitForPathname(page, (pathname) => !pathname.includes('/my-postings/create'));
  await waitForAppReady(page);
}

async function fillEmployerCreateForm(page, title) {
  await page.goto(makeUrl('/my-postings/create'), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);

  await fillFieldBySelector(page, 'input[placeholder*="강남 홀덤펍 딜러 구합니다"]', title);
  await fillFieldBySelector(page, 'input[placeholder*="홀덤펍 강남점"]', 'Codex Live Lounge');
  await page.waitForTimeout(250);
  await fillFieldBySelector(
    page,
    'input[placeholder*="서울시 강남구 테헤란로 123"]',
    '서울시 강남구 테헤란로 123'
  );
  await page.waitForTimeout(250);
  await fillFieldBySelector(page, 'input[placeholder*="홀덤펍 강남점"]', 'Codex Live Lounge');
  await fillFieldBySelector(page, 'input[placeholder*="건물명, 층수 등"]', '3층');
  await fillFieldBySelector(page, 'input[placeholder="010-0000-0000"]', '010-5555-0002');
  await fillFieldBySelector(
    page,
    'textarea[placeholder*="근무 환경"], input[placeholder*="근무 환경"]',
    'Codex live deep verify employer posting'
  );

  await selectNextWorkDate(page);

  const salaryInputs = page.locator('input[placeholder="0"]');
  const salaryCount = await salaryInputs.count();
  let filledSalaryCount = 0;
  for (let index = 0; index < salaryCount; index += 1) {
    const candidate = salaryInputs.nth(index);
    if (!(await candidate.isVisible().catch(() => false))) {
      continue;
    }

    await candidate.scrollIntoViewIfNeeded().catch(() => {});
    await fillVisibleNumericField(candidate, '12000');
    filledSalaryCount += 1;
  }

  if (filledSalaryCount === 0) {
    throw new Error('No visible salary inputs found on create posting screen');
  }

  await fillFieldBySelector(page, 'input[placeholder*="강남 홀덤펍 딜러 구합니다"]', title);
  await page.waitForTimeout(250);

  await page
    .locator('button:visible', { hasText: /공고 등록|확인 요청/ })
    .last()
    .click({ force: true });

  const nextPath = await waitForPathname(
    page,
    (pathname) => !pathname.includes('/my-postings/create'),
    5000
  ).catch(() => null);

  if (nextPath) {
    await waitForAppReady(page);
  } else {
    await page.waitForTimeout(3000);
  }
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
  await waitForPathname(page, (pathname) => !pathname.endsWith('/edit'));
  await waitForAppReady(page);
}

async function editEmployerPosting(page, postingId, updatedTitle) {
  await page.goto(makeUrl(`/my-postings/${postingId}/edit`), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);

  await fillFieldBySelector(page, 'input[placeholder*="강남 홀덤펍 딜러 구합니다"]', updatedTitle);
  await page
    .getByRole('button', { name: /공고 수정/ })
    .last()
    .click({ force: true });

  const nextPath = await waitForPathname(
    page,
    (pathname) => !pathname.endsWith('/edit'),
    5000
  ).catch(() => null);

  if (!nextPath) {
    await page.goto(makeUrl(`/my-postings/${postingId}`), { waitUntil: 'domcontentloaded' });
  }

  await waitForAppReady(page);
}

async function editEmployerPosting(page, postingId, updatedTitle) {
  await page.goto(makeUrl(`/my-postings/${postingId}/edit`), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);

  await setVisibleControlValue(
    page,
    'input[placeholder*="강남 홀덤펍 딜러 구합니다"]',
    updatedTitle
  );
  await page.waitForTimeout(500);
  await page
    .getByRole('button', { name: /공고 수정/ })
    .last()
    .click({ force: true });

  const nextPath = await waitForPathname(
    page,
    (pathname) => !pathname.endsWith('/edit'),
    5000
  ).catch(() => null);

  if (!nextPath) {
    await page.goto(makeUrl(`/my-postings/${postingId}`), { waitUntil: 'domcontentloaded' });
  }

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

function parseFirestoreValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(value, 'stringValue')) {
    return value.stringValue;
  }

  if (Object.prototype.hasOwnProperty.call(value, 'booleanValue')) {
    return value.booleanValue;
  }

  if (Object.prototype.hasOwnProperty.call(value, 'integerValue')) {
    return Number(value.integerValue);
  }

  if (Object.prototype.hasOwnProperty.call(value, 'doubleValue')) {
    return value.doubleValue;
  }

  if (Object.prototype.hasOwnProperty.call(value, 'timestampValue')) {
    return value.timestampValue;
  }

  if (Object.prototype.hasOwnProperty.call(value, 'nullValue')) {
    return null;
  }

  if (value.mapValue?.fields) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields).map(([key, innerValue]) => [
        key,
        parseFirestoreValue(innerValue),
      ])
    );
  }

  if (value.arrayValue?.values) {
    return value.arrayValue.values.map(parseFirestoreValue);
  }

  return value;
}

async function getLivePostingSnapshot(postingId) {
  const env = readEnvFile(envFilePath);
  const accessToken = ensureFreshFirebaseAccessToken({ cwd: projectRoot });
  const projectId = env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/jobPostings/${postingId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (response.status === 404) {
    return null;
  }

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(`Failed to load live posting ${postingId}: ${response.status}`);
    error.payload = payload;
    throw error;
  }

  return Object.fromEntries(
    Object.entries(payload.fields || {}).map(([key, value]) => [key, parseFirestoreValue(value)])
  );
}

async function waitForLivePostingMatch(postingId, predicate, timeout = 20000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const snapshot = await getLivePostingSnapshot(postingId);
    if (predicate(snapshot)) {
      return snapshot;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Timed out waiting for live posting match: ${postingId}`);
}

async function clickVisibleButtonByText(page, text) {
  const clicked = await page.evaluate((needle) => {
    const buttons = Array.from(document.querySelectorAll('button,[role="button"]'));
    const visibleButtons = buttons.filter((node) => {
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        rect.width > 0 &&
        rect.height > 0
      );
    });
    const target = [...visibleButtons]
      .reverse()
      .find((node) => (node.textContent || '').replace(/\s+/g, ' ').trim().includes(needle));

    if (!target) {
      return false;
    }

    target.click();
    return true;
  }, text);

  if (!clicked) {
    throw new Error(`No visible button found for text: ${text}`);
  }
}

async function fillEmployerCreateForm(page, title) {
  await page.goto(makeUrl('/my-postings/create'), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);

  await setVisibleControlValue(page, 'input[placeholder*="媛뺣궓 ??ㅽ럪 ?쒕윭 援ы빀?덈떎"]', title);
  await setVisibleControlValue(page, 'input[placeholder*="??ㅽ럪 媛뺣궓??]', 'Codex Live Lounge');
  await setVisibleControlValue(
    page,
    'input[placeholder*="?쒖슱??媛뺣궓援??뚰뿤?濡?123"]',
    '?쒖슱??媛뺣궓援??뚰뿤?濡?123'
  );
  await setVisibleControlValue(page, 'input[placeholder*="嫄대Ъ紐? 痢듭닔 ??]', '3痢?');
  await setVisibleControlValue(page, 'input[placeholder="010-0000-0000"]', '010-5555-0002');
  await setVisibleControlValue(
    page,
    'textarea[placeholder*="洹쇰Т ?섍꼍"], input[placeholder*="洹쇰Т ?섍꼍"]',
    'Codex live deep verify employer posting'
  );

  await selectNextWorkDate(page);

  const salaryInputs = page.locator('input[placeholder="0"]');
  const salaryCount = await salaryInputs.count();
  let filledSalaryCount = 0;
  for (let index = 0; index < salaryCount; index += 1) {
    const candidate = salaryInputs.nth(index);
    if (!(await candidate.isVisible().catch(() => false))) {
      continue;
    }

    await candidate.scrollIntoViewIfNeeded().catch(() => {});
    await fillVisibleNumericField(candidate, '12000');
    filledSalaryCount += 1;
  }

  if (filledSalaryCount === 0) {
    throw new Error('No visible salary inputs found on create posting screen');
  }

  await setVisibleControlValue(page, 'input[placeholder*="媛뺣궓 ??ㅽ럪 ?쒕윭 援ы빀?덈떎"]', title);
  await page.waitForTimeout(500);
  await clickVisibleButtonByText(page, '怨듦퀬 ?깅줉');

  const nextPath = await waitForPathname(
    page,
    (pathname) => !pathname.includes('/my-postings/create'),
    5000
  ).catch(() => null);

  if (nextPath) {
    await waitForAppReady(page);
  } else {
    await page.waitForTimeout(3000);
  }
}

async function editEmployerPosting(page, postingId, updatedTitle) {
  await page.goto(makeUrl(`/my-postings/${postingId}/edit`), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);

  await setVisibleControlValue(
    page,
    'input[placeholder*="강남 홀덤펍 딜러 구합니다"]',
    updatedTitle
  );
  await page.waitForTimeout(500);
  await clickVisibleButtonByText(page, '공고 수정');

  await waitForLivePostingMatch(postingId, (snapshot) => snapshot?.title === updatedTitle, 15000);
  await page.goto(makeUrl(`/my-postings/${postingId}`), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
}

async function openApplicantsPage(page, postingId) {
  await page.goto(makeUrl(`/my-postings/${postingId}/applicants`), {
    waitUntil: 'domcontentloaded',
  });
  await waitForAppReady(page);
}

async function closePostingFromEmployerTab(page, postingId) {
  await page.goto(makeUrl(`/my-postings/${postingId}`), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);

  await page
    .getByRole('button', { name: /마감하기/ })
    .last()
    .click({ force: true });
  await page.waitForTimeout(500);
  await page
    .getByRole('button', { name: /마감하기/ })
    .last()
    .click({ force: true });

  await waitForLivePostingMatch(postingId, (snapshot) => snapshot?.status === 'closed', 15000);
  await page.goto(makeUrl('/employer'), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
}

async function cleanupPosting(page, postingId, diagnostics) {
  try {
    await page.goto(makeUrl(`/my-postings/${postingId}`), { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await page
      .getByRole('button', { name: /공고 삭제/ })
      .last()
      .click({ force: true });
    await page.waitForTimeout(500);
    await page
      .getByRole('button', { name: /^삭제$/ })
      .last()
      .click({ force: true });
    await waitForLivePostingMatch(postingId, (snapshot) => snapshot === null, 15000);
    diagnostics.cleanupCompleted = true;
  } catch (error) {
    diagnostics.cleanupError = error instanceof Error ? error.message : String(error);
  }
}

async function fillEmployerCreateForm(page, title) {
  await page.goto(makeUrl('/my-postings/create'), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);

  await setVisibleControlValue(
    page,
    'input[placeholder*="강남 홀덤펍 딜러 구합니다"]',
    title,
    10000
  );
  await setVisibleControlValue(
    page,
    'input[placeholder*="홀덤펍 강남점"]',
    'Codex Live Lounge',
    10000
  );
  await setVisibleControlValue(
    page,
    'input[placeholder*="서울시 강남구 테헤란로 123"]',
    '서울시 강남구 테헤란로 123',
    10000
  );
  await setVisibleControlValue(page, 'input[placeholder*="건물명, 층수 등"]', '3층', 10000);
  await setVisibleControlValue(page, 'input[placeholder="010-0000-0000"]', '010-5555-0002', 10000);
  await setVisibleControlValue(
    page,
    'textarea[placeholder*="근무 환경"], input[placeholder*="근무 환경"]',
    'Codex live deep verify employer posting',
    10000
  );

  await selectNextWorkDate(page);

  const salaryInputs = page.locator('input[placeholder="0"]');
  const salaryCount = await salaryInputs.count();
  let filledSalaryCount = 0;
  for (let index = 0; index < salaryCount; index += 1) {
    const candidate = salaryInputs.nth(index);
    if (!(await candidate.isVisible().catch(() => false))) {
      continue;
    }

    await candidate.scrollIntoViewIfNeeded().catch(() => {});
    await fillVisibleNumericField(candidate, '12000');
    filledSalaryCount += 1;
  }

  if (filledSalaryCount === 0) {
    throw new Error('No visible salary inputs found on create posting screen');
  }

  await setVisibleControlValue(
    page,
    'input[placeholder*="강남 홀덤펍 딜러 구합니다"]',
    title,
    10000
  );
  await page.waitForTimeout(500);
  await page
    .locator('button:visible', { hasText: /공고 등록|확인 요청/ })
    .last()
    .click({ force: true });

  const nextPath = await waitForPathname(
    page,
    (pathname) => !pathname.includes('/my-postings/create'),
    5000
  ).catch(() => null);

  if (nextPath) {
    await waitForAppReady(page);
  } else {
    await page.waitForTimeout(3000);
  }
}

async function editEmployerPosting(page, postingId, updatedTitle) {
  await waitForAppReady(page);
  await page
    .getByRole('button', { name: /공고 수정/ })
    .last()
    .click({ force: true });

  const editPath = await waitForPathname(
    page,
    (pathname) => pathname.endsWith('/edit'),
    5000
  ).catch(() => null);

  if (!editPath) {
    await page.goto(makeUrl(`/my-postings/${postingId}/edit`), { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
  }

  try {
    await setVisibleControlValue(
      page,
      'input[placeholder*="강남 홀덤펍 딜러 구합니다"]',
      updatedTitle,
      5000
    );
  } catch {
    const visibleInputs = await waitForVisibleInputCount(page, 1, 10000);
    await fillVisibleField(visibleInputs.nth(0), updatedTitle);
  }
  await page.waitForTimeout(500);
  await page
    .getByRole('button', { name: /공고 수정/ })
    .last()
    .click({ force: true });

  await waitForLivePostingMatch(postingId, (snapshot) => snapshot?.title === updatedTitle, 15000);
  await page.goto(makeUrl(`/my-postings/${postingId}`), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
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
  enableDialogAcceptance(page, diagnostics.employer);

  const titleSuffix = String(Date.now()).slice(-8);
  const createdTitle = `CLD ${titleSuffix}`;
  const updatedTitle = `CLD ${titleSuffix} Edit`;

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

    await closePostingFromEmployerTab(page, postingId);
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
  enableDialogAcceptance(page, diagnostics.staff);

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
  enableDialogAcceptance(page, diagnostics.admin);

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
