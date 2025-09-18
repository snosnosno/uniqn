import { test, expect } from '@playwright/test';

test.describe('T-HOLDEM CTA 기본 기능 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/landing');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
  });

  test('Hero 섹션 CTA 버튼 기본 동작', async ({ page }) => {
    // Hero 섹션 확인
    const heroSection = page.getByTestId('hero-section');
    await expect(heroSection).toBeVisible({ timeout: 10000 });

    // 무료로 시작하기 버튼 확인
    const ctaButton = page.locator('button').filter({ hasText: '무료로 시작하기' });
    await expect(ctaButton).toBeVisible({ timeout: 5000 });
    await expect(ctaButton).toBeEnabled();

    // 클릭 테스트
    await ctaButton.click();
    await page.waitForTimeout(500);
  });

  test('Target 섹션 CTA 버튼들', async ({ page }) => {
    const targetSection = page.getByTestId('target-section');
    await targetSection.scrollIntoViewIfNeeded();
    await expect(targetSection).toBeVisible({ timeout: 10000 });

    // 타겟 카드들의 CTA 버튼 확인
    const targetCards = targetSection.locator('article');
    const cardCount = await targetCards.count();
    expect(cardCount).toBe(3);

    // 첫 번째 카드의 CTA 버튼 테스트
    const firstCard = targetCards.first();
    const firstCtaButton = firstCard.getByRole('button');

    await expect(firstCtaButton).toBeVisible();
    await expect(firstCtaButton).toBeEnabled();

    // 버튼 텍스트 확인
    const buttonText = await firstCtaButton.textContent();
    expect(buttonText).toContain('솔루션 보기');

    // 클릭 테스트
    await firstCtaButton.click();
    await page.waitForTimeout(500);
  });

  test('최종 CTA 섹션 버튼들', async ({ page }) => {
    const ctaSection = page.getByTestId('cta-section');
    await ctaSection.scrollIntoViewIfNeeded();
    await expect(ctaSection).toBeVisible({ timeout: 10000 });

    // Primary CTA 버튼
    const primaryButton = ctaSection.getByRole('button').filter({ hasText: '무료로 시작하기' });
    await expect(primaryButton).toBeVisible();
    await primaryButton.click();
    await page.waitForTimeout(500);

    // Secondary CTA 버튼
    const secondaryButton = ctaSection.getByRole('button').filter({ hasText: '데모 보기' });
    await expect(secondaryButton).toBeVisible();
    await secondaryButton.click();
    await page.waitForTimeout(500);
  });

  test('모바일에서 CTA 버튼 기본 동작', async ({ page }) => {
    // 모바일 뷰포트로 변경
    await page.setViewportSize({ width: 375, height: 667 });

    // CTA 섹션 확인
    const ctaSection = page.getByTestId('cta-section');
    await ctaSection.scrollIntoViewIfNeeded();

    // 버튼 컨테이너가 세로 배치되는지 확인
    const ctaButtons = ctaSection.getByTestId('cta-buttons');
    await expect(ctaButtons).toBeVisible();
    await expect(ctaButtons).toHaveClass(/flex-col/);

    // 버튼들이 터치 가능한 크기인지 확인
    const buttons = ctaButtons.getByRole('button');
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThanOrEqual(1);

    // 첫 번째 버튼 클릭 테스트
    const firstButton = buttons.first();
    await expect(firstButton).toBeVisible();
    await firstButton.click();
    await page.waitForTimeout(500);
  });
});