/**
 * 홈 대시보드 — 로고 연속 탭 시 스택 누적 방지 E2E 테스트
 *
 * 시나리오:
 *   1. 홈에서 로고 10번 연속 탭
 *   2. 뒤로가기 1번 → 이전 탭으로 복귀 (스택 누적 없음 증명)
 *
 * 구현 확인 포인트:
 *   - TabHeader의 UNIQN 로고: pathname === '/(app)/home'이면 no-op
 *   - home.tsx 로고 탭: router.replace('/(app)/home') 사용
 */

import { test, expect, type Page } from '@playwright/test';
import path from 'path';

const staffState = path.join(__dirname, '../../fixtures/storage-states/staff.json');

async function waitForAppInit(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  const loading = page.getByText(/앱 로딩 중/);
  await loading.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  await loading.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
}

async function dismissOnboarding(page: Page): Promise<void> {
  const skipBtn = page.getByText('나중에 하기');
  const visible = await skipBtn.isVisible().catch(() => false);
  if (visible) {
    await skipBtn.click({ timeout: 3_000 });
    await page.waitForTimeout(300);
  }
}

test.use({ storageState: staffState });

// PR #119: home_dashboard_enabled=true 도입 후 staff entry 가 (app)/home (standalone).
// 시나리오를 새 flow 에 맞게 재작성:
//   1. /home 에서 로고 click → 자기 참조 (router.replace) — history 누적 없음
//   2. 탭에서 로고 click → 홈 이동 — history 정상 push (push 1회만)
test.describe('홈 로고 탭 스택 누적 방지', () => {
  test('홈에서 로고를 10번 탭해도 history 가 누적되지 않는다', async ({ page }) => {
    await page.goto('/');
    await waitForAppInit(page);
    await dismissOnboarding(page);

    // 홈 진입 확인
    await expect(page.getByText('다음 근무').first()).toBeVisible({ timeout: 15_000 });

    const initialHistoryLength = await page.evaluate(() => window.history.length);

    const logoButton = page.getByRole('button', { name: 'UNIQN 홈으로 이동' });
    await expect(logoButton).toBeVisible({ timeout: 5_000 });

    // 로고 10번 연속 탭. TabHeader 우측 actions View(zIndex:10) 가 center logo
    // absolute View 클릭을 intercept — dispatchEvent('click') 으로 직접 발사.
    for (let i = 0; i < 10; i++) {
      await logoButton.dispatchEvent('click');
      await page.waitForTimeout(100);
    }

    // 여전히 홈
    await expect(page.getByText('다음 근무').first()).toBeVisible({ timeout: 5_000 });

    // history 증가가 거의 없음 (router.replace 또는 same-pathname no-op)
    const finalHistoryLength = await page.evaluate(() => window.history.length);
    expect(finalHistoryLength - initialHistoryLength).toBeLessThanOrEqual(2);
  });

  test('탭에서 홈 로고 5번 탭 후 history 가 비정상 증가하지 않는다', async ({ page }) => {
    await page.goto('/');
    await waitForAppInit(page);
    await dismissOnboarding(page);

    // 홈 → 구인구직 탭 (HomeTabBar)
    const jobsTabButton = page.getByRole('button', { name: '구인구직 탭으로 이동' });
    await expect(jobsTabButton).toBeVisible({ timeout: 10_000 });
    await jobsTabButton.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    const tabHistoryLength = await page.evaluate(() => window.history.length);

    // 탭 헤더의 로고 5번 click — 첫 click 만 home 이동, 나머지 4번은 self-replace
    // dispatchEvent('click') 으로 우측 actions View 의 pointer intercept 우회.
    const logoButton = page.getByRole('button', { name: 'UNIQN 홈으로 이동' });
    await expect(logoButton).toBeVisible({ timeout: 5_000 });

    for (let i = 0; i < 5; i++) {
      await logoButton.dispatchEvent('click');
      await page.waitForTimeout(150);
    }

    // 홈 도착
    await expect(page.getByText('다음 근무').first()).toBeVisible({ timeout: 10_000 });

    // 탭 → 홈 push 1 회 만 발생 (+1) 예상, +5 가 아님
    const finalHistoryLength = await page.evaluate(() => window.history.length);
    expect(finalHistoryLength - tabHistoryLength).toBeLessThanOrEqual(2);
  });
});
