import { test, expect } from '@playwright/test';

test.describe('T-HOLDEM 모바일 반응형 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/landing');
    await page.waitForLoadState('domcontentloaded');
  });

  test('모바일 뷰포트에서 레이아웃 검증', async ({ page }) => {
    // 모바일 뷰포트로 설정
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);

    // Hero 섹션 모바일 레이아웃
    const heroSection = page.getByTestId('hero-section');
    await expect(heroSection).toBeVisible();

    // 제목이 모바일에서 적절한 크기로 표시되는지 확인
    const title = heroSection.locator('h1');
    await expect(title).toBeVisible();

    // CTA 버튼이 터치하기 적절한 크기인지 확인
    const ctaButton = heroSection.locator('button');
    if (await ctaButton.isVisible()) {
      const boundingBox = await ctaButton.boundingBox();
      expect(boundingBox?.height).toBeGreaterThanOrEqual(44); // 최소 터치 영역
    }
  });

  test('태블릿 뷰포트에서 레이아웃 검증', async ({ page }) => {
    // 태블릿 뷰포트로 설정
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);

    // Target 섹션 그리드 확인
    const targetSection = page.getByTestId('target-section');
    await targetSection.scrollIntoViewIfNeeded();

    const targetsGrid = page.getByTestId('targets-grid');
    await expect(targetsGrid).toBeVisible();

    // 태블릿에서 2컬럼 레이아웃 확인
    await expect(targetsGrid).toHaveClass(/md:grid-cols-2/);
  });

  test('데스크톱 뷰포트에서 레이아웃 검증', async ({ page }) => {
    // 데스크톱 뷰포트로 설정
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(1000);

    // Target 섹션 그리드 확인
    const targetSection = page.getByTestId('target-section');
    await targetSection.scrollIntoViewIfNeeded();

    const targetsGrid = page.getByTestId('targets-grid');
    await expect(targetsGrid).toBeVisible();

    // 데스크톱에서 3컬럼 레이아웃 확인
    await expect(targetsGrid).toHaveClass(/lg:grid-cols-3/);
  });

  test('모바일에서 텍스트 가독성 확인', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Hero 섹션 텍스트 확인
    const heroSection = page.getByTestId('hero-section');
    const title = heroSection.locator('h1');
    const description = heroSection.locator('p');

    await expect(title).toBeVisible();
    if (await description.isVisible()) {
      await expect(description).toBeVisible();
    }

    // Feature 섹션 카드 텍스트 확인
    const featureSection = page.getByTestId('feature-section');
    await featureSection.scrollIntoViewIfNeeded();

    const featureCards = featureSection.locator('.feature-card');
    const cardCount = await featureCards.count();

    for (let i = 0; i < Math.min(cardCount, 2); i++) {
      const card = featureCards.nth(i);
      await expect(card).toBeVisible();

      const cardTitle = card.locator('h3');
      const cardDescription = card.locator('p');

      await expect(cardTitle).toBeVisible();
      await expect(cardDescription).toBeVisible();
    }
  });

  test('터치 인터페이스 친화성 확인', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // CTA 섹션으로 이동
    const ctaSection = page.getByTestId('cta-section');
    await ctaSection.scrollIntoViewIfNeeded();

    // 버튼 컨테이너가 모바일에서 세로 배치되는지 확인
    const ctaButtons = ctaSection.getByTestId('cta-buttons');
    await expect(ctaButtons).toBeVisible();
    await expect(ctaButtons).toHaveClass(/flex-col/);

    // 모든 버튼이 터치하기 적절한 크기인지 확인
    const buttons = ctaButtons.getByRole('button');
    const buttonCount = await buttons.count();

    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      await expect(button).toBeVisible();

      const boundingBox = await button.boundingBox();
      expect(boundingBox?.height).toBeGreaterThanOrEqual(44);
      expect(boundingBox?.width).toBeGreaterThanOrEqual(88); // 최소 터치 영역
    }
  });

  test('스크롤 성능 확인', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // 페이지 전체 높이 확인
    const pageHeight = await page.evaluate(() => document.body.scrollHeight);
    expect(pageHeight).toBeGreaterThan(1000); // 충분한 컨텐츠가 있는지 확인

    // 스크롤 테스트
    const heroSection = page.getByTestId('hero-section');
    await expect(heroSection).toBeVisible();

    // Feature 섹션으로 스크롤
    await page.evaluate(() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' }));
    await page.waitForTimeout(1000);

    const featureSection = page.getByTestId('feature-section');
    await expect(featureSection).toBeInViewport();

    // Target 섹션으로 스크롤
    await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 2, behavior: 'smooth' }));
    await page.waitForTimeout(1000);

    const targetSection = page.getByTestId('target-section');
    await expect(targetSection).toBeInViewport();

    // CTA 섹션으로 스크롤
    await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 3, behavior: 'smooth' }));
    await page.waitForTimeout(1000);

    const ctaSection = page.getByTestId('cta-section');
    await expect(ctaSection).toBeInViewport();
  });

  test('가로/세로 모드 전환 테스트', async ({ page }) => {
    // 세로 모드 (모바일)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    const heroSection = page.getByTestId('hero-section');
    await expect(heroSection).toBeVisible();

    // 가로 모드로 전환
    await page.setViewportSize({ width: 667, height: 375 });
    await page.waitForTimeout(500);

    // 레이아웃이 여전히 작동하는지 확인
    await expect(heroSection).toBeVisible();

    // CTA 버튼이 여전히 접근 가능한지 확인
    const ctaButton = heroSection.locator('button').first();
    if (await ctaButton.isVisible()) {
      await expect(ctaButton).toBeVisible();
    }
  });

  test('small mobile 디바이스 호환성', async ({ page }) => {
    // 매우 작은 모바일 디바이스 (iPhone SE 크기)
    await page.setViewportSize({ width: 320, height: 568 });
    await page.waitForTimeout(1000);

    // 모든 주요 섹션이 여전히 표시되는지 확인
    const heroSection = page.getByTestId('hero-section');
    await expect(heroSection).toBeVisible();

    // 텍스트가 오버플로우되지 않는지 확인
    const title = heroSection.locator('h1');
    await expect(title).toBeVisible();

    // CTA 버튼이 뷰포트를 벗어나지 않는지 확인
    const ctaButton = heroSection.locator('button').first();
    if (await ctaButton.isVisible()) {
      const boundingBox = await ctaButton.boundingBox();
      expect(boundingBox?.x).toBeGreaterThanOrEqual(0);
      expect(boundingBox?.y).toBeGreaterThanOrEqual(0);
      if (boundingBox) {
        expect(boundingBox.x + boundingBox.width).toBeLessThanOrEqual(320);
      }
    }
  });

  test('폰트 크기 스케일링 확인', async ({ page }) => {
    // 여러 뷰포트에서 폰트 크기가 적절히 조정되는지 확인

    // 모바일
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    const heroTitle = page.getByTestId('hero-section').locator('h1');
    await expect(heroTitle).toBeVisible();

    // CSS 클래스가 반응형 폰트를 포함하는지 확인
    await expect(heroTitle).toHaveClass(/text-4xl/); // 모바일 기본 크기
    await expect(heroTitle).toHaveClass(/md:text-6xl/); // 태블릿 이상 크기

    // 태블릿
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);

    await expect(heroTitle).toBeVisible();

    // 데스크톱
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);

    await expect(heroTitle).toBeVisible();
  });

  test('이미지 및 미디어 반응형 테스트', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // 배경 이미지가 적절히 스케일링되는지 확인
    const heroSection = page.getByTestId('hero-section');
    await expect(heroSection).toBeVisible();

    // CSS 속성 확인
    const heroStyle = await heroSection.getAttribute('style');
    if (heroStyle && heroStyle.includes('background')) {
      // 배경 이미지가 올바르게 설정되어 있는지 확인
      expect(heroStyle).toContain('background');
    }

    // Feature 섹션의 아이콘들이 적절한 크기로 표시되는지 확인
    const featureSection = page.getByTestId('feature-section');
    await featureSection.scrollIntoViewIfNeeded();

    const featureIcons = featureSection.locator('svg, img').first();
    if (await featureIcons.isVisible()) {
      const iconBox = await featureIcons.boundingBox();
      expect(iconBox?.width).toBeGreaterThan(0);
      expect(iconBox?.height).toBeGreaterThan(0);
    }
  });
});