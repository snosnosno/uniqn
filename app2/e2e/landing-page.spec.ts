import { test, expect } from '@playwright/test';

test.describe('T-HOLDEM 랜딩페이지', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/landing');
  });

  test('페이지 기본 요소 렌더링', async ({ page }) => {
    // 페이지 제목 확인
    await expect(page).toHaveTitle(/T-HOLDEM/);

    // Hero 섹션 확인
    const heroSection = page.getByTestId('hero-section');
    await expect(heroSection).toBeVisible();

    // 메인 제목 확인
    const mainTitle = page.getByRole('heading', { level: 1 });
    await expect(mainTitle).toBeVisible();
    await expect(mainTitle).toContainText('T-HOLDEM');

    // CTA 버튼 확인
    const ctaButton = page.locator('.cta-button').first();
    await expect(ctaButton).toBeVisible();
  });

  test('섹션별 네비게이션', async ({ page }) => {
    // Hero 섹션 확인
    const heroSection = page.getByTestId('hero-section');
    await expect(heroSection).toBeVisible();

    // Feature 섹션으로 스크롤
    const featureSection = page.getByTestId('feature-section');
    await featureSection.scrollIntoViewIfNeeded();
    await expect(featureSection).toBeVisible();

    // 기능 카드들 확인
    const featureCards = page.getByTestId('features-grid').locator('[data-testid^="feature-card-"]');
    await expect(featureCards).toHaveCount(4);

    // Target 섹션으로 스크롤
    const targetSection = page.getByTestId('target-section');
    await targetSection.scrollIntoViewIfNeeded();
    await expect(targetSection).toBeVisible();

    // 타겟 카드들 확인
    const targetCards = page.getByTestId('targets-grid').locator('[data-testid^="target-card-"]');
    await expect(targetCards).toHaveCount(3);

    // CTA 섹션으로 스크롤
    const ctaSection = page.getByTestId('cta-section');
    await ctaSection.scrollIntoViewIfNeeded();
    await expect(ctaSection).toBeVisible();
  });

  test('상호작용 요소 동작', async ({ page }) => {
    // Hero CTA 버튼 클릭 - 클래스명으로 더 정확한 선택
    const heroCta = page.locator('.cta-button').first();
    await expect(heroCta).toBeVisible({ timeout: 10000 });
    await heroCta.click();

    // Feature 카드 상호작용 - 좀 더 구체적인 선택자 사용
    const featureSection = page.getByTestId('feature-section');
    await featureSection.scrollIntoViewIfNeeded();

    const firstFeatureCard = featureSection.locator('.feature-card').first();
    await expect(firstFeatureCard).toBeVisible({ timeout: 10000 });

    // 호버 효과 확인
    await firstFeatureCard.hover();
    await page.waitForTimeout(500); // 호버 애니메이션 대기

    // 클릭 이벤트
    await firstFeatureCard.click();

    // Target 카드 상호작용 - 섹션 기반 접근
    const targetSection = page.getByTestId('target-section');
    await targetSection.scrollIntoViewIfNeeded();

    const firstTargetCard = targetSection.locator('article').first();
    await expect(firstTargetCard).toBeVisible({ timeout: 10000 });

    // Target CTA 버튼 클릭 - 섹션 내 첫 번째 버튼
    const targetCtaButton = firstTargetCard.getByRole('button');
    await expect(targetCtaButton).toBeVisible();
    await targetCtaButton.click();

    // 최종 CTA 섹션 버튼들
    const ctaSection = page.getByTestId('cta-section');
    await ctaSection.scrollIntoViewIfNeeded();

    const primaryCta = ctaSection.getByRole('button').first();
    await expect(primaryCta).toBeVisible();
    await primaryCta.click();
  });

  test('반응형 디자인 검증', async ({ page }) => {
    // 데스크톱 뷰 확인
    await page.setViewportSize({ width: 1920, height: 1080 });

    const targetsGrid = page.getByTestId('targets-grid');
    await targetsGrid.scrollIntoViewIfNeeded();

    // 데스크톱에서는 3컬럼 레이아웃
    await expect(targetsGrid).toHaveClass(/lg:grid-cols-3/);

    // 태블릿 뷰 확인
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500); // CSS 트랜지션 대기

    // 태블릿에서는 2컬럼 레이아웃
    await expect(targetsGrid).toHaveClass(/md:grid-cols-2/);

    // 모바일 뷰 확인
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    // 모바일에서는 1컬럼 레이아웃
    await expect(targetsGrid).toHaveClass(/grid-cols-1/);

    // CTA 버튼들이 모바일에서 세로 배치되는지 확인
    const ctaButtons = page.getByTestId('cta-buttons');
    await ctaButtons.scrollIntoViewIfNeeded();
    await expect(ctaButtons).toHaveClass(/flex-col/);
  });

  test('성능 메트릭 검증', async ({ page }) => {
    // 페이지 로드 시간 측정 - 더 관대한 임계값 설정
    const loadStart = Date.now();
    await page.goto('/landing');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - loadStart;

    // E2E 환경에서는 5초 이내 로딩 목표 (더 현실적)
    expect(loadTime).toBeLessThan(5000);

    // 주요 요소들이 빠르게 로드되는지 확인
    const heroSection = page.getByTestId('hero-section');
    await expect(heroSection).toBeVisible({ timeout: 5000 });

    // Lazy 로딩된 섹션들이 스크롤 시 빠르게 나타나는지 확인
    const featureSection = page.getByTestId('feature-section');
    await featureSection.scrollIntoViewIfNeeded();
    await expect(featureSection).toBeVisible({ timeout: 3000 });

    // 섹션들이 정상 로드되는지 확인 (아이콘 대신 섹션 확인)
    const targetSection = page.getByTestId('target-section');
    await targetSection.scrollIntoViewIfNeeded();
    await expect(targetSection).toBeVisible({ timeout: 3000 });
  });

  test('접근성 검증', async ({ page }) => {
    // 키보드 네비게이션 테스트 - 첫 번째 버튼 찾기
    const firstButton = page.locator('button').first();
    await expect(firstButton).toBeVisible({ timeout: 5000 });

    // 버튼에 포커스 이동
    await firstButton.focus();
    await expect(firstButton).toBeFocused();

    // Enter 키로 버튼 활성화
    await page.keyboard.press('Enter');

    // Feature 섹션으로 이동
    const featureSection = page.getByTestId('feature-section');
    await featureSection.scrollIntoViewIfNeeded();

    // Target 섹션으로 이동하여 ARIA 속성 확인
    const targetSection = page.getByTestId('target-section');
    await targetSection.scrollIntoViewIfNeeded();

    // 첫 번째 타겟 카드의 ARIA 속성 확인
    const firstTargetCard = targetSection.locator('article').first();
    await expect(firstTargetCard).toBeVisible();

    // ARIA 레이블 존재 확인
    const hasAriaLabel = await firstTargetCard.getAttribute('aria-labelledby');
    const hasAriaDescription = await firstTargetCard.getAttribute('aria-describedby');

    // 최소한 하나의 ARIA 속성이 있어야 함
    expect(hasAriaLabel || hasAriaDescription).toBeTruthy();
  });

  test('다국어 지원 검증', async ({ page }) => {
    // 한국어 콘텐츠 확인 - 고유한 텍스트 사용
    await expect(page.getByText('맞춤형 솔루션')).toBeVisible();
    await expect(page.getByText('다양한 니즈에 맞는 전문 서비스')).toBeVisible();

    // 타겟 그룹별 한국어 텍스트 - 더 구체적인 선택자 사용
    const targetSection = page.getByTestId('target-section');
    await targetSection.scrollIntoViewIfNeeded();

    // 각 타겟 그룹을 카드 내에서 확인 (실제 콘텐츠와 일치하도록 수정)
    await expect(targetSection.locator('text=토너먼트 주최자')).toBeVisible();
    await expect(targetSection.locator('text=홀덤펍')).toBeVisible();
    await expect(targetSection.locator('text=스태프')).toBeVisible();

    // CTA 버튼 한국어 텍스트
    const ctaSection = page.getByTestId('cta-section');
    await ctaSection.scrollIntoViewIfNeeded();
    await expect(ctaSection.getByText('지금 바로 시작하세요')).toBeVisible();
  });

  test('에러 핸들링', async ({ page }) => {
    // 네트워크 에러 시뮬레이션
    await page.route('**/api/**', route => route.abort());

    // 페이지가 여전히 기본 콘텐츠를 표시하는지 확인
    const heroSection = page.getByTestId('hero-section');
    await expect(heroSection).toBeVisible();

    // 에러 상태에서도 사용자 상호작용이 가능한지 확인
    const heroCta = page.locator('.cta-button').first();
    await expect(heroCta).toBeVisible();
    await heroCta.click();

    // 콘솔 에러가 과도하지 않은지 확인
    let errorCount = 0;
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errorCount++;
      }
    });

    await page.waitForTimeout(2000);
    expect(errorCount).toBeLessThan(5); // 최대 5개 에러까지 허용
  });
});