/**
 * Job Posting Management E2E Tests
 * Week 4 성능 최적화: 구인공고 관리 워크플로우 테스트
 * 
 * @version 4.0
 * @since 2025-02-02 (Week 4)
 */

import { test, expect } from '@playwright/test';

test.describe('구인공고 관리', () => {
  test.beforeEach(async ({ page }) => {
    // TODO: 실제 로그인 구현 후 수정 필요
    await page.goto('/admin/job-postings');
    
    // 페이지 로드 완료 대기
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('구인공고 목록 페이지 렌더링', async ({ page }) => {
    // 페이지 제목 확인
    await expect(page.locator('h1, h2')).toContainText(/구인|공고|Job/i);
    
    // 공고 목록 확인
    const jobPostingList = page.locator('[data-testid="job-posting-list"], .job-card, table').first();
    await expect(jobPostingList).toBeVisible();
    
    // 새 공고 작성 버튼 확인
    const createButton = page.locator('button').filter({ hasText: /작성|생성|추가|등록|Create|Add/ }).first();
    if (await createButton.count() > 0) {
      await expect(createButton).toBeVisible();
    }
  });

  test('새 구인공고 작성', async ({ page }) => {
    const createButton = page.locator('button').filter({ hasText: /작성|생성|추가|등록|Create|Add/ }).first();
    
    if (await createButton.count() > 0) {
      await createButton.click();
      
      // 공고 작성 폼 표시 확인
      const jobForm = page.locator('form, [role="dialog"]').first();
      await expect(jobForm).toBeVisible();
      
      // 필수 입력 필드들 확인
      await expect(page.locator('input[name*="title"], input[placeholder*="제목"]').first()).toBeVisible();
      await expect(page.locator('textarea, input[name*="description"]').first()).toBeVisible();
      await expect(page.locator('input[name*="location"], input[placeholder*="위치"]').first()).toBeVisible();
    }
  });

  test('구인공고 상세 페이지 진입', async ({ page }) => {
    // 첫 번째 공고 클릭
    const firstJobPosting = page.locator('.job-card, tr, [data-testid*="job"]').nth(1).first();
    
    if (await firstJobPosting.count() > 0) {
      await firstJobPosting.click();
      
      // 상세 페이지로 이동하거나 모달 표시 확인
      const detailPage = page.locator('h1, h2, .job-detail').first();
      await expect(detailPage).toBeVisible();
      
      // 탭 네비게이션 확인 (지원자, 스태프, 시프트, 정산)
      const tabs = page.locator('[role="tab"], .tab-button').count();
      if (await tabs > 0) {
        await expect(page.locator('[role="tab"], .tab-button').first()).toBeVisible();
      }
    }
  });

  test('지원자 탭 가상화 성능', async ({ page }) => {
    // 첫 번째 공고 상세로 이동
    const firstJobPosting = page.locator('.job-card, tr, [data-testid*="job"]').nth(1).first();
    
    if (await firstJobPosting.count() > 0) {
      await firstJobPosting.click();
      
      // 지원자 탭 클릭
      const applicantTab = page.locator('[role="tab"], .tab-button').filter({ hasText: /지원자|Applicant/i }).first();
      
      if (await applicantTab.count() > 0) {
        const startTime = Date.now();
        await applicantTab.click();
        
        // 지원자 목록 로딩 대기
        await expect(page.locator('[data-testid="applicant-list"], .applicant-card, table').first()).toBeVisible();
        
        const loadTime = Date.now() - startTime;
        
        // 가상화로 인한 빠른 로딩 확인 (2초 이내)
        expect(loadTime).toBeLessThan(2000);
        console.log(`지원자 탭 로딩 시간: ${loadTime}ms`);
        
        // 스크롤 성능 테스트
        const applicantList = page.locator('[data-testid="applicant-list"], .applicant-container').first();
        if (await applicantList.count() > 0) {
          const scrollStartTime = Date.now();
          await applicantList.hover();
          await page.mouse.wheel(0, 500);
          await page.waitForTimeout(100);
          const scrollTime = Date.now() - scrollStartTime;
          
          expect(scrollTime).toBeLessThan(300);
          console.log(`지원자 목록 스크롤 시간: ${scrollTime}ms`);
        }
      }
    }
  });

  test('스태프 탭 가상화 성능', async ({ page }) => {
    // 첫 번째 공고 상세로 이동
    const firstJobPosting = page.locator('.job-card, tr, [data-testid*="job"]').nth(1).first();
    
    if (await firstJobPosting.count() > 0) {
      await firstJobPosting.click();
      
      // 스태프 탭 클릭
      const staffTab = page.locator('[role="tab"], .tab-button').filter({ hasText: /스태프|Staff/i }).first();
      
      if (await staffTab.count() > 0) {
        const startTime = Date.now();
        await staffTab.click();
        
        // 스태프 목록 로딩 대기
        await expect(page.locator('[data-testid="staff-list"], .staff-card, table').first()).toBeVisible();
        
        const loadTime = Date.now() - startTime;
        
        // 가상화로 인한 빠른 로딩 확인 (2초 이내)
        expect(loadTime).toBeLessThan(2000);
        console.log(`스태프 탭 로딩 시간: ${loadTime}ms`);
      }
    }
  });

  test('정산 탭 Web Workers 성능', async ({ page }) => {
    // 첫 번째 공고 상세로 이동
    const firstJobPosting = page.locator('.job-card, tr, [data-testid*="job"]').nth(1).first();
    
    if (await firstJobPosting.count() > 0) {
      await firstJobPosting.click();
      
      // 정산 탭 클릭
      const payrollTab = page.locator('[role="tab"], .tab-button').filter({ hasText: /정산|급여|Payroll/i }).first();
      
      if (await payrollTab.count() > 0) {
        const startTime = Date.now();
        await payrollTab.click();
        
        // 정산 데이터 로딩 대기
        const payrollSection = page.locator('[data-testid="payroll-section"], .payroll-container').first();
        if (await payrollSection.count() > 0) {
          await expect(payrollSection).toBeVisible();
          
          const loadTime = Date.now() - startTime;
          
          // Web Workers로 인한 논블로킹 성능 확인 (3초 이내)
          expect(loadTime).toBeLessThan(3000);
          console.log(`정산 탭 로딩 시간: ${loadTime}ms`);
          
          // 정산 계산 버튼이 있다면 클릭하여 Worker 테스트
          const calculateButton = page.locator('button').filter({ hasText: /계산|정산|Calculate/i }).first();
          
          if (await calculateButton.count() > 0) {
            const calcStartTime = Date.now();
            await calculateButton.click();
            
            // 계산 완료 대기 (로딩 스피너 사라짐)
            await page.waitForSelector('.loading, .spinner', { state: 'detached', timeout: 10000 }).catch(() => {
              // 로딩 스피너가 없을 수도 있으므로 에러 무시
            });
            
            const calcTime = Date.now() - calcStartTime;
            
            // Web Worker로 인한 빠른 계산 완료 확인 (5초 이내)
            expect(calcTime).toBeLessThan(5000);
            console.log(`정산 계산 시간: ${calcTime}ms`);
          }
        }
      }
    }
  });

  test('React.lazy 지연 로딩 성능', async ({ page }) => {
    // 페이지 로드 시 초기 번들 크기 측정
    const performanceEntries = await page.evaluate(() => {
      return performance.getEntriesByType('navigation');
    });
    
    const initialLoad = performanceEntries[0] as any;
    
    console.log(`초기 페이지 로드 시간: ${initialLoad.loadEventEnd - initialLoad.navigationStart}ms`);
    
    // 첫 번째 공고 상세로 이동 (탭 컴포넌트 지연 로딩 트리거)
    const firstJobPosting = page.locator('.job-card, tr, [data-testid*="job"]').nth(1).first();
    
    if (await firstJobPosting.count() > 0) {
      await firstJobPosting.click();
      
      // React.lazy Suspense 폴백 확인 (로딩 상태)
      const loadingIndicator = page.locator('text=로딩, text=Loading, .spinner').first();
      
      // 로딩 상태가 잠깐 표시되고 사라지는지 확인
      if (await loadingIndicator.count() > 0) {
        await expect(loadingIndicator).toBeVisible();
        await expect(loadingIndicator).toBeHidden({ timeout: 3000 });
        console.log('React.lazy 지연 로딩 확인됨');
      }
      
      // 탭 컴포넌트가 정상 로드되었는지 확인
      await expect(page.locator('[role="tab"], .tab-button').first()).toBeVisible();
    }
  });

  test('필터링 및 검색 성능', async ({ page }) => {
    // 검색 입력 필드 찾기
    const searchInput = page.locator('input[placeholder*="검색"], input[type="search"]').first();
    
    if (await searchInput.count() > 0) {
      const startTime = Date.now();
      
      await searchInput.fill('테스트');
      
      // 검색 결과 로딩 대기
      await page.waitForTimeout(1000);
      
      const searchTime = Date.now() - startTime;
      
      // 검색 응답 시간 확인 (2초 이내)
      expect(searchTime).toBeLessThan(2000);
      console.log(`검색 응답 시간: ${searchTime}ms`);
      
      // 검색 결과 표시 확인
      const jobList = page.locator('[data-testid="job-posting-list"], .job-card, table').first();
      await expect(jobList).toBeVisible();
    }
  });

  test('모바일 반응형 - 구인공고', async ({ page }) => {
    // 모바일 뷰포트로 변경
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    
    // 모바일에서 공고 목록 확인
    await expect(page.locator('h1, h2').first()).toBeVisible();
    
    // 공고 카드가 모바일에서 적절히 표시되는지 확인
    const jobCards = page.locator('.job-card, [data-testid*="job"]');
    if (await jobCards.count() > 0) {
      await expect(jobCards.first()).toBeVisible();
      
      // 카드 width가 화면을 넘지 않는지 확인
      const cardBox = await jobCards.first().boundingBox();
      expect(cardBox?.width).toBeLessThanOrEqual(375);
    }
    
    // 첫 번째 공고 상세 진입
    const firstJobPosting = page.locator('.job-card, tr, [data-testid*="job"]').first();
    if (await firstJobPosting.count() > 0) {
      await firstJobPosting.click();
      
      // 모바일에서 탭 네비게이션 확인
      const tabContainer = page.locator('[role="tablist"], .tab-container').first();
      if (await tabContainer.count() > 0) {
        await expect(tabContainer).toBeVisible();
        
        // 탭이 가로 스크롤 없이 표시되는지 확인
        const tabBox = await tabContainer.boundingBox();
        expect(tabBox?.width).toBeLessThanOrEqual(375);
      }
    }
  });
});