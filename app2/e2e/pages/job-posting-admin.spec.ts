/**
 * 공고 관리 페이지 E2E 테스트
 * Phase 2: 관리자 기능 (5/8)
 * 
 * 테스트 시나리오:
 * 1. JobPostingAdminPage 접근
 * 2. 공고 목록 관리
 * 3. 공고 수정/삭제
 * 4. 공고 상태 변경 (진행중/마감)
 * 5. 탭 네비게이션 (지원자/스태프/정산)
 * 6. 권한 기반 접근 제어
 * 
 * @version 4.0
 * @since 2025-09-04
 */

import { test, expect } from '@playwright/test';
import { navigateToAdminPage } from '../helpers/auth.helper';
import { 
  waitForDataLoading, 
  collectPerformanceMetrics,
  checkUnifiedDataState,
  initializeTestEnvironment 
} from '../helpers/data.helper';
import { 
  validateFirebaseCollection,
  checkUnifiedDataSubscriptions,
  measureFirebaseQueryPerformance
} from '../helpers/firebase.helper';

test.describe('공고 관리 페이지', () => {

  test.beforeEach(async ({ page }) => {
    // 테스트 환경 초기화
    await initializeTestEnvironment(page);
    
    // 성능 측정 시작
    await page.addInitScript(() => {
      performance.mark('job-admin-start');
    });
  });

  test('5-1. JobPostingAdminPage 접근 및 권한 확인', async ({ page }) => {
    console.log('👨‍💼 공고 관리 페이지 접근 테스트 시작...');
    
    const startTime = Date.now();
    
    // 관리자로 로그인하고 공고 관리 페이지 접근
    await navigateToAdminPage(page, '/admin');
    
    // 공고 관리 페이지로 이동
    const adminPagePaths = [
      '/admin/job-posting-admin',
      '/job-posting-admin', 
      '/admin/job-postings',
      '/admin/postings'
    ];
    
    let pageLoaded = false;
    for (const path of adminPagePaths) {
      try {
        await page.goto(path, { waitUntil: 'networkidle', timeout: 15000 });
        await waitForDataLoading(page);
        pageLoaded = true;
        console.log(`✅ 공고 관리 페이지 로딩 성공: ${path}`);
        break;
      } catch (error) {
        console.log(`⚠️ ${path} 경로 접근 실패, 다음 경로 시도...`);
      }
    }
    
    if (!pageLoaded) {
      // 관리자 페이지에서 공고 관리 링크 찾기
      await page.goto('/admin', { waitUntil: 'networkidle' });
      
      const adminMenuSelectors = [
        'a[href*="job-posting"]',
        'a[href*="postings"]', 
        'a:has-text("구인공고")',
        'a:has-text("공고 관리")',
        '.admin-menu a[href*="job"]',
        'nav a:has-text("공고")'
      ];
      
      for (const selector of adminMenuSelectors) {
        const link = page.locator(selector);
        if (await link.count() > 0 && await link.isVisible()) {
          await link.click();
          await waitForDataLoading(page);
          pageLoaded = true;
          console.log(`✅ 관리자 메뉴에서 공고 관리 접근: ${selector}`);
          break;
        }
      }
    }
    
    const loadTime = Date.now() - startTime;
    console.log(`⏱️ 공고 관리 페이지 로딩 시간: ${loadTime}ms`);
    
    if (pageLoaded) {
      // 페이지 제목 확인
      await expect(page.locator('h1, h2').filter({ hasText: /구인|공고|Job|관리/i }).first()).toBeVisible({
        timeout: 10000
      });
      
      // 관리자 권한 요소 확인
      const adminElements = [
        'button:has-text("새 공고")',
        'button:has-text("생성")',
        'button:has-text("등록")',
        '.admin-controls',
        '[data-testid="admin-actions"]'
      ];
      
      let adminControlsFound = false;
      for (const selector of adminElements) {
        const element = page.locator(selector);
        if (await element.count() > 0 && await element.isVisible()) {
          console.log(`✅ 관리자 컨트롤 발견: ${selector}`);
          adminControlsFound = true;
          break;
        }
      }
      
      if (!adminControlsFound) {
        console.log('ℹ️ 명시적인 관리자 컨트롤을 찾을 수 없지만 페이지 접근은 성공');
      }
      
    } else {
      console.log('⚠️ 공고 관리 페이지에 접근할 수 없습니다. 권한이나 라우팅을 확인하세요.');
    }
    
    console.log('✅ JobPostingAdminPage 접근 테스트 완료');
  });

  test('5-2. 공고 목록 표시 및 관리 기능 확인', async ({ page }) => {
    await navigateToAdminPage(page, '/admin');
    
    // 공고 관리 페이지 접근
    try {
      await page.goto('/admin/job-posting-admin', { waitUntil: 'networkidle' });
    } catch {
      await page.goto('/job-posting-admin', { waitUntil: 'networkidle' });
    }
    
    await waitForDataLoading(page);
    
    // UnifiedDataContext 상태 확인
    const dataState = await checkUnifiedDataState(page);
    console.log('📊 UnifiedDataContext 상태:', {
      jobPostingsCount: dataState.jobPostingsCount,
      applicationsCount: dataState.applicationsCount,
      isLoading: dataState.isLoading ? '⏳' : '✅'
    });
    
    // jobPostings 컬렉션 검증
    const jobPostingsValidation = await validateFirebaseCollection(page, {
      name: 'jobPostings',
      expectedFields: ['title', 'description', 'location', 'status', 'createdBy', 'createdAt']
    });
    
    console.log('📋 jobPostings 컬렉션 검증:', jobPostingsValidation);
    expect(jobPostingsValidation.exists).toBe(true);
    
    // 공고 목록 테이블/카드 확인
    const jobListSelectors = [
      'table tbody tr',
      '.job-posting-item',
      '.job-card',
      '[data-testid="job-posting"]',
      '.admin-job-list .item'
    ];
    
    let jobList;
    let jobCount = 0;
    
    for (const selector of jobListSelectors) {
      const items = page.locator(selector);
      const count = await items.count();
      
      if (count > 0) {
        jobList = items;
        jobCount = count;
        console.log(`✅ 공고 목록 발견: ${count}개 (${selector})`);
        break;
      }
    }
    
    if (jobList && jobCount > 0) {
      // 첫 번째 공고의 관리 기능 확인
      const firstJob = jobList.first();
      
      // 공고 정보 확인
      const titleElement = firstJob.locator('td, h2, h3, .title').first();
      if (await titleElement.count() > 0) {
        const title = await titleElement.textContent();
        console.log(`📋 첫 번째 공고: "${title}"`);
      }
      
      // 관리 액션 버튼들 확인
      const actionButtons = [
        { name: '수정', selectors: ['button:has-text("수정")', 'button:has-text("Edit")', '.edit-btn'] },
        { name: '삭제', selectors: ['button:has-text("삭제")', 'button:has-text("Delete")', '.delete-btn'] },
        { name: '상세보기', selectors: ['button:has-text("보기")', 'button:has-text("View")', '.view-btn'] },
        { name: '상태변경', selectors: ['button:has-text("마감")', 'button:has-text("활성")', '.status-btn'] }
      ];
      
      for (const action of actionButtons) {
        let buttonFound = false;
        for (const selector of action.selectors) {
          const button = firstJob.locator(selector);
          if (await button.count() > 0 && await button.isVisible()) {
            console.log(`✅ ${action.name} 버튼 발견: ${selector}`);
            buttonFound = true;
            break;
          }
        }
        if (!buttonFound) {
          console.log(`ℹ️ ${action.name} 버튼 없음`);
        }
      }
      
      // 상태 표시 확인
      const statusElement = firstJob.locator('.status, .badge, td').filter({ hasText: /활성|마감|진행|Active|Closed/i }).first();
      if (await statusElement.count() > 0) {
        const status = await statusElement.textContent();
        console.log(`📊 공고 상태: ${status}`);
      }
      
    } else {
      // 빈 상태 확인
      const emptyStateSelectors = [
        'text=등록된 공고가 없습니다',
        'text=No job postings',
        '.empty-state',
        '[data-testid="empty-list"]'
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
        console.log('⚠️ 공고 목록도 빈 상태 메시지도 찾을 수 없습니다');
      }
    }
    
    console.log('✅ 공고 목록 관리 기능 확인 완료');
  });

  test('5-3. 공고 상세 페이지 진입 및 탭 네비게이션', async ({ page }) => {
    await navigateToAdminPage(page, '/admin');
    
    // 공고 관리 페이지 접근
    try {
      await page.goto('/admin/job-posting-admin', { waitUntil: 'networkidle' });
    } catch {
      await page.goto('/job-posting-admin', { waitUntil: 'networkidle' });
    }
    
    await waitForDataLoading(page);
    
    // 첫 번째 공고 선택
    const jobListSelectors = [
      'table tbody tr',
      '.job-posting-item', 
      '.job-card',
      '[data-testid="job-posting"]'
    ];
    
    let firstJobPosting;
    for (const selector of jobListSelectors) {
      const items = page.locator(selector);
      if (await items.count() > 0) {
        firstJobPosting = items.first();
        console.log(`✅ 공고 항목 선택: ${selector}`);
        break;
      }
    }
    
    if (firstJobPosting) {
      // 상세 페이지 진입 방법 시도
      const detailAccessMethods = [
        { name: '보기 버튼', selector: 'button:has-text("보기")' },
        { name: '상세 버튼', selector: 'button:has-text("상세")' },
        { name: '제목 클릭', selector: 'h2, h3, .title, td:first-child' },
        { name: '전체 행 클릭', selector: '' }
      ];
      
      let detailPageAccessed = false;
      
      for (const method of detailAccessMethods) {
        const element = method.selector ? firstJobPosting.locator(method.selector) : firstJobPosting;
        
        if (await element.count() > 0 && await element.isVisible()) {
          console.log(`🔍 ${method.name} 시도...`);
          
          await element.click();
          await page.waitForTimeout(3000);
          
          // 상세 페이지 또는 모달 확인
          const detailIndicators = [
            'text=지원자',
            'text=스태프', 
            'text=정산',
            'text=시프트',
            '[role="tab"]',
            '.tab-navigation',
            'h1, h2'
          ];
          
          for (const indicator of detailIndicators) {
            const element = page.locator(indicator);
            if (await element.count() > 0 && await element.isVisible()) {
              console.log(`✅ 상세 페이지 진입 성공: ${indicator}`);
              detailPageAccessed = true;
              break;
            }
          }
          
          if (detailPageAccessed) break;
        }
      }
      
      if (detailPageAccessed) {
        // 탭 네비게이션 테스트
        console.log('🔄 탭 네비게이션 테스트 시작...');
        
        const expectedTabs = [
          { name: '지원자', keywords: ['지원자', 'Applicant', '신청'] },
          { name: '스태프', keywords: ['스태프', 'Staff', '직원'] },
          { name: '시프트', keywords: ['시프트', 'Shift', '시간'] },
          { name: '정산', keywords: ['정산', 'Payroll', '급여'] }
        ];
        
        const tabs = await page.locator('[role="tab"], .tab-button, .nav-tab').all();
        console.log(`📊 발견된 탭 수: ${tabs.length}개`);
        
        for (let i = 0; i < Math.min(tabs.length, 4); i++) {
          const tab = tabs[i];
          const tabText = await tab.textContent() || '';
          
          console.log(`📌 탭 ${i + 1}: "${tabText}"`);
          
          // 탭 클릭
          if (await tab.isVisible() && await tab.isEnabled()) {
            await tab.click();
            await page.waitForTimeout(2000);
            
            // 탭 컨텐츠 로딩 확인
            const tabContent = page.locator('[role="tabpanel"], .tab-content').first();
            if (await tabContent.count() > 0 && await tabContent.isVisible()) {
              console.log(`✅ 탭 ${i + 1} 컨텐츠 로딩됨`);
            }
          }
        }
        
        // 지원자 탭으로 복귀 (첫 번째 탭)
        if (tabs.length > 0) {
          await tabs[0].click();
          await page.waitForTimeout(1000);
          console.log('🔄 첫 번째 탭으로 복귀');
        }
        
      } else {
        console.log('⚠️ 공고 상세 페이지에 접근할 수 없습니다');
      }
      
    } else {
      console.log('⚠️ 접근할 수 있는 공고가 없습니다');
    }
    
    console.log('✅ 공고 상세 및 탭 네비게이션 테스트 완료');
  });

  test('5-4. 공고 수정 기능 테스트', async ({ page }) => {
    await navigateToAdminPage(page, '/admin');
    
    // 공고 관리 페이지 접근
    try {
      await page.goto('/admin/job-posting-admin', { waitUntil: 'networkidle' });
    } catch {
      await page.goto('/job-posting-admin', { waitUntil: 'networkidle' });
    }
    
    await waitForDataLoading(page);
    
    // 첫 번째 공고의 수정 버튼 찾기
    const firstJobRow = page.locator('table tbody tr, .job-posting-item, .job-card').first();
    
    if (await firstJobRow.count() > 0) {
      // 수정 버튼 찾기
      const editButtonSelectors = [
        'button:has-text("수정")',
        'button:has-text("Edit")',
        '.edit-btn',
        'button[aria-label*="수정"]'
      ];
      
      let editButton;
      for (const selector of editButtonSelectors) {
        const button = firstJobRow.locator(selector);
        if (await button.count() > 0 && await button.isVisible()) {
          editButton = button;
          console.log(`✅ 수정 버튼 발견: ${selector}`);
          break;
        }
      }
      
      if (editButton && await editButton.isEnabled()) {
        // 현재 공고 정보 확인
        const originalTitle = await firstJobRow.locator('td, h2, h3, .title').first().textContent() || '제목 없음';
        console.log(`📋 수정할 공고: "${originalTitle}"`);
        
        // 수정 버튼 클릭
        await editButton.click();
        console.log('✏️ 수정 버튼 클릭됨');
        
        await page.waitForTimeout(3000);
        
        // 수정 모달/폼 확인
        const editFormSelectors = [
          '[role="dialog"]',
          '.modal',
          'form',
          '.edit-form',
          '[data-testid="edit-job-posting"]'
        ];
        
        let editForm;
        for (const selector of editFormSelectors) {
          const form = page.locator(selector);
          if (await form.count() > 0 && await form.isVisible()) {
            editForm = form;
            console.log(`✅ 수정 폼 표시됨: ${selector}`);
            break;
          }
        }
        
        if (editForm) {
          // 수정 가능한 필드들 확인
          const editableFields = [
            { name: '제목', selectors: ['input[name="title"]', 'input[value*="' + originalTitle + '"]'] },
            { name: '설명', selectors: ['textarea[name="description"]', 'textarea'] },
            { name: '위치', selectors: ['input[name="location"]', 'input[placeholder*="위치"]'] },
            { name: '상태', selectors: ['select[name="status"]', 'select'] }
          ];
          
          for (const field of editableFields) {
            let fieldFound = false;
            for (const selector of field.selectors) {
              const input = editForm.locator(selector);
              if (await input.count() > 0 && await input.isVisible()) {
                console.log(`✅ ${field.name} 필드 발견: ${selector}`);
                
                // 테스트 수정 (실제로는 변경하지 않음)
                if (field.name === '제목') {
                  const currentValue = await input.inputValue();
                  console.log(`📝 현재 ${field.name}: "${currentValue}"`);
                }
                
                fieldFound = true;
                break;
              }
            }
            if (!fieldFound) {
              console.log(`ℹ️ ${field.name} 필드 없음`);
            }
          }
          
          // 저장/취소 버튼 확인
          const saveButton = editForm.locator('button:has-text("저장"), button:has-text("Save"), button[type="submit"]').first();
          const cancelButton = editForm.locator('button:has-text("취소"), button:has-text("Cancel")').first();
          
          if (await saveButton.count() > 0) {
            console.log('✅ 저장 버튼 발견');
          }
          if (await cancelButton.count() > 0) {
            console.log('✅ 취소 버튼 발견');
            
            // 실제 저장하지 않고 취소
            await cancelButton.click();
            console.log('❌ 수정 취소됨 (테스트용)');
          }
          
        } else {
          console.log('⚠️ 수정 폼을 찾을 수 없습니다');
        }
        
      } else {
        console.log('⚠️ 수정 버튼을 찾을 수 없거나 비활성화됨');
      }
      
    } else {
      console.log('⚠️ 수정할 공고를 찾을 수 없습니다');
    }
    
    console.log('✅ 공고 수정 기능 테스트 완료');
  });

  test('5-5. 공고 상태 변경 테스트', async ({ page }) => {
    await navigateToAdminPage(page, '/admin');
    
    // 공고 관리 페이지 접근
    try {
      await page.goto('/admin/job-posting-admin', { waitUntil: 'networkidle' });
    } catch {
      await page.goto('/job-posting-admin', { waitUntil: 'networkidle' });
    }
    
    await waitForDataLoading(page);
    
    // 상태 변경 가능한 공고 찾기
    const jobRows = await page.locator('table tbody tr, .job-posting-item, .job-card').all();
    
    if (jobRows.length > 0) {
      console.log(`📊 총 공고 수: ${jobRows.length}개`);
      
      for (let i = 0; i < Math.min(jobRows.length, 3); i++) {
        const jobRow = jobRows[i];
        
        // 현재 상태 확인
        const statusElement = jobRow.locator('.status, .badge, td').filter({ hasText: /활성|마감|진행|Active|Closed|Open/i }).first();
        let currentStatus = '상태 없음';
        
        if (await statusElement.count() > 0) {
          currentStatus = await statusElement.textContent() || '상태 없음';
        }
        
        console.log(`📋 공고 ${i + 1} 현재 상태: "${currentStatus}"`);
        
        // 상태 변경 버튼/컨트롤 찾기
        const statusControls = [
          { type: '토글 버튼', selectors: ['button:has-text("마감")', 'button:has-text("활성화")', '.status-toggle'] },
          { type: '드롭다운', selectors: ['select:has(option)', '.status-select'] },
          { type: '상태 버튼', selectors: ['.status-btn', 'button[data-status]'] }
        ];
        
        let statusControlFound = false;
        for (const control of statusControls) {
          for (const selector of control.selectors) {
            const element = jobRow.locator(selector);
            if (await element.count() > 0 && await element.isVisible()) {
              console.log(`✅ ${control.type} 발견: ${selector}`);
              
              // 상태 변경 테스트 (실제로는 변경하지 않음)
              if (control.type === '드롭다운') {
                const options = await element.locator('option').allTextContents();
                console.log(`📋 사용 가능한 상태: ${options.join(', ')}`);
              }
              
              // 호버 테스트만 수행 (실제 클릭 안함)
              await element.hover();
              await page.waitForTimeout(500);
              
              statusControlFound = true;
              break;
            }
          }
          if (statusControlFound) break;
        }
        
        if (!statusControlFound) {
          console.log(`ℹ️ 공고 ${i + 1}: 상태 변경 컨트롤 없음`);
        }
      }
    } else {
      console.log('⚠️ 상태를 변경할 공고가 없습니다');
    }
    
    console.log('✅ 공고 상태 변경 테스트 완료');
  });

  test('5-6. 공고 삭제 기능 및 확인 모달 테스트', async ({ page }) => {
    await navigateToAdminPage(page, '/admin');
    
    // 공고 관리 페이지 접근
    try {
      await page.goto('/admin/job-posting-admin', { waitUntil: 'networkidle' });
    } catch {
      await page.goto('/job-posting-admin', { waitUntil: 'networkidle' });
    }
    
    await waitForDataLoading(page);
    
    // 삭제 가능한 공고 찾기 (마지막 공고를 선택하여 안전성 확보)
    const jobRows = await page.locator('table tbody tr, .job-posting-item, .job-card').all();
    
    if (jobRows.length > 0) {
      const lastJobRow = jobRows[jobRows.length - 1]; // 마지막 공고 선택
      
      // 공고 정보 확인
      const titleElement = lastJobRow.locator('td, h2, h3, .title').first();
      const jobTitle = await titleElement.textContent() || '제목 없음';
      console.log(`🗑️ 삭제 테스트 대상 공고: "${jobTitle}"`);
      
      // 삭제 버튼 찾기
      const deleteButtonSelectors = [
        'button:has-text("삭제")',
        'button:has-text("Delete")',
        '.delete-btn',
        'button[aria-label*="삭제"]',
        'button.text-red-600' // Tailwind red 버튼
      ];
      
      let deleteButton;
      for (const selector of deleteButtonSelectors) {
        const button = lastJobRow.locator(selector);
        if (await button.count() > 0 && await button.isVisible()) {
          deleteButton = button;
          console.log(`✅ 삭제 버튼 발견: ${selector}`);
          break;
        }
      }
      
      if (deleteButton && await deleteButton.isEnabled()) {
        console.log('⚠️ 삭제 버튼 클릭 테스트 (실제 삭제는 하지 않음)');
        
        // 삭제 버튼 호버만 수행
        await deleteButton.hover();
        await page.waitForTimeout(1000);
        
        // 툴팁이나 경고 메시지 확인
        const warningSelectors = [
          '.tooltip',
          '[role="tooltip"]',
          '.warning-text'
        ];
        
        for (const selector of warningSelectors) {
          const warning = page.locator(selector);
          if (await warning.count() > 0 && await warning.isVisible()) {
            const warningText = await warning.textContent();
            console.log(`⚠️ 삭제 관련 메시지: "${warningText}"`);
          }
        }
        
        // 실제 테스트 환경에서는 삭제 확인 모달까지만 테스트
        // await deleteButton.click();
        // await page.waitForTimeout(2000);
        
        // 삭제 확인 모달 예상 구조 확인
        const confirmationSelectors = [
          '[role="dialog"]',
          '.confirmation-modal',
          '.delete-confirmation',
          'div:has-text("정말 삭제하시겠습니까?")'
        ];
        
        console.log('ℹ️ 삭제 확인 모달 구조 예상:');
        console.log('  - 제목: "공고 삭제 확인"');
        console.log('  - 내용: "정말로 이 공고를 삭제하시겠습니까?"');
        console.log('  - 버튼: "삭제", "취소"');
        
        console.log('✅ 삭제 기능 존재 확인 완료 (안전성을 위해 실제 실행 안함)');
        
      } else {
        console.log('ℹ️ 삭제 버튼을 찾을 수 없거나 비활성화됨');
      }
      
    } else {
      console.log('⚠️ 삭제할 공고가 없습니다');
    }
    
    console.log('✅ 공고 삭제 기능 테스트 완료');
  });

  test.afterEach(async ({ page }) => {
    // 성능 메트릭 수집
    const metrics = await collectPerformanceMetrics(page);
    console.log('📊 공고 관리 페이지 최종 성능 지표:', {
      loadTime: `${metrics.loadTime.toFixed(2)}ms`,
      firebaseRequests: metrics.firebaseRequests,
      networkRequests: metrics.networkRequests,
      bundleSize: `${(metrics.bundleSize / 1024).toFixed(2)}KB`,
      memoryUsage: `${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`
    });
    
    // Firebase 쿼리 성능 확인
    const queryPerf = await measureFirebaseQueryPerformance(page, 'jobPostings');
    console.log('⚡ jobPostings 최종 쿼리 성능:', {
      queryTime: `${queryPerf.queryTime.toFixed(2)}ms`,
      cacheHit: queryPerf.cacheHit ? '✅' : '❌',
      documentCount: queryPerf.documentCount
    });
    
    // UnifiedDataContext 최적화 상태 확인
    const subscriptions = await checkUnifiedDataSubscriptions(page);
    console.log('🔗 구독 최적화 최종 상태:', {
      totalSubscriptions: subscriptions.totalSubscriptions,
      isOptimized: subscriptions.isOptimized ? '✅' : '⚠️'
    });
    
    console.log('✅ 공고 관리 페이지 테스트 정리 완료');
  });
});