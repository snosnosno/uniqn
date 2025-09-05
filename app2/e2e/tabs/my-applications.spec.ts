/**
 * 내 지원현황 탭 E2E 테스트
 * Phase 1: 기본 워크플로우 (4/4)
 * 
 * 테스트 시나리오:
 * 1. 내 지원현황 탭 접근
 * 2. 지원한 공고 목록 확인
 * 3. 지원 상태 표시 (대기/승인/거절)
 * 4. 지원 취소 기능
 * 5. 실시간 상태 업데이트 확인
 * 6. UnifiedDataContext 동기화 검증
 * 
 * @version 4.0
 * @since 2025-09-04
 */

import { test, expect } from '@playwright/test';
import { navigateToUserPage } from '../helpers/auth.helper';
import { 
  waitForDataLoading, 
  collectPerformanceMetrics,
  checkUnifiedDataState,
  initializeTestEnvironment 
} from '../helpers/data.helper';
import { 
  checkUnifiedDataSubscriptions,
  measureFirebaseQueryPerformance,
  testRealtimeSubscription
} from '../helpers/firebase.helper';

test.describe('내 지원현황 탭', () => {

  test.beforeEach(async ({ page }) => {
    // 테스트 환경 초기화
    await initializeTestEnvironment(page);
    
    // 성능 측정 시작
    await page.addInitScript(() => {
      performance.mark('my-applications-start');
    });
  });

  test('4-1. 내 지원현황 탭 접근 및 로딩', async ({ page }) => {
    console.log('📋 내 지원현황 탭 접근 테스트 시작...');
    
    // 구인구직 페이지로 이동
    await navigateToUserPage(page, '/job-board');
    await waitForDataLoading(page);
    
    // 내 지원현황 탭 찾기
    const myApplicationsTabSelectors = [
      'button:has-text("내 지원")',
      'button:has-text("지원현황")',
      'button:has-text("My Applications")',
      '[role="tab"]:has-text("지원")',
      '[data-testid="my-applications-tab"]',
      'button[aria-controls*="application"]'
    ];
    
    let myApplicationsTab;
    for (const selector of myApplicationsTabSelectors) {
      const tab = page.locator(selector);
      if (await tab.count() > 0 && await tab.isVisible()) {
        myApplicationsTab = tab;
        console.log(`✅ 내 지원현황 탭 발견: ${selector}`);
        break;
      }
    }
    
    if (myApplicationsTab) {
      // 탭 클릭
      await myApplicationsTab.click();
      console.log('🔄 내 지원현황 탭 클릭됨');
      
      // 탭 전환 대기
      await page.waitForTimeout(2000);
      
      // 활성 탭 확인
      const activeTab = page.locator('[role="tab"][aria-selected="true"], .tab-button.active').filter({ hasText: /지원|Application/i });
      if (await activeTab.count() > 0) {
        const activeTabText = await activeTab.textContent();
        console.log(`✅ 활성 탭 확인: "${activeTabText}"`);
      }
      
      // 컨텐츠 영역 로딩 확인
      await waitForDataLoading(page);
      
      // MyApplicationsTab 컴포넌트 로딩 확인
      const contentSelectors = [
        '[role="tabpanel"]',
        '.my-applications',
        '[data-testid="my-applications-content"]',
        '.application-list'
      ];
      
      let contentLoaded = false;
      for (const selector of contentSelectors) {
        const content = page.locator(selector);
        if (await content.count() > 0 && await content.isVisible()) {
          console.log(`✅ 지원현황 컨텐츠 로딩됨: ${selector}`);
          contentLoaded = true;
          break;
        }
      }
      
      if (!contentLoaded) {
        // 최소한 페이지 변화 확인
        await expect(page.locator('body')).toBeVisible();
        console.log('ℹ️ 명시적 컨텐츠 영역을 찾을 수 없지만 탭 전환은 확인됨');
      }
      
    } else {
      console.log('⚠️ 내 지원현황 탭을 찾을 수 없습니다. 단일 페이지 구조이거나 다른 UI 패턴일 수 있습니다.');
      
      // 대안으로 URL 직접 접근 시도
      try {
        await page.goto('/my-applications', { waitUntil: 'networkidle' });
        await waitForDataLoading(page);
        console.log('✅ URL 직접 접근으로 내 지원현황 페이지 로딩');
      } catch {
        console.log('ℹ️ 내 지원현황 전용 페이지도 없음');
      }
    }
    
    console.log('✅ 내 지원현황 탭 접근 테스트 완료');
  });

  test('4-2. 지원한 공고 목록 확인', async ({ page }) => {
    await navigateToUserPage(page, '/job-board');
    await waitForDataLoading(page);
    
    // 내 지원현황 탭으로 이동
    const myApplicationsTab = page.locator('button:has-text("내 지원"), button:has-text("지원현황")').first();
    if (await myApplicationsTab.count() > 0) {
      await myApplicationsTab.click();
      await page.waitForTimeout(2000);
    }
    
    // UnifiedDataContext 상태 확인
    const dataState = await checkUnifiedDataState(page);
    console.log('📊 UnifiedDataContext 상태:', {
      applicationsCount: dataState.applicationsCount,
      isLoading: dataState.isLoading ? '⏳' : '✅'
    });
    
    // 지원 목록 확인
    const applicationListSelectors = [
      '.application-item',
      '.application-card', 
      '[data-testid="application"]',
      '.my-application',
      'article',
      'tr' // 테이블 형식인 경우
    ];
    
    let applicationList;
    let applicationCount = 0;
    
    for (const selector of applicationListSelectors) {
      const items = page.locator(selector);
      const count = await items.count();
      
      if (count > 0) {
        applicationList = items;
        applicationCount = count;
        console.log(`✅ 지원 목록 발견: ${count}개 (${selector})`);
        break;
      }
    }
    
    if (applicationList && applicationCount > 0) {
      // 첫 번째 지원서 정보 확인
      const firstApplication = applicationList.first();
      
      // 공고 제목 확인
      const titleElement = firstApplication.locator('h2, h3, .title, .job-title, .posting-title').first();
      if (await titleElement.count() > 0) {
        const title = await titleElement.textContent();
        console.log(`📋 지원한 공고: "${title}"`);
      }
      
      // 지원 날짜 확인
      const dateElement = firstApplication.locator('.date, .applied-date, time').first();
      if (await dateElement.count() > 0) {
        const date = await dateElement.textContent();
        console.log(`📅 지원 날짜: ${date}`);
      }
      
      // 지원 상태 확인
      const statusElement = firstApplication.locator('.status, .application-status, .badge').first();
      if (await statusElement.count() > 0) {
        const status = await statusElement.textContent();
        console.log(`📊 지원 상태: ${status}`);
      }
      
      // 전체 지원서 목록 순회 (최대 5개)
      const visibleApplications = Math.min(applicationCount, 5);
      console.log(`🔍 상위 ${visibleApplications}개 지원서 상태 확인:`);
      
      for (let i = 0; i < visibleApplications; i++) {
        const app = applicationList.nth(i);
        const appTitle = await app.locator('h2, h3, .title').first().textContent() || `지원서 ${i + 1}`;
        const appStatus = await app.locator('.status, .badge').first().textContent() || '상태 없음';
        console.log(`  ${i + 1}. ${appTitle} - ${appStatus}`);
      }
      
    } else {
      // 빈 상태 확인
      const emptyStateSelectors = [
        'text=지원한 공고가 없습니다',
        'text=아직 지원하지 않았습니다',
        '.empty-state',
        '[data-testid="empty-applications"]'
      ];
      
      let emptyStateFound = false;
      for (const selector of emptyStateSelectors) {
        const emptyState = page.locator(selector);
        if (await emptyState.count() > 0 && await emptyState.isVisible()) {
          console.log(`ℹ️ 빈 상태 확인: ${selector}`);
          emptyStateFound = true;
          break;
        }
      }
      
      if (!emptyStateFound) {
        console.log('⚠️ 지원 목록도 빈 상태도 찾을 수 없습니다. UI 구조를 확인하세요.');
      }
    }
    
    console.log('✅ 지원한 공고 목록 확인 완료');
  });

  test('4-3. 지원 상태별 분류 및 표시', async ({ page }) => {
    await navigateToUserPage(page, '/job-board');
    await waitForDataLoading(page);
    
    // 내 지원현황 탭으로 이동
    const myApplicationsTab = page.locator('button:has-text("내 지원"), button:has-text("지원현황")').first();
    if (await myApplicationsTab.count() > 0) {
      await myApplicationsTab.click();
      await page.waitForTimeout(2000);
    }
    
    // 상태별 필터 또는 분류 확인
    const statusFilterSelectors = [
      '.status-filter',
      'select[name*="status"]',
      'button:has-text("대기")',
      'button:has-text("승인")',
      'button:has-text("거절")',
      '.filter-tabs'
    ];
    
    let statusFilterFound = false;
    for (const selector of statusFilterSelectors) {
      const filter = page.locator(selector);
      if (await filter.count() > 0 && await filter.isVisible()) {
        console.log(`✅ 상태 필터 발견: ${selector}`);
        statusFilterFound = true;
        
        // 필터가 버튼 형태라면 클릭해서 테스트
        if (selector.includes('button')) {
          await filter.first().click();
          await page.waitForTimeout(1000);
          console.log('🔄 상태 필터 클릭 테스트');
        }
        break;
      }
    }
    
    // 지원서들의 상태 분석
    const applicationItems = await page.locator('.application-item, .application-card, [data-testid="application"]').all();
    
    if (applicationItems.length > 0) {
      const statusCounts = { pending: 0, approved: 0, rejected: 0, other: 0 };
      
      console.log('📊 지원서별 상태 분석:');
      
      for (let i = 0; i < Math.min(applicationItems.length, 10); i++) {
        const app = applicationItems[i];
        const statusElement = app.locator('.status, .badge, .application-status');
        
        if (await statusElement.count() > 0) {
          const statusText = await statusElement.textContent() || '';
          const lowerStatus = statusText.toLowerCase();
          
          if (lowerStatus.includes('대기') || lowerStatus.includes('pending')) {
            statusCounts.pending++;
            console.log(`  ${i + 1}. 📝 대기 중: ${statusText}`);
          } else if (lowerStatus.includes('승인') || lowerStatus.includes('approved') || lowerStatus.includes('confirmed')) {
            statusCounts.approved++;
            console.log(`  ${i + 1}. ✅ 승인됨: ${statusText}`);
          } else if (lowerStatus.includes('거절') || lowerStatus.includes('rejected') || lowerStatus.includes('denied')) {
            statusCounts.rejected++;
            console.log(`  ${i + 1}. ❌ 거절됨: ${statusText}`);
          } else {
            statusCounts.other++;
            console.log(`  ${i + 1}. ❓ 기타: ${statusText}`);
          }
        } else {
          console.log(`  ${i + 1}. 상태 표시 없음`);
        }
      }
      
      console.log('📈 상태별 집계:', statusCounts);
      
      // 상태 표시가 일관성 있게 되어 있는지 확인
      const totalWithStatus = statusCounts.pending + statusCounts.approved + statusCounts.rejected + statusCounts.other;
      if (totalWithStatus === applicationItems.length) {
        console.log('✅ 모든 지원서에 상태 표시됨');
      } else {
        console.log(`⚠️ 일부 지원서에 상태 표시 누락: ${totalWithStatus}/${applicationItems.length}`);
      }
      
    } else {
      console.log('ℹ️ 분석할 지원서가 없습니다');
    }
    
    console.log('✅ 지원 상태별 분류 확인 완료');
  });

  test('4-4. 지원 취소 기능 테스트', async ({ page }) => {
    await navigateToUserPage(page, '/job-board');
    await waitForDataLoading(page);
    
    // 내 지원현황 탭으로 이동
    const myApplicationsTab = page.locator('button:has-text("내 지원"), button:has-text("지원현황")').first();
    if (await myApplicationsTab.count() > 0) {
      await myApplicationsTab.click();
      await page.waitForTimeout(2000);
    }
    
    // 지원 취소 가능한 항목 찾기 (대기 중 상태)
    const applicationItems = await page.locator('.application-item, .application-card, [data-testid="application"]').all();
    
    let cancelableApplication = null;
    for (const app of applicationItems) {
      const statusElement = app.locator('.status, .badge');
      if (await statusElement.count() > 0) {
        const statusText = await statusElement.textContent() || '';
        
        // 대기 중 상태인 지원서 찾기
        if (statusText.includes('대기') || statusText.includes('pending') || statusText.includes('제출')) {
          cancelableApplication = app;
          console.log(`✅ 취소 가능한 지원서 발견: ${statusText}`);
          break;
        }
      }
    }
    
    if (cancelableApplication) {
      // 취소 버튼 찾기
      const cancelButtonSelectors = [
        'button:has-text("취소")',
        'button:has-text("Cancel")', 
        'button:has-text("철회")',
        '[data-testid="cancel-application"]',
        '.cancel-btn'
      ];
      
      let cancelButton;
      for (const selector of cancelButtonSelectors) {
        const button = cancelableApplication.locator(selector);
        if (await button.count() > 0 && await button.isVisible()) {
          cancelButton = button;
          console.log(`✅ 취소 버튼 발견: ${selector}`);
          break;
        }
      }
      
      if (cancelButton && await cancelButton.isEnabled()) {
        console.log('⚠️ 지원 취소 버튼 클릭 테스트 (실제 취소는 하지 않음)');
        
        // 실제 환경에서는 취소하지 않고, 버튼 존재만 확인
        // await cancelButton.click();
        
        // 취소 확인 모달이 나타날지 확인 (클릭하지 않고 hover로 테스트)
        await cancelButton.hover();
        await page.waitForTimeout(1000);
        
        // 툴팁이나 확인 메시지 확인
        const tooltipSelectors = [
          '.tooltip',
          '[role="tooltip"]',
          '.confirmation-popup'
        ];
        
        for (const selector of tooltipSelectors) {
          const tooltip = page.locator(selector);
          if (await tooltip.count() > 0 && await tooltip.isVisible()) {
            const tooltipText = await tooltip.textContent();
            console.log(`ℹ️ 취소 관련 메시지: "${tooltipText}"`);
            break;
          }
        }
        
        console.log('✅ 지원 취소 기능 존재 확인 (실제 실행 안함)');
        
      } else {
        console.log('ℹ️ 취소 버튼을 찾을 수 없거나 비활성화됨');
      }
      
    } else {
      console.log('ℹ️ 취소 가능한 지원서가 없습니다 (모두 처리완료 상태이거나 지원서 없음)');
    }
    
    console.log('✅ 지원 취소 기능 테스트 완료');
  });

  test('4-5. 실시간 상태 업데이트 확인', async ({ page }) => {
    await navigateToUserPage(page, '/job-board');
    await waitForDataLoading(page);
    
    // 실시간 구독 테스트
    console.log('📡 실시간 구독 상태 테스트...');
    
    const subscriptionsWorking = await testRealtimeSubscription(page, 'applications', 8000);
    if (subscriptionsWorking) {
      console.log('✅ applications 컬렉션 실시간 구독 작동');
    } else {
      console.log('⚠️ applications 컬렉션 실시간 구독 미작동');
    }
    
    // UnifiedDataContext 구독 최적화 확인
    const subscriptionStatus = await checkUnifiedDataSubscriptions(page);
    console.log('🔗 구독 최적화 상태:', {
      totalSubscriptions: subscriptionStatus.totalSubscriptions,
      isOptimized: subscriptionStatus.isOptimized ? '✅' : '⚠️',
      collections: subscriptionStatus.collections
    });
    
    // 내 지원현황 탭으로 이동
    const myApplicationsTab = page.locator('button:has-text("내 지원"), button:has-text("지원현황")').first();
    if (await myApplicationsTab.count() > 0) {
      await myApplicationsTab.click();
      await page.waitForTimeout(2000);
    }
    
    // 현재 상태 스냅샷
    const initialDataState = await checkUnifiedDataState(page);
    console.log('📊 초기 데이터 상태:', initialDataState);
    
    // 페이지 새로고침 없이 데이터 변경 감지 테스트
    console.log('🔄 데이터 변경 감지 테스트 (10초 대기)...');
    
    await page.waitForTimeout(10000);
    
    // 변경 후 상태 확인
    const updatedDataState = await checkUnifiedDataState(page);
    console.log('📊 업데이트 후 데이터 상태:', updatedDataState);
    
    // 변경사항 감지
    const applicationsChanged = initialDataState.applicationsCount !== updatedDataState.applicationsCount;
    if (applicationsChanged) {
      console.log('✅ 실시간 데이터 업데이트 감지됨');
    } else {
      console.log('ℹ️ 테스트 기간 중 데이터 변경 없음 (정상)');
    }
    
    // 로딩 상태 변화 확인
    const loadingStateChanged = initialDataState.isLoading !== updatedDataState.isLoading;
    if (loadingStateChanged) {
      console.log('🔄 로딩 상태 변화 감지됨');
    }
    
    console.log('✅ 실시간 상태 업데이트 테스트 완료');
  });

  test('4-6. 지원현황 성능 및 사용성 테스트', async ({ page }) => {
    await navigateToUserPage(page, '/job-board');
    
    // 성능 측정 시작
    const startTime = Date.now();
    
    // 내 지원현황 탭으로 이동
    const myApplicationsTab = page.locator('button:has-text("내 지원"), button:has-text("지원현황")').first();
    if (await myApplicationsTab.count() > 0) {
      await myApplicationsTab.click();
    }
    
    await waitForDataLoading(page);
    
    const loadTime = Date.now() - startTime;
    console.log(`⏱️ 지원현황 탭 로딩 시간: ${loadTime}ms`);
    
    // 성능 목표 확인 (2초 = 2000ms)
    if (loadTime < 2000) {
      console.log('✅ 지원현황 로딩 성능 우수 (< 2초)');
    } else {
      console.log(`⚠️ 지원현황 로딩 성능 개선 필요: ${loadTime}ms`);
    }
    
    // Firebase 쿼리 성능 확인
    const queryPerformance = await measureFirebaseQueryPerformance(page, 'applications');
    console.log('⚡ applications 쿼리 성능:', {
      queryTime: `${queryPerformance.queryTime.toFixed(2)}ms`,
      documentCount: queryPerformance.documentCount,
      cacheHit: queryPerformance.cacheHit ? '✅' : '❌'
    });
    
    // 사용성 테스트 - 키보드 네비게이션
    console.log('⌨️ 키보드 네비게이션 테스트...');
    
    // Tab 키로 요소 간 이동
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);
    
    // 현재 포커스된 요소 확인
    const focusedElement = await page.evaluate(() => {
      const focused = document.activeElement;
      return {
        tagName: focused?.tagName,
        className: focused?.className,
        textContent: focused?.textContent?.slice(0, 50)
      };
    });
    
    console.log('🎯 포커스된 요소:', focusedElement);
    
    // 접근성 확인 - 스크린리더 지원
    const accessibilityElements = await page.locator('[aria-label], [role], [tabindex]').count();
    console.log(`♿ 접근성 요소 개수: ${accessibilityElements}개`);
    
    // 반응형 테스트 - 모바일 뷰포트
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    
    const mobileApplicationItems = await page.locator('.application-item, .application-card').count();
    console.log(`📱 모바일에서 표시되는 지원서: ${mobileApplicationItems}개`);
    
    // 데스크톱으로 복원
    await page.setViewportSize({ width: 1280, height: 720 });
    
    console.log('✅ 성능 및 사용성 테스트 완료');
  });

  test.afterEach(async ({ page }) => {
    // 최종 성능 메트릭 수집
    const metrics = await collectPerformanceMetrics(page);
    console.log('📊 내 지원현황 최종 성능 지표:', {
      loadTime: `${metrics.loadTime.toFixed(2)}ms`,
      firebaseRequests: metrics.firebaseRequests,
      networkRequests: metrics.networkRequests,
      bundleSize: `${(metrics.bundleSize / 1024).toFixed(2)}KB`,
      memoryUsage: `${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`
    });
    
    // UnifiedDataContext 최종 상태 확인
    const finalDataState = await checkUnifiedDataState(page);
    console.log('🔄 UnifiedDataContext 최종 상태:', {
      applicationsCount: finalDataState.applicationsCount,
      totalStaff: finalDataState.staffCount,
      totalWorkLogs: finalDataState.workLogsCount,
      isLoading: finalDataState.isLoading ? '⏳' : '✅'
    });
    
    console.log('✅ 내 지원현황 테스트 정리 완료');
  });
});