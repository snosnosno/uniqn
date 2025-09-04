/**
 * E2E Test Utilities
 * Week 4 성능 최적화: 테스트 헬퍼 함수들
 * 
 * @version 4.0
 * @since 2025-02-02 (Week 4)
 */

import { Page, expect } from '@playwright/test';

/**
 * 성능 측정 유틸리티
 */
export class PerformanceUtils {
  /**
   * 페이지 로드 시간 측정
   */
  static async measurePageLoad(page: Page, url: string): Promise<number> {
    const startTime = Date.now();
    await page.goto(url);
    await expect(page.locator('body')).toBeVisible();
    return Date.now() - startTime;
  }

  /**
   * Core Web Vitals 측정
   */
  static async measureWebVitals(page: Page): Promise<{
    lcp?: number;
    fid?: number;
    cls?: number;
  }> {
    return await page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals: any = {};
        
        // LCP (Largest Contentful Paint)
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) {
            vitals.lcp = entries[entries.length - 1].startTime;
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        
        // CLS (Cumulative Layout Shift)
        let clsValue = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
          vitals.cls = clsValue;
        }).observe({ type: 'layout-shift', buffered: true });
        
        setTimeout(() => resolve(vitals), 2000);
      });
    });
  }

  /**
   * JavaScript 번들 크기 분석
   */
  static async analyzeJSBundles(page: Page): Promise<Array<{
    name: string;
    size: number;
    loadTime: number;
  }>> {
    return await page.evaluate(() => {
      return performance.getEntriesByType('resource')
        .filter((resource: any) => resource.name.includes('.js'))
        .map((resource: any) => ({
          name: resource.name.split('/').pop(),
          size: resource.transferSize || 0,
          loadTime: resource.loadEnd - resource.startTime
        }));
    });
  }

  /**
   * 메모리 사용량 측정
   */
  static async measureMemoryUsage(page: Page): Promise<{
    used: number;
    total: number;
    limit: number;
  } | null> {
    return await page.evaluate(() => {
      return (performance as any).memory ? {
        used: (performance as any).memory.usedJSHeapSize,
        total: (performance as any).memory.totalJSHeapSize,
        limit: (performance as any).memory.jsHeapSizeLimit
      } : null;
    });
  }
}

/**
 * 네비게이션 유틸리티
 */
export class NavigationUtils {
  /**
   * 안전한 클릭 (로딩 완료 후)
   */
  static async safeClick(page: Page, selector: string, timeout = 10000) {
    const element = page.locator(selector);
    await expect(element).toBeVisible({ timeout });
    await element.click();
    
    // 네비게이션 완료 대기
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
      // 네트워크가 완전히 idle하지 않을 수도 있으므로 에러 무시
    });
  }

  /**
   * 탭 네비게이션
   */
  static async navigateToTab(page: Page, tabName: string) {
    const tab = page.locator('[role="tab"], .tab-button').filter({ hasText: new RegExp(tabName, 'i') });
    await expect(tab).toBeVisible();
    await tab.click();
    
    // 탭 컨텐츠 로딩 대기
    await page.waitForTimeout(1000);
  }

  /**
   * 첫 번째 아이템 클릭 (목록에서)
   */
  static async clickFirstItem(page: Page, containerSelector: string) {
    const firstItem = page.locator(`${containerSelector} tr, ${containerSelector} .card, ${containerSelector} [data-testid*="item"]`).nth(1);
    
    if (await firstItem.count() > 0) {
      await firstItem.click();
      await page.waitForTimeout(500);
      return true;
    }
    return false;
  }
}

/**
 * 폼 유틸리티
 */
export class FormUtils {
  /**
   * 폼 필드 채우기
   */
  static async fillForm(page: Page, fields: Record<string, string>) {
    for (const [fieldName, value] of Object.entries(fields)) {
      const field = page.locator(`input[name="${fieldName}"], input[placeholder*="${fieldName}"], textarea[name="${fieldName}"]`).first();
      
      if (await field.count() > 0) {
        await field.fill(value);
      }
    }
  }

  /**
   * 폼 유효성 검사 확인
   */
  static async checkFormValidation(page: Page, inputSelector: string): Promise<boolean> {
    return await page.locator(inputSelector).evaluate((el: HTMLInputElement) => {
      return el.validity.valid;
    });
  }

  /**
   * 필수 필드 체크
   */
  static async checkRequiredFields(page: Page, fieldSelectors: string[]): Promise<boolean[]> {
    const results = [];
    
    for (const selector of fieldSelectors) {
      const isValid = await this.checkFormValidation(page, selector);
      results.push(isValid);
    }
    
    return results;
  }
}

/**
 * 데이터 유틸리티
 */
export class DataUtils {
  /**
   * 테스트 데이터 생성
   */
  static generateTestData() {
    const timestamp = Date.now();
    
    return {
      staff: {
        name: `테스트 스태프 ${timestamp}`,
        phone: `010-${String(timestamp).slice(-8, -4)}-${String(timestamp).slice(-4)}`,
        role: '딜러'
      },
      jobPosting: {
        title: `테스트 구인공고 ${timestamp}`,
        location: '서울시 강남구',
        description: `테스트용 구인공고입니다. ${timestamp}`,
        hourlyWage: '15000'
      },
      applicant: {
        name: `테스트 지원자 ${timestamp}`,
        phone: `010-${String(timestamp).slice(-8, -4)}-${String(timestamp).slice(-4)}`,
        experience: '1년 미만'
      }
    };
  }

  /**
   * 목록 개수 확인
   */
  static async getListItemCount(page: Page, containerSelector: string): Promise<number> {
    const items = page.locator(`${containerSelector} tr, ${containerSelector} .card, ${containerSelector} [data-testid*="item"]`);
    return await items.count();
  }

  /**
   * 검색 결과 확인
   */
  static async verifySearchResults(page: Page, searchTerm: string, containerSelector: string): Promise<boolean> {
    const items = page.locator(`${containerSelector} tr, ${containerSelector} .card`);
    const count = await items.count();
    
    if (count === 0) {
      // 검색 결과 없음 메시지 확인
      const noResultsMessage = page.locator('text=검색 결과가 없습니다, text=결과 없음, text=No results');
      return await noResultsMessage.count() > 0;
    }
    
    return count > 0;
  }
}

/**
 * 가상화 테스트 유틸리티
 */
export class VirtualizationUtils {
  /**
   * 가상화된 목록 스크롤 성능 테스트
   */
  static async testVirtualizedScrolling(page: Page, containerSelector: string): Promise<{
    scrollTime: number;
    isSmooth: boolean;
  }> {
    const container = page.locator(containerSelector);
    await expect(container).toBeVisible();
    
    const startTime = Date.now();
    
    await container.hover();
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(100);
    
    const scrollTime = Date.now() - startTime;
    const isSmooth = scrollTime < 300; // 300ms 이내면 부드러운 스크롤
    
    return { scrollTime, isSmooth };
  }

  /**
   * 렌더링된 아이템 수 확인 (가상화 효과 검증)
   */
  static async checkRenderedItemCount(page: Page, containerSelector: string): Promise<number> {
    return await page.locator(`${containerSelector} [data-testid="virtual-item"], ${containerSelector} .virtual-row`).count();
  }
}

/**
 * 접근성 테스트 유틸리티
 */
export class AccessibilityUtils {
  /**
   * 키보드 네비게이션 테스트
   */
  static async testKeyboardNavigation(page: Page, startSelector: string): Promise<boolean> {
    const startElement = page.locator(startSelector);
    await expect(startElement).toBeVisible();
    
    await startElement.focus();
    
    // Tab 키로 네비게이션
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    
    // 포커스가 이동했는지 확인
    const focusedElement = await page.locator(':focus').count();
    return focusedElement > 0;
  }

  /**
   * ARIA 라벨 확인
   */
  static async checkAriaLabels(page: Page, selectors: string[]): Promise<boolean[]> {
    const results = [];
    
    for (const selector of selectors) {
      const element = page.locator(selector);
      if (await element.count() > 0) {
        const hasAriaLabel = await element.getAttribute('aria-label') !== null ||
                            await element.getAttribute('aria-labelledby') !== null;
        results.push(hasAriaLabel);
      } else {
        results.push(false);
      }
    }
    
    return results;
  }
}

/**
 * 모바일 테스트 유틸리티
 */
export class MobileUtils {
  /**
   * 모바일 뷰포트로 변경
   */
  static async setMobileViewport(page: Page, device: 'iphone' | 'android' = 'iphone') {
    const viewports = {
      iphone: { width: 375, height: 667 },
      android: { width: 360, height: 640 }
    };
    
    await page.setViewportSize(viewports[device]);
  }

  /**
   * 터치 제스처 테스트
   */
  static async testTouchGesture(page: Page, elementSelector: string, gesture: 'tap' | 'swipe' = 'tap') {
    const element = page.locator(elementSelector);
    await expect(element).toBeVisible();
    
    const box = await element.boundingBox();
    if (!box) return false;
    
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    
    if (gesture === 'tap') {
      await page.touchscreen.tap(centerX, centerY);
    } else if (gesture === 'swipe') {
      await page.touchscreen.tap(centerX, centerY);
      await page.touchscreen.tap(centerX - 100, centerY);
    }
    
    return true;
  }

  /**
   * 가로 스크롤 없음 확인
   */
  static async checkNoHorizontalScroll(page: Page): Promise<boolean> {
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    
    return scrollWidth <= viewportWidth + 20; // 20px 여유 허용
  }
}