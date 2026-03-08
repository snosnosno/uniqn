/**
 * 대기 헬퍼 — 앱 초기화, 토스트, 모달, 로딩 대기
 */
import type { Page } from '@playwright/test';

/**
 * 앱 초기화 완료 대기
 * 스플래시 화면이 사라지고 실제 콘텐츠가 나타날 때까지 대기
 */
export async function waitForAppReady(
  page: Page,
  timeout = 30_000
): Promise<void> {
  // 로딩 오버레이가 사라질 때까지 대기
  const loadingIndicator = page.getByText('앱 로딩 중...');
  try {
    const isVisible = await loadingIndicator.isVisible().catch(() => false);
    if (isVisible) {
      await loadingIndicator.waitFor({ state: 'hidden', timeout });
    }
  } catch {
    // 로딩 메시지가 없었으면 이미 로드 완료
  }

  // 알림 온보딩 모달이 남아있으면 스킵
  await dismissNotificationOnboarding(page);
}

/**
 * 알림 권한 온보딩 모달 자동 스킵
 */
export async function dismissNotificationOnboarding(
  page: Page
): Promise<void> {
  try {
    const skipButton = page.getByText('나중에 하기');
    const isVisible = await skipButton.isVisible().catch(() => false);
    if (isVisible) {
      await skipButton.click({ timeout: 3_000 });
      await page.waitForTimeout(500);
    }
  } catch {
    // 온보딩 모달이 없으면 무시
  }
}

/**
 * 토스트 메시지 대기
 */
export async function waitForToast(
  page: Page,
  message: string | RegExp,
  timeout = 5_000
): Promise<void> {
  const toast = typeof message === 'string'
    ? page.getByText(message)
    : page.locator(`text=${message}`);
  await toast.waitFor({ state: 'visible', timeout });
}

/**
 * 토스트 메시지가 사라질 때까지 대기
 */
export async function waitForToastDismiss(
  page: Page,
  timeout = 6_000
): Promise<void> {
  const toast = page.locator('[role="alert"]');
  try {
    await toast.waitFor({ state: 'hidden', timeout });
  } catch {
    // 토스트가 없었으면 무시
  }
}

/**
 * 모달이 열릴 때까지 대기
 */
export async function waitForModal(
  page: Page,
  timeout = 5_000
): Promise<void> {
  await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout });
}

/**
 * 모달이 닫힐 때까지 대기
 */
export async function waitForModalDismiss(
  page: Page,
  timeout = 5_000
): Promise<void> {
  await page.locator('[role="dialog"]').waitFor({ state: 'hidden', timeout });
}

/**
 * 네비게이션 완료 대기
 */
export async function waitForNavigation(
  page: Page,
  urlPattern: string | RegExp,
  timeout = 10_000
): Promise<void> {
  await page.waitForURL(urlPattern, { timeout });
}

/**
 * 네트워크 요청 완료 대기
 */
export async function waitForNetworkIdle(
  page: Page,
  timeout = 5_000
): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}
