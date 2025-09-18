import { test, expect } from '@playwright/test';

test.describe('T-HOLDEM 크로스 브라우저 호환성 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/landing');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
  });

  test('모든 브라우저에서 기본 페이지 로드', async ({ page, browserName }) => {
    // 페이지 제목 확인
    await expect(page).toHaveTitle(/T-HOLDEM/);

    // Hero 섹션 표시 확인
    const heroSection = page.getByTestId('hero-section');
    await expect(heroSection).toBeVisible({ timeout: 10000 });

    // 메인 제목 확인
    const mainTitle = page.getByRole('heading', { level: 1 });
    await expect(mainTitle).toBeVisible();
    await expect(mainTitle).toContainText('T-HOLDEM');

    console.log(`✅ 기본 페이지 로드 성공: ${browserName}`);
  });

  test('모든 브라우저에서 CSS 스타일 적용', async ({ page, browserName }) => {
    const heroSection = page.getByTestId('hero-section');
    await expect(heroSection).toBeVisible();

    // CSS 클래스가 적용되어 있는지 확인
    await expect(heroSection).toHaveClass(/bg-gradient-to-br/);

    // CTA 버튼 스타일 확인
    const ctaButton = page.locator('button').first();
    if (await ctaButton.isVisible()) {
      await expect(ctaButton).toHaveClass(/bg-blue-600/);
    }

    console.log(`✅ CSS 스타일 적용 확인: ${browserName}`);
  });

  test('모든 브라우저에서 JavaScript 상호작용', async ({ page, browserName }) => {
    // 페이지가 완전히 로드될 때까지 대기
    await page.waitForLoadState('networkidle');

    // CTA 버튼 클릭 테스트
    const ctaButton = page.locator('button').first();
    if (await ctaButton.isVisible()) {
      await expect(ctaButton).toBeEnabled();
      await ctaButton.click();
      await page.waitForTimeout(500);
    }

    // Feature 섹션으로 스크롤
    const featureSection = page.getByTestId('feature-section');
    await featureSection.scrollIntoViewIfNeeded();
    await expect(featureSection).toBeVisible();

    console.log(`✅ JavaScript 상호작용 확인: ${browserName}`);
  });

  test('모든 브라우저에서 반응형 동작', async ({ page, browserName }) => {
    // 모바일 크기로 변경
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    const heroSection = page.getByTestId('hero-section');
    await expect(heroSection).toBeVisible();

    // 데스크톱 크기로 변경
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);

    await expect(heroSection).toBeVisible();

    console.log(`✅ 반응형 동작 확인: ${browserName}`);
  });

  test('모든 브라우저에서 폰트 렌더링', async ({ page, browserName }) => {
    const heroTitle = page.getByTestId('hero-section').locator('h1');
    await expect(heroTitle).toBeVisible();

    // 폰트가 로드되고 렌더링되었는지 확인
    const fontSize = await heroTitle.evaluate((el) => {
      return window.getComputedStyle(el).fontSize;
    });

    expect(fontSize).toBeTruthy();
    expect(fontSize).not.toBe('0px');

    console.log(`✅ 폰트 렌더링 확인: ${browserName}, 폰트 크기: ${fontSize}`);
  });

  test('모든 브라우저에서 이미지 로딩', async ({ page, browserName }) => {
    // SVG 아이콘들이 표시되는지 확인
    const svgIcons = page.locator('svg');
    const iconCount = await svgIcons.count();

    expect(iconCount).toBeGreaterThan(0);

    // 첫 번째 아이콘이 표시되는지 확인
    if (iconCount > 0) {
      const firstIcon = svgIcons.first();
      await expect(firstIcon).toBeVisible();
    }

    console.log(`✅ 이미지/아이콘 로딩 확인: ${browserName}, 아이콘 수: ${iconCount}`);
  });

  test('모든 브라우저에서 스크롤 동작', async ({ page, browserName }) => {
    // 초기 위치에서 Hero 섹션 확인
    const heroSection = page.getByTestId('hero-section');
    await expect(heroSection).toBeInViewport();

    // 스크롤 다운
    await page.evaluate(() => {
      window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
    });
    await page.waitForTimeout(1000);

    // Feature 섹션이 뷰포트에 들어왔는지 확인
    const featureSection = page.getByTestId('feature-section');
    await expect(featureSection).toBeInViewport();

    // 페이지 상단으로 스크롤
    await page.evaluate(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    await page.waitForTimeout(1000);

    await expect(heroSection).toBeInViewport();

    console.log(`✅ 스크롤 동작 확인: ${browserName}`);
  });

  test('모든 브라우저에서 키보드 네비게이션', async ({ page, browserName }) => {
    // Tab 키로 포커스 이동
    await page.keyboard.press('Tab');

    // 포커스된 요소가 있는지 확인
    const focusedElement = page.locator(':focus');
    const focusedCount = await focusedElement.count();

    if (focusedCount > 0) {
      await expect(focusedElement.first()).toBeVisible();

      // Enter 키로 활성화
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
    }

    console.log(`✅ 키보드 네비게이션 확인: ${browserName}`);
  });

  test('모든 브라우저에서 성능 기본 체크', async ({ page, browserName }) => {
    // 페이지 로드 시간 측정
    const loadStart = Date.now();
    await page.goto('/landing');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - loadStart;

    // 브라우저별로 다른 임계값 설정 (Safari는 더 관대하게)
    const timeLimit = browserName === 'webkit' ? 8000 : 6000;
    expect(loadTime).toBeLessThan(timeLimit);

    // DOM 요소 수 확인
    const elementCount = await page.evaluate(() => {
      return document.querySelectorAll('*').length;
    });

    expect(elementCount).toBeGreaterThan(10); // 최소한의 DOM 구조

    console.log(`✅ 성능 기본 체크: ${browserName}, 로드 시간: ${loadTime}ms, 요소 수: ${elementCount}`);
  });

  test('모든 브라우저에서 에러 핸들링', async ({ page, browserName }) => {
    // 콘솔 에러 모니터링
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // 페이지 상호작용
    const heroSection = page.getByTestId('hero-section');
    await expect(heroSection).toBeVisible();

    const ctaButton = page.locator('button').first();
    if (await ctaButton.isVisible()) {
      await ctaButton.click();
    }

    // Feature 섹션으로 스크롤
    const featureSection = page.getByTestId('feature-section');
    await featureSection.scrollIntoViewIfNeeded();

    await page.waitForTimeout(2000);

    // 치명적인 에러가 없는지 확인 (경고는 허용)
    const criticalErrors = consoleErrors.filter(error =>
      !error.includes('Warning') &&
      !error.includes('favicon') &&
      !error.includes('DevTools')
    );

    expect(criticalErrors.length).toBeLessThan(3); // 최대 2개의 비치명적 에러까지 허용

    console.log(`✅ 에러 핸들링 확인: ${browserName}, 콘솔 에러: ${criticalErrors.length}개`);
  });
});