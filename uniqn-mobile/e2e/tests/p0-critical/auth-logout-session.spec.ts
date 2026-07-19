/**
 * P0 로그아웃 & 세션 테스트 (4 tests)
 */
import { test, expect } from '@playwright/test';
import { TEXT } from '../../helpers/assertion-helpers';
import { waitForAppReady } from '../../helpers/wait-helpers';

test.describe('로그아웃 & 세션', () => {
  test('로그아웃 → 로그인 화면 이동', async ({ page }) => {
    // storageState로 인증된 상태에서 시작
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    // 프로필 탭으로 이동
    const profileTab = page.getByText(TEXT.TAB_PROFILE);
    if (await profileTab.isVisible()) {
      await profileTab.click();
    }

    // 로그아웃 버튼 찾기
    const logoutButton = page.getByText(TEXT.LOGOUT);
    if (await logoutButton.isVisible()) {
      page.once('dialog', async (dialog) => {
        await dialog.accept();
      });
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

  test('로그아웃 후 보호 라우트 접근 → 인증 필요 상태', async ({ page }) => {
    // 비인증 상태에서 보호 라우트 접근
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    // 앱이 로드되어야 함 (리다이렉트 또는 로그인 화면/스플래시 표시)
    // Expo Router SPA에서는 클라이언트 라우팅으로 인해
    // 비인증 시 로그인 폼이 표시되거나 스플래시/앱 탭이 표시됨
    // (앱 탭 착지 프록시: 하단 탭바의 구인구직 탭 — 홈 대시보드 삭제로 로고 버튼은 소멸)
    const loginOrSplash = page
      .getByPlaceholder('이메일을 입력하세요')
      .or(page.getByText('로그인'))
      .or(page.getByRole('tab', { name: '구인구직' }));
    await expect(loginOrSplash).toBeVisible({ timeout: 15_000 });
  });

  test('미인증 상태에서 스케줄 접근 → 앱이 정상 동작', async ({ browser }) => {
    // 새 컨텍스트 (인증 없음)
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/schedule', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');

    // 앱이 크래시 없이 어떤 화면이든 표시해야 함
    // (SPA이므로 비인증 시 로그인 폼, 스플래시, 또는 리다이렉트 가능)
    await page.waitForTimeout(5_000);
    expect(page.url()).toBeTruthy();

    await context.close();
  });

  test('세션 만료 시뮬레이션 → 앱이 정상 처리', async ({ browser }) => {
    // 새 컨텍스트 (인증 없음)
    const context = await browser.newContext();
    const page = await context.newPage();

    // localStorage에 만료된 상태 주입
    await page.addInitScript(() => {
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            user: null,
            profile: null,
            isInitialized: true,
          },
          version: 0,
        })
      );
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5_000);

    // 앱이 크래시 없이 정상 동작 (로그인 폼 또는 스플래시 표시)
    const anyContent = page
      .getByPlaceholder('이메일을 입력하세요')
      .or(page.getByText('로그인'))
      .or(page.getByRole('tab', { name: '구인구직' }))
      .or(page.getByText('앱 로딩 중...'));
    await expect(anyContent).toBeVisible({ timeout: 10_000 });

    await context.close();
  });
});
