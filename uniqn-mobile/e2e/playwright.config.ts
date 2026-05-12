import { config as loadDotenv } from 'dotenv';
import path from 'path';

// E2E_CONFIG의 requireEnv가 모듈 로드 시점에 실행되므로 반드시 먼저 로드
loadDotenv({ path: path.join(__dirname, '.env.test') });

// eslint-disable-next-line import/first
import { defineConfig, devices } from '@playwright/test';
// eslint-disable-next-line import/first
import { E2E_CONFIG } from './config';

const isCI = !!process.env.CI;
const projectRoot = path.resolve(__dirname, '..');
const artifactRoot = path.join(projectRoot, E2E_CONFIG.runtime.artifactDir);
const htmlReportDir = path.join(artifactRoot, 'report');
const testResultsDir = path.join(artifactRoot, 'test-results');

const iPhone14Viewport = {
  viewport: devices['iPhone 14'].viewport,
  deviceScaleFactor: devices['iPhone 14'].deviceScaleFactor,
  isMobile: true,
  hasTouch: true,
};

export default defineConfig({
  testDir: './tests',
  testIgnore: /.*-debug\.spec\.ts/,
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 4 : 1,
  outputDir: testResultsDir,
  reporter: isCI
    ? [['html', { open: 'never', outputFolder: htmlReportDir }], ['github']]
    : [['html', { open: 'on-failure', outputFolder: htmlReportDir }]],

  globalSetup: require.resolve('./global-setup'),
  globalTeardown: require.resolve('./global-teardown'),

  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: E2E_CONFIG.runtime.baseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    browserName: 'chromium',
  },

  projects: [
    {
      name: 'setup',
      testDir: '.',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...iPhone14Viewport,
        storageState: './e2e/fixtures/storage-states/staff.json',
      },
      dependencies: ['setup'],
      testIgnore:
        /.*(auth-login|auth-signup|auth-forgot|public|rbac|employer|admin|collaborator).*\.spec\.ts/,
    },
    {
      name: 'chromium-employer',
      use: {
        ...iPhone14Viewport,
        storageState: './e2e/fixtures/storage-states/employer.json',
      },
      dependencies: ['setup'],
      testMatch: /.*employer.*\.spec\.ts/,
    },
    {
      name: 'chromium-admin',
      use: {
        ...iPhone14Viewport,
        storageState: './e2e/fixtures/storage-states/admin.json',
      },
      dependencies: ['setup'],
      testMatch: /.*admin.*\.spec\.ts/,
    },
    {
      name: 'chromium-collaborator',
      use: {
        ...iPhone14Viewport,
        storageState: './e2e/fixtures/storage-states/collaborator.json',
      },
      dependencies: ['setup'],
      // PR #88 follow-up: collaborator 페르소나 — "공유받은 공고" + 자가 나가기
      testMatch: /.*collaborator-(shared|self).*\.spec\.ts/,
    },
    {
      name: 'chromium-unauthenticated',
      use: {
        ...iPhone14Viewport,
        storageState: './e2e/fixtures/storage-states/unauthenticated.json',
      },
      dependencies: ['setup'],
      testMatch: /.*(auth-login|auth-signup|auth-forgot|public|rbac).*\.spec\.ts/,
    },
  ],

  webServer: {
    command: `npx serve dist -l ${E2E_CONFIG.runtime.webPort} -s`,
    port: E2E_CONFIG.runtime.webPort,
    cwd: projectRoot,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
