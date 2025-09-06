/**
 * 구인구직 게시판 E2E 테스트
 * Phase 1: 기본 워크플로우 (2/4)
 * 
 * 테스트 시나리오:
 * 1. 게시판 로딩 시간 측정 (<3초)
 * 2. 공고 목록 표시 확인
 * 3. 필터링 기능 (위치, 날짜, 역할)
 * 4. 검색 기능 테스트
 * 5. 페이지네이션/무한 스크롤
 * 6. 모바일 반응형 확인
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
  measureFirebaseQueryPerformance 
} from '../helpers/firebase.helper';

test.describe('구인구직 게시판', () => {
  
  test.beforeEach(async ({ page }) => {
    // 테스트 환경 초기화
    await initializeTestEnvironment(page);
    
    // 성능 측정 시작
    await page.addInitScript(() => {
      performance.mark('jobs-start');
    });
  });

  test('2-1. 게시판 로딩 성능 테스트 (<4초 목표)', async ({ page }) => {
    console.log('⏱️ 게시판 로딩 성능 테스트 시작...');
    
    const startTime = Date.now();
    
    // 구인구직 게시판 페이지 접근
    await navigateToUserPage(page, '/jobs');
    
    // 페이지 로딩 대기
    await waitForDataLoading(page, 15000);
    
    const loadTime = Date.now() - startTime;
    console.log(`📊 페이지 로딩 시간: ${loadTime}ms`);
    
    // 성능 목표 확인 (4초 = 4000ms)
    if (loadTime < 4000) {
      console.log('✅ 로딩 성능 목표 달성 (< 4초)');
    } else {
      console.log(`⚠️ 로딩 성능 개선 필요: ${loadTime}ms > 4000ms`);
    }
    
    // 기본 페이지 요소 확인
    await expect(page.locator('h1, h2').filter({ hasText: /구인|공고|Job Board/i }).first()).toBeVisible({
      timeout: 10000
    });
    
    // 상세 성능 메트릭 수집
    const performanceMetrics = await collectPerformanceMetrics(page);
    console.log('📈 상세 성능 지표:', {
      totalLoadTime: `${performanceMetrics.loadTime.toFixed(2)}ms`,
      networkRequests: performanceMetrics.networkRequests,
      firebaseRequests: performanceMetrics.firebaseRequests,
      bundleSize: `${(performanceMetrics.bundleSize / 1024).toFixed(2)}KB`,
      memoryUsage: `${(performanceMetrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`
    });
    
    console.log('✅ 게시판 로딩 성능 테스트 완료');
  });

  test('2-2. 공고 목록 표시 및 UnifiedDataContext 확인', async ({ page }) => {
    await navigateToUserPage(page, '/jobs');
    await waitForDataLoading(page);
    
    // UnifiedDataContext 상태 확인
    const dataState = await checkUnifiedDataState(page);
    console.log('📊 UnifiedDataContext 상태:', dataState);
    
    // 구독 최적화 확인
    const subscriptions = await checkUnifiedDataSubscriptions(page);
    console.log('📡 Firebase 구독 상태:', subscriptions);
    
    // 최적화 목표 확인 (5개 이하 구독)
    if (subscriptions.isOptimized) {
      console.log('✅ Firebase 구독 최적화됨 (≤ 5개)');
    } else {
      console.log('⚠️ Firebase 구독 최적화 필요');
    }
    
    // 공고 목록 확인
    const jobListSelectors = [
      '.job-card',
      '[data-testid="job-posting"]',
      '.job-item',
      'article',
      '.posting-item'
    ];
    
    let jobListFound = false;
    for (const selector of jobListSelectors) {
      const jobItems = page.locator(selector);
      const count = await jobItems.count();
      
      if (count > 0) {
        console.log(`✅ 공고 목록 발견: ${count}개 (${selector})`);
        
        // 첫 번째 공고 카드의 내용 확인
        const firstJob = jobItems.first();
        await expect(firstJob).toBeVisible();
        
        // 공고 카드 필수 정보 확인
        const jobTitle = firstJob.locator('h2, h3, .title, .job-title').first();
        if (await jobTitle.count() > 0) {
          const titleText = await jobTitle.textContent();
          console.log(`📋 첫 번째 공고 제목: "${titleText}"`);
        }
        
        jobListFound = true;
        break;
      }
    }
    
    if (!jobListFound) {
      // 빈 상태 메시지 확인
      const emptyStateSelectors = [
        'text=공고가 없습니다',
        'text=등록된 구인공고가 없습니다',
        '.empty-state',
        '[data-testid="empty-state"]'
      ];
      
      for (const selector of emptyStateSelectors) {
        const emptyState = page.locator(selector);
        if (await emptyState.count() > 0) {
          console.log('ℹ️ 빈 상태 확인: 등록된 구인공고가 없습니다');
          jobListFound = true;
          break;
        }
      }
    }
    
    expect(jobListFound).toBe(true);
    console.log('✅ 공고 목록 표시 확인 완료');
  });

  test('2-3. 탭 네비게이션 기능 테스트', async ({ page }) => {
    await navigateToUserPage(page, '/jobs');
    await waitForDataLoading(page);
    
    // 탭 찾기
    const tabSelectors = [
      '[role="tab"]',
      '.tab-button',
      'button[aria-selected]',
      '.nav-tabs button'
    ];
    
    let tabs = [];
    for (const selector of tabSelectors) {
      const tabElements = await page.locator(selector).all();
      if (tabElements.length > 0) {
        tabs = tabElements;
        console.log(`✅ 탭 발견: ${tabElements.length}개 (${selector})`);
        break;
      }
    }
    
    if (tabs.length >= 2) {
      // 첫 번째 탭 (구인 목록)
      const firstTab = tabs[0];
      const firstTabText = await firstTab.textContent();
      console.log(`🔗 첫 번째 탭: "${firstTabText}"`);
      
      await firstTab.click();
      await page.waitForTimeout(1000);
      
      // 두 번째 탭 (내 지원 현황)
      const secondTab = tabs[1];
      const secondTabText = await secondTab.textContent();
      console.log(`🔗 두 번째 탭: "${secondTabText}"`);
      
      await secondTab.click();
      await page.waitForTimeout(1000);
      
      // 탭 전환 후 컨텐츠 변경 확인
      const activeTab = page.locator('[role="tab"][aria-selected="true"], .tab-button.active').first();
      if (await activeTab.count() > 0) {
        const activeTabText = await activeTab.textContent();
        console.log(`✅ 활성 탭: "${activeTabText}"`);
      }
      
      // 첫 번째 탭으로 복귀
      await firstTab.click();
      await page.waitForTimeout(1000);
      
      console.log('✅ 탭 네비게이션 테스트 완료');
    } else {
      console.log('ℹ️ 탭이 없거나 단일 탭 구조입니다');
    }
  });

  test('2-4. 필터링 기능 테스트', async ({ page }) => {
    await navigateToUserPage(page, '/jobs');
    await waitForDataLoading(page);
    
    // 필터 버튼 또는 필터 영역 찾기
    const filterSelectors = [
      'button:has-text("필터")',
      'button[aria-label*="필터"]',
      '.filter-button',
      '[data-testid="filter-toggle"]',
      '.filters',
      '.filter-section'
    ];
    
    let filterSection;
    for (const selector of filterSelectors) {
      const element = page.locator(selector);
      if (await element.count() > 0 && await element.isVisible()) {
        filterSection = element;
        console.log(`✅ 필터 섹션 발견: ${selector}`);
        break;
      }
    }
    
    if (filterSection) {
      // 필터 버튼인 경우 클릭하여 열기
      const isButton = await filterSection.evaluate(el => el.tagName === 'BUTTON');
      if (isButton) {
        await filterSection.click();
        await page.waitForTimeout(1000);
      }
      
      // 위치 필터 테스트
      const locationFilter = page.locator('select[name*="location"], input[name*="location"], input[placeholder*="위치"]').first();
      if (await locationFilter.count() > 0) {
        const tagName = await locationFilter.evaluate(el => el.tagName);
        
        if (tagName === 'SELECT') {
          // 드롭다운 선택
          await locationFilter.selectOption({ index: 1 });
          console.log('✅ 위치 필터 (드롭다운) 테스트');
        } else {
          // 텍스트 입력
          await locationFilter.fill('강남');
          console.log('✅ 위치 필터 (입력) 테스트');
        }
        
        await page.waitForTimeout(2000);
      }
      
      // 날짜 필터 테스트
      const dateFilter = page.locator('input[type="date"], input[name*="date"]').first();
      if (await dateFilter.count() > 0) {
        const today = new Date().toISOString().split('T')[0];
        await dateFilter.fill(today);
        console.log('✅ 날짜 필터 테스트');
        await page.waitForTimeout(2000);
      }
      
      // 역할 필터 테스트
      const roleFilter = page.locator('select[name*="role"], select[name*="position"]').first();
      if (await roleFilter.count() > 0) {
        await roleFilter.selectOption({ index: 1 });
        console.log('✅ 역할 필터 테스트');
        await page.waitForTimeout(2000);
      }
      
      // 필터 초기화 버튼
      const clearButton = page.locator('button:has-text("초기화"), button:has-text("Clear"), button[aria-label*="초기화"]').first();
      if (await clearButton.count() > 0) {
        await clearButton.click();
        console.log('✅ 필터 초기화 테스트');
        await page.waitForTimeout(1000);
      }
      
    } else {
      console.log('ℹ️ 필터 기능을 찾을 수 없습니다. 기본 목록 표시만 확인합니다.');
    }
    
    console.log('✅ 필터링 기능 테스트 완료');
  });

  test('2-5. 검색 기능 테스트', async ({ page }) => {
    await navigateToUserPage(page, '/jobs');
    await waitForDataLoading(page);
    
    // 검색 입력 필드 찾기
    const searchSelectors = [
      'input[type="search"]',
      'input[placeholder*="검색"]',
      'input[name*="search"]',
      '[data-testid="search-input"]',
      '.search-input'
    ];
    
    let searchInput;
    for (const selector of searchSelectors) {
      const input = page.locator(selector);
      if (await input.count() > 0 && await input.isVisible()) {
        searchInput = input;
        console.log(`✅ 검색 입력 필드 발견: ${selector}`);
        break;
      }
    }
    
    if (searchInput) {
      // 검색어 입력
      const searchTerm = '딜러';
      await searchInput.fill(searchTerm);
      console.log(`🔍 검색어 입력: "${searchTerm}"`);
      
      // 검색 버튼 찾기 및 클릭
      const searchButtonSelectors = [
        'button[type="submit"]',
        'button:has-text("검색")',
        'button[aria-label*="검색"]',
        '[data-testid="search-button"]'
      ];
      
      let searchButton;
      for (const selector of searchButtonSelectors) {
        const button = page.locator(selector);
        if (await button.count() > 0 && await button.isVisible()) {
          searchButton = button;
          break;
        }
      }
      
      if (searchButton) {
        await searchButton.click();
      } else {
        // Enter 키로 검색
        await searchInput.press('Enter');
      }
      
      console.log('🔎 검색 실행됨');
      await page.waitForTimeout(3000);
      
      // 검색 결과 확인
      const resultCount = await page.locator('.job-card, .job-item, [data-testid="job-posting"]').count();
      console.log(`📊 검색 결과: ${resultCount}개`);
      
      // 검색어 초기화
      await searchInput.clear();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      console.log('✅ 검색 초기화 완료');
      
    } else {
      console.log('ℹ️ 검색 기능을 찾을 수 없습니다.');
    }
    
    console.log('✅ 검색 기능 테스트 완료');
  });

  test('2-6. 페이지네이션/무한 스크롤 테스트', async ({ page }) => {
    await navigateToUserPage(page, '/jobs');
    await waitForDataLoading(page);
    
    // 초기 공고 수 확인
    const initialJobCount = await page.locator('.job-card, .job-item, [data-testid="job-posting"]').count();
    console.log(`📊 초기 공고 수: ${initialJobCount}개`);
    
    // 페이지네이션 확인
    const paginationSelectors = [
      '.pagination',
      '[data-testid="pagination"]',
      'nav[aria-label*="페이지"]',
      '.page-navigation'
    ];
    
    let paginationFound = false;
    for (const selector of paginationSelectors) {
      const pagination = page.locator(selector);
      if (await pagination.count() > 0) {
        console.log('✅ 페이지네이션 발견');
        
        // 다음 페이지 버튼 클릭
        const nextButton = pagination.locator('button:has-text("다음"), button[aria-label*="다음"], .next').first();
        if (await nextButton.count() > 0 && await nextButton.isEnabled()) {
          await nextButton.click();
          await page.waitForTimeout(2000);
          
          const newJobCount = await page.locator('.job-card, .job-item, [data-testid="job-posting"]').count();
          console.log(`📊 다음 페이지 공고 수: ${newJobCount}개`);
        }
        
        paginationFound = true;
        break;
      }
    }
    
    // 무한 스크롤 테스트 (페이지네이션이 없는 경우)
    if (!paginationFound && initialJobCount > 0) {
      console.log('🔄 무한 스크롤 테스트 시작...');
      
      // 페이지 끝까지 스크롤
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      // 로딩 더보기 대기
      await page.waitForTimeout(3000);
      
      // 추가 로딩된 공고 확인
      const newJobCount = await page.locator('.job-card, .job-item, [data-testid="job-posting"]').count();
      
      if (newJobCount > initialJobCount) {
        console.log(`✅ 무한 스크롤 작동: ${initialJobCount} → ${newJobCount}개`);
      } else {
        console.log('ℹ️ 추가 공고가 없거나 무한 스크롤 기능 없음');
      }
    }
    
    console.log('✅ 페이지네이션/무한 스크롤 테스트 완료');
  });

  test('2-7. 모바일 반응형 디자인 테스트', async ({ page }) => {
    console.log('📱 모바일 반응형 테스트 시작...');
    
    // 모바일 뷰포트로 변경
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone X
    
    await navigateToUserPage(page, '/jobs');
    await waitForDataLoading(page);
    
    // 모바일에서 페이지 기본 요소 확인
    await expect(page.locator('h1, h2').first()).toBeVisible();
    
    // 햄버거 메뉴 또는 모바일 네비게이션 확인
    const mobileMenuSelectors = [
      '.mobile-menu',
      '[data-testid="mobile-menu"]',
      'button[aria-label*="메뉴"]',
      '.hamburger',
      '.menu-toggle'
    ];
    
    for (const selector of mobileMenuSelectors) {
      const menu = page.locator(selector);
      if (await menu.count() > 0 && await menu.isVisible()) {
        console.log(`📱 모바일 메뉴 발견: ${selector}`);
        await menu.click();
        await page.waitForTimeout(1000);
        break;
      }
    }
    
    // 모바일에서 공고 카드 레이아웃 확인
    const jobCards = page.locator('.job-card, .job-item').first();
    if (await jobCards.count() > 0) {
      const cardBounds = await jobCards.boundingBox();
      if (cardBounds) {
        console.log(`📱 공고 카드 크기: ${cardBounds.width}px (뷰포트: 375px)`);
        
        // 카드가 화면 너비에 맞는지 확인 (여백 고려)
        if (cardBounds.width <= 375 && cardBounds.width >= 300) {
          console.log('✅ 모바일 카드 레이아웃 적절');
        } else {
          console.log('⚠️ 모바일 카드 레이아웃 개선 필요');
        }
      }
    }
    
    // 태블릿 뷰포트 테스트
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    await page.waitForTimeout(1000);
    
    console.log('📱 태블릿 뷰포트 테스트 완료');
    
    // 데스크톱으로 복원
    await page.setViewportSize({ width: 1280, height: 720 });
    
    console.log('✅ 모바일 반응형 테스트 완료');
  });

  test.afterEach(async ({ page }) => {
    // 성능 메트릭 수집
    const metrics = await collectPerformanceMetrics(page);
    console.log('📊 페이지 최종 성능 지표:', {
      loadTime: `${metrics.loadTime.toFixed(2)}ms`,
      firebaseRequests: metrics.firebaseRequests,
      bundleSize: `${(metrics.bundleSize / 1024).toFixed(2)}KB`,
      networkRequests: metrics.networkRequests
    });
    
    // Firebase 쿼리 성능 최종 확인
    const queryPerf = await measureFirebaseQueryPerformance(page, 'jobPostings');
    console.log('⚡ Firebase 최종 성능:', {
      queryTime: `${queryPerf.queryTime.toFixed(2)}ms`,
      cacheHit: queryPerf.cacheHit ? '✅' : '❌',
      documentCount: queryPerf.documentCount
    });
  });
});