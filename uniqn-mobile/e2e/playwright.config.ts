import { config as loadDotenv } from 'dotenv';
import path from 'path';

// E2E_CONFIG의 requireEnv가 모듈 로드 시점에 실행되므로 반드시 먼저 로드
loadDotenv({ path: path.join(__dirname, '.env.test'), quiet: true });

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
  // retries 2→1: 실패/flaky 테스트 재실행을 3배→2배로 줄여 전체 wall-clock 단축 (45분 cap 초과 cancelled 방어, 단일 flake는 1회 재시도로 흡수)
  retries: isCI ? 1 : 0,
  // ubuntu-latest 는 2 vCPU. workers:4 + 로컬 Supabase + 웹서버가 CPU 초과구독되면
  // 인증후 페이지 로드가 expect timeout 을 넘겨 광범위 실패 → retries 3배 증폭 →
  // 45분 job cap 초과 cancelled. 2 로 낮춰 경합 완화 (8.5→~15분이나 안정적).
  workers: isCI ? 2 : 1,
  outputDir: testResultsDir,
  reporter: isCI
    ? [['list'], ['html', { open: 'never', outputFolder: htmlReportDir }], ['github']]
    : [['html', { open: 'on-failure', outputFolder: htmlReportDir }]],

  globalSetup: require.resolve('./global-setup'),
  globalTeardown: require.resolve('./global-teardown'),

  timeout: 60_000,
  // CI 러너 부하 시 페이지 로드 여유 확보 (10s → 15s). 근본은 workers 축소.
  expect: { timeout: 15_000 },

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
