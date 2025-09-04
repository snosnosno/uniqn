/**
 * Authentication E2E Tests
 * Week 4 성능 최적화: 로그인/로그아웃 워크플로우 테스트
 * 
 * @version 4.0
 * @since 2025-02-02 (Week 4)
 */

import { test, expect } from '@playwright/test';

test.describe('사용자 인증', () => {
  test.beforeEach(async ({ page }) => {
    // 페이지 로드 성능 측정
    await page.goto('/');
    
    // 초기 로딩 완료 대기
    await expect(page.locator('body')).toBeVisible();
  });

  test('로그인 페이지 렌더링', async ({ page }) => {
    // 로그인 폼이 표시되는지 확인
    const loginForm = page.locator('form').first();
    await expect(loginForm).toBeVisible();
    
    // 필수 입력 필드 확인
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    
    // 로그인 버튼 확인
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // 페이지 제목 확인
    await expect(page).toHaveTitle(/T-HOLDEM/);
  });

  test('이메일 유효성 검사', async ({ page }) => {
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');
    
    // 잘못된 이메일 형식 입력
    await emailInput.fill('invalid-email');
    await passwordInput.fill('password123');
    await submitButton.click();
    
    // 에러 메시지 또는 유효성 검사 확인
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  test('빈 필드 제출 방지', async ({ page }) => {
    const submitButton = page.locator('button[type="submit"]');
    
    // 빈 폼으로 제출 시도
    await submitButton.click();
    
    // 필수 필드 유효성 검사 확인
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    
    const emailInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    const passwordInvalid = await passwordInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    
    expect(emailInvalid || passwordInvalid).toBe(true);
  });

  test('성능 측정 - 페이지 로드', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    
    // 3초 이내 로드 완료 확인
    expect(loadTime).toBeLessThan(3000);
    console.log(`페이지 로드 시간: ${loadTime}ms`);
  });

  test('반응형 디자인 - 모바일', async ({ page }) => {
    // 모바일 뷰포트로 변경
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // 모바일에서도 로그인 폼이 정상 표시되는지 확인
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // 스크롤 없이 주요 요소들이 보이는지 확인
    const emailInput = page.locator('input[type="email"]');
    const emailBox = await emailInput.boundingBox();
    
    expect(emailBox?.y).toBeLessThan(667); // 뷰포트 높이 내에 있어야 함
  });
});