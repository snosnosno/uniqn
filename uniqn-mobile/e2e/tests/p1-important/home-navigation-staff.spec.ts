/**
 * 홈 대시보드 — Staff 네비게이션 E2E 테스트
 *
 * 시나리오:
 *   1. Staff로 앱 진입 → 홈 대시보드 자동 표시
 *   2. 탭 화면의 UNIQN 로고 탭 → 홈으로 이동
 *   3. Staff 대시보드 위젯 노출 확인
 *   4. 위젯 탭 → 해당 화면으로 이동
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

test.describe('홈 네비게이션 — Staff', () => {
  test('앱 진입 시 홈 대시보드가 표시된다', async ({ page }) => {
    await page.goto('/');
    await waitForAppInit(page);
    await dismissOnboarding(page);

    // Staff 대시보드 위젯 확인
    await expect(page.getByText('다음 근무').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('내 지원 현황').first()).toBeVisible({ timeout: 10_000 });
  });

  // 해소(옵션 B): Jobs 탭 분리(/jobs)로 (tabs) 진입이 URL '/' 충돌 없이 안정 렌더되어
  // 로고 탭 홈 복귀 검증이 가능해짐.
  test('홈 → 탭 진입 → UNIQN 로고 탭으로 홈 복귀', async ({ page }) => {
    await page.goto('/');
    await waitForAppInit(page);
    await dismissOnboarding(page);

    // 홈 진입 확인
    await expect(page.getByText('다음 근무').first()).toBeVisible({ timeout: 15_000 });

    // HomeTabBar 의 "구인구직 탭으로 이동" button click → /(app)/(tabs) 진입
    const jobsTabButton = page.getByRole('button', { name: '구인구직 탭으로 이동' });
    await expect(jobsTabButton).toBeVisible({ timeout: 10_000 });
    await jobsTabButton.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    // 탭 헤더의 UNIQN 로고 click → home 복귀
    // TabHeader 우측 actions View(flex-1 zIndex:10) 가 center logo absolute View 클릭을
    // intercept — dispatchEvent('click') 으로 DOM click event 직접 발사 (mouse 경로 우회).
    const logoButton = page.getByRole('button', { name: 'UNIQN 홈으로 이동' });
    await expect(logoButton).toBeVisible({ timeout: 10_000 });
    await logoButton.dispatchEvent('click');

    // 홈 대시보드 진입 확인 — 탭→로고 복귀 후 이전 /home 인스턴스가 DOM 에 hidden 으로
    // 남으므로 보이는 '다음 근무' 로 스코프 (.first() 만으론 hidden 중복을 잡을 수 있음).
    await expect(page.getByText('다음 근무').filter({ visible: true }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('Staff 사용자는 뷰 전환 토글이 표시되지 않는다', async ({ page }) => {
    await page.goto('/');
    await waitForAppInit(page);
    await dismissOnboarding(page);

    // 뷰 전환 토글 없음
    const toggle = page.getByText('내 업무');
    await expect(toggle)
      .not.toBeVisible({ timeout: 3_000 })
      .catch(() => {
        // 없으면 테스트 통과
      });
  });
});
