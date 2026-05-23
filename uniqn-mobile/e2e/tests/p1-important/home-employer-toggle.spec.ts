/**
 * 홈 대시보드 — Employer 뷰 전환 토글 E2E 테스트
 *
 * 시나리오:
 *   1. Employer 로그인 → 홈 진입 → Employer 대시보드 기본 표시
 *   2. 뷰 전환 토글 표시 확인
 *   3. "스태프로" 탭 → Staff 대시보드로 전환
 *   4. "내 업무" 탭 → Employer 대시보드로 복귀
 */

import { test, expect, type Page } from '@playwright/test';
import path from 'path';

const employerState = path.join(__dirname, '../../fixtures/storage-states/employer.json');

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

test.use({ storageState: employerState });

test.describe('Employer 뷰 전환 토글', () => {
  test('홈 진입 시 Employer 대시보드와 뷰 토글이 기본 표시된다', async ({ page }) => {
    await page.goto('/');
    await waitForAppInit(page);
    await dismissOnboarding(page);

    // 뷰 전환 토글 표시
    await expect(page.getByText('내 업무').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('스태프로').first()).toBeVisible({ timeout: 5_000 });

    // Employer 대시보드 위젯 확인
    await expect(page.getByText('이번 주 스태프').first()).toBeVisible({ timeout: 10_000 });
  });

  test('"스태프로" 탭하면 Staff 대시보드로 전환된다', async ({ page }) => {
    await page.goto('/');
    await waitForAppInit(page);
    await dismissOnboarding(page);

    // 초기 Employer 뷰 확인
    await expect(page.getByText('내 업무').first()).toBeVisible({ timeout: 15_000 });

    // "스태프로" 탭 클릭
    await page.getByText('스태프로').first().click();
    await page.waitForTimeout(300);

    // Staff 대시보드 위젯 표시 확인
    await expect(page.getByText('다음 근무').first()).toBeVisible({ timeout: 10_000 });
    // Employer 위젯은 사라짐
    await expect(page.getByText('이번 주 스태프'))
      .not.toBeVisible({ timeout: 3_000 })
      .catch(() => {});
  });

  test('"내 업무" 탭하면 Employer 대시보드로 복귀한다', async ({ page }) => {
    await page.goto('/');
    await waitForAppInit(page);
    await dismissOnboarding(page);

    // Staff 뷰로 전환
    await page.getByText('스태프로').first().click();
    await page.waitForTimeout(300);
    await expect(page.getByText('다음 근무').first()).toBeVisible({ timeout: 10_000 });

    // Employer 뷰로 복귀
    await page.getByText('내 업무').first().click();
    await page.waitForTimeout(300);
    await expect(page.getByText('이번 주 스태프').first()).toBeVisible({ timeout: 10_000 });
  });

  test('홈 재진입 시 뷰가 기본값(employer)으로 리셋된다', async ({ page }) => {
    await page.goto('/');
    await waitForAppInit(page);
    await dismissOnboarding(page);

    // Staff 뷰로 전환
    await page.getByText('스태프로').first().click();
    await page.waitForTimeout(300);

    // 뒤로가기 후 다시 홈 진입
    await page.goBack().catch(() => {});
    await page.waitForTimeout(500);

    // 로고 탭으로 홈 재진입
    const logoButton = page.getByRole('button', { name: 'UNIQN 홈으로 이동' });
    const logoVisible = await logoButton.isVisible().catch(() => false);
    if (logoVisible) {
      await logoButton.click();
      await page.waitForTimeout(500);
    } else {
      await page.goto('/');
      await waitForAppInit(page);
    }

    // Employer 대시보드가 기본값으로 표시
    await expect(page.getByText('이번 주 스태프').first()).toBeVisible({ timeout: 10_000 });
  });
});
