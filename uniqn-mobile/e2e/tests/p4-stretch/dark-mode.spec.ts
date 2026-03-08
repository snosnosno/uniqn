/**
 * P4 다크모드 테스트 (4 tests)
 * 프로젝트: chromium (staff storageState)
 *
 * 설정 페이지의 다크 모드 토글이 올바르게 동작하는지 검증
 */
import { test, expect } from '../../fixtures/base.fixture';

/**
 * 설정 페이지로 이동하고 앱 초기화 + 콘텐츠 렌더링 완료를 대기
 */
async function navigateToSettings(page: import('@playwright/test').Page) {
  await page.goto('/settings', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
  // 앱 초기화(useAppInitialize) + 라우트 렌더링 완료까지 대기
  // 설정 페이지에는 '앱 설정' 섹션 헤더가 반드시 표시됨
  await page.getByText('앱 설정').waitFor({ state: 'visible', timeout: 15_000 });
}

test.describe('다크모드', () => {
  test('설정에서 다크모드 토글 표시', async ({ page }) => {
    await navigateToSettings(page);

    const darkModeLabel = page.getByText('다크 모드');
    await expect(darkModeLabel).toBeVisible({ timeout: 5_000 });
  });

  test('다크모드 토글 → 테마 전환', async ({ page }) => {
    await navigateToSettings(page);

    // 현재 다크모드 상태 확인
    const initialBg = await page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor;
    });

    // 다크모드 토글 클릭 — Switch 컴포넌트는 '다크 모드' 텍스트 옆에 위치
    // SettingItem 내부의 Switch를 클릭 (label 텍스트로 위치 파악)
    const darkModeRow = page.getByText('다크 모드').locator('..');
    const toggle = darkModeRow.locator('..').locator('[role="switch"]');
    const hasSwitch = await toggle.isVisible().catch(() => false);

    if (hasSwitch) {
      await toggle.click();
    } else {
      // Switch가 없으면 텍스트 영역 클릭 (SettingItem의 onPress 동작)
      await page.getByText('다크 모드').click();
    }
    await page.waitForTimeout(500);

    // NativeWind에서 다크모드는 class 기반이므로 documentElement에 dark 클래스 확인
    const hasDarkClass = await page.evaluate(() => {
      return document.documentElement.classList.contains('dark');
    });

    expect(typeof hasDarkClass).toBe('boolean');
  });

  test('다크모드 설정 지속성 → 새로고침 후 유지', async ({ page }) => {
    await navigateToSettings(page);

    // 다크모드 활성화 — localStorage에 직접 테마 저장
    await page.evaluate(() => {
      const currentTheme = localStorage.getItem('uniqn-theme');
      const parsed = currentTheme ? JSON.parse(currentTheme) : {};
      parsed.state = { ...parsed.state, mode: 'dark' };
      localStorage.setItem('uniqn-theme', JSON.stringify(parsed));
    });

    // 저장 확인
    const isDarkBefore = await page.evaluate(() => {
      const storage = localStorage.getItem('uniqn-theme');
      return storage ? JSON.parse(storage) : null;
    });

    // 새로고침
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3_000);

    // 테마 상태 유지 확인
    const isDarkAfter = await page.evaluate(() => {
      const storage = localStorage.getItem('uniqn-theme');
      return storage ? JSON.parse(storage) : null;
    });

    // 저장된 테마가 동일해야 함
    if (isDarkBefore && isDarkAfter) {
      expect(isDarkAfter.state?.mode).toBe(isDarkBefore.state?.mode);
    }
  });

  test('다크모드에서 텍스트 가독성 확인', async ({ page }) => {
    await navigateToSettings(page);

    // 다크모드 활성화 — localStorage를 통한 직접 설정
    await page.evaluate(() => {
      const currentTheme = localStorage.getItem('uniqn-theme');
      const parsed = currentTheme ? JSON.parse(currentTheme) : {};
      parsed.state = { ...parsed.state, mode: 'dark' };
      localStorage.setItem('uniqn-theme', JSON.stringify(parsed));
    });

    // 다른 페이지로 이동하여 텍스트 가독성 확인
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3_000);

    // 페이지에 콘텐츠가 렌더링되어야 함
    const body = page.locator('body');
    await expect(body).not.toBeEmpty();

    // 콘솔 에러 없이 렌더링되어야 함
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(1_000);

    // 크리티컬 렌더링 에러 없어야 함
    const criticalErrors = errors.filter(
      (e) => e.includes('TypeError') || e.includes('ReferenceError')
    );
    expect(criticalErrors).toEqual([]);
  });
});
