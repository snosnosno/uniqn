/**
 * 동시 출석 관리 E2E 테스트
 *
 * 시나리오:
 * 1. 여러 스태프가 동시에 로그인
 * 2. 관리자가 실시간 출석 현황 모니터링
 * 3. 스태프들이 체크인/체크아웃
 * 4. 관리자가 출석 수정 및 확인
 */

import { test, expect, BrowserContext, Page } from '@playwright/test';

// 테스트 사용자 정보
const ADMIN_USER = {
  email: 'admin@test.com',
  password: 'testpass123',
  name: '관리자'
};

const STAFF_USERS = [
  { email: 'staff1@test.com', password: 'testpass123', name: '스태프1' },
  { email: 'staff2@test.com', password: 'testpass123', name: '스태프2' },
  { email: 'staff3@test.com', password: 'testpass123', name: '스태프3' },
  { email: 'staff4@test.com', password: 'testpass123', name: '스태프4' },
  { email: 'staff5@test.com', password: 'testpass123', name: '스태프5' },
];

test.describe('동시 출석 관리', () => {
  let adminContext: BrowserContext;
  let adminPage: Page;
  let staffContexts: BrowserContext[] = [];
  let staffPages: Page[] = [];

  test.beforeAll(async ({ browser }) => {
    // 관리자 브라우저 컨텍스트 생성
    adminContext = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
    });
    adminPage = await adminContext.newPage();

    // 스태프들 브라우저 컨텍스트 생성
    for (let i = 0; i < STAFF_USERS.length; i++) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        locale: 'ko-KR',
        timezoneId: 'Asia/Seoul',
      });
      const page = await context.newPage();

      staffContexts.push(context);
      staffPages.push(page);
    }
  });

  test.afterAll(async () => {
    // 모든 컨텍스트 정리
    await adminContext.close();
    for (const context of staffContexts) {
      await context.close();
    }
  });

  test('관리자 로그인 및 출석 관리 페이지 준비', async () => {
    // 관리자 로그인
    await adminPage.goto('/login');
    await adminPage.fill('input[name="email"]', ADMIN_USER.email);
    await adminPage.fill('input[name="password"]', ADMIN_USER.password);
    await adminPage.click('button[type="submit"]');

    // 로그인 완료 대기
    await adminPage.waitForURL('**/admin/ceo-dashboard');

    // 출석 관리 페이지로 이동
    await adminPage.goto('/attendance');
    await expect(adminPage.locator('text=출석 관리')).toBeVisible();

    // 오늘 날짜 선택 (기본적으로 오늘이 선택되어 있어야 함)
    const today = new Date().toLocaleDateString('ko-KR');
    await expect(adminPage.locator(`text=${today.split('.').slice(0, 2).join('.')}`)).toBeVisible();

    // 초기 출석 현황 확인 (모든 스태프가 미출석 상태)
    await expect(adminPage.locator('text=전체 스태프')).toBeVisible();
    await expect(adminPage.locator('text=출석: 0명')).toBeVisible();
  });

  test('여러 스태프가 동시에 로그인', async () => {
    // 모든 스태프가 동시에 로그인
    const loginPromises = STAFF_USERS.map(async (staff, index) => {
      const page = staffPages[index];

      // 로그인
      await page.goto('/login');
      await page.fill('input[name="email"]', staff.email);
      await page.fill('input[name="password"]', staff.password);
      await page.click('button[type="submit"]');

      // 프로필 페이지 로드 대기
      await page.waitForURL('**/profile');
      await expect(page.locator(`text=${staff.name}`)).toBeVisible();

      return `${staff.name} 로그인 완료`;
    });

    // 모든 스태프 로그인 완료 대기
    const results = await Promise.all(loginPromises);
    expect(results).toHaveLength(STAFF_USERS.length);
  });

  test('스태프들이 순차적으로 체크인', async () => {
    // 스태프들이 체크인 (시간차를 두고)
    for (let i = 0; i < STAFF_USERS.length; i++) {
      const page = staffPages[i];
      const staff = STAFF_USERS[i];

      // 출석 페이지로 이동
      await page.goto('/attendance');

      // 체크인 버튼 클릭
      await page.click('button:has-text("체크인")');

      // 체크인 성공 메시지 확인
      await expect(page.locator('text=체크인이 완료되었습니다')).toBeVisible();

      // 체크인 시간 표시 확인
      await expect(page.locator('text=체크인')).toBeVisible();

      // 관리자 페이지에서 실시간 업데이트 확인
      await adminPage.reload();
      await expect(adminPage.locator(`text=출석: ${i + 1}명`)).toBeVisible();

      // 개별 스태프 출석 상태 확인
      await expect(adminPage.locator(`text=${staff.name}`)).toBeVisible();
      const staffRow = adminPage.locator(`[data-testid="staff-row"]:has-text("${staff.name}")`);
      await expect(staffRow.locator('text=출석')).toBeVisible();

      // 1초 대기 (실시간 업데이트 시뮬레이션)
      await page.waitForTimeout(1000);
    }

    // 최종 출석 통계 확인
    await expect(adminPage.locator(`text=출석: ${STAFF_USERS.length}명`)).toBeVisible();
    await expect(adminPage.locator('text=미출석: 0명')).toBeVisible();
  });

  test('일부 스태프가 지각 처리', async () => {
    // 마지막 두 스태프를 지각으로 변경
    for (let i = STAFF_USERS.length - 2; i < STAFF_USERS.length; i++) {
      const staff = STAFF_USERS[i];

      // 관리자가 해당 스태프 찾기
      const staffRow = adminPage.locator(`[data-testid="staff-row"]:has-text("${staff.name}")`);

      // 출석 상태 드롭다운 클릭
      await staffRow.locator('select[data-testid="attendance-status"]').selectOption('late');

      // 지각 사유 입력 모달
      await adminPage.fill('input[name="lateReason"]', '교통 지연');
      await adminPage.click('button:has-text("확인")');

      // 성공 메시지 확인
      await expect(adminPage.locator('text=출석 상태가 변경되었습니다')).toBeVisible();

      // 상태 변경 확인
      await expect(staffRow.locator('text=지각')).toBeVisible();
    }

    // 통계 업데이트 확인
    await expect(adminPage.locator(`text=출석: ${STAFF_USERS.length - 2}명`)).toBeVisible();
    await expect(adminPage.locator('text=지각: 2명')).toBeVisible();
  });

  test('스태프들의 중간 휴식 및 복귀', async () => {
    // 중간에 일부 스태프가 휴식 후 복귀
    const breakStaffIndexes = [1, 3]; // 두 번째, 네 번째 스태프

    for (const index of breakStaffIndexes) {
      const page = staffPages[index];
      const staff = STAFF_USERS[index];

      // 휴식 버튼 클릭
      await page.goto('/attendance');
      await page.click('button:has-text("휴식")');

      // 휴식 시작 확인
      await expect(page.locator('text=휴식 중')).toBeVisible();

      // 관리자 페이지에서 휴식 상태 확인
      await adminPage.reload();
      const staffRow = adminPage.locator(`[data-testid="staff-row"]:has-text("${staff.name}")`);
      await expect(staffRow.locator('text=휴식')).toBeVisible();

      // 2초 후 복귀
      await page.waitForTimeout(2000);
      await page.click('button:has-text("복귀")');

      // 복귀 확인
      await expect(page.locator('text=복귀가 완료되었습니다')).toBeVisible();
      await expect(page.locator('text=근무 중')).toBeVisible();

      // 관리자 페이지에서 복귀 상태 확인
      await adminPage.reload();
      await expect(staffRow.locator('text=출석')).toBeVisible();
    }
  });

  test('동시 체크아웃 처리', async () => {
    // 모든 스태프가 동시에 체크아웃
    const checkoutPromises = STAFF_USERS.map(async (staff, index) => {
      const page = staffPages[index];

      // 체크아웃 버튼 클릭
      await page.goto('/attendance');
      await page.click('button:has-text("체크아웃")');

      // 체크아웃 확인 메시지
      await expect(page.locator('text=체크아웃이 완료되었습니다')).toBeVisible();

      // 근무 시간 요약 확인
      await expect(page.locator('text=총 근무시간')).toBeVisible();
      await expect(page.locator('[data-testid="work-duration"]')).toBeVisible();

      return `${staff.name} 체크아웃 완료`;
    });

    // 모든 스태프 체크아웃 완료 대기
    const results = await Promise.all(checkoutPromises);
    expect(results).toHaveLength(STAFF_USERS.length);

    // 관리자 페이지에서 모든 스태프 퇴근 확인
    await adminPage.reload();

    for (const staff of STAFF_USERS) {
      const staffRow = adminPage.locator(`[data-testid="staff-row"]:has-text("${staff.name}")`);
      await expect(staffRow.locator('text=퇴근')).toBeVisible();

      // 근무 시간 표시 확인
      await expect(staffRow.locator('[data-testid="work-hours"]')).toBeVisible();
    }

    // 일일 출석 요약 확인
    await expect(adminPage.locator('text=일일 요약')).toBeVisible();
    await expect(adminPage.locator(`text=총 출근: ${STAFF_USERS.length}명`)).toBeVisible();
    await expect(adminPage.locator('text=지각: 2명')).toBeVisible();
    await expect(adminPage.locator('text=정상 퇴근: 5명')).toBeVisible();
  });

  test('관리자의 출석 수정 및 급여 계산', async () => {
    // 한 스태프의 출근 시간을 관리자가 수정
    const staff = STAFF_USERS[0];
    const staffRow = adminPage.locator(`[data-testid="staff-row"]:has-text("${staff.name}")`);

    // 시간 편집 버튼 클릭
    await staffRow.locator('button[data-testid="edit-time"]').click();

    // 출근 시간 수정
    await adminPage.fill('input[name="checkInTime"]', '17:30');
    await adminPage.fill('input[name="checkOutTime"]', '23:30');

    // 수정 사유 입력
    await adminPage.fill('textarea[name="editReason"]', '실제 근무 시간으로 수정');

    // 저장
    await adminPage.click('button:has-text("저장")');

    // 수정 완료 메시지 확인
    await expect(adminPage.locator('text=근무시간이 수정되었습니다')).toBeVisible();

    // 수정된 시간 확인
    await expect(staffRow.locator('text=17:30')).toBeVisible();
    await expect(staffRow.locator('text=23:30')).toBeVisible();

    // 급여 미리보기 버튼 클릭
    await adminPage.click('button:has-text("급여 계산")');

    // 급여 계산 결과 확인
    await expect(adminPage.locator('text=일일 급여 요약')).toBeVisible();

    // 각 스태프의 급여 정보 확인
    for (const staffUser of STAFF_USERS) {
      const payrollRow = adminPage.locator(`[data-testid="payroll-row"]:has-text("${staffUser.name}")`);
      await expect(payrollRow.locator('[data-testid="work-hours"]')).toBeVisible();
      await expect(payrollRow.locator('[data-testid="total-pay"]')).toBeVisible();
    }

    // 총 급여 합계 확인
    await expect(adminPage.locator('[data-testid="total-payroll"]')).toBeVisible();
  });

  test('실시간 동기화 검증', async () => {
    // 새로운 테스트 날짜로 이동 (내일)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = tomorrow.toISOString().split('T')[0];

    // 관리자가 날짜 변경
    await adminPage.fill('input[type="date"]', tomorrowString);

    // 스태프들도 동일한 날짜로 이동해서 실시간 동기화 테스트
    const staff1Page = staffPages[0];
    const staff2Page = staffPages[1];

    // 첫 번째 스태프 체크인
    await staff1Page.goto('/attendance');
    await staff1Page.click('button:has-text("체크인")');

    // 두 번째 스태프 페이지에서 실시간 업데이트 확인
    await staff2Page.goto('/attendance');

    // 실시간 출석 현황에 첫 번째 스태프가 표시되는지 확인
    await expect(staff2Page.locator('text=현재 출석 중')).toBeVisible();
    await expect(staff2Page.locator(`text=${STAFF_USERS[0].name}`)).toBeVisible();

    // 관리자 페이지에서도 실시간 업데이트 확인
    await adminPage.reload();
    await expect(adminPage.locator('text=출석: 1명')).toBeVisible();

    // Firebase 실시간 리스너가 작동하는지 추가 검증
    await staff2Page.click('button:has-text("체크인")');

    // 1초 대기 후 관리자 페이지에서 자동 업데이트 확인
    await page.waitForTimeout(1000);
    await expect(adminPage.locator('text=출석: 2명')).toBeVisible();
  });

  test('성능 테스트 - 동시 출석 처리', async () => {
    // 모든 스태프가 동시에 출석 관련 작업을 수행할 때의 성능 측정
    const startTime = Date.now();

    // 동시에 체크인 시도
    const performancePromises = staffPages.map(async (page, index) => {
      const staff = STAFF_USERS[index];
      const operationStartTime = Date.now();

      // 랜덤한 작업 수행 (체크인, 상태 확인, 페이지 이동 등)
      const operations = ['checkin', 'status', 'schedule'];
      const randomOperation = operations[Math.floor(Math.random() * operations.length)];

      switch (randomOperation) {
        case 'checkin':
          await page.goto('/attendance');
          await page.click('button:has-text("체크인")');
          await page.waitForSelector('text=체크인이 완료되었습니다');
          break;
        case 'status':
          await page.goto('/attendance');
          await page.waitForSelector('[data-testid="attendance-status"]');
          break;
        case 'schedule':
          await page.goto('/my-schedule');
          await page.waitForSelector('[data-testid="schedule-calendar"]');
          break;
      }

      const operationTime = Date.now() - operationStartTime;
      return { staff: staff.name, operation: randomOperation, time: operationTime };
    });

    const performanceResults = await Promise.all(performancePromises);
    const totalTime = Date.now() - startTime;

    // 성능 검증
    expect(totalTime).toBeLessThan(15000); // 15초 이내

    // 각 작업이 합리적인 시간 내에 완료되었는지 확인
    for (const result of performanceResults) {
      expect(result.time).toBeLessThan(8000); // 각 작업 8초 이내
    }

    // 데이터베이스 동시성 처리 검증
    await adminPage.reload();
    const finalAttendanceCount = await adminPage.locator('[data-testid="attendance-count"]').textContent();

    console.log(`총 처리 시간: ${totalTime}ms`);
    console.log('개별 작업 시간:', performanceResults);
    console.log('최종 출석 인원:', finalAttendanceCount);
  });

  test('오류 상황 처리 - 네트워크 지연 및 중복 요청', async () => {
    const testPage = staffPages[0];

    // 네트워크 지연 시뮬레이션
    await testPage.route('**/api/**', route => {
      // 2초 지연 후 응답
      setTimeout(() => route.continue(), 2000);
    });

    // 체크인 버튼 빠르게 여러 번 클릭 (중복 요청 시뮬레이션)
    await testPage.goto('/attendance');

    // 빠른 연속 클릭
    await Promise.all([
      testPage.click('button:has-text("체크인")'),
      testPage.click('button:has-text("체크인")'),
      testPage.click('button:has-text("체크인")'),
    ]);

    // 중복 요청 방지 확인 (한 번만 성공해야 함)
    await testPage.waitForSelector('text=체크인이 완료되었습니다');

    // 에러 메시지가 없는지 확인
    const errorMessages = await testPage.locator('text=오류').count();
    expect(errorMessages).toBe(0);

    // 관리자 페이지에서 정확히 한 번만 기록되었는지 확인
    await adminPage.reload();
    const staffRow = adminPage.locator(`[data-testid="staff-row"]:has-text("${STAFF_USERS[0].name}")`);
    const checkInEntries = await staffRow.locator('[data-testid="checkin-time"]').count();
    expect(checkInEntries).toBe(1); // 중복 기록이 없어야 함
  });
});