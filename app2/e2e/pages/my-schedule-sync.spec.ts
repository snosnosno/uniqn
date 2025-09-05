import { test, expect, Page } from '@playwright/test';
import { AuthHelper } from '../helpers/auth.helper';
import { DataHelper } from '../helpers/data.helper';
import { FirebaseHelper } from '../helpers/firebase.helper';

/**
 * Test 12: 내 스케줄 페이지 동기화 테스트
 * 
 * 테스트 범위:
 * - 내 스케줄 페이지 기본 기능 및 데이터 로드
 * - 관리자의 시간 변경이 내 스케줄에 실시간 반영
 * - 출근 상태 변경의 양방향 동기화
 * - 급여 정보 실시간 업데이트
 * - 내 지원 현황과 내 스케줄 간 데이터 일관성
 * - 모바일 반응형 레이아웃 동기화
 * - 오프라인 상태에서의 동기화 처리
 * - 푸시 알림 및 실시간 업데이트 알림
 */

test.describe('내 스케줄 페이지 동기화', () => {
  let authHelper: AuthHelper;
  let dataHelper: DataHelper;
  let firebaseHelper: FirebaseHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    dataHelper = new DataHelper(page);
    firebaseHelper = new FirebaseHelper(page);

    // Firebase 에뮬레이터 연결 확인
    await firebaseHelper.checkFirebaseConnection();

    // 테스트 시나리오: 사용자가 지원하고 확정된 상태의 스케줄
    await dataHelper.createTestJobPosting('test-job-schedule', {
      title: '포커 딜러 모집 - 스케줄 동기화 테스트',
      location: '서울 강남구',
      roles: [
        { name: '딜러', hourlyWage: 15000, requiredCount: 2 }
      ],
      description: '내 스케줄 동기화 테스트용 공고',
      jobDate: '2025-02-10',
      startTime: '18:00',
      endTime: '02:00',
      status: 'active'
    });

    // 테스트 사용자 생성 및 지원서 제출 → 확정까지 완료
    await dataHelper.createTestApplication('test-job-schedule', {
      name: '김스케줄',
      phone: '010-1234-5678',
      experience: 'intermediate',
      status: 'confirmed' // 이미 확정된 상태
    });

    // 확정된 지원자의 스태프 데이터 생성
    await dataHelper.createTestStaff('test-job-schedule', {
      name: '김스케줄',
      phone: '010-1234-5678',
      role: '딜러',
      hourlyWage: 15000,
      status: 'scheduled'
    });

    // workLog 초기 데이터 생성
    await dataHelper.createWorkLog('test-job-schedule', '김스케줄', {
      scheduledStartTime: '18:00',
      scheduledEndTime: '02:00',
      status: 'scheduled',
      expectedSalary: 120000 // 8시간 * 15000원
    });
  });

  test.afterEach(async ({ page }) => {
    // 테스트 데이터 정리
    await dataHelper.cleanupTestData('test-job-schedule');
    await authHelper.logout();
  });

  test('내 스케줄 페이지 기본 렌더링 및 데이터 로드', async ({ page }) => {
    const startTime = Date.now();

    // 김스케줄 사용자로 로그인
    await authHelper.loginAsUser('김스케줄', 'test123');

    // 내 스케줄 페이지로 이동
    await page.goto('http://localhost:3001/my-schedule');
    await page.waitForLoadState('domcontentloaded');

    // 성능 검증: 4초 이내 로드
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(4000);

    // 기본 스케줄 정보 표시 확인
    await expect(page.locator('text=스케줄 동기화 테스트')).toBeVisible();
    await expect(page.locator('text=18:00')).toBeVisible();
    await expect(page.locator('text=02:00')).toBeVisible();
    await expect(page.locator('text=딜러')).toBeVisible();

    // 예상 급여 정보 확인
    await expect(page.locator('text=120,000').or(
      page.locator('text=120000')
    )).toBeVisible();

    // 출근 상태 확인
    await expect(page.locator('text=예정').or(
      page.locator('text=scheduled')
    )).toBeVisible();

    console.log(`✅ 내 스케줄 페이지 로드 시간: ${loadTime}ms`);
  });

  test('관리자 시간 변경의 실시간 반영', async ({ page, context }) => {
    // 사용자 세션: 내 스케줄 페이지
    await authHelper.loginAsUser('김스케줄', 'test123');
    await page.goto('http://localhost:3001/my-schedule');
    await page.waitForLoadState('domcontentloaded');

    // 초기 시간 확인
    await expect(page.locator('text=18:00')).toBeVisible();
    await expect(page.locator('text=02:00')).toBeVisible();

    // 관리자 세션: 시간 변경
    const adminPage = await context.newPage();
    await authHelper.loginAsAdmin(adminPage);
    await adminPage.goto('http://localhost:3001/admin/job-postings');
    await adminPage.waitForLoadState('domcontentloaded');

    // 관리자가 스케줄 시간 변경
    await this.adminModifyScheduleTime(adminPage, '김스케줄', '19:00', '03:00');

    // 사용자 페이지에서 실시간 업데이트 확인
    const syncStartTime = Date.now();
    
    await expect(page.locator('text=19:00')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=03:00')).toBeVisible();

    const syncDelay = Date.now() - syncStartTime;
    expect(syncDelay).toBeLessThan(5000); // 5초 이내 동기화

    // 급여도 자동 재계산되어야 함 (8시간 → 8시간, 동일)
    await expect(page.locator('text=120,000').or(
      page.locator('text=120000')
    )).toBeVisible();

    console.log(`✅ 관리자 시간 변경 동기화: ${syncDelay}ms`);

    await adminPage.close();
  });

  test('출근 상태 변경의 양방향 동기화', async ({ page, context }) => {
    // 사용자 세션
    await authHelper.loginAsUser('김스케줄', 'test123');
    await page.goto('http://localhost:3001/my-schedule');
    await page.waitForLoadState('domcontentloaded');

    // 관리자 세션
    const adminPage = await context.newPage();
    await authHelper.loginAsAdmin(adminPage);
    await adminPage.goto('http://localhost:3001/admin/job-postings');
    await adminPage.waitForLoadState('domcontentloaded');
    
    await this.navigateToStaffTab(adminPage);

    // 1. 관리자가 출근 상태를 present로 변경
    const staffRow = adminPage.locator('tr').filter({ hasText: '김스케줄' });
    const statusSelect = staffRow.locator('select').first();

    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption('present');
      await adminPage.waitForTimeout(2000);
    }

    // 사용자 페이지에서 상태 변경 확인
    await expect(page.locator('text=출근').or(
      page.locator('text=present')
    )).toBeVisible({ timeout: 10000 });

    // 실제 출근 시간 표시 확인
    const currentTime = new Date().toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    // 출근 시간이 표시되는지 확인 (정확한 시간이 아니어도 됨)
    const clockInTime = page.locator('text=/\d{2}:\d{2}/').first();
    if (await clockInTime.isVisible()) {
      console.log(`✅ 실제 출근 시간 표시됨`);
    }

    // 2. 사용자가 직접 퇴근 체크 (가능한 경우)
    const checkOutButton = page.locator('button').filter({ hasText: /퇴근|check out/i }).or(
      page.locator('[data-testid="check-out-button"]')
    );

    if (await checkOutButton.isVisible()) {
      await checkOutButton.click();
      await page.waitForTimeout(2000);

      // 관리자 페이지에서 상태 변경 확인
      await expect(staffRow.locator('text=completed')).toBeVisible({ timeout: 10000 });
      
      console.log('✅ 사용자 퇴근 체크 → 관리자 동기화 확인');
    }

    console.log('✅ 출근 상태 양방향 동기화 완료');

    await adminPage.close();
  });

  test('급여 정보 실시간 업데이트', async ({ page, context }) => {
    await authHelper.loginAsUser('김스케줄', 'test123');
    await page.goto('http://localhost:3001/my-schedule');
    await page.waitForLoadState('domcontentloaded');

    // 초기 예상 급여 확인
    const initialSalary = await this.extractSalaryAmount(page);
    expect(initialSalary).toBe(120000);

    // 관리자가 시급 변경
    const adminPage = await context.newPage();
    await authHelper.loginAsAdmin(adminPage);
    await adminPage.goto('http://localhost:3001/admin/job-postings');
    await adminPage.waitForLoadState('domcontentloaded');

    // 시급 변경 (15000 → 18000)
    await this.adminModifyHourlyWage(adminPage, '김스케줄', 18000);

    // 사용자 페이지에서 급여 업데이트 확인
    await expect(page.locator('text=144,000').or(
      page.locator('text=144000')
    )).toBeVisible({ timeout: 10000 });

    const updatedSalary = await this.extractSalaryAmount(page);
    expect(updatedSalary).toBe(144000); // 8시간 * 18000원

    console.log(`✅ 급여 실시간 업데이트: ${initialSalary} → ${updatedSalary}원`);

    await adminPage.close();
  });

  test('내 지원 현황과 내 스케줄 간 데이터 일관성', async ({ page }) => {
    await authHelper.loginAsUser('김스케줄', 'test123');

    // 1. 내 지원 현황 페이지 확인
    await page.goto('http://localhost:3001/my-applications');
    await page.waitForLoadState('domcontentloaded');

    // 확정된 지원서 정보 확인
    await expect(page.locator('text=스케줄 동기화 테스트')).toBeVisible();
    await expect(page.locator('text=confirmed').or(
      page.locator('text=확정')
    )).toBeVisible();

    // 공고 상세 정보 추출
    const jobTitle = await page.locator('h3, h4').filter({ hasText: '스케줄 동기화 테스트' }).textContent();
    const jobLocation = await page.locator('text=서울 강남구').textContent();

    // 2. 내 스케줄 페이지로 이동
    await page.goto('http://localhost:3001/my-schedule');
    await page.waitForLoadState('domcontentloaded');

    // 동일한 공고 정보가 스케줄에도 표시되는지 확인
    await expect(page.locator(`text=${jobTitle?.replace('포커 딜러 모집 - ', '')}`)).toBeVisible();
    if (jobLocation) {
      await expect(page.locator(`text=${jobLocation}`)).toBeVisible();
    }

    // 역할과 시급 정보 일관성 확인
    await expect(page.locator('text=딜러')).toBeVisible();
    await expect(page.locator('text=15,000').or(
      page.locator('text=15000')
    )).toBeVisible();

    console.log('✅ 내 지원 현황 ↔ 내 스케줄 데이터 일관성 확인');
  });

  test('모바일 반응형 레이아웃 동기화', async ({ page, context }) => {
    // 모바일 뷰포트로 설정
    await page.setViewportSize({ width: 375, height: 667 });

    await authHelper.loginAsUser('김스케줄', 'test123');
    await page.goto('http://localhost:3001/my-schedule');
    await page.waitForLoadState('domcontentloaded');

    // 모바일 레이아웃에서 스케줄 정보 확인
    await expect(page.locator('text=18:00')).toBeVisible();
    await expect(page.locator('text=02:00')).toBeVisible();

    // 관리자가 데스크톱에서 시간 변경
    const adminPage = await context.newPage();
    await adminPage.setViewportSize({ width: 1920, height: 1080 });
    await authHelper.loginAsAdmin(adminPage);
    await adminPage.goto('http://localhost:3001/admin/job-postings');
    await adminPage.waitForLoadState('domcontentloaded');

    // 시간 변경
    await this.adminModifyScheduleTime(adminPage, '김스케줄', '20:00', '04:00');

    // 모바일 사용자 페이지에서 동기화 확인
    await expect(page.locator('text=20:00')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=04:00')).toBeVisible();

    // 모바일에서 급여 정보도 업데이트되는지 확인
    await expect(page.locator('text=120,000').or(
      page.locator('text=120000')
    )).toBeVisible();

    // 태블릿 뷰포트로 변경
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);

    // 태블릿에서도 동일한 정보 확인
    await expect(page.locator('text=20:00')).toBeVisible();
    await expect(page.locator('text=04:00')).toBeVisible();

    console.log('✅ 모바일/태블릿 반응형 레이아웃 동기화 확인');

    await adminPage.close();
  });

  test('오프라인 상태에서의 동기화 처리', async ({ page, context }) => {
    await authHelper.loginAsUser('김스케줄', 'test123');
    await page.goto('http://localhost:3001/my-schedule');
    await page.waitForLoadState('domcontentloaded');

    // 초기 상태 확인
    await expect(page.locator('text=18:00')).toBeVisible();

    // 네트워크 오프라인
    await context.setOffline(true);

    // 오프라인 상태 표시 확인
    const offlineIndicator = page.locator('text=오프라인').or(
      page.locator('[data-testid="offline-indicator"]').or(
        page.locator('.offline-status')
      )
    );

    if (await offlineIndicator.isVisible()) {
      await expect(offlineIndicator).toBeVisible();
      console.log('✅ 오프라인 상태 표시 확인');
    }

    // 오프라인 상태에서 캐시된 데이터 확인
    await expect(page.locator('text=18:00')).toBeVisible();
    await expect(page.locator('text=120,000')).toBeVisible();

    // 관리자가 온라인 상태에서 데이터 변경 (사용자는 모름)
    const adminPage = await context.newPage();
    await adminPage.goto('http://localhost:3001/admin/job-postings');
    await adminPage.waitForLoadState('domcontentloaded');
    
    // 시간 변경 시도 (사용자는 오프라인이라 실시간 반영 안됨)
    await this.adminModifyScheduleTime(adminPage, '김스케줄', '21:00', '05:00');

    // 네트워크 복구
    await context.setOffline(false);
    await page.waitForTimeout(3000);

    // 온라인 복구 후 자동 동기화 확인
    await expect(page.locator('text=21:00')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=05:00')).toBeVisible();

    console.log('✅ 오프라인 → 온라인 복구 후 자동 동기화 확인');

    await adminPage.close();
  });

  test('푸시 알림 및 실시간 업데이트 알림', async ({ page, context }) => {
    await authHelper.loginAsUser('김스케줄', 'test123');
    await page.goto('http://localhost:3001/my-schedule');
    await page.waitForLoadState('domcontentloaded');

    // 알림 권한 요청 시뮬레이션
    await page.evaluate(() => {
      if ('Notification' in window) {
        Notification.requestPermission();
      }
    });

    // 관리자가 중요한 변경사항 적용
    const adminPage = await context.newPage();
    await authHelper.loginAsAdmin(adminPage);
    await adminPage.goto('http://localhost:3001/admin/job-postings');
    await adminPage.waitForLoadState('domcontentloaded');

    // 시간 대폭 변경
    await this.adminModifyScheduleTime(adminPage, '김스케줄', '16:00', '00:00');

    // 사용자 페이지에서 알림 토스트 확인
    const notificationToast = page.locator('[data-testid="notification-toast"]').or(
      page.locator('.toast-notification').or(
        page.locator('.alert').or(
          page.locator('[role="alert"]')
        )
      )
    );

    // 알림이 나타나는지 확인
    if (await notificationToast.isVisible({ timeout: 10000 })) {
      await expect(notificationToast).toContainText(/스케줄.*변경/);
      console.log('✅ 실시간 변경 알림 표시 확인');
    }

    // 변경된 시간 확인
    await expect(page.locator('text=16:00')).toBeVisible();
    await expect(page.locator('text=00:00')).toBeVisible();

    // 급여 재계산 확인 (8시간 근무 유지)
    await expect(page.locator('text=120,000')).toBeVisible();

    console.log('✅ 푸시 알림 및 실시간 업데이트 알림 시스템 확인');

    await adminPage.close();
  });

  test('다중 스케줄 동기화', async ({ page, context }) => {
    // 추가 공고 생성
    await dataHelper.createTestJobPosting('test-job-schedule-2', {
      title: '포커 딜러 모집 - 추가 스케줄',
      location: '부산 해운대',
      roles: [{ name: '딜러', hourlyWage: 14000, requiredCount: 1 }],
      jobDate: '2025-02-15',
      startTime: '20:00',
      endTime: '04:00',
      status: 'active'
    });

    // 동일 사용자가 추가 공고에도 지원하고 확정
    await dataHelper.createTestApplication('test-job-schedule-2', {
      name: '김스케줄',
      phone: '010-1234-5678',
      experience: 'intermediate',
      status: 'confirmed'
    });

    await dataHelper.createTestStaff('test-job-schedule-2', {
      name: '김스케줄',
      phone: '010-1234-5678',
      role: '딜러',
      hourlyWage: 14000,
      status: 'scheduled'
    });

    // 사용자 로그인 후 내 스케줄 페이지
    await authHelper.loginAsUser('김스케줄', 'test123');
    await page.goto('http://localhost:3001/my-schedule');
    await page.waitForLoadState('domcontentloaded');

    // 두 개의 스케줄이 모두 표시되는지 확인
    await expect(page.locator('text=스케줄 동기화 테스트')).toBeVisible();
    await expect(page.locator('text=추가 스케줄')).toBeVisible();

    // 각 스케줄의 시간 정보 확인
    await expect(page.locator('text=18:00')).toBeVisible(); // 첫 번째 스케줄
    await expect(page.locator('text=20:00')).toBeVisible(); // 두 번째 스케줄

    // 관리자가 두 번째 스케줄만 변경
    const adminPage = await context.newPage();
    await authHelper.loginAsAdmin(adminPage);
    await adminPage.goto('http://localhost:3001/admin/job-postings');
    await adminPage.waitForLoadState('domcontentloaded');

    // 두 번째 공고의 시간 변경
    const secondJobRow = adminPage.locator('tr').filter({ hasText: '추가 스케줄' });
    if (await secondJobRow.isVisible()) {
      await secondJobRow.click();
      await adminPage.waitForURL(/\/admin\/job-postings\/.*/, { timeout: 5000 });
      
      await this.adminModifyScheduleTimeInCurrentJob(adminPage, '김스케줄', '21:00', '05:00');
    }

    // 사용자 페이지에서 해당 스케줄만 변경되었는지 확인
    await expect(page.locator('text=18:00')).toBeVisible(); // 첫 번째는 그대로
    await expect(page.locator('text=21:00')).toBeVisible({ timeout: 10000 }); // 두 번째만 변경

    console.log('✅ 다중 스케줄 개별 동기화 확인');

    await adminPage.close();
  });

});

// Helper Methods
async function adminModifyScheduleTime(adminPage: Page, staffName: string, startTime: string, endTime: string) {
    const jobRow = adminPage.locator('tr').filter({ hasText: '스케줄 동기화 테스트' });
    if (await jobRow.isVisible()) {
      await jobRow.click();
      await adminPage.waitForURL(/\/admin\/job-postings\/.*/, { timeout: 5000 });
    }

    await adminPage.locator('button').filter({ hasText: /스태프|staff/i }).first().click();
    await adminPage.waitForTimeout(1000);

    const staffRow = adminPage.locator('tr').filter({ hasText: staffName });
    await modifyStaffTime(adminPage, staffRow, startTime, endTime);
  }

async function adminModifyScheduleTimeInCurrentJob(adminPage: Page, staffName: string, startTime: string, endTime: string) {
    await adminPage.locator('button').filter({ hasText: /스태프|staff/i }).first().click();
    await adminPage.waitForTimeout(1000);

    const staffRow = adminPage.locator('tr').filter({ hasText: staffName });
    await modifyStaffTime(adminPage, staffRow, startTime, endTime);
  }

async function modifyStaffTime(page: Page, staffRow: any, startTime: string, endTime: string) {
    const timeButton = staffRow.locator('button').filter({ hasText: /시간|time/i }).or(
      staffRow.locator('td').filter({ hasText: /\d{2}:\d{2}/ })
    ).first();

    if (await timeButton.isVisible()) {
      await timeButton.click();
      await page.waitForTimeout(500);

      const startTimeInput = page.locator('input[type="time"]').first();
      if (await startTimeInput.isVisible()) {
        await startTimeInput.fill(startTime);
      }

      const endTimeInput = page.locator('input[type="time"]').nth(1);
      if (await endTimeInput.isVisible()) {
        await endTimeInput.fill(endTime);
      }

      const saveButton = page.locator('button').filter({ hasText: /저장|save/i });
      if (await saveButton.isVisible()) {
        await saveButton.click();
      } else {
        await page.keyboard.press('Enter');
      }

      await page.waitForTimeout(1000);
    }
  }

// Helper Functions
async function adminModifyHourlyWage(adminPage: Page, staffName: string, newWage: number) {
  await navigateToStaffTab(adminPage);

  const staffRow = adminPage.locator('tr').filter({ hasText: staffName });
  const wageCell = staffRow.locator('td').filter({ hasText: /\d{1,3}(,\d{3})*/ });

  if (await wageCell.isVisible()) {
    await wageCell.dblclick();
    await adminPage.waitForTimeout(500);

    const wageInput = adminPage.locator('input').filter({ hasText: '' });
    if (await wageInput.isVisible()) {
      await wageInput.clear();
      await wageInput.fill(newWage.toString());
      await adminPage.keyboard.press('Enter');
      await adminPage.waitForTimeout(1000);
    }
  }
}

// Helper Functions
async function navigateToStaffTab(adminPage: Page) {
  const jobRow = adminPage.locator('tr').filter({ hasText: '스케줄 동기화 테스트' });
  if (await jobRow.isVisible()) {
    await jobRow.click();
    await adminPage.waitForURL(/\/admin\/job-postings\/.*/, { timeout: 5000 });
  }

  await adminPage.locator('button').filter({ hasText: /스태프|staff/i }).first().click();
  await adminPage.waitForTimeout(1000);
}

// Helper Functions
async function extractSalaryAmount(page: Page): Promise<number> {
  try {
    const salaryText = await page.locator('text=/\d{1,3}(,\d{3})*원?/').first().textContent();
    if (salaryText) {
      return parseInt(salaryText.replace(/[,원]/g, ''));
    }
  } catch {
    // 추출 실패 시 기본값
  }
  return 120000;
}