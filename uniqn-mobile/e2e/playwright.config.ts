import path from 'path';
import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;
const baseURL = isCI ? 'http://localhost:3000' : 'http://localhost:8081';
const projectRoot = path.resolve(__dirname, '..');

// iPhone 14 뷰포트만 사용 (webkit 대신 chromium)
const iPhone14Viewport = {
  viewport: devices['iPhone 14'].viewport,
  deviceScaleFactor: devices['iPhone 14'].deviceScaleFactor,
  isMobile: true,
  hasTouch: true,
};

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 4 : 1,
  reporter: isCI ? [['html', { open: 'never' }], ['github']] : [['html', { open: 'on-failure' }]],

  globalSetup: require.resolve('./global-setup'),
  globalTeardown: require.resolve('./global-teardown'),

  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    browserName: 'chromium',
  },

  projects: [
    // Auth setup — storageState 파일 검증 (생성은 global-setup에서 수행)
    {
      name: 'setup',
      testDir: '.',
      testMatch: /.*\.setup\.ts/,
    },

    // 기본 테스트 (Chromium, iPhone 14 뷰포트)
    {
      name: 'chromium',
      use: {
        ...iPhone14Viewport,
        storageState: './e2e/fixtures/storage-states/staff.json',
      },
      dependencies: ['setup'],
      testIgnore: /.*(auth-login|auth-signup|auth-forgot|public|rbac|employer|admin).*\.spec\.ts/,
    },

    // Employer 전용 테스트
    {
      name: 'chromium-employer',
      use: {
        ...iPhone14Viewport,
        storageState: './e2e/fixtures/storage-states/employer.json',
      },
      dependencies: ['setup'],
      testMatch: /.*employer.*\.spec\.ts/,
    },

    // Admin 전용 테스트
    {
      name: 'chromium-admin',
      use: {
        ...iPhone14Viewport,
        storageState: './e2e/fixtures/storage-states/admin.json',
      },
      dependencies: ['setup'],
      testMatch: /.*admin.*\.spec\.ts/,
    },

    // 비인증 테스트 (로그인/회원가입/퍼블릭)
    {
      name: 'chromium-unauthenticated',
      use: {
        ...iPhone14Viewport,
      },
      dependencies: ['setup'],
      testMatch: /.*(auth-login|auth-signup|auth-forgot|public|rbac).*\.spec\.ts/,
    },
  ],

  webServer: {
    command: isCI ? 'npx serve dist -l 3000 -s' : 'npx serve dist -l 8081 -s',
    port: isCI ? 3000 : 8081,
    cwd: projectRoot,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
