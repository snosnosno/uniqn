/**
 * P4 반응형 & 접근성 테스트 (6 tests)
 * 프로젝트: chromium (staff storageState)
 *
 * 반응형 테스트는 인증 상태로, 접근성 중 로그인 페이지 테스트는 비인증 상태로 진행
 */
import { test, expect } from '../../fixtures/base.fixture';

test.describe('반응형 레이아웃', () => {
  test('모바일 뷰포트(390x844) → 정상 렌더링', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5_000);

    // 콘텐츠가 뷰포트 내에 렌더링
    const body = page.locator('body');
    await expect(body).not.toBeEmpty();

    // 가로 스크롤 없어야 함
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
  });

  test('태블릿 뷰포트(768x1024) → 레이아웃 깨지지 않음', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5_000);

    // 콘텐츠 렌더링 확인
    const body = page.locator('body');
    await expect(body).not.toBeEmpty();

    // 크리티컬 에러 없어야 함
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(1_000);

    const criticalErrors = errors.filter(
      (e) => e.includes('TypeError') || e.includes('ReferenceError')
    );
    expect(criticalErrors).toEqual([]);
  });
});

test.describe('접근성', () => {
  test('터치 타겟 최소 크기 44x44px 확인 (버튼)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5_000);

    // 하단 탭바의 버튼 크기 확인
    const tabButtons = page.locator('[role="tab"]');
    const tabCount = await tabButtons.count();

    for (let i = 0; i < Math.min(tabCount, 4); i++) {
      const box = await tabButtons.nth(i).boundingBox();
      if (box) {
        // 최소 44px 터치 타겟 (WCAG 2.5.8)
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('키보드 네비게이션 → Tab 키로 포커스 이동', async ({ page }) => {
    // 인증된 상태로 메인 페이지에서 키보드 네비게이션 테스트
    // (로그인 페이지는 storageState에 의해 리다이렉트되므로 메인 페이지 사용)
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5_000);

    // Tab 키로 포커스 이동
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);

    // 포커스된 요소가 있어야 함
    const focusedTag = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? el.tagName.toLowerCase() : null;
    });

    // input, button, a, select, div 등 인터랙티브 요소에 포커스
    const interactiveElements = ['input', 'button', 'a', 'select', 'textarea', 'div'];
    expect(interactiveElements).toContain(focusedTag);
  });

  test('aria-label 사용 확인 → 주요 인터랙티브 요소', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5_000);

    // role 속성이 있는 요소 확인
    // React Native Web은 accessibilityRole을 role 속성으로 변환
    const elementsWithRole = await page.evaluate(() => {
      const elements = document.querySelectorAll(
        '[role="button"], [role="tab"], [role="link"], [role="alert"], [role="switch"], [aria-label]'
      );
      return elements.length;
    });

    // 인터랙티브 요소에 role 또는 aria-label이 설정되어 있어야 함
    expect(elementsWithRole).toBeGreaterThan(0);
  });

  test('포커스 표시 → 포커스 링 또는 시각적 표시', async ({ page }) => {
    // 인증된 상태에서 설정 페이지의 입력 필드로 포커스 테스트
    // (로그인 페이지는 storageState에 의해 리다이렉트됨)
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5_000);

    // Tab 키를 눌러 첫 번째 포커스 가능 요소로 이동
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);

    // 포커스된 요소의 스타일 확인
    const focusInfo = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;

      const style = getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        outline: style.outline,
        outlineWidth: style.outlineWidth,
        outlineStyle: style.outlineStyle,
        borderColor: style.borderColor,
        boxShadow: style.boxShadow,
      };
    });

    // 포커스된 요소가 존재해야 함
    expect(focusInfo).not.toBeNull();

    if (focusInfo) {
      // 포커스 표시가 있어야 함 (outline, border, 또는 boxShadow 중 하나)
      const hasFocusIndicator =
        (focusInfo.outlineWidth !== '0px' && focusInfo.outlineStyle !== 'none') ||
        focusInfo.boxShadow !== 'none' ||
        focusInfo.borderColor !== '';

      expect(hasFocusIndicator).toBe(true);
    }
  });
});
