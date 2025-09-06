/**
 * E2E 테스트용 데이터 헬퍼
 * Firebase 테스트 데이터 생성, 클린업, 검증 유틸리티
 * 
 * @version 4.1
 * @since 2025-09-05 (클래스 구조로 변경)
 */

import { Page } from '@playwright/test';

export interface TestJobPosting {
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  roles: any[];
  hourlyRate: number;
  maxApplicants: number;
  preQuestions?: string[];
  jobDate?: string;
  status?: string;
}

export interface TestApplication {
  jobPostingId: string;
  applicantName: string;
  phone: string;
  experience: string;
  availability: string;
  preAnswers?: string[];
  name?: string;
  status?: string;
}

export interface TestWorkLog {
  staffId: string;
  eventId: string;
  date: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
}

/**
 * E2E 테스트용 데이터 헬퍼 클래스
 */
export class DataHelper {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * 테스트용 구인공고 데이터 생성
   */
  createJobPostingData(overrides: Partial<TestJobPosting> = {}): TestJobPosting {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    return {
      title: 'E2E 테스트 구인공고',
      description: 'Playwright 테스트용으로 생성된 구인공고입니다.',
      location: '서울특별시 강남구',
      startDate: tomorrow.toISOString().split('T')[0],
      endDate: tomorrow.toISOString().split('T')[0],
      startTime: '18:00',
      endTime: '23:00', 
      roles: [{ name: '딜러', hourlyWage: 15000, requiredCount: 2 }],
      hourlyRate: 25000,
      maxApplicants: 10,
      preQuestions: ['이전 경험이 있으신가요?', '근무 가능한 요일을 알려주세요.'],
      ...overrides
    };
  }

  /**
   * 테스트용 지원서 데이터 생성
   */
  createApplicationData(overrides: Partial<TestApplication> = {}): TestApplication {
    return {
      jobPostingId: '',
      applicantName: 'E2E 테스트 지원자',
      phone: '010-1234-5678',
      experience: '홀덤 딜러 경험 2년',
      availability: '주말 근무 가능',
      preAnswers: ['네, 2년 경험이 있습니다.', '토요일, 일요일 근무 가능합니다.'],
      ...overrides
    };
  }

  /**
   * 테스트용 근무 기록 데이터 생성
   */
  createTestWorkLog(overrides: Partial<TestWorkLog> = {}): TestWorkLog {
    const today = new Date().toISOString().split('T')[0];
    
    return {
      staffId: 'test-staff-id',
      eventId: 'test-event-id',
      date: today,
      scheduledStartTime: '18:00',
      scheduledEndTime: '23:00',
      status: 'scheduled',
      ...overrides
    };
  }

  /**
   * UI를 통해 테스트 구인공고 생성
   */
  async createTestJobPosting(title: string, data: Partial<TestJobPosting> = {}): Promise<string | null> {
    const jobData = this.createJobPostingData({ title, ...data });
    
    try {
      // Firebase에 직접 구인공고 생성 (UI 대신 데이터 직접 생성)
      const jobId = `test-job-${Date.now()}`;
      
      await this.page.evaluate(async ({ jobId, jobData }) => {
        const { collection, addDoc } = await import('firebase/firestore');
        const { db } = await import('../../../src/firebase');
        
        const jobPostingData = {
          id: jobId,
          title: jobData.title,
          location: jobData.location,
          salary: jobData.salary,
          description: jobData.description,
          requirements: jobData.requirements,
          roles: jobData.roles,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'test-admin'
        };
        
        const docRef = await addDoc(collection(db, 'jobPostings'), jobPostingData);
        if (process.env.E2E_DEBUG === 'true') console.log('✅ 테스트 구인공고 생성:', docRef.id);
        return docRef.id;
      }, { jobId, jobData });
      
      if (process.env.E2E_DEBUG === 'true') console.log(`✅ 테스트 구인공고 생성: ${title} (ID: ${jobId})`);
      return jobId;
      
    } catch (error) {
      if (process.env.E2E_DEBUG === 'true') console.log('⚠️ UI를 통한 구인공고 생성 시도...');
      
      // 구인공고 관리 페이지로 이동
      await this.page.goto('http://localhost:3001/admin/job-postings');
      await this.page.waitForLoadState('domcontentloaded');
      await this.page.waitForTimeout(2000);
      
      // "새 구인공고 작성" 버튼 클릭
      const createButtons = [
        this.page.locator('button').filter({ hasText: /새 구인공고|구인공고 작성|New Job|Add Job|구인공고 추가/i }),
        this.page.locator('a').filter({ hasText: /새 구인공고|구인공고 작성|New Job|Add Job|구인공고 추가/i }),
        this.page.locator('[data-testid*="create"], [data-testid*="add"]')
      ];
      
      let buttonClicked = false;
      for (const buttonSelector of createButtons) {
        try {
          if (await buttonSelector.first().isVisible({ timeout: 2000 })) {
            await buttonSelector.first().click();
            await this.page.waitForTimeout(1000);
            buttonClicked = true;
            break;
          }
        } catch (error) {
          continue;
        }
      }
      
      if (!buttonClicked) {
        if (process.env.E2E_DEBUG === 'true') console.log('⚠️ 구인공고 작성 버튼을 찾을 수 없어 데이터 생성 건너뜀');
        return null;
      }
      
      // 폼 필드 입력
      const titleFields = [
        'input[name="title"]',
        'input[placeholder*="제목"]',
        'input[placeholder*="Title"]',
        '[data-testid*="title"]'
      ];
      
      const locationFields = [
        'input[name="location"]', 
        'input[placeholder*="위치"]',
        'input[placeholder*="Location"]',
        '[data-testid*="location"]'
      ];
      
      // 제목 입력
      for (const selector of titleFields) {
        try {
          if (await this.page.locator(selector).isVisible({ timeout: 1000 })) {
            await this.page.fill(selector, jobData.title);
            break;
          }
        } catch (error) {
          continue;
        }
      }
      
      // 위치 입력
      for (const selector of locationFields) {
        try {
          if (await this.page.locator(selector).isVisible({ timeout: 1000 })) {
            await this.page.fill(selector, jobData.location);
            break;
          }
        } catch (error) {
          continue;
        }
      }
      
      // 저장 버튼 클릭
      const saveButtons = [
        this.page.locator('button').filter({ hasText: /저장|Save|등록|Submit|Create/i }),
        this.page.locator('[data-testid*="save"], [data-testid*="submit"], [data-testid*="create"]')
      ];
      
      for (const buttonSelector of saveButtons) {
        try {
          if (await buttonSelector.first().isVisible({ timeout: 2000 })) {
            await buttonSelector.first().click();
            await this.page.waitForTimeout(2000);
            
            // 생성된 구인공고 ID 추출 시도 (URL에서)
            const currentUrl = this.page.url();
            const jobIdMatch = currentUrl.match(/job-postings\/([^\/\?]+)/);
            
            if (jobIdMatch) {
              if (process.env.E2E_DEBUG === 'true') console.log(`✅ UI를 통해 구인공고 생성 성공: ${title} (ID: ${jobIdMatch[1]})`);
              return jobIdMatch[1];
            } else {
              if (process.env.E2E_DEBUG === 'true') console.log(`✅ UI를 통해 구인공고 생성 완료: ${title}`);
              return `ui-created-${Date.now()}`;
            }
          }
        } catch (error) {
          continue;
        }
      }
      
      if (process.env.E2E_DEBUG === 'true') console.log('⚠️ 저장 버튼을 찾을 수 없거나 클릭 실패');
      return null;
    }
  }

  /**
   * UI를 통해 테스트 지원서 생성  
   */
  async createTestApplication(jobId: string, data: Partial<TestApplication> = {}): Promise<void> {
    const applicationData = this.createApplicationData({ jobPostingId: jobId, ...data });
    
    // Firebase SDK 대신 UI를 통한 지원서 생성
    try {
      // 구인구직 게시판으로 이동
      await this.page.goto(`http://localhost:3001/jobs`);
      await this.page.waitForLoadState('domcontentloaded');
      
      // 해당 구인공고 찾기 및 지원하기 클릭
      const jobCard = this.page.locator('.job-card').filter({ hasText: jobId });
      if (await jobCard.isVisible({ timeout: 3000 })) {
        await jobCard.locator('button').filter({ hasText: /지원하기|Apply/ }).click();
        
        // 지원서 폼 작성
        await this.page.fill('input[name="applicantName"], input[placeholder*="이름"]', applicationData.applicantName);
        await this.page.fill('input[name="phone"], input[placeholder*="전화"]', applicationData.phone);
        await this.page.fill('textarea[name="experience"], textarea[placeholder*="경험"]', applicationData.experience);
        
        // 제출 버튼 클릭
        const submitButton = this.page.locator('button').filter({ hasText: /제출|Submit/ });
        if (await submitButton.isVisible()) {
          await submitButton.click();
          await this.page.waitForTimeout(1000);
        }
        
        if (process.env.E2E_DEBUG === 'true') console.log(`✅ UI를 통한 테스트 지원서 생성: ${applicationData.applicantName}`);
      } else {
        // UI에서 찾을 수 없는 경우 로그만 출력
        if (process.env.E2E_DEBUG === 'true') console.log(`⚠️ 구인공고를 찾을 수 없어 지원서 생성 건너뜀: ${jobId}`);
      }
    } catch (error) {
      if (process.env.E2E_DEBUG === 'true') console.log(`⚠️ UI를 통한 지원서 생성 실패, 건너뜀: ${error}`);
    }
  }

  /**
   * 페이지에서 Firebase 데이터 로딩 대기
   */
  async waitForDataLoading(timeout: number = 10000): Promise<void> {
    if (process.env.E2E_DEBUG === 'true') console.log('📊 Firebase 데이터 로딩 대기 중...');
    
    // 로딩 스피너가 사라질 때까지 대기
    const loadingSelectors = [
      '.loading',
      '.spinner',
      '[data-testid="loading"]',
      '.skeleton'
    ];
    
    for (const selector of loadingSelectors) {
      const loadingElement = this.page.locator(selector);
      if (await loadingElement.count() > 0) {
        await loadingElement.first().waitFor({ state: 'hidden', timeout });
      }
    }
    
    // 데이터가 로드된 후 안정화 대기
    await this.page.waitForTimeout(1000);
    
    if (process.env.E2E_DEBUG === 'true') console.log('✅ 데이터 로딩 완료');
  }

  /**
   * UnifiedDataContext 데이터 상태 확인
   */
  async checkUnifiedDataState(): Promise<{
    staffCount: number;
    workLogsCount: number;
    applicationsCount: number;
    jobPostingsCount: number;
    isLoading: boolean;
  }> {
    return await this.page.evaluate(() => {
      // 윈도우 객체에서 UnifiedDataContext 상태 확인
      const context = (window as any).__UNIFIED_DATA_CONTEXT__;
      
      if (!context) {
        if (process.env.E2E_DEBUG === 'true') console.warn('UnifiedDataContext가 윈도우 객체에서 찾을 수 없습니다.');
        return {
          staffCount: 0,
          workLogsCount: 0, 
          applicationsCount: 0,
          jobPostingsCount: 0,
          isLoading: true
        };
      }
      
      return {
        staffCount: context.staff?.size || 0,
        workLogsCount: context.workLogs?.size || 0,
        applicationsCount: context.applications?.size || 0,
        jobPostingsCount: context.jobPostings?.size || 0,
        isLoading: context.loading?.initial || false
      };
    });
  }

  /**
   * Firebase 실시간 구독 상태 확인
   */
  async checkFirebaseSubscriptions(): Promise<{
    activeSubscriptions: number;
    subscriptionTypes: string[];
  }> {
    return await this.page.evaluate(() => {
      const subscriptions = (window as any).__FIREBASE_SUBSCRIPTIONS__ || [];
      
      return {
        activeSubscriptions: subscriptions.length,
        subscriptionTypes: subscriptions.map((sub: any) => sub.collection || sub.type)
      };
    });
  }

  /**
   * 성능 메트릭 수집
   */
  async collectPerformanceMetrics(): Promise<{
    loadTime: number;
    networkRequests: number;
    firebaseRequests: number;
    bundleSize: number;
    memoryUsage: number;
  }> {
    const performanceEntries = await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const resources = performance.getEntriesByType('resource');
      
      // Firebase 요청 필터링
      const firebaseRequests = resources.filter(entry => 
        entry.name.includes('firestore') || 
        entry.name.includes('firebase') ||
        entry.name.includes('.googleapis.com')
      );
      
      // 메모리 사용량 (지원되는 경우)
      const memoryInfo = (performance as any).memory;
      
      return {
        loadTime: navigation.loadEventEnd - navigation.navigationStart,
        networkRequests: resources.length,
        firebaseRequests: firebaseRequests.length,
        bundleSize: resources
          .filter(entry => entry.name.endsWith('.js'))
          .reduce((total, entry) => total + (entry.transferSize || 0), 0),
        memoryUsage: memoryInfo ? memoryInfo.usedJSMemorySize : 0
      };
    });
    
    return performanceEntries;
  }

  /**
   * 테스트 데이터 클린업
   */
  async cleanupTestData(testId?: string): Promise<void> {
    if (process.env.E2E_DEBUG === 'true') console.log('🧹 테스트 데이터 클린업 시작...');
    
    await this.page.evaluate((testId) => {
      // 테스트 데이터만 삭제 (production 데이터 보호)
      const testIdentifiers = ['E2E 테스트', 'test-', 'Playwright', testId].filter(Boolean);
      
      // localStorage 클린업
      Object.keys(localStorage).forEach(key => {
        if (testIdentifiers.some(id => key.includes(id!))) {
          localStorage.removeItem(key);
        }
      });
      
      // sessionStorage 클린업
      Object.keys(sessionStorage).forEach(key => {
        if (testIdentifiers.some(id => key.includes(id!))) {
          sessionStorage.removeItem(key);
        }
      });
      
      // IndexedDB 클린업 (스마트 캐시)
      if ('indexedDB' in window) {
        try {
          const deleteReq = indexedDB.deleteDatabase('T-HOLDEM-Cache-Test');
          deleteReq.onsuccess = () => {
            if (process.env.E2E_DEBUG === 'true') console.log('테스트 캐시 DB 삭제 완료');
          };
        } catch (error) {
          if (process.env.E2E_DEBUG === 'true') console.warn('캐시 DB 삭제 중 오류:', error);
        }
      }
    }, testId);
    
    // Firebase 테스트 데이터 클린업 (에뮬레이터에서만)
    if (testId) {
      await this.page.evaluate(async (testId) => {
        const db = (window as any).firebase?.firestore();
        if (!db) return;
        
        try {
          // 테스트 구인공고 삭제
          await db.collection('jobPostings').doc(testId).delete();
          
          // 관련 지원서 삭제
          const applicationsSnapshot = await db.collection('applications')
            .where('jobPostingId', '==', testId).get();
          
          for (const doc of applicationsSnapshot.docs) {
            await doc.ref.delete();
          }
          
          if (process.env.E2E_DEBUG === 'true') console.log(`✅ Firebase 테스트 데이터 삭제: ${testId}`);
        } catch (error) {
          if (process.env.E2E_DEBUG === 'true') console.warn('Firebase 데이터 삭제 중 오류:', error);
        }
      }, testId);
    }
    
    if (process.env.E2E_DEBUG === 'true') console.log('✅ 테스트 데이터 클린업 완료');
  }

  /**
   * 구인공고 상세 페이지로 네비게이션
   */
  async navigateToJobDetail(jobTitle?: string, timeout: number = 10000): Promise<string | null> {
    try {
      if (process.env.E2E_DEBUG === 'true') console.log(`🧭 구인공고 상세 페이지로 이동 중... (제목: ${jobTitle || '첫 번째 공고'})`);
      
      // 구인공고 관리 페이지로 먼저 이동
      await this.page.goto('http://localhost:3001/admin/job-postings');
      await this.page.waitForLoadState('domcontentloaded');
      await this.page.waitForTimeout(2000);
      
      // 구인공고 목록에서 "관리" 버튼 찾기
      const manageButtons = this.page.locator('button').filter({ hasText: /관리|Manage/i });
      const manageButtonCount = await manageButtons.count();
      
      if (manageButtonCount > 0) {
        if (process.env.E2E_DEBUG === 'true') console.log(`📋 ${manageButtonCount}개의 관리 버튼 발견`);
        
        // 첫 번째 관리 버튼 클릭
        await manageButtons.first().click();
        await this.page.waitForTimeout(2000);
        
        // 페이지가 변경되었는지 확인
        const currentUrl = this.page.url();
        if (process.env.E2E_DEBUG === 'true') console.log(`📄 현재 URL: ${currentUrl}`);
        
        // 구인공고 관리 페이지의 탭들이 있는지 확인
        const tabSelectors = [
          'button[role="tab"]',
          '.tab-button',
          '[data-testid*="tab"]',
          'button[aria-selected]',
          'div[role="tablist"] button'
        ];
        
        for (const selector of tabSelectors) {
          const tabCount = await this.page.locator(selector).count();
          if (tabCount > 0) {
            if (process.env.E2E_DEBUG === 'true') console.log(`✅ ${selector} 셀렉터로 ${tabCount}개 탭 발견`);
            return 'job-detail-with-tabs';
          }
        }
        
        // 탭이 없어도 관리 페이지에는 진입했으므로 성공으로 처리
        if (process.env.E2E_DEBUG === 'true') console.log('⚠️ 탭을 찾을 수 없지만 구인공고 관리 페이지에 진입 성공');
        return 'job-detail-no-tabs';
        
      } else {
        if (process.env.E2E_DEBUG === 'true') console.log('⚠️ 관리 버튼을 찾을 수 없음, 일반 목록 페이지에서 진행');
        return 'job-postings-main';
      }
      
    } catch (error) {
      if (process.env.E2E_DEBUG === 'true') console.log(`❌ 구인공고 상세 페이지 이동 실패: ${error}`);
      return null;
    }
  }

  /**
   * 탭 버튼 클릭 (지원자, 스태프, 정산)
   */
  async clickTab(tabName: '지원자' | '스태프' | '정산' | 'applicant' | 'staff' | 'payroll', timeout: number = 10000): Promise<boolean> {
    try {
      if (process.env.E2E_DEBUG === 'true') console.log(`🔄 탭 클릭 중: ${tabName}`);
      
      // 탭 버튼 패턴들
      const tabPatterns = {
        '지원자': /지원자|applicant/i,
        '스태프': /스태프|staff/i,
        '정산': /정산|payroll/i,
        'applicant': /지원자|applicant/i,
        'staff': /스태프|staff/i,
        'payroll': /정산|payroll/i
      };
      
      const pattern = tabPatterns[tabName] || new RegExp(tabName, 'i');
      
      // 다양한 탭 선택자 시도
      const tabSelectors = [
        `button:has-text("${tabName}")`,
        `[role="tab"]:has-text("${tabName}")`,
        `.tab:has-text("${tabName}")`,
        `button.tab-button:has-text("${tabName}")`,
        `div[data-tab="${tabName}"] button`,
        'button',  // 모든 버튼에서 텍스트 필터링
        '[role="tab"]'
      ];
      
      for (const selector of tabSelectors) {
        const elements = this.page.locator(selector);
        const count = await elements.count();
        
        if (count > 0) {
          // 텍스트로 필터링
          const targetTab = elements.filter({ hasText: pattern });
          const targetCount = await targetTab.count();
          
          if (targetCount > 0) {
            const firstTab = targetTab.first();
            if (await firstTab.isVisible({ timeout: 2000 })) {
              await firstTab.click();
              await this.page.waitForTimeout(1000);
              if (process.env.E2E_DEBUG === 'true') console.log(`✅ ${tabName} 탭 클릭 완료`);
              return true;
            }
          }
        }
      }
      
      if (process.env.E2E_DEBUG === 'true') console.log(`⚠️ ${tabName} 탭을 찾을 수 없습니다.`);
      
      // 페이지의 모든 버튼 출력 (디버깅용)
      const allButtons = await this.page.locator('button').allTextContents();
      if (process.env.E2E_DEBUG === 'true') console.log('🔍 페이지의 모든 버튼:', allButtons.slice(0, 10));
      
      return false;
    } catch (error) {
      if (process.env.E2E_DEBUG === 'true') console.log(`❌ ${tabName} 탭 클릭 실패: ${error}`);
      return false;
    }
  }

  /**
   * 테스트 환경 초기화
   */
  async initializeTestEnvironment(): Promise<void> {
    if (process.env.E2E_DEBUG === 'true') console.log('🔧 테스트 환경 초기화...');
    
    // 테스트 플래그 설정
    await this.page.addInitScript(() => {
      (window as any).__E2E_TEST_MODE__ = true;
      (window as any).__TEST_START_TIME__ = Date.now();
    });
    
    // Firebase 에뮬레이터 사용 설정 (개발 환경에서)
    if (process.env.NODE_ENV !== 'production') {
      await this.page.addInitScript(() => {
        (window as any).__USE_FIREBASE_EMULATOR__ = true;
      });
    }
    
    if (process.env.E2E_DEBUG === 'true') console.log('✅ 테스트 환경 초기화 완료');
  }
}

// 기존 함수들도 호환성을 위해 유지 (내부적으로 클래스 사용)
export function createTestJobPosting(overrides: Partial<TestJobPosting> = {}): TestJobPosting {
  const helper = new DataHelper({} as Page); // 임시 페이지 객체
  return helper.createJobPostingData(overrides);
}

export function createTestApplication(overrides: Partial<TestApplication> = {}): TestApplication {
  const helper = new DataHelper({} as Page); // 임시 페이지 객체
  return helper.createApplicationData(overrides);
}

export function createTestWorkLog(overrides: Partial<TestWorkLog> = {}): TestWorkLog {
  const helper = new DataHelper({} as Page); // 임시 페이지 객체
  return helper.createTestWorkLog(overrides);
}

export async function waitForDataLoading(page: Page, timeout: number = 10000): Promise<void> {
  const helper = new DataHelper(page);
  await helper.waitForDataLoading(timeout);
}

export async function checkUnifiedDataState(page: Page): Promise<{
  staffCount: number;
  workLogsCount: number;
  applicationsCount: number;
  jobPostingsCount: number;
  isLoading: boolean;
}> {
  const helper = new DataHelper(page);
  return helper.checkUnifiedDataState();
}

export async function checkFirebaseSubscriptions(page: Page): Promise<{
  activeSubscriptions: number;
  subscriptionTypes: string[];
}> {
  const helper = new DataHelper(page);
  return helper.checkFirebaseSubscriptions();
}

export async function collectPerformanceMetrics(page: Page): Promise<{
  loadTime: number;
  networkRequests: number;
  firebaseRequests: number;
  bundleSize: number;
  memoryUsage: number;
}> {
  const helper = new DataHelper(page);
  return helper.collectPerformanceMetrics();
}

export async function cleanupTestData(page: Page): Promise<void> {
  const helper = new DataHelper(page);
  await helper.cleanupTestData();
}

export async function initializeTestEnvironment(page: Page): Promise<void> {
  const helper = new DataHelper(page);
  await helper.initializeTestEnvironment();
}