/**
 * Smoke Test — 앱이 정상적으로 로드되는지 확인
 */
import { test, expect } from '@playwright/test';

test.describe('Smoke Test', () => {
  test('앱이 정상적으로 로드된다', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // 페이지가 로드되고 빈 페이지가 아닌지 확인
    await expect(page.locator('body')).not.toBeEmpty();

    // Expo Web 앱의 root div가 렌더링되는지 확인
    await expect(page.locator('#root')).toBeAttached({ timeout: 15_000 });
  });

  test('스플래시 화면 또는 로그인 페이지가 표시된다', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // 앱 초기화 완료 대기
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const pathname = new URL(url).pathname;

    // 인증 페이지 또는 앱 메인 페이지 중 하나여야 함
    const isAuthPage = pathname.includes('login') || pathname.includes('auth');
    const isAppRoot = pathname === '/';
    const isAppPage = pathname.includes('schedule') || pathname.includes('qr');
    expect(isAuthPage || isAppRoot || isAppPage).toBeTruthy();
  });
});
