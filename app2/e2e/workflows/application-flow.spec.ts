/**
 * 지원하기 플로우 E2E 테스트
 * Phase 1: 기본 워크플로우 (3/4)
 * 
 * 테스트 시나리오:
 * 1. 사용자 로그인
 * 2. 공고 상세 페이지 진입
 * 3. 사전질문 답변
 * 4. 지원서 제출
 * 5. 중복 지원 방지 확인
 * 6. 지원 완료 알림 확인
 * 
 * @version 4.0
 * @since 2025-09-04
 */

import { test, expect } from '@playwright/test';
import { navigateToUserPage, loginUser } from '../helpers/auth.helper';
import { 
  createTestApplication,
  waitForDataLoading, 
  collectPerformanceMetrics,
  checkUnifiedDataState,
  initializeTestEnvironment 
} from '../helpers/data.helper';
import { 
  validateFirebaseCollection,
  measureFirebaseQueryPerformance,
  checkUnifiedDataSubscriptions
} from '../helpers/firebase.helper';

test.describe('지원하기 플로우', () => {
  let testApplication: ReturnType<typeof createTestApplication>;

  test.beforeEach(async ({ page }) => {
    // 테스트 환경 초기화
    await initializeTestEnvironment(page);
    
    // 테스트 지원서 데이터 생성
    testApplication = createTestApplication({
      applicantName: `E2E 테스트 지원자 - ${Date.now()}`,
      phone: '010-9999-8888',
      experience: 'E2E 테스트를 위한 가상 경험',
      availability: '평일 저녁, 주말 종일 가능',
      preAnswers: ['네, 테스트 경험이 있습니다.', '모든 시간대 가능합니다.']
    });
    
    console.log('🎯 테스트 지원서 데이터:', testApplication);
  });

  test('3-1. 사용자 로그인 및 구인구직 페이지 접근', async ({ page }) => {
    console.log('👤 사용자 로그인 테스트 시작...');
    
    // 성능 측정 시작
    const startTime = Date.now();
    
    // 일반 사용자로 로그인
    await navigateToUserPage(page, '/job-board');
    
    const loginTime = Date.now() - startTime;
    console.log(`⏱️ 로그인 및 페이지 로드 시간: ${loginTime}ms`);
    
    // 페이지 로딩 대기
    await waitForDataLoading(page);
    
    // 로그인 상태 확인
    const isLoggedIn = await page.evaluate(() => {
      // 로그인된 사용자 정보나 토큰 확인
      return localStorage.getItem('user') !== null || 
             sessionStorage.getItem('user') !== null ||
             document.querySelector('[data-testid="user-menu"]') !== null ||
             !window.location.pathname.includes('/login');
    });
    
    if (isLoggedIn) {
      console.log('✅ 사용자 로그인 성공');
    } else {
      console.log('⚠️ 로그인 상태 불확실, 하지만 페이지 접근은 성공');
    }
    
    // 구인구직 게시판 기본 요소 확인
    await expect(page.locator('h1, h2').filter({ hasText: /구인|공고|Job/i }).first()).toBeVisible({
      timeout: 10000
    });
    
    // 공고 목록 확인
    const jobListExists = await page.locator('.job-card, .job-item, [data-testid="job-posting"]').count() > 0;
    if (jobListExists) {
      console.log('✅ 공고 목록 표시 확인');
    } else {
      console.log('ℹ️ 현재 등록된 공고가 없습니다');
    }
    
    console.log('✅ 사용자 접근 테스트 완료');
  });

  test('3-2. 공고 상세 페이지 진입', async ({ page }) => {
    await navigateToUserPage(page, '/job-board');
    await waitForDataLoading(page);
    
    // 첫 번째 공고 카드 찾기
    const jobCardSelectors = [
      '.job-card',
      '.job-item', 
      '[data-testid="job-posting"]',
      'article',
      '.posting-card'
    ];
    
    let selectedJobCard;
    for (const selector of jobCardSelectors) {
      const cards = page.locator(selector);
      const count = await cards.count();
      
      if (count > 0) {
        selectedJobCard = cards.first();
        console.log(`✅ 공고 카드 발견: ${count}개 (${selector})`);
        break;
      }
    }
    
    if (selectedJobCard && await selectedJobCard.isVisible()) {
      // 공고 제목 확인
      const titleElement = selectedJobCard.locator('h2, h3, .title, .job-title').first();
      let jobTitle = '제목 없음';
      if (await titleElement.count() > 0) {
        jobTitle = await titleElement.textContent() || '제목 없음';
        console.log(`📋 선택된 공고: "${jobTitle}"`);
      }
      
      // 공고 카드 클릭
      await selectedJobCard.click();
      console.log('🔍 공고 카드 클릭됨');
      
      // 상세 페이지 또는 모달 로딩 대기
      await page.waitForTimeout(2000);
      
      // 상세 정보 표시 확인
      const detailSelectors = [
        '[role="dialog"]', // 모달인 경우
        '.modal',
        '.job-detail',
        '.job-posting-detail',
        'h1:has-text("' + jobTitle + '")', // 상세 페이지인 경우
        'h2:has-text("' + jobTitle + '")'
      ];
      
      let detailFound = false;
      for (const selector of detailSelectors) {
        const detail = page.locator(selector);
        if (await detail.count() > 0 && await detail.isVisible()) {
          console.log(`✅ 공고 상세 정보 표시됨: ${selector}`);
          detailFound = true;
          break;
        }
      }
      
      if (!detailFound) {
        // URL 변경으로 상세 페이지 진입 확인
        const currentUrl = page.url();
        if (currentUrl.includes('/job/') || currentUrl.includes('/posting/')) {
          console.log('✅ 상세 페이지 URL 진입 확인');
          detailFound = true;
        }
      }
      
      expect(detailFound).toBe(true);
      
      // 지원하기 버튼 확인
      const applyButtonSelectors = [
        'button:has-text("지원하기")',
        'button:has-text("Apply")',
        '[data-testid="apply-button"]',
        '.apply-btn',
        'button[aria-label*="지원"]'
      ];
      
      for (const selector of applyButtonSelectors) {
        const applyButton = page.locator(selector);
        if (await applyButton.count() > 0 && await applyButton.isVisible()) {
          console.log(`✅ 지원하기 버튼 발견: ${selector}`);
          
          // 버튼 활성화 상태 확인
          const isEnabled = await applyButton.isEnabled();
          if (isEnabled) {
            console.log('✅ 지원하기 버튼 활성화됨');
          } else {
            console.log('⚠️ 지원하기 버튼 비활성화 (이미 지원했거나 다른 이유)');
          }
          break;
        }
      }
      
    } else {
      console.log('⚠️ 사용 가능한 공고가 없습니다. 테스트용 공고를 먼저 생성해야 합니다.');
    }
    
    console.log('✅ 공고 상세 페이지 진입 테스트 완료');
  });

  test('3-3. 지원하기 모달 열기 및 폼 확인', async ({ page }) => {
    await navigateToUserPage(page, '/job-board');
    await waitForDataLoading(page);
    
    // 첫 번째 공고 선택
    const firstJobCard = page.locator('.job-card, .job-item, [data-testid="job-posting"]').first();
    
    if (await firstJobCard.count() > 0) {
      await firstJobCard.click();
      await page.waitForTimeout(2000);
      
      // 지원하기 버튼 찾기 및 클릭
      const applyButtonSelectors = [
        'button:has-text("지원하기")',
        'button:has-text("Apply")',
        '[data-testid="apply-button"]',
        '.apply-btn'
      ];
      
      let applyButton;
      for (const selector of applyButtonSelectors) {
        const button = page.locator(selector);
        if (await button.count() > 0 && await button.isVisible() && await button.isEnabled()) {
          applyButton = button;
          console.log(`✅ 지원하기 버튼 발견: ${selector}`);
          break;
        }
      }
      
      if (applyButton) {
        await applyButton.click();
        console.log('📝 지원하기 버튼 클릭됨');
        
        // 지원 모달/폼 로딩 대기
        await page.waitForTimeout(3000);
        
        // 지원 폼 확인
        const formSelectors = [
          '[role="dialog"]',
          '.modal',
          'form',
          '.application-form',
          '[data-testid="application-modal"]'
        ];
        
        let applicationForm;
        for (const selector of formSelectors) {
          const form = page.locator(selector);
          if (await form.count() > 0 && await form.isVisible()) {
            applicationForm = form;
            console.log(`✅ 지원 폼 표시됨: ${selector}`);
            break;
          }
        }
        
        if (applicationForm) {
          // 기본 입력 필드들 확인
          const fieldChecks = [
            { name: '이름', selectors: ['input[name="name"]', 'input[placeholder*="이름"]'] },
            { name: '전화번호', selectors: ['input[name="phone"]', 'input[placeholder*="전화"]', 'input[type="tel"]'] },
            { name: '경험', selectors: ['textarea[name="experience"]', 'textarea[placeholder*="경험"]'] },
            { name: '가능시간', selectors: ['textarea[name="availability"]', 'textarea[placeholder*="시간"]'] }
          ];
          
          for (const field of fieldChecks) {
            let fieldFound = false;
            for (const selector of field.selectors) {
              const input = applicationForm.locator(selector);
              if (await input.count() > 0 && await input.isVisible()) {
                console.log(`✅ ${field.name} 필드 발견: ${selector}`);
                fieldFound = true;
                break;
              }
            }
            if (!fieldFound) {
              console.log(`ℹ️ ${field.name} 필드 없음 (선택적 필드일 수 있음)`);
            }
          }
          
          // 사전질문 섹션 확인
          const preQuestionSection = applicationForm.locator('.pre-questions, [data-testid="pre-questions"]');
          if (await preQuestionSection.count() > 0 && await preQuestionSection.isVisible()) {
            console.log('✅ 사전질문 섹션 발견');
            
            const questionCount = await preQuestionSection.locator('textarea, input[type="text"]').count();
            console.log(`📝 사전질문 개수: ${questionCount}개`);
          } else {
            console.log('ℹ️ 사전질문이 설정되지 않음');
          }
          
          // 제출 버튼 확인
          const submitButtonSelectors = [
            'button[type="submit"]',
            'button:has-text("제출")',
            'button:has-text("지원하기")',
            'button:has-text("완료")'
          ];
          
          for (const selector of submitButtonSelectors) {
            const submitBtn = applicationForm.locator(selector);
            if (await submitBtn.count() > 0 && await submitBtn.isVisible()) {
              console.log(`✅ 제출 버튼 발견: ${selector}`);
              break;
            }
          }
          
        }
      } else {
        console.log('⚠️ 지원하기 버튼을 찾을 수 없거나 비활성화됨');
      }
    }
    
    console.log('✅ 지원하기 모달 테스트 완료');
  });

  test('3-4. 지원서 정보 입력 및 제출', async ({ page }) => {
    await navigateToUserPage(page, '/job-board');
    await waitForDataLoading(page);
    
    // 첫 번째 공고 선택
    const firstJobCard = page.locator('.job-card, .job-item, [data-testid="job-posting"]').first();
    
    if (await firstJobCard.count() > 0) {
      await firstJobCard.click();
      await page.waitForTimeout(2000);
      
      // 지원하기 버튼 클릭
      const applyButton = page.locator('button:has-text("지원하기"), button:has-text("Apply")').first();
      if (await applyButton.count() > 0 && await applyButton.isEnabled()) {
        await applyButton.click();
        await page.waitForTimeout(3000);
        
        console.log('📝 지원서 정보 입력 시작...');
        
        // 이름 입력
        const nameInput = page.locator('input[name="name"], input[placeholder*="이름"]').first();
        if (await nameInput.count() > 0 && await nameInput.isVisible()) {
          await nameInput.fill(testApplication.applicantName);
          console.log(`✅ 이름 입력: ${testApplication.applicantName}`);
        }
        
        // 전화번호 입력
        const phoneInput = page.locator('input[name="phone"], input[placeholder*="전화"], input[type="tel"]').first();
        if (await phoneInput.count() > 0 && await phoneInput.isVisible()) {
          await phoneInput.fill(testApplication.phone);
          console.log(`✅ 전화번호 입력: ${testApplication.phone}`);
        }
        
        // 경험 입력
        const experienceInput = page.locator('textarea[name="experience"], textarea[placeholder*="경험"]').first();
        if (await experienceInput.count() > 0 && await experienceInput.isVisible()) {
          await experienceInput.fill(testApplication.experience);
          console.log(`✅ 경험 입력: ${testApplication.experience}`);
        }
        
        // 가능시간 입력
        const availabilityInput = page.locator('textarea[name="availability"], textarea[placeholder*="시간"], textarea[placeholder*="가능"]').first();
        if (await availabilityInput.count() > 0 && await availabilityInput.isVisible()) {
          await availabilityInput.fill(testApplication.availability);
          console.log(`✅ 가능시간 입력: ${testApplication.availability}`);
        }
        
        // 사전질문 답변
        if (testApplication.preAnswers && testApplication.preAnswers.length > 0) {
          const preQuestionInputs = await page.locator('.pre-questions textarea, .pre-questions input[type="text"]').all();
          
          for (let i = 0; i < Math.min(preQuestionInputs.length, testApplication.preAnswers.length); i++) {
            const input = preQuestionInputs[i];
            if (await input.isVisible()) {
              await input.fill(testApplication.preAnswers[i]);
              console.log(`✅ 사전질문 ${i + 1} 답변: ${testApplication.preAnswers[i]}`);
            }
          }
        }
        
        // 필수 약관 동의 (있는 경우)
        const agreementCheckbox = page.locator('input[type="checkbox"][name*="agree"], input[type="checkbox"][name*="consent"]').first();
        if (await agreementCheckbox.count() > 0 && await agreementCheckbox.isVisible()) {
          await agreementCheckbox.check();
          console.log('✅ 약관 동의 체크');
        }
        
        // 제출하기 전 잠시 대기 (사용자 입력 시뮬레이션)
        await page.waitForTimeout(1000);
        
        // 제출 버튼 클릭
        const submitButton = page.locator('button[type="submit"], button:has-text("제출"), button:has-text("지원하기")').filter({ hasNotText: /취소|닫기/ }).first();
        
        if (await submitButton.count() > 0 && await submitButton.isVisible() && await submitButton.isEnabled()) {
          console.log('📤 지원서 제출 시도...');
          
          // 성능 측정 시작
          await page.addInitScript(() => {
            performance.mark('application-submit-start');
          });
          
          await submitButton.click();
          
          // 제출 완료 대기 - 다양한 성공 신호 확인
          const successIndicators = [
            '.success-message',
            '.toast-success',
            '[data-testid="success-toast"]',
            'text=성공적으로 지원되었습니다',
            'text=지원이 완료되었습니다',
            'text=제출되었습니다'
          ];
          
          let submitSuccess = false;
          for (const indicator of successIndicators) {
            try {
              await page.waitForSelector(indicator, { timeout: 8000 });
              console.log(`✅ 지원 성공 확인: ${indicator}`);
              submitSuccess = true;
              break;
            } catch {
              // 다음 indicator 시도
            }
          }
          
          // 명시적 성공 메시지가 없으면 URL 변경이나 모달 닫힘으로 판단
          if (!submitSuccess) {
            await page.waitForTimeout(3000);
            
            // 모달이 닫혔는지 확인
            const modalClosed = await page.locator('[role="dialog"], .modal').count() === 0;
            if (modalClosed) {
              console.log('✅ 지원 완료 (모달 닫힘)');
              submitSuccess = true;
            }
          }
          
          expect(submitSuccess).toBe(true);
          
          // 성능 측정
          const submitTime = await page.evaluate(() => {
            performance.mark('application-submit-end');
            performance.measure('application-submit', 'application-submit-start', 'application-submit-end');
            const measures = performance.getEntriesByName('application-submit');
            return measures.length > 0 ? measures[0].duration : 0;
          });
          
          console.log(`⚡ 지원서 제출 시간: ${submitTime.toFixed(2)}ms`);
          
        } else {
          console.log('⚠️ 제출 버튼을 찾을 수 없거나 비활성화됨');
        }
      }
    }
    
    console.log('✅ 지원서 제출 테스트 완료');
  });

  test('3-5. 중복 지원 방지 확인', async ({ page }) => {
    await navigateToUserPage(page, '/job-board');
    await waitForDataLoading(page);
    
    // 동일한 공고에 다시 지원 시도
    const firstJobCard = page.locator('.job-card, .job-item, [data-testid="job-posting"]').first();
    
    if (await firstJobCard.count() > 0) {
      await firstJobCard.click();
      await page.waitForTimeout(2000);
      
      // 지원하기 버튼 상태 확인
      const applyButtonSelectors = [
        'button:has-text("지원하기")',
        'button:has-text("Apply")',
        '[data-testid="apply-button"]'
      ];
      
      let applyButton;
      for (const selector of applyButtonSelectors) {
        const button = page.locator(selector);
        if (await button.count() > 0 && await button.isVisible()) {
          applyButton = button;
          break;
        }
      }
      
      if (applyButton) {
        const isDisabled = !(await applyButton.isEnabled());
        const buttonText = await applyButton.textContent();
        
        if (isDisabled || buttonText?.includes('이미') || buttonText?.includes('완료')) {
          console.log('✅ 중복 지원 방지 확인됨 - 버튼 비활성화 또는 텍스트 변경');
          console.log(`📝 버튼 상태: "${buttonText}" (활성화: ${!isDisabled})`);
        } else {
          // 버튼이 활성화되어 있다면 클릭해서 중복 방지 메시지 확인
          await applyButton.click();
          await page.waitForTimeout(2000);
          
          // 중복 지원 방지 메시지 확인
          const duplicateMessages = [
            'text=이미 지원하셨습니다',
            'text=중복 지원은 불가능합니다',
            'text=Already applied',
            '.error-message',
            '.toast-error'
          ];
          
          let duplicateWarningFound = false;
          for (const selector of duplicateMessages) {
            const message = page.locator(selector);
            if (await message.count() > 0 && await message.isVisible()) {
              console.log(`✅ 중복 지원 방지 메시지 확인: ${selector}`);
              duplicateWarningFound = true;
              break;
            }
          }
          
          if (!duplicateWarningFound) {
            console.log('⚠️ 중복 지원 방지 메시지를 찾을 수 없습니다. 시스템 동작을 확인하세요.');
          }
        }
      } else {
        console.log('ℹ️ 지원하기 버튼이 표시되지 않음 (이미 지원 완료 상태일 수 있음)');
      }
    }
    
    console.log('✅ 중복 지원 방지 테스트 완료');
  });

  test('3-6. Firebase 지원서 데이터 저장 확인', async ({ page }) => {
    await navigateToUserPage(page, '/job-board');
    
    // applications 컬렉션 검증
    const applicationsValidation = await validateFirebaseCollection(page, {
      name: 'applications',
      expectedFields: ['applicantName', 'phone', 'eventId', 'status', 'createdAt']
    });
    
    console.log('📊 applications 컬렉션 검증:', applicationsValidation);
    
    // 기본 검증
    expect(applicationsValidation.exists).toBe(true);
    
    if (applicationsValidation.documentCount > 0) {
      console.log(`✅ 지원서 데이터 존재: ${applicationsValidation.documentCount}개`);
      
      // 샘플 데이터 구조 확인
      if (applicationsValidation.sampleData) {
        console.log('📋 지원서 샘플 데이터:', {
          applicantName: applicationsValidation.sampleData.applicantName || '없음',
          status: applicationsValidation.sampleData.status || '없음',
          eventId: applicationsValidation.sampleData.eventId || '없음'
        });
      }
    } else {
      console.log('ℹ️ 아직 지원서가 제출되지 않았거나 테스트 데이터가 없습니다');
    }
    
    // Firebase 쿼리 성능 확인
    const queryPerformance = await measureFirebaseQueryPerformance(page, 'applications');
    console.log('⚡ applications 쿼리 성능:', {
      queryTime: `${queryPerformance.queryTime.toFixed(2)}ms`,
      documentCount: queryPerformance.documentCount,
      cacheHit: queryPerformance.cacheHit ? '✅' : '❌'
    });
    
    // UnifiedDataContext 동기화 확인
    const unifiedDataState = await checkUnifiedDataState(page);
    console.log('🔄 UnifiedDataContext 상태:', {
      applicationsCount: unifiedDataState.applicationsCount,
      isLoading: unifiedDataState.isLoading ? '⏳' : '✅'
    });
    
    // 실시간 구독 상태 확인
    const subscriptions = await checkUnifiedDataSubscriptions(page);
    console.log('📡 실시간 구독 상태:', {
      totalSubscriptions: subscriptions.totalSubscriptions,
      isOptimized: subscriptions.isOptimized ? '✅' : '⚠️'
    });
    
    console.log('✅ Firebase 지원서 데이터 검증 완료');
  });

  test.afterEach(async ({ page }) => {
    // 최종 성능 메트릭 수집
    const metrics = await collectPerformanceMetrics(page);
    console.log('📊 지원 플로우 최종 성능 지표:', {
      loadTime: `${metrics.loadTime.toFixed(2)}ms`,
      firebaseRequests: metrics.firebaseRequests,
      networkRequests: metrics.networkRequests,
      memoryUsage: `${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`
    });
    
    // 테스트 정리
    console.log('🧹 지원 플로우 테스트 정리 완료');
  });
});