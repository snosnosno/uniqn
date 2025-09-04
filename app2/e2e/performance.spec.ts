/**
 * Performance E2E Tests
 * Week 4 성능 최적화: Core Web Vitals 및 전체 성능 테스트
 * 
 * @version 4.0
 * @since 2025-02-02 (Week 4)
 */

import { test, expect } from '@playwright/test';

test.describe('성능 테스트', () => {
  test.beforeEach(async ({ page }) => {
    // 성능 측정을 위한 네트워크 조건 설정
    await page.route('**/*', route => route.continue());
  });

  test('Core Web Vitals 측정', async ({ page }) => {
    await page.goto('/');
    
    // Web Vitals 측정 스크립트 주입
    const webVitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals: any = {};
        
        // LCP (Largest Contentful Paint)
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          vitals.lcp = entries[entries.length - 1].startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        
        // FID (First Input Delay) - 사용자 상호작용 시뮬레이션
        document.addEventListener('click', () => {
          vitals.fid = performance.now();
        }, { once: true });
        
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
        
        setTimeout(() => resolve(vitals), 3000);
      });
    });
    
    console.log('Core Web Vitals:', webVitals);
    
    // LCP는 2.5초 이하여야 함
    if ((webVitals as any).lcp) {
      expect((webVitals as any).lcp).toBeLessThan(2500);
    }
    
    // CLS는 0.1 이하여야 함
    if ((webVitals as any).cls !== undefined) {
      expect((webVitals as any).cls).toBeLessThan(0.1);
    }
  });

  test('페이지 로드 성능', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    
    // 3초 이내 로드 완료
    expect(loadTime).toBeLessThan(3000);
    console.log(`페이지 로드 시간: ${loadTime}ms`);
    
    // 리소스 로드 시간 분석
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as any;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
        loadComplete: navigation.loadEventEnd - navigation.navigationStart,
        firstByte: navigation.responseStart - navigation.navigationStart,
        domInteractive: navigation.domInteractive - navigation.navigationStart,
      };
    });
    
    console.log('성능 메트릭:', performanceMetrics);
    
    // DOM Interactive는 1.5초 이내
    expect(performanceMetrics.domInteractive).toBeLessThan(1500);
    
    // First Byte는 500ms 이내
    expect(performanceMetrics.firstByte).toBeLessThan(500);
  });

  test('JavaScript 번들 크기 확인', async ({ page }) => {
    await page.goto('/');
    
    // 로드된 JavaScript 리소스 분석
    const jsResources = await page.evaluate(() => {
      return performance.getEntriesByType('resource')
        .filter((resource: any) => resource.name.includes('.js'))
        .map((resource: any) => ({
          name: resource.name.split('/').pop(),
          size: resource.transferSize,
          loadTime: resource.loadEnd - resource.startTime
        }));
    });
    
    console.log('JavaScript 번들 정보:', jsResources);
    
    // 메인 번들의 크기 확인 (300KB 이하)
    const mainBundle = jsResources.find((resource: any) => 
      resource.name.includes('main') || resource.name.includes('index')
    );
    
    if (mainBundle) {
      expect(mainBundle.size).toBeLessThan(300 * 1024); // 300KB
      console.log(`메인 번들 크기: ${Math.round(mainBundle.size / 1024)}KB`);
    }
    
    // 개별 청크 크기 확인 (100KB 이하)
    for (const resource of jsResources) {
      if (resource.name.includes('chunk')) {
        expect(resource.size).toBeLessThan(100 * 1024); // 100KB
      }
    }
  });

  test('메모리 사용량 테스트', async ({ page }) => {
    await page.goto('/');
    
    // 초기 메모리 사용량
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory ? {
        used: (performance as any).memory.usedJSHeapSize,
        total: (performance as any).memory.totalJSHeapSize,
        limit: (performance as any).memory.jsHeapSizeLimit
      } : null;
    });
    
    if (initialMemory) {
      console.log('초기 메모리 사용량:', initialMemory);
      
      // 여러 페이지 네비게이션 시뮬레이션
      if (await page.locator('a, button').count() > 0) {
        const links = await page.locator('a, button').all();
        
        for (let i = 0; i < Math.min(3, links.length); i++) {
          await links[i].click();
          await page.waitForTimeout(1000);
        }
        
        // 네비게이션 후 메모리 사용량
        const finalMemory = await page.evaluate(() => {
          return (performance as any).memory ? {
            used: (performance as any).memory.usedJSHeapSize,
            total: (performance as any).memory.totalJSHeapSize,
            limit: (performance as any).memory.jsHeapSizeLimit
          } : null;
        });
        
        if (finalMemory) {
          console.log('최종 메모리 사용량:', finalMemory);
          
          // 메모리 누수 확인 (50MB 증가 이하)
          const memoryIncrease = finalMemory.used - initialMemory.used;
          expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
          console.log(`메모리 증가량: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
        }
      }
    }
  });

  test('IndexedDB 캐시 성능', async ({ page }) => {
    await page.goto('/');
    
    // 첫 번째 로드 시간 측정
    const firstLoadStart = Date.now();
    
    // 데이터가 있는 페이지로 이동 (스태프 관리 등)
    const dataPageLink = page.locator('a').filter({ hasText: /스태프|구인|관리/ }).first();
    
    if (await dataPageLink.count() > 0) {
      await dataPageLink.click();
      await expect(page.locator('h1, h2').first()).toBeVisible();
      
      const firstLoadTime = Date.now() - firstLoadStart;
      console.log(`첫 번째 로드 시간: ${firstLoadTime}ms`);
      
      // 페이지 새로고침 (캐시 효과 테스트)
      const secondLoadStart = Date.now();
      await page.reload();
      await expect(page.locator('h1, h2').first()).toBeVisible();
      
      const secondLoadTime = Date.now() - secondLoadStart;
      console.log(`두 번째 로드 시간 (캐시): ${secondLoadTime}ms`);
      
      // 캐시로 인한 성능 향상 확인 (최소 20% 향상)
      if (firstLoadTime > 1000) {
        expect(secondLoadTime).toBeLessThan(firstLoadTime * 0.8);
        const improvement = Math.round((1 - secondLoadTime / firstLoadTime) * 100);
        console.log(`캐시 성능 향상: ${improvement}%`);
      }
    }
  });

  test('Web Workers 성능 테스트', async ({ page }) => {
    await page.goto('/');
    
    // 정산 계산이 있는 페이지로 이동
    const payrollLink = page.locator('a').filter({ hasText: /정산|급여|payroll/ }).first();
    
    if (await payrollLink.count() > 0) {
      await payrollLink.click();
      
      // 계산 버튼 찾기
      const calculateButton = page.locator('button').filter({ hasText: /계산|정산|calculate/i }).first();
      
      if (await calculateButton.count() > 0) {
        // 메인 스레드 블로킹 테스트
        const startTime = Date.now();
        
        // 계산 시작
        await calculateButton.click();
        
        // 메인 스레드가 블로킹되지 않는지 확인 (다른 UI 상호작용 가능)
        const testButton = page.locator('button, a').nth(1);
        if (await testButton.count() > 0) {
          const interactionStart = Date.now();
          await testButton.hover();
          const interactionTime = Date.now() - interactionStart;
          
          // Web Worker 사용으로 메인 스레드 비블로킹 확인 (100ms 이내)
          expect(interactionTime).toBeLessThan(100);
          console.log(`메인 스레드 반응 시간: ${interactionTime}ms`);
        }
        
        // 계산 완료 대기
        await page.waitForTimeout(2000);
        
        const calculationTime = Date.now() - startTime;
        console.log(`Web Worker 계산 시간: ${calculationTime}ms`);
        
        // Web Worker로 인한 적절한 계산 시간 (10초 이내)
        expect(calculationTime).toBeLessThan(10000);
      }
    }
  });

  test('가상화된 목록 렌더링 성능', async ({ page }) => {
    await page.goto('/admin/staff-management');
    
    // 스태프 목록 로딩 대기
    const staffList = page.locator('[data-testid="staff-list"], .staff-container').first();
    
    if (await staffList.count() > 0) {
      await expect(staffList).toBeVisible();
      
      // 스크롤 성능 테스트
      const scrollTests = [
        { distance: 1000, label: '1000px' },
        { distance: 5000, label: '5000px' },
        { distance: 10000, label: '10000px' }
      ];
      
      for (const test of scrollTests) {
        const scrollStart = Date.now();
        
        await staffList.hover();
        await page.mouse.wheel(0, test.distance);
        await page.waitForTimeout(100); // 렌더링 안정화 대기
        
        const scrollTime = Date.now() - scrollStart;
        
        // 가상화로 인한 빠른 스크롤 (200ms 이내)
        expect(scrollTime).toBeLessThan(200);
        console.log(`${test.label} 스크롤 시간: ${scrollTime}ms`);
      }
    }
  });

  test('네트워크 요청 최적화', async ({ page }) => {
    // 네트워크 요청 모니터링
    const requests: any[] = [];
    
    page.on('request', (request) => {
      requests.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType()
      });
    });
    
    await page.goto('/');
    await page.waitForTimeout(3000); // 모든 요청 완료 대기
    
    console.log(`총 네트워크 요청 수: ${requests.length}`);
    
    // Firebase 요청 분석
    const firebaseRequests = requests.filter(req => 
      req.url.includes('firestore.googleapis.com') || 
      req.url.includes('firebase')
    );
    
    console.log(`Firebase 요청 수: ${firebaseRequests.length}`);
    
    // 스마트 캐싱으로 인한 Firebase 요청 최적화 확인 (10개 이하)
    expect(firebaseRequests.length).toBeLessThan(10);
    
    // 중복 요청 확인
    const uniqueUrls = new Set(requests.map(req => req.url));
    const duplicateRequests = requests.length - uniqueUrls.size;
    
    // 중복 요청 최소화 확인 (5% 이하)
    expect(duplicateRequests / requests.length).toBeLessThan(0.05);
    console.log(`중복 요청 비율: ${Math.round(duplicateRequests / requests.length * 100)}%`);
  });

  test('React.lazy 코드 분할 효과', async ({ page }) => {
    // 초기 로드된 JavaScript 파일 수 확인
    const initialJSCount = await page.evaluate(() => {
      return document.querySelectorAll('script[src*=".js"]').length;
    });
    
    console.log(`초기 JavaScript 파일 수: ${initialJSCount}`);
    
    await page.goto('/');
    
    // 동적 로딩이 필요한 페이지로 이동
    const jobPostingLink = page.locator('a').filter({ hasText: /구인|공고/ }).first();
    
    if (await jobPostingLink.count() > 0) {
      await jobPostingLink.click();
      
      // 상세 페이지로 이동하여 탭 컴포넌트 로딩
      const firstJob = page.locator('.job-card, tr').nth(1).first();
      
      if (await firstJob.count() > 0) {
        await firstJob.click();
        
        // 탭을 여러 개 클릭하여 lazy 컴포넌트 로딩
        const tabs = await page.locator('[role="tab"], .tab-button').all();
        
        for (const tab of tabs) {
          await tab.click();
          await page.waitForTimeout(500);
        }
        
        // 최종 JavaScript 파일 수 확인
        const finalJSCount = await page.evaluate(() => {
          return document.querySelectorAll('script[src*=".js"]').length;
        });
        
        console.log(`최종 JavaScript 파일 수: ${finalJSCount}`);
        
        // 코드 분할로 인한 동적 로딩 확인
        expect(finalJSCount).toBeGreaterThan(initialJSCount);
        console.log(`동적 로딩된 파일 수: ${finalJSCount - initialJSCount}`);
      }
    }
  });
});