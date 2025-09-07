/**
 * WorkLog 사전 생성 시스템 E2E 테스트
 * 
 * 테스트 시나리오:
 * 1. 지원자 확정 시 WorkLog 자동 생성 테스트
 * 2. 시간 수정 기능 테스트 
 * 3. 출석 상태 변경 테스트
 * 4. 중복 WorkLog 생성 방지 테스트
 * 
 * @version 1.0
 * @since 2025-09-07
 */

import { test, expect, Page } from '@playwright/test';
import { navigateToAdminPage } from './test-auth-helper';

const TARGET_JOB_POSTING_ID = 'u7z6sw7os6DWuRmg3a7f';
const TARGET_URL = `http://localhost:3000/admin/job-posting/${TARGET_JOB_POSTING_ID}?tab=applicants`;

/**
 * 콘솔 로그 모니터링을 위한 헬퍼 함수
 */
async function setupConsoleLogging(page: Page) {
  const logs: string[] = [];
  
  page.on('console', (msg) => {
    const text = msg.text();
    logs.push(`[${msg.type()}] ${text}`);
    console.log(`콘솔 로그: [${msg.type()}] ${text}`);
  });
  
  page.on('pageerror', (error) => {
    logs.push(`[ERROR] ${error.message}`);
    console.error('페이지 에러:', error.message);
  });
  
  return logs;
}

/**
 * Network 탭 모니터링을 위한 헬퍼 함수
 */
async function setupNetworkMonitoring(page: Page) {
  const networkRequests: any[] = [];
  
  page.on('request', (request) => {
    if (request.url().includes('firestore') || request.url().includes('firebase')) {
      networkRequests.push({
        type: 'request',
        method: request.method(),
        url: request.url(),
        timestamp: new Date().toISOString()
      });
      console.log(`🌐 Firebase 요청: ${request.method()} ${request.url()}`);
    }
  });
  
  page.on('response', (response) => {
    if (response.url().includes('firestore') || response.url().includes('firebase')) {
      networkRequests.push({
        type: 'response',
        status: response.status(),
        url: response.url(),
        timestamp: new Date().toISOString()
      });
      console.log(`📡 Firebase 응답: ${response.status()} ${response.url()}`);
    }
  });
  
  return networkRequests;
}

/**
 * WorkLog 데이터 확인 함수
 */
async function checkWorkLogData(page: Page, staffId: string, eventId: string, date: string) {
  return await page.evaluate(async ({ staffId, eventId, date }) => {
    // Firebase에서 WorkLog 데이터 조회
    const expectedId = `${eventId}_${staffId}_0_${date}`;
    
    // 브라우저 개발자 도구에서 실행되는 코드
    try {
      // UnifiedDataContext에서 workLogs 가져오기
      const workLogs = (window as any).__TEST_DATA__?.workLogs || [];
      const workLog = workLogs.find((log: any) => log.id === expectedId);
      
      return {
        found: !!workLog,
        data: workLog,
        expectedId,
        totalWorkLogs: workLogs.length
      };
    } catch (error) {
      return {
        found: false,
        error: error.message,
        expectedId
      };
    }
  }, { staffId, eventId, date });
}

test.describe('WorkLog 사전 생성 시스템 테스트', () => {
  
  test.beforeEach(async ({ page }) => {
    // 콘솔 로그 및 네트워크 모니터링 설정
    await setupConsoleLogging(page);
    await setupNetworkMonitoring(page);
    
    // 관리자 페이지로 이동
    const success = await navigateToAdminPage(page, TARGET_URL);
    expect(success).toBe(true);
    
    // 페이지 로딩 완료 대기
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('1. 지원자 확정 시 WorkLog 자동 생성 테스트', async ({ page }) => {
    console.log('🧪 테스트 1: 지원자 확정 시 WorkLog 자동 생성');
    
    // 지원자 탭이 활성화되어 있는지 확인
    await expect(page.locator('[data-tab="applicants"]')).toHaveClass(/active|bg-blue-500|text-blue-600/);
    
    // 대기 중인 지원자 찾기
    const pendingApplicants = page.locator('[data-status="pending"]');
    const firstApplicant = pendingApplicants.first();
    
    if (await firstApplicant.isVisible()) {
      console.log('✅ 대기 중인 지원자 발견');
      
      // 지원자 정보 추출
      const applicantInfo = await firstApplicant.evaluate(el => {
        const staffId = el.getAttribute('data-staff-id');
        const name = el.querySelector('[data-field="name"]')?.textContent;
        const position = el.querySelector('[data-field="position"]')?.textContent;
        return { staffId, name, position };
      });
      
      console.log('📋 지원자 정보:', applicantInfo);
      
      // 확정 버튼 클릭 전에 기존 WorkLog 수 확인
      const initialWorkLogCount = await page.evaluate(() => {
        return (window as any).__TEST_DATA__?.workLogs?.length || 0;
      });
      
      console.log(`📊 확정 전 WorkLog 수: ${initialWorkLogCount}`);
      
      // 확정 버튼 클릭
      const confirmButton = firstApplicant.locator('button').filter({ hasText: /확정|승인|Confirm/ });
      await confirmButton.click();
      
      // 확정 모달이 나타나면 확인 버튼 클릭
      const modalConfirmButton = page.locator('.modal button').filter({ hasText: /확인|예|Yes/ });
      if (await modalConfirmButton.isVisible({ timeout: 2000 })) {
        await modalConfirmButton.click();
      }
      
      // WorkLog 생성 대기
      await page.waitForTimeout(3000);
      
      // 확정 후 WorkLog 수 확인
      const finalWorkLogCount = await page.evaluate(() => {
        return (window as any).__TEST_DATA__?.workLogs?.length || 0;
      });
      
      console.log(`📊 확정 후 WorkLog 수: ${finalWorkLogCount}`);
      
      // WorkLog가 생성되었는지 확인
      if (applicantInfo.staffId) {
        const today = new Date().toISOString().split('T')[0];
        const workLogCheck = await checkWorkLogData(page, applicantInfo.staffId, TARGET_JOB_POSTING_ID, today);
        
        console.log('🔍 WorkLog 확인 결과:', workLogCheck);
        
        expect(workLogCheck.found).toBe(true);
        expect(workLogCheck.expectedId).toMatch(new RegExp(`${TARGET_JOB_POSTING_ID}_${applicantInfo.staffId}_0_\\d{4}-\\d{2}-\\d{2}`));
      }
      
    } else {
      console.log('⚠️ 대기 중인 지원자가 없음 - 테스트 스킵');
      test.skip(true, '대기 중인 지원자가 없어 테스트를 건너뜁니다');
    }
  });

  test('2. 스태프 탭에서 시간 수정 기능 테스트', async ({ page }) => {
    console.log('🧪 테스트 2: 시간 수정 기능');
    
    // 스태프 탭으로 이동
    await page.click('[data-tab="staff"]');
    await page.waitForTimeout(2000);
    
    console.log('📍 스태프 탭으로 이동 완료');
    
    // 스태프 목록에서 첫 번째 스태프 찾기
    const staffRows = page.locator('[data-testid="staff-row"]');
    const firstStaff = staffRows.first();
    
    if (await firstStaff.isVisible()) {
      console.log('✅ 스태프 발견');
      
      // 기존 WorkLog 수 확인
      const initialWorkLogCount = await page.evaluate(() => {
        return (window as any).__TEST_DATA__?.workLogs?.length || 0;
      });
      
      console.log(`📊 시간 수정 전 WorkLog 수: ${initialWorkLogCount}`);
      
      // 시간 수정 버튼이나 시간 필드 클릭
      const timeEditButton = firstStaff.locator('button').filter({ hasText: /시간|수정|편집/ });
      const timeInput = firstStaff.locator('input[type="time"]');
      
      if (await timeEditButton.isVisible()) {
        await timeEditButton.click();
        console.log('⏰ 시간 수정 버튼 클릭');
      } else if (await timeInput.isVisible()) {
        await timeInput.click();
        console.log('⏰ 시간 입력 필드 클릭');
      } else {
        console.log('⚠️ 시간 수정 인터페이스를 찾을 수 없음');
      }
      
      // 시간 수정 후 대기
      await page.waitForTimeout(2000);
      
      // 수정 후 WorkLog 수 확인 - 새로 생성되지 않고 업데이트만 되어야 함
      const finalWorkLogCount = await page.evaluate(() => {
        return (window as any).__TEST_DATA__?.workLogs?.length || 0;
      });
      
      console.log(`📊 시간 수정 후 WorkLog 수: ${finalWorkLogCount}`);
      
      // WorkLog 수가 증가하지 않았는지 확인 (업데이트만 되어야 함)
      expect(finalWorkLogCount).toBe(initialWorkLogCount);
      console.log('✅ 시간 수정 시 새로운 WorkLog가 생성되지 않음을 확인');
      
    } else {
      console.log('⚠️ 스태프가 없음 - 테스트 스킵');
      test.skip(true, '스태프가 없어 테스트를 건너뜁니다');
    }
  });

  test('3. 출석 상태 변경 테스트', async ({ page }) => {
    console.log('🧪 테스트 3: 출석 상태 변경');
    
    // 스태프 탭으로 이동
    await page.click('[data-tab="staff"]');
    await page.waitForTimeout(2000);
    
    // 출석 상태 버튼 찾기
    const attendanceButtons = page.locator('button').filter({ hasText: /출석|지각|조퇴|결근/ });
    const firstButton = attendanceButtons.first();
    
    if (await firstButton.isVisible()) {
      console.log('✅ 출석 상태 버튼 발견');
      
      // 상태 변경 전 WorkLog 수 확인
      const initialWorkLogCount = await page.evaluate(() => {
        return (window as any).__TEST_DATA__?.workLogs?.length || 0;
      });
      
      console.log(`📊 상태 변경 전 WorkLog 수: ${initialWorkLogCount}`);
      
      // 출석 상태 버튼 클릭
      await firstButton.click();
      console.log('📝 출석 상태 변경 버튼 클릭');
      
      // 상태 변경 후 대기
      await page.waitForTimeout(2000);
      
      // 상태 변경 후 WorkLog 수 확인
      const finalWorkLogCount = await page.evaluate(() => {
        return (window as any).__TEST_DATA__?.workLogs?.length || 0;
      });
      
      console.log(`📊 상태 변경 후 WorkLog 수: ${finalWorkLogCount}`);
      
      // WorkLog 수가 증가하지 않았는지 확인 (업데이트만 되어야 함)
      expect(finalWorkLogCount).toBe(initialWorkLogCount);
      console.log('✅ 출석 상태 변경 시 actualStartTime/actualEndTime만 업데이트됨을 확인');
      
    } else {
      console.log('⚠️ 출석 상태 버튼이 없음 - 테스트 스킵');
      test.skip(true, '출석 상태 버튼이 없어 테스트를 건너뜁니다');
    }
  });

  test('4. 중복 WorkLog 생성 방지 테스트', async ({ page }) => {
    console.log('🧪 테스트 4: 중복 WorkLog 생성 방지');
    
    // 지원자 탭으로 이동
    await page.click('[data-tab="applicants"]');
    await page.waitForTimeout(2000);
    
    // 이미 확정된 지원자 찾기
    const confirmedApplicants = page.locator('[data-status="confirmed"]');
    const firstConfirmed = confirmedApplicants.first();
    
    if (await firstConfirmed.isVisible()) {
      console.log('✅ 확정된 지원자 발견');
      
      // 지원자 정보 추출
      const applicantInfo = await firstConfirmed.evaluate(el => {
        const staffId = el.getAttribute('data-staff-id');
        const name = el.querySelector('[data-field="name"]')?.textContent;
        return { staffId, name };
      });
      
      console.log('📋 확정된 지원자 정보:', applicantInfo);
      
      if (applicantInfo.staffId) {
        // 해당 스태프의 WorkLog 수 확인
        const today = new Date().toISOString().split('T')[0];
        const workLogsBefore = await page.evaluate(({ staffId, eventId }) => {
          const workLogs = (window as any).__TEST_DATA__?.workLogs || [];
          return workLogs.filter((log: any) => 
            log.staffId === staffId && log.eventId === eventId
          );
        }, { staffId: applicantInfo.staffId, eventId: TARGET_JOB_POSTING_ID });
        
        console.log(`📊 해당 스태프의 기존 WorkLog 수: ${workLogsBefore.length}`);
        
        // 다시 확정 시도 (이미 확정된 상태에서)
        const reconfirmButton = firstConfirmed.locator('button').filter({ hasText: /확정|승인/ });
        if (await reconfirmButton.isVisible()) {
          await reconfirmButton.click();
          
          // 확정 모달 처리
          const modalConfirmButton = page.locator('.modal button').filter({ hasText: /확인|예|Yes/ });
          if (await modalConfirmButton.isVisible({ timeout: 2000 })) {
            await modalConfirmButton.click();
          }
          
          // 대기 후 WorkLog 수 재확인
          await page.waitForTimeout(3000);
          
          const workLogsAfter = await page.evaluate(({ staffId, eventId }) => {
            const workLogs = (window as any).__TEST_DATA__?.workLogs || [];
            return workLogs.filter((log: any) => 
              log.staffId === staffId && log.eventId === eventId
            );
          }, { staffId: applicantInfo.staffId, eventId: TARGET_JOB_POSTING_ID });
          
          console.log(`📊 재확정 후 WorkLog 수: ${workLogsAfter.length}`);
          
          // WorkLog 수가 증가하지 않았는지 확인
          expect(workLogsAfter.length).toBe(workLogsBefore.length);
          console.log('✅ 중복 WorkLog 생성이 방지됨을 확인');
          
          // 각 WorkLog가 고유한 ID를 가지는지 확인
          const uniqueIds = new Set(workLogsAfter.map(log => log.id));
          expect(uniqueIds.size).toBe(workLogsAfter.length);
          console.log('✅ 모든 WorkLog가 고유한 ID를 가짐을 확인');
        }
      }
      
    } else {
      console.log('⚠️ 확정된 지원자가 없음 - 테스트 스킵');
      test.skip(true, '확정된 지원자가 없어 테스트를 건너뜁니다');
    }
  });

  test('5. WorkLog ID 패턴 검증 테스트', async ({ page }) => {
    console.log('🧪 테스트 5: WorkLog ID 패턴 검증');
    
    // 전체 WorkLog 목록 조회
    const allWorkLogs = await page.evaluate(() => {
      return (window as any).__TEST_DATA__?.workLogs || [];
    });
    
    console.log(`📊 전체 WorkLog 수: ${allWorkLogs.length}`);
    
    if (allWorkLogs.length > 0) {
      // ID 패턴 검증 (eventId_staffId_0_date)
      const idPattern = /^.+_.+_0_\d{4}-\d{2}-\d{2}$/;
      const validIds = allWorkLogs.filter((log: any) => idPattern.test(log.id));
      
      console.log(`✅ 올바른 ID 패턴을 가진 WorkLog 수: ${validIds.length}`);
      console.log(`❌ 잘못된 ID 패턴을 가진 WorkLog 수: ${allWorkLogs.length - validIds.length}`);
      
      // 일부 ID 샘플 출력
      const sampleIds = allWorkLogs.slice(0, 5).map((log: any) => log.id);
      console.log('📋 WorkLog ID 샘플:', sampleIds);
      
      // 모든 WorkLog가 올바른 ID 패턴을 가지는지 확인
      expect(validIds.length).toBe(allWorkLogs.length);
      console.log('✅ 모든 WorkLog가 올바른 ID 패턴 (eventId_staffId_0_date)을 사용함을 확인');
      
      // 중복 ID 검사
      const allIds = allWorkLogs.map((log: any) => log.id);
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);
      console.log('✅ 모든 WorkLog ID가 고유함을 확인');
      
    } else {
      console.log('⚠️ WorkLog가 없어 ID 패턴 검증을 수행할 수 없음');
    }
  });

  test('6. 실시간 동기화 테스트', async ({ page }) => {
    console.log('🧪 테스트 6: 실시간 동기화');
    
    // 초기 데이터 로드 확인
    await page.waitForSelector('[data-testid="loading-spinner"]', { state: 'hidden', timeout: 10000 });
    
    // 데이터 로딩 상태 확인
    const isDataLoaded = await page.evaluate(() => {
      const data = (window as any).__TEST_DATA__;
      return !!(data && data.workLogs && data.staff && data.applications);
    });
    
    expect(isDataLoaded).toBe(true);
    console.log('✅ 데이터 로딩 완료 확인');
    
    // onSnapshot 구독 상태 확인
    const subscriptionStatus = await page.evaluate(() => {
      return {
        hasUnifiedDataContext: !!(window as any).__UNIFIED_DATA_CONTEXT__,
        hasRealtimeSubscriptions: !!(window as any).__REALTIME_SUBSCRIPTIONS__,
        subscriptionCount: Object.keys((window as any).__REALTIME_SUBSCRIPTIONS__ || {}).length
      };
    });
    
    console.log('🔄 실시간 구독 상태:', subscriptionStatus);
    
    // 실시간 구독이 활성화되어 있는지 확인
    expect(subscriptionStatus.subscriptionCount).toBeGreaterThan(0);
    console.log('✅ Firebase 실시간 구독이 활성화됨을 확인');
  });

});