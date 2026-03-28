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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function findLivePostingIdByTitle(title, timeout = 30000) {
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

    await sleep(1000);
  }

  throw new Error(`Unable to resolve live posting id for title: ${title}`);
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

async function waitForLivePostingMatch(postingId, predicate, timeout = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const snapshot = await getLivePostingSnapshot(postingId);
    if (predicate(snapshot)) {
      return snapshot;
    }

    await sleep(1000);
  }

  throw new Error(`Timed out waiting for live posting match: ${postingId}`);
}

function assertNoActionableDiagnostics(report) {
  const actionableSections = Object.entries(report.summary || {})
    .filter(([, summary]) => summary?.actionableFailedRequestCount > 0)
    .map(([section, summary]) => `${section}:${summary.actionableFailedRequestCount}`);

  if (actionableSections.length > 0) {
    throw new Error(
      `Unexpected actionable network failures detected: ${actionableSections.join(', ')}`
    );
  }
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

  await page.waitForTimeout(500);
}

async function expectBodyText(page, timeout = 15000) {
  await page.locator('body').waitFor({ state: 'attached', timeout });
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const bodyText = normalizeText(await page.locator('body').textContent());
    if (bodyText.length > 0) {
      return bodyText;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`Page body did not render visible text: ${page.url()}`);
}

async function waitForBodyTextMatch(
  page,
  matcher,
  timeout = 20000,
  description = 'body text match'
) {
  await page.locator('body').waitFor({ state: 'attached', timeout });
  const startedAt = Date.now();
  let lastBodyText = '';

  while (Date.now() - startedAt < timeout) {
    lastBodyText = normalizeText(await page.locator('body').textContent());

    if (lastBodyText.length > 0 && matcher(lastBodyText)) {
      return lastBodyText;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(
    `Timed out waiting for ${description}: ${lastBodyText.slice(0, 500) || page.url()}`
  );
}

async function waitForPathname(page, matcher, timeout = 20000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const pathname = new URL(page.url()).pathname;
    if (matcher(pathname)) {
      return pathname;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`Timed out waiting for pathname transition: ${page.url()}`);
}

async function waitForVisibleInputCount(page, minimum, timeout = 15000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const inputs = page.locator('input:visible');
    const count = await inputs.count().catch(() => 0);

    if (count >= minimum) {
      return inputs;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`Timed out waiting for ${minimum} visible inputs on ${page.url()}`);
}

async function waitForLoginInputs(page, timeout = 15000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
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

async function fillLoginForm(page, account) {
  const inputs = await waitForVisibleInputCount(page, 2, 15000);
  await inputs.nth(0).fill(account.email);
  await inputs.nth(1).fill(account.password);
}

async function login(page, account) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await page.goto(makeUrl('/login'), { waitUntil: 'domcontentloaded' });
      await waitForAppReady(page);
      await waitForLoginInputs(page, 10000);
      await fillLoginForm(page, account);
      await page.getByRole('button', { name: /^로그인( 중\.\.\.)?$/ }).click({ force: true });
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
    url: page.url(),
    title: await page.title().catch(() => null),
    bodyText: await page
      .locator('body')
      .textContent()
      .then((text) => normalizeText(text).slice(0, 4000))
      .catch(() => null),
    alerts: await page
      .locator('[role="alert"]')
      .evaluateAll((nodes) =>
        nodes
          .map((node) => (node.textContent || '').replace(/\s+/g, ' ').trim())
          .filter(Boolean)
          .slice(0, 20)
      )
      .catch(() => []),
  };

  await page
    .screenshot({
      path: path.join(artifactRoot, `${fileStem}-failure.png`),
      fullPage: true,
    })
    .catch(() => {});

  writeJson(path.join(artifactRoot, `${fileStem}-failure.txt`), failureDetails);
}

async function collectVisibleErrorTexts(page) {
  return page
    .evaluate(() => {
      const selectors = ['[role="alert"]', '[class*="text-red"]', '[class*="text-error"]'];
      const seen = new Set();

      return selectors
        .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
        .filter((node) => {
          const style = window.getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            rect.width > 0 &&
            rect.height > 0
          );
        })
        .map((node) => (node.textContent || '').replace(/\s+/g, ' ').trim())
        .filter((text) => {
          if (!text || seen.has(text)) {
            return false;
          }

          seen.add(text);
          return true;
        })
        .slice(0, 20);
    })
    .catch(() => []);
}

async function fillInput(locator, value, options = {}) {
  const settleMs = options.settleMs ?? 350;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await locator.waitFor({ state: 'visible', timeout: 15000 });
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await locator.fill('', { force: true });
    await locator.fill(value, { force: true });
    await locator.blur().catch(() => {});
    await locator.page().waitForTimeout(settleMs);

    const currentValue = await locator.inputValue().catch(() => null);
    if (currentValue === value) {
      return;
    }
  }

  throw new Error(`Failed to persist input value: ${value}`);
}

function normalizeDigits(value) {
  return String(value).replace(/[^\d.-]/g, '');
}

async function clickWithFallback(locator) {
  await locator.waitFor({ state: 'visible', timeout: 15000 });
  await locator.scrollIntoViewIfNeeded().catch(() => {});

  try {
    await locator.click({ timeout: 3000 });
    return;
  } catch {}

  await locator
    .evaluate((element) => {
      const dispatchReactPress = (target) => {
        const reactPropsKey = Object.keys(target).find((key) => key.startsWith('__reactProps$'));
        if (!reactPropsKey) {
          return false;
        }

        const props = target[reactPropsKey];
        const handlers = [
          props?.onClick,
          props?.onPress,
          props?.onPressIn,
          props?.onPressOut,
          props?.onResponderRelease,
        ];

        for (const handler of handlers) {
          if (typeof handler === 'function') {
            handler({
              type: 'click',
              currentTarget: target,
              target,
              preventDefault() {},
              stopPropagation() {},
              nativeEvent: { target },
            });
            return true;
          }
        }

        return false;
      };

      let current = element;
      while (current) {
        if (current instanceof HTMLElement) {
          current.focus?.();
          current.click();
          current.dispatchEvent(
            new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              composed: true,
            })
          );

          if (dispatchReactPress(current)) {
            return;
          }
        }

        current = current.parentElement;
      }
    })
    .catch(() => {});

  await locator.page().waitForTimeout(300);
}

async function fillNumericInput(locator, value, options = {}) {
  const settleMs = options.settleMs ?? 250;
  const expectedValue = normalizeDigits(value);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await locator.waitFor({ state: 'visible', timeout: 15000 });
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await locator.fill('', { force: true });
    await locator.fill(value, { force: true });
    await locator.blur().catch(() => {});
    await locator.page().waitForTimeout(settleMs);

    const currentValue = await locator.inputValue().catch(() => null);
    if (currentValue !== null && normalizeDigits(currentValue) === expectedValue) {
      return;
    }
  }

  throw new Error(`Failed to persist numeric input value: ${value}`);
}

async function waitForVisibleTestId(page, testId, timeout = 15000) {
  const visibleLocator = page.locator(`[data-testid="${testId}"]:visible`).first();
  const locator = page.getByTestId(testId);
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    if (await visibleLocator.isVisible().catch(() => false)) {
      return visibleLocator;
    }

    const count = await locator.count().catch(() => 0);

    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`Timed out waiting for test id: ${testId}`);
}

async function selectNextWorkDate(page) {
  const tomorrowLabel = format(addDays(new Date(), 1), 'yyyy년 M월 d일 EEEE', { locale: ko });

  const addDateButton = await waitForVisibleTestId(page, 'job-posting-add-date-button');
  await addDateButton.click();
  await page.getByLabel(tomorrowLabel).first().click();
  const confirmButton = await waitForVisibleTestId(page, 'job-posting-date-confirm-button');
  await confirmButton.click();
  await confirmButton.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
}

async function createEmployerPosting(page, title) {
  await page.goto(makeUrl('/my-postings/create'), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);

  await fillInput(await waitForVisibleTestId(page, 'job-posting-title-input'), title);
  await fillInput(
    await waitForVisibleTestId(page, 'job-posting-location-name-input'),
    'Codex Live Lounge',
    {
      settleMs: 500,
    }
  );
  await fillInput(
    await waitForVisibleTestId(page, 'job-posting-location-address-input'),
    '서울시 강남구 테헤란로 123',
    { settleMs: 500 }
  );
  await fillInput(await waitForVisibleTestId(page, 'job-posting-detailed-address-input'), '3층');
  await fillInput(
    await waitForVisibleTestId(page, 'job-posting-contact-phone-input'),
    '010-5555-0002'
  );
  await fillInput(
    await waitForVisibleTestId(page, 'job-posting-description-input'),
    'Codex live deep verify employer posting'
  );

  await selectNextWorkDate(page);

  const salaryInputs = page.locator('[data-testid^="job-posting-salary-input-"]:visible');
  const salaryCount = await salaryInputs.count();
  if (salaryCount === 0) {
    throw new Error('No salary inputs were rendered on the create form');
  }

  for (let index = 0; index < salaryCount; index += 1) {
    await fillNumericInput(salaryInputs.nth(index), '12000');
  }

  const createSubmitButton = await waitForVisibleTestId(page, 'job-posting-create-submit');
  await createSubmitButton.click({ force: true });
  const nextPath = await waitForPathname(
    page,
    (pathname) => !pathname.includes('/my-postings/create'),
    8000
  ).catch(() => null);

  if (nextPath) {
    await waitForAppReady(page);
  }

  try {
    return await findLivePostingIdByTitle(title, 30000);
  } catch (error) {
    const visibleErrors = await collectVisibleErrorTexts(page);
    const suffix = visibleErrors.length > 0 ? ` Visible errors: ${visibleErrors.join(' | ')}` : '';
    throw new Error(`Create form did not persist posting "${title}".${suffix}`);
  }
}

async function openEmployerDetail(page, postingId) {
  await page.goto(makeUrl(`/my-postings/${postingId}`), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
}

async function editEmployerPosting(page, postingId, updatedTitle) {
  await page.goto(makeUrl(`/my-postings/${postingId}/edit`), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);

  await fillInput(await waitForVisibleTestId(page, 'job-posting-title-input'), updatedTitle, {
    settleMs: 500,
  });
  const editSubmitButton = await waitForVisibleTestId(page, 'job-posting-edit-submit');
  await editSubmitButton.click({ force: true });
  await waitForLivePostingMatch(postingId, (snapshot) => snapshot?.title === updatedTitle, 30000);
  await openEmployerDetail(page, postingId);
}

async function openApplicantsPage(page, postingId) {
  await page.goto(makeUrl(`/my-postings/${postingId}/applicants`), {
    waitUntil: 'domcontentloaded',
  });
  await waitForAppReady(page);
}

async function closePostingFromEmployerTab(page, postingId) {
  await page.goto(makeUrl('/employer'), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);

  const closeButton = await waitForVisibleTestId(
    page,
    `employer-close-posting-${postingId}`,
    30000
  );
  let confirmButton = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await clickWithFallback(closeButton);
    confirmButton = await waitForVisibleTestId(page, 'employer-close-posting-confirm', 2500).catch(
      () => null
    );

    if (confirmButton) {
      break;
    }
  }

  if (!confirmButton) {
    throw new Error('Close confirm modal did not appear on employer tab');
  }

  await clickWithFallback(confirmButton);
  await waitForLivePostingMatch(postingId, (snapshot) => snapshot?.status === 'closed', 30000);
  await page.goto(makeUrl('/employer'), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
}

async function cleanupPosting(page, postingId, diagnostics) {
  try {
    await openEmployerDetail(page, postingId);
    const deleteButton = await waitForVisibleTestId(page, 'job-posting-delete-button');
    await clickWithFallback(deleteButton);
    const confirmDeleteButton = await waitForVisibleTestId(page, 'job-posting-delete-confirm');
    await clickWithFallback(confirmDeleteButton);
    await waitForLivePostingMatch(postingId, (snapshot) => snapshot?.status === 'cancelled', 30000);
    diagnostics.cleanupCompleted = true;
  } catch (error) {
    diagnostics.cleanupError = error instanceof Error ? error.message : String(error);
    throw error;
  }
}

async function verifyPublic(page, diagnostics) {
  await page.goto(makeUrl('/jobs'), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);

  const bodyText = await expectBodyText(page, 30000);
  diagnostics.public.url = page.url();
  diagnostics.public.bodyText = bodyText.slice(0, 500);

  await page.screenshot({
    path: path.join(artifactRoot, 'public-jobs.png'),
    fullPage: true,
  });
}

async function verifyEmployer(context, account, diagnostics) {
  const page = await context.newPage();
  await attachDiagnostics(page, diagnostics.employer);

  const titleSuffix = String(Date.now()).slice(-8);
  const createdTitle = `CLD ${titleSuffix}`;
  const updatedTitle = `CLD ${titleSuffix} Edit`;

  diagnostics.employer.createdTitle = createdTitle;
  diagnostics.employer.updatedTitle = updatedTitle;

  try {
    await login(page, account);

    const postingId = await createEmployerPosting(page, createdTitle);
    diagnostics.employer.postingId = postingId;

    await page.goto(makeUrl('/employer'), { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await waitForVisibleTestId(page, `employer-close-posting-${postingId}`, 30000).catch(
      () => null
    );
    diagnostics.employer.listUrl = page.url();
    diagnostics.employer.listText = (await expectBodyText(page, 20000)).slice(0, 500);
    await page.screenshot({
      path: path.join(artifactRoot, 'employer-created-list.png'),
      fullPage: true,
    });

    await openEmployerDetail(page, postingId);
    diagnostics.employer.detailUrl = page.url();
    diagnostics.employer.detailText = (await expectBodyText(page, 20000)).slice(0, 500);
    await page.screenshot({
      path: path.join(artifactRoot, 'employer-detail.png'),
      fullPage: true,
    });

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

    await resetSession(page);
  } catch (error) {
    diagnostics.employer.error = error instanceof Error ? error.message : String(error);
    await captureFailure(page, 'employer-deep', error);
    throw error;
  } finally {
    await page.close().catch(() => {});
  }
}

async function verifyEmployerClose(context, account, diagnostics, postingId) {
  if (!postingId) {
    throw new Error('Employer close verification requires a posting id');
  }

  const page = await context.newPage();
  await attachDiagnostics(page, diagnostics.employer);

  try {
    await login(page, account);
    await closePostingFromEmployerTab(page, postingId);
    diagnostics.employer.closedListText = (await expectBodyText(page, 20000)).slice(0, 500);
    await page.screenshot({
      path: path.join(artifactRoot, 'employer-closed-list.png'),
      fullPage: true,
    });
    await resetSession(page);
  } catch (error) {
    diagnostics.employer.closeError = error instanceof Error ? error.message : String(error);
    await captureFailure(page, 'employer-close-deep', error);
    throw error;
  } finally {
    await page.close().catch(() => {});
  }
}

async function verifyStaff(context, account, diagnostics, employerDiagnostics) {
  const page = await context.newPage();
  await attachDiagnostics(page, diagnostics.staff);

  const postingId = employerDiagnostics.postingId;
  const updatedTitle = employerDiagnostics.updatedTitle;

  if (!postingId || !updatedTitle) {
    throw new Error('Employer verification did not produce a stable posting id/title');
  }

  try {
    await login(page, account);
    await page.goto(makeUrl(`/jobs/${postingId}`), { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    diagnostics.staff.detailUrl = page.url();
    const detailTitle = await waitForVisibleTestId(page, 'job-detail-title', 30000);
    diagnostics.staff.detailText = normalizeText((await detailTitle.textContent()) || '').slice(
      0,
      500
    );

    if (!diagnostics.staff.detailText.includes(updatedTitle)) {
      throw new Error(
        `Staff detail page did not render the updated posting title: ${diagnostics.staff.detailText}`
      );
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

async function verifyAdmin(context, adminAccount, diagnostics) {
  const page = await context.newPage();
  await attachDiagnostics(page, diagnostics.admin);

  try {
    await login(page, adminAccount);

    await page.goto(makeUrl('/admin'), { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    diagnostics.admin.dashboardUrl = page.url();
    diagnostics.admin.dashboardText = (await expectBodyText(page, 20000)).slice(0, 500);
    await page.screenshot({
      path: path.join(artifactRoot, 'admin-dashboard.png'),
      fullPage: true,
    });

    await page.goto(makeUrl('/admin/users'), { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    diagnostics.admin.usersUrl = page.url();
    diagnostics.admin.usersText = (await expectBodyText(page, 20000)).slice(0, 500);
    await page.screenshot({
      path: path.join(artifactRoot, 'admin-users.png'),
      fullPage: true,
    });

    await page.goto(makeUrl('/profile'), { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    diagnostics.admin.profileUrl = page.url();
    diagnostics.admin.profileText = (await expectBodyText(page, 20000)).slice(0, 500);
    await page.screenshot({
      path: path.join(artifactRoot, 'admin-profile.png'),
      fullPage: true,
    });

    await resetSession(page);
  } catch (error) {
    diagnostics.admin.error = error instanceof Error ? error.message : String(error);
    await captureFailure(page, 'admin-deep', error);
    throw error;
  } finally {
    await page.close().catch(() => {});
  }
}

async function cleanupEmployer(context, account, diagnostics, postingId) {
  if (!postingId) {
    return;
  }

  const page = await context.newPage();
  await attachDiagnostics(page, diagnostics.employer);

  try {
    await login(page, account);
    await cleanupPosting(page, postingId, diagnostics.employer);
    await resetSession(page);
  } catch (error) {
    diagnostics.employer.cleanupError = error instanceof Error ? error.message : String(error);
    await captureFailure(page, 'employer-cleanup-deep', error);
    throw error;
  } finally {
    await page.close().catch(() => {});
  }
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
  const adminAccount = {
    email: process.env.LIVE_ADMIN_EMAIL || accounts.admin?.email,
    password: process.env.LIVE_ADMIN_PASSWORD || accounts.admin?.password,
  };

  if (!adminAccount.email || !adminAccount.password) {
    throw new Error('Admin credentials are required for live deep verification');
  }

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
  let finalDiagnosticsReport = null;

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
      await verifyAdmin(adminContext, adminAccount, diagnostics);
    } finally {
      await adminContext.close();
    }

    const closeContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    try {
      await verifyEmployerClose(
        closeContext,
        accounts.employer,
        diagnostics,
        diagnostics.employer.postingId
      );
    } finally {
      await closeContext.close();
    }

    const cleanupContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    try {
      await cleanupEmployer(
        cleanupContext,
        accounts.employer,
        diagnostics,
        diagnostics.employer.postingId
      );
    } finally {
      await cleanupContext.close();
    }
  } finally {
    await browser.close();
    finalDiagnosticsReport = finalizeDiagnosticsReport(diagnostics);
    writeJson(path.join(artifactRoot, 'diagnostics.json'), finalDiagnosticsReport);
  }

  assertNoActionableDiagnostics(finalDiagnosticsReport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
