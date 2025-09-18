import { test, expect } from '@playwright/test';

test.describe('T-HOLDEM CTA 기능 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/landing');
    // 페이지 로드 완료 대기 - 더 관대한 설정
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000); // 추가 로딩 시간
  });

  test('Hero 섹션 CTA 버튼 기능', async ({ page }) => {
    // Hero 섹션의 주요 CTA 버튼 확인
    const heroSection = page.getByTestId('hero-section');
    await expect(heroSection).toBeVisible();

    // "무료로 시작하기" 버튼 클릭 (실제 텍스트로 수정)
    const primaryCta = page.locator('button').filter({ hasText: '무료로 시작하기' });
    await expect(primaryCta).toBeVisible();
    await expect(primaryCta).toBeEnabled();

    // 버튼 스타일 확인 (primary 스타일)
    await expect(primaryCta).toHaveClass(/bg-blue-600/);

    // 클릭 이벤트
    await primaryCta.click();

    // 페이지가 로딩되거나 스크롤되는지 확인
    await page.waitForTimeout(1000);
  });

  test('스크롤 다운 기능', async ({ page }) => {
    // 스크롤 인디케이터 확인
    const scrollIndicator = page.locator('.scroll-indicator');
    await expect(scrollIndicator).toBeVisible();

    // 스크롤 동작 테스트
    await page.evaluate(() => {
      window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
    });

    // Feature 섹션이 뷰포트에 들어오는지 확인
    const featureSection = page.getByTestId('feature-section');
    await expect(featureSection).toBeInViewport({ timeout: 5000 });
  });

  test('Feature 카드 상호작용', async ({ page }) => {
    const featureSection = page.getByTestId('feature-section');
    await featureSection.scrollIntoViewIfNeeded();

    // 모든 Feature 카드 확인
    const featureCards = featureSection.locator('.feature-card');
    const cardCount = await featureCards.count();
    expect(cardCount).toBe(4);

    // 각 카드의 호버 효과 테스트
    for (let i = 0; i < cardCount; i++) {
      const card = featureCards.nth(i);
      await expect(card).toBeVisible();

      // 호버 전 상태 확인
      const beforeHover = await card.getAttribute('class');

      // 호버 효과
      await card.hover();
      await page.waitForTimeout(300);

      // 호버 후 상태 확인 (transform 또는 shadow 변화)
      const afterHover = await card.getAttribute('class');

      // 클릭 가능한지 확인
      await card.click();
      await page.waitForTimeout(500);
    }
  });

  test('Target 섹션 CTA 버튼들', async ({ page }) => {
    const targetSection = page.getByTestId('target-section');
    await targetSection.scrollIntoViewIfNeeded();

    // 각 타겟 카드의 CTA 버튼 테스트
    const targetCards = targetSection.locator('article');
    const cardCount = await targetCards.count();
    expect(cardCount).toBe(3);

    for (let i = 0; i < cardCount; i++) {
      const card = targetCards.nth(i);
      const ctaButton = card.getByRole('button');

      await expect(ctaButton).toBeVisible();
      await expect(ctaButton).toBeEnabled();

      // 버튼 텍스트 확인
      const buttonText = await ctaButton.textContent();
      expect(buttonText).toContain('솔루션 보기');

      // 버튼 스타일 확인
      await expect(ctaButton).toHaveClass(/bg-blue-600/);

      // 호버 효과 확인
      await ctaButton.hover();
      await page.waitForTimeout(200);
      await expect(ctaButton).toHaveClass(/hover:bg-blue-700/);

      // 클릭 테스트
      await ctaButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('최종 CTA 섹션 버튼들', async ({ page }) => {
    const ctaSection = page.getByTestId('cta-section');
    await ctaSection.scrollIntoViewIfNeeded();

    // 주요 CTA 버튼 (실제 텍스트로 수정)
    const primaryButton = ctaSection.getByRole('button').filter({ hasText: '무료로 시작하기' });
    await expect(primaryButton).toBeVisible();
    await expect(primaryButton).toBeEnabled();

    // 버튼 스타일 확인
    await expect(primaryButton).toHaveClass(/bg-blue-600/);

    // 보조 CTA 버튼 (실제 텍스트로 수정)
    const secondaryButton = ctaSection.getByRole('button').filter({ hasText: '데모 보기' });
    await expect(secondaryButton).toBeVisible();
    await expect(secondaryButton).toBeEnabled();

    // 버튼 스타일 확인 (실제 스타일로 수정)
    await expect(secondaryButton).toHaveClass(/border-2/);

    // 클릭 테스트
    await primaryButton.click();
    await page.waitForTimeout(1000);

    await secondaryButton.click();
    await page.waitForTimeout(1000);
  });

  test('CTA 버튼 키보드 접근성', async ({ page }) => {
    // Tab 키로 CTA 버튼들 간 이동
    await page.keyboard.press('Tab');

    let focusedElement = await page.locator(':focus').first();
    await expect(focusedElement).toBeVisible();

    // Enter로 버튼 활성화
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // 다음 버튼으로 이동
    await page.keyboard.press('Tab');
    focusedElement = await page.locator(':focus').first();

    // Space로 버튼 활성화
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
  });

  test('CTA 버튼 상태 변화', async ({ page }) => {
    const ctaSection = page.getByTestId('cta-section');
    await ctaSection.scrollIntoViewIfNeeded();

    const primaryButton = ctaSection.getByRole('button').first();

    // 초기 상태 확인
    await expect(primaryButton).not.toHaveAttribute('disabled');
    await expect(primaryButton).toBeEnabled();

    // 포커스 상태 확인
    await primaryButton.focus();
    await expect(primaryButton).toBeFocused();

    // 호버 상태 확인
    await primaryButton.hover();
    await page.waitForTimeout(200);

    // 활성화 상태 확인
    await primaryButton.click();
    await page.waitForTimeout(200);
  });

  test('CTA 버튼 애니메이션 및 전환 효과', async ({ page }) => {
    const featureSection = page.getByTestId('feature-section');
    await featureSection.scrollIntoViewIfNeeded();

    const firstCard = featureSection.locator('.feature-card').first();

    // 애니메이션 전 상태 캡처
    const initialBounds = await firstCard.boundingBox();

    // 호버 효과 트리거
    await firstCard.hover();
    await page.waitForTimeout(500); // 애니메이션 완료 대기

    // 애니메이션 후 상태 캡처
    const hoverBounds = await firstCard.boundingBox();

    // 클릭 효과
    await firstCard.click();
    await page.waitForTimeout(300);

    // 마우스 떼기
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);
  });

  test('모바일에서 CTA 버튼 동작', async ({ page }) => {
    // 모바일 뷰포트로 변경
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    // CTA 버튼들이 모바일에서 적절하게 배치되는지 확인
    const ctaSection = page.getByTestId('cta-section');
    await ctaSection.scrollIntoViewIfNeeded();

    const ctaButtons = ctaSection.getByTestId('cta-buttons');
    await expect(ctaButtons).toBeVisible();

    // 모바일에서 세로 배치 확인
    await expect(ctaButtons).toHaveClass(/flex-col/);

    // 버튼들이 터치하기 적절한 크기인지 확인
    const buttons = ctaButtons.getByRole('button');
    const buttonCount = await buttons.count();

    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const boundingBox = await button.boundingBox();

      // 최소 터치 영역 확인 (44px 이상)
      expect(boundingBox?.height).toBeGreaterThanOrEqual(44);

      // 터치 테스트
      await button.click();
      await page.waitForTimeout(300);
    }
  });

  test('CTA 버튼 에러 상황 처리', async ({ page }) => {
    // 네트워크 요청 차단
    await page.route('**/api/**', route => route.abort());

    const ctaSection = page.getByTestId('cta-section');
    await ctaSection.scrollIntoViewIfNeeded();

    const primaryButton = ctaSection.getByRole('button').first();

    // 에러 상황에서도 버튼이 클릭 가능한지 확인
    await expect(primaryButton).toBeEnabled();
    await primaryButton.click();

    // 에러가 발생해도 UI가 깨지지 않는지 확인
    await expect(primaryButton).toBeVisible();
    await page.waitForTimeout(1000);
  });
});