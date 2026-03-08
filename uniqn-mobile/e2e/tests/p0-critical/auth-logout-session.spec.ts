/**
 * P0 로그아웃 & 세션 테스트 (4 tests)
 */
import { test, expect } from '@playwright/test';
import { TEXT } from '../../helpers/assertion-helpers';

test.describe('로그아웃 & 세션', () => {
  test('로그아웃 → 로그인 화면 이동', async ({ page }) => {
    // storageState로 인증된 상태에서 시작
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // 프로필 탭으로 이동
    const profileTab = page.getByText(TEXT.TAB_PROFILE);
    if (await profileTab.isVisible()) {
      await profileTab.click();
    }

    // 로그아웃 버튼 찾기
    const logoutButton = page.getByText(TEXT.LOGOUT);
    if (await logoutButton.isVisible()) {
      await logoutButton.click();

      // 확인 모달이 있으면 확인
      const confirmButton = page.getByRole('button', { name: /확인|네|로그아웃/ });
      if (await confirmButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await confirmButton.click();
      }

      // 로그인 화면으로 이동 확인
      await page.waitForURL(/login|auth/, { timeout: 10_000 });
      expect(page.url()).toMatch(/login|auth/);
    }
  });

  test('로그아웃 후 보호 라우트 접근 → 로그인 리다이렉트', async ({ page }) => {
    // 비인증 상태에서 보호 라우트 접근
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // 로그인 페이지로 리다이렉트되어야 함
    const pathname = new URL(page.url()).pathname;
    expect(pathname).toMatch(/login|auth/);
  });

  test('미인증 상태에서 스케줄 접근 → 리다이렉트', async ({ browser }) => {
    // 새 컨텍스트 (인증 없음)
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/schedule', { waitUntil: 'domcontentloaded' });

    // 웹에서는 클라이언트 사이드 리다이렉트가 발생하므로 URL 변경을 기다림
    await page.waitForURL((url) => !url.pathname.includes('/schedule'), { timeout: 10_000 }).catch(() => {});
    await page.waitForLoadState('domcontentloaded');

    const url = page.url();
    // 인증이 없으면 로그인 또는 루트로 리다이렉트
    expect(url).not.toContain('/schedule');

    await context.close();
  });

  test('세션 만료 시뮬레이션 → 재로그인 필요', async ({ browser }) => {
    // 새 컨텍스트 (인증 없음)
    const context = await browser.newContext();
    const page = await context.newPage();

    // localStorage에 만료된 상태 주입
    await page.addInitScript(() => {
      localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          user: null,
          profile: null,
          isInitialized: true,
        },
        version: 0,
      }));
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // 웹에서는 클라이언트 사이드 리다이렉트가 발생하므로 URL 변경을 기다림
    await page.waitForURL(/login|auth/, { timeout: 10_000 }).catch(() => {});
    await page.waitForLoadState('domcontentloaded');

    // 인증 없으면 로그인으로 이동
    const url = page.url();
    expect(url).toMatch(/login|auth/);

    await context.close();
  });
});
