/**
 * 네비게이션 헬퍼 — 탭/라우트 이동
 */
import type { Page } from '@playwright/test';

/**
 * 하단 탭 네비게이션 클릭
 */
export async function clickTab(
  page: Page,
  tabName: '구인구직' | '내 스케줄' | '내 공고' | '프로필'
): Promise<void> {
  await page.getByRole('tab', { name: tabName }).click();
}

/**
 * 특정 라우트로 이동 후 로드 대기
 */
export async function navigateTo(
  page: Page,
  route: string,
  waitForLoad = true
): Promise<void> {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  if (waitForLoad) {
    await page.waitForLoadState('domcontentloaded');
  }
}

/**
 * 뒤로가기
 */
export async function goBack(page: Page): Promise<void> {
  await page.goBack();
  await page.waitForLoadState('domcontentloaded');
}

/**
 * 현재 URL에서 라우트 추출
 */
export function getCurrentRoute(page: Page): string {
  const url = new URL(page.url());
  return url.pathname;
}
