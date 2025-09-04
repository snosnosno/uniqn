/**
 * Playwright E2E Test Configuration
 * Week 4 성능 최적화: 엔터프라이즈급 E2E 테스트 프레임워크
 * 
 * @version 4.0
 * @since 2025-02-02 (Week 4)
 */

import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 설정
 * 핵심 워크플로우 테스트: 로그인, 스태프 관리, 공고 관리, 급여 정산
 */
export default defineConfig({
  testDir: './e2e',
  
  /* 병렬 테스트 실행 */
  fullyParallel: true,
  
  /* CI에서 실패시 재시도 안함 */
  forbidOnly: !!process.env.CI,
  
  /* CI에서 재시도 설정 */
  retries: process.env.CI ? 2 : 0,
  
  /* 병렬 워커 수 */
  workers: process.env.CI ? 1 : undefined,
  
  /* 리포터 설정 */
  reporter: 'html',
  
  /* 글로벌 테스트 설정 */
  use: {
    /* Base URL */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    
    /* 실패시 스크린샷 촬영 */
    screenshot: 'only-on-failure',
    
    /* 실패시 비디오 녹화 */
    video: 'retain-on-failure',
    
    /* 네트워크 추적 */
    trace: 'on-first-retry',
    
    /* 타임아웃 설정 */
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  /* 브라우저 프로젝트 설정 */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
    },

    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 }
      },
    },

    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 }
      },
    },

    /* 모바일 테스트 */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  /* 로컬 개발 서버 */
  webServer: {
    command: 'npm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2분
    env: {
      NODE_ENV: 'test',
      REACT_APP_USE_EMULATOR: 'true',
    }
  },
  
  /* 출력 디렉토리 */
  outputDir: 'test-results/',
});