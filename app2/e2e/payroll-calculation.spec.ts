/**
 * 급여 정산 플로우 E2E 테스트
 *
 * 시나리오:
 * 1. 여러 스태프의 근무 기록 생성
 * 2. 관리자가 급여 일괄 계산
 * 3. 스태프들이 개별 급여 확인
 * 4. 관리자가 정산 완료 처리
 */

import { test, expect, BrowserContext, Page } from '@playwright/test';

// 테스트 사용자 정보
const ADMIN_USER = {
  email: 'admin@test.com',
  password: 'testpass123',
  name: '관리자'
};

const STAFF_USERS = [
  { email: 'staff1@test.com', password: 'testpass123', name: '스태프1', hourlyWage: 30000 },
  { email: 'staff2@test.com', password: 'testpass123', name: '스태프2', hourlyWage: 28000 },
  { email: 'staff3@test.com', password: 'testpass123', name: '스태프3', hourlyWage: 32000 },
  { email: 'staff4@test.com', password: 'testpass123', name: '스태프4', hourlyWage: 25000 },
  { email: 'staff5@test.com', password: 'testpass123', name: '스태프5', hourlyWage: 35000 },
];

// 테스트용 근무 기록 데이터
const WORK_SESSIONS = [
  { date: '2025-01-15', startTime: '18:00', endTime: '23:00', hours: 5 },
  { date: '2025-01-16', startTime: '19:00', endTime: '02:00', hours: 7 },
  { date: '2025-01-17', startTime: '17:30', endTime: '22:30', hours: 5 },
  { date: '2025-01-18', startTime: '18:00', endTime: '01:00', hours: 7 },
  { date: '2025-01-19', startTime: '20:00', endTime: '03:00', hours: 7 },
];

test.describe('급여 정산 플로우', () => {
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

  test('관리자 로그인 및 초기 설정', async () => {
    // 관리자 로그인
    await adminPage.goto('/login');
    await adminPage.fill('input[name="email"]', ADMIN_USER.email);
    await adminPage.fill('input[name="password"]', ADMIN_USER.password);
    await adminPage.click('button[type="submit"]');

    // CEO 대시보드 확인
    await adminPage.waitForURL('**/admin/ceo-dashboard');
    await expect(adminPage.locator('text=CEO 대시보드')).toBeVisible();

    // 급여 관리 페이지로 이동
    await adminPage.goto('/payroll');
    await expect(adminPage.locator('text=급여 관리')).toBeVisible();

    // 기간 설정 (지난주)
    const lastWeekStart = new Date();
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date();

    const startDate = lastWeekStart.toISOString().split('T')[0];
    const endDate = lastWeekEnd.toISOString().split('T')[0];

    await adminPage.fill('input[name="startDate"]', startDate);
    await adminPage.fill('input[name="endDate"]', endDate);

    // 조회 버튼 클릭
    await adminPage.click('button:has-text("조회")');
  });

  test('스태프들의 과거 근무 기록 생성 (관리자가 수동 입력)', async () => {
    // 각 스태프별로 근무 기록 생성
    for (let staffIndex = 0; staffIndex < STAFF_USERS.length; staffIndex++) {
      const staff = STAFF_USERS[staffIndex];

      // 출석 관리 페이지로 이동
      await adminPage.goto('/attendance');

      // 스태프 선택
      await adminPage.selectOption('select[name="staffFilter"]', staff.name);

      // 각 근무일별로 출석 기록 생성
      for (const session of WORK_SESSIONS) {
        // 날짜 선택
        await adminPage.fill('input[type="date"]', session.date);

        // 해당 스태프 찾기
        const staffRow = adminPage.locator(`[data-testid="staff-row"]:has-text("${staff.name}")`);

        // 수동 체크인/체크아웃 기록 추가
        await staffRow.locator('button[data-testid="add-manual-record"]').click();

        // 시간 입력
        await adminPage.fill('input[name="checkInTime"]', session.startTime);
        await adminPage.fill('input[name="checkOutTime"]', session.endTime);

        // 메모 추가
        await adminPage.fill('textarea[name="notes"]', `${session.date} 정상 근무`);

        // 저장
        await adminPage.click('button:has-text("저장")');

        // 성공 메시지 확인
        await expect(adminPage.locator('text=근무 기록이 저장되었습니다')).toBeVisible();

        // 모달 닫기
        await adminPage.press('body', 'Escape');

        // 잠시 대기 (데이터베이스 저장 시간 고려)
        await adminPage.waitForTimeout(500);
      }
    }

    // 전체 근무 기록 요약 확인
    await adminPage.goto('/admin/reports');
    await expect(adminPage.locator('text=근무 현황')).toBeVisible();

    // 총 근무 일수 확인
    const totalWorkDays = STAFF_USERS.length * WORK_SESSIONS.length;
    await expect(adminPage.locator(`text=총 ${totalWorkDays}일`)).toBeVisible();
  });

  test('스태프들이 개별 로그인하여 근무 기록 확인', async () => {
    // 모든 스태프가 로그인하여 자신의 근무 기록 확인
    const verificationPromises = STAFF_USERS.map(async (staff, index) => {
      const page = staffPages[index];

      // 로그인
      await page.goto('/login');
      await page.fill('input[name="email"]', staff.email);
      await page.fill('input[name="password"]', staff.password);
      await page.click('button[type="submit"]');

      // 프로필 페이지 로드 대기
      await page.waitForURL('**/profile');

      // 내 근무 기록 페이지로 이동
      await page.goto('/my-work-history');
      await expect(page.locator('text=내 근무 기록')).toBeVisible();

      // 기간 설정
      await page.fill('input[name="startDate"]', '2025-01-15');
      await page.fill('input[name="endDate"]', '2025-01-19');
      await page.click('button:has-text("조회")');

      // 각 근무일별 기록 확인
      for (const session of WORK_SESSIONS) {
        await expect(page.locator(`text=${session.date}`)).toBeVisible();
        await expect(page.locator(`text=${session.startTime}`)).toBeVisible();
        await expect(page.locator(`text=${session.endTime}`)).toBeVisible();
        await expect(page.locator(`text=${session.hours}시간`)).toBeVisible();
      }

      // 총 근무시간 확인
      const totalHours = WORK_SESSIONS.reduce((sum, session) => sum + session.hours, 0);
      await expect(page.locator(`text=총 ${totalHours}시간`)).toBeVisible();

      return `${staff.name} 근무 기록 확인 완료`;
    });

    const results = await Promise.all(verificationPromises);
    expect(results).toHaveLength(STAFF_USERS.length);
  });

  test('관리자가 급여 일괄 계산', async () => {
    // 급여 관리 페이지로 이동
    await adminPage.goto('/payroll');

    // 계산 기간 설정
    await adminPage.fill('input[name="startDate"]', '2025-01-15');
    await adminPage.fill('input[name="endDate"]', '2025-01-19');

    // 급여 계산 실행
    await adminPage.click('button:has-text("급여 계산")');

    // 계산 진행 상황 확인
    await expect(adminPage.locator('text=급여를 계산하는 중입니다')).toBeVisible();

    // 계산 완료 대기 (최대 30초)
    await adminPage.waitForSelector('text=급여 계산이 완료되었습니다', { timeout: 30000 });

    // 각 스태프별 급여 정보 확인
    for (const staff of STAFF_USERS) {
      const payrollRow = adminPage.locator(`[data-testid="payroll-row"]:has-text("${staff.name}")`);

      // 스태프 정보 확인
      await expect(payrollRow).toBeVisible();

      // 총 근무시간 확인
      const totalHours = WORK_SESSIONS.reduce((sum, session) => sum + session.hours, 0);
      await expect(payrollRow.locator(`text=${totalHours}시간`)).toBeVisible();

      // 시급 확인
      await expect(payrollRow.locator(`text=${staff.hourlyWage.toLocaleString()}원`)).toBeVisible();

      // 총 급여 계산 확인
      const expectedPay = totalHours * staff.hourlyWage;
      await expect(payrollRow.locator(`text=${expectedPay.toLocaleString()}원`)).toBeVisible();

      // 세금 및 공제 금액 확인
      await expect(payrollRow.locator('[data-testid="tax-amount"]')).toBeVisible();
      await expect(payrollRow.locator('[data-testid="net-pay"]')).toBeVisible();
    }

    // 전체 급여 합계 확인
    const totalPayroll = STAFF_USERS.reduce((sum, staff) => {
      const totalHours = WORK_SESSIONS.reduce((sum, session) => sum + session.hours, 0);
      return sum + (totalHours * staff.hourlyWage);
    }, 0);

    await expect(adminPage.locator(`[data-testid="total-payroll"]:has-text("${totalPayroll.toLocaleString()}원")`)).toBeVisible();

    // 급여 명세서 생성
    await adminPage.click('button:has-text("명세서 생성")');
    await expect(adminPage.locator('text=급여 명세서가 생성되었습니다')).toBeVisible();
  });

  test('급여 계산 상세 내역 검증', async () => {
    // 첫 번째 스태프의 상세 급여 내역 확인
    const firstStaff = STAFF_USERS[0];
    const payrollRow = adminPage.locator(`[data-testid="payroll-row"]:has-text("${firstStaff.name}")`);

    // 상세 보기 클릭
    await payrollRow.locator('button:has-text("상세")').click();

    // 상세 내역 모달 확인
    await expect(adminPage.locator('text=급여 상세 내역')).toBeVisible();

    // 일별 근무 기록 확인
    for (const session of WORK_SESSIONS) {
      const dailyRow = adminPage.locator(`[data-testid="daily-record"]:has-text("${session.date}")`);
      await expect(dailyRow).toBeVisible();

      // 근무 시간 확인
      await expect(dailyRow.locator(`text=${session.startTime}`)).toBeVisible();
      await expect(dailyRow.locator(`text=${session.endTime}`)).toBeVisible();
      await expect(dailyRow.locator(`text=${session.hours}h`)).toBeVisible();

      // 일일 급여 확인
      const dailyPay = session.hours * firstStaff.hourlyWage;
      await expect(dailyRow.locator(`text=${dailyPay.toLocaleString()}원`)).toBeVisible();
    }

    // 추가 수당 및 공제 항목 확인
    await expect(adminPage.locator('[data-testid="overtime-pay"]')).toBeVisible(); // 야간 수당
    await expect(adminPage.locator('[data-testid="holiday-pay"]')).toBeVisible(); // 휴일 수당
    await expect(adminPage.locator('[data-testid="tax-deduction"]')).toBeVisible(); // 세금 공제
    await expect(adminPage.locator('[data-testid="insurance-deduction"]')).toBeVisible(); // 보험료 공제

    // 최종 지급액 확인
    await expect(adminPage.locator('[data-testid="final-net-pay"]')).toBeVisible();

    // 모달 닫기
    await adminPage.press('body', 'Escape');
  });

  test('스태프들이 개별 급여 명세서 확인', async () => {
    // 모든 스태프가 자신의 급여 명세서 확인
    const payrollCheckPromises = STAFF_USERS.map(async (staff, index) => {
      const page = staffPages[index];

      // 급여 조회 페이지로 이동
      await page.goto('/my-payroll');
      await expect(page.locator('text=내 급여 내역')).toBeVisible();

      // 조회 기간 설정
      await page.fill('input[name="startDate"]', '2025-01-15');
      await page.fill('input[name="endDate"]', '2025-01-19');
      await page.click('button:has-text("조회")');

      // 급여 명세서 확인
      await expect(page.locator('text=급여 명세서')).toBeVisible();

      // 기본 정보 확인
      await expect(page.locator(`text=${staff.name}`)).toBeVisible();

      // 근무 현황 확인
      const totalHours = WORK_SESSIONS.reduce((sum, session) => sum + session.hours, 0);
      await expect(page.locator(`text=총 근무시간: ${totalHours}시간`)).toBeVisible();
      await expect(page.locator(`text=시급: ${staff.hourlyWage.toLocaleString()}원`)).toBeVisible();

      // 급여 계산 내역 확인
      const grossPay = totalHours * staff.hourlyWage;
      await expect(page.locator(`text=기본급: ${grossPay.toLocaleString()}원`)).toBeVisible();

      // 공제 내역 확인
      await expect(page.locator('text=소득세')).toBeVisible();
      await expect(page.locator('text=국민연금')).toBeVisible();
      await expect(page.locator('text=건강보험')).toBeVisible();
      await expect(page.locator('text=고용보험')).toBeVisible();

      // 최종 지급액 확인
      await expect(page.locator('[data-testid="net-salary"]')).toBeVisible();

      // 명세서 다운로드 기능 확인
      await expect(page.locator('button:has-text("명세서 다운로드")')).toBeVisible();

      // 급여 이의제기 버튼 확인
      await expect(page.locator('button:has-text("이의제기")')).toBeVisible();

      return `${staff.name} 급여 명세서 확인 완료`;
    });

    const results = await Promise.all(payrollCheckPromises);
    expect(results).toHaveLength(STAFF_USERS.length);
  });

  test('급여 이의제기 및 관리자 처리', async () => {
    // 한 스태프가 급여에 대해 이의제기
    const staff = STAFF_USERS[2]; // 세 번째 스태프
    const staffPage = staffPages[2];

    // 이의제기 버튼 클릭
    await staffPage.click('button:has-text("이의제기")');

    // 이의제기 내용 입력
    await staffPage.fill('textarea[name="disputeReason"]',
      '1월 17일 연장 근무 2시간이 누락된 것 같습니다. 실제로는 24:30까지 근무했습니다.');

    // 이의제기 제출
    await staffPage.click('button:has-text("이의제기 제출")');

    // 제출 완료 메시지 확인
    await expect(staffPage.locator('text=이의제기가 접수되었습니다')).toBeVisible();

    // 관리자 페이지에서 이의제기 확인
    await adminPage.goto('/payroll/disputes');
    await expect(adminPage.locator('text=급여 이의제기 관리')).toBeVisible();

    // 새로운 이의제기 확인
    const disputeRow = adminPage.locator(`[data-testid="dispute-row"]:has-text("${staff.name}")`);
    await expect(disputeRow).toBeVisible();
    await expect(disputeRow.locator('text=검토 중')).toBeVisible();

    // 이의제기 상세 내용 확인
    await disputeRow.locator('button:has-text("상세")').click();
    await expect(adminPage.locator('text=연장 근무 2시간이 누락')).toBeVisible();

    // 원래 근무 기록 확인 및 수정
    await adminPage.click('button:has-text("근무 기록 확인")');

    // 1월 17일 기록 수정
    await adminPage.fill('input[name="checkOutTime"]', '00:30');

    // 수정 사유 입력
    await adminPage.fill('textarea[name="editReason"]', '연장 근무 시간 반영');

    // 저장
    await adminPage.click('button:has-text("수정 저장")');

    // 급여 재계산
    await adminPage.click('button:has-text("급여 재계산")');

    // 이의제기 승인
    await adminPage.click('button:has-text("이의제기 승인")');

    // 승인 완료 메시지 확인
    await expect(adminPage.locator('text=이의제기가 승인되고 급여가 수정되었습니다')).toBeVisible();

    // 스태프 페이지에서 수정된 급여 확인
    await staffPage.reload();
    await staffPage.goto('/my-payroll');

    // 수정된 급여 정보 확인
    const updatedHours = WORK_SESSIONS.reduce((sum, session) => sum + session.hours, 0) + 2; // 2시간 추가
    await expect(staffPage.locator(`text=총 근무시간: ${updatedHours}시간`)).toBeVisible();

    // 수정 내역 알림 확인
    await expect(staffPage.locator('text=급여가 수정되었습니다')).toBeVisible();
  });

  test('관리자가 정산 완료 처리', async () => {
    // 급여 관리 페이지로 이동
    await adminPage.goto('/payroll');

    // 모든 급여가 최종 확인되었는지 체크
    for (const staff of STAFF_USERS) {
      const payrollRow = adminPage.locator(`[data-testid="payroll-row"]:has-text("${staff.name}")`);

      // 최종 확인 체크박스 선택
      await payrollRow.locator('input[type="checkbox"][name="finalConfirm"]').check();
    }

    // 일괄 정산 완료 버튼 클릭
    await adminPage.click('button:has-text("일괄 정산 완료")');

    // 확인 모달
    await adminPage.fill('input[name="adminPassword"]', ADMIN_USER.password);
    await adminPage.click('button:has-text("정산 완료 확인")');

    // 정산 완료 메시지 확인
    await expect(adminPage.locator('text=급여 정산이 완료되었습니다')).toBeVisible();

    // 각 스태프 상태가 '정산완료'로 변경되었는지 확인
    for (const staff of STAFF_USERS) {
      const payrollRow = adminPage.locator(`[data-testid="payroll-row"]:has-text("${staff.name}")`);
      await expect(payrollRow.locator('text=정산완료')).toBeVisible();
    }

    // 정산 완료 후에는 수정이 불가능한지 확인
    const firstStaffRow = adminPage.locator(`[data-testid="payroll-row"]:has-text("${STAFF_USERS[0].name}")`);
    await expect(firstStaffRow.locator('button:has-text("수정")')).toBeDisabled();

    // 정산 요약 리포트 생성
    await adminPage.click('button:has-text("정산 리포트 생성")');
    await expect(adminPage.locator('text=정산 리포트가 생성되었습니다')).toBeVisible();

    // 리포트 내용 확인
    await expect(adminPage.locator('[data-testid="payroll-summary"]')).toBeVisible();

    const totalPayroll = STAFF_USERS.reduce((sum, staff) => {
      const totalHours = WORK_SESSIONS.reduce((sum, session) => sum + session.hours, 0);
      return sum + (totalHours * staff.hourlyWage);
    }, 0) + (2 * STAFF_USERS[2].hourlyWage); // 이의제기로 추가된 2시간 포함

    await expect(adminPage.locator(`text=총 지급액: ${totalPayroll.toLocaleString()}원`)).toBeVisible();
  });

  test('정산 완료 후 스태프들의 최종 확인', async () => {
    // 모든 스태프가 정산 완료된 급여 확인
    const finalCheckPromises = STAFF_USERS.map(async (staff, index) => {
      const page = staffPages[index];

      // 급여 페이지로 이동
      await page.goto('/my-payroll');

      // 정산 완료 상태 확인
      await expect(page.locator('text=정산 완료')).toBeVisible();

      // 최종 급여 명세서 다운로드 가능 여부 확인
      await expect(page.locator('button:has-text("최종 명세서 다운로드")')).toBeVisible();

      // 더 이상 이의제기가 불가능한지 확인
      const disputeButton = page.locator('button:has-text("이의제기")');
      if (await disputeButton.count() > 0) {
        await expect(disputeButton).toBeDisabled();
      }

      // 지급 예정일 확인
      await expect(page.locator('text=지급 예정일')).toBeVisible();

      return `${staff.name} 정산 완료 확인`;
    });

    const results = await Promise.all(finalCheckPromises);
    expect(results).toHaveLength(STAFF_USERS.length);

    // 모든 처리 완료 후 시스템 안정성 확인
    await adminPage.goto('/admin/ceo-dashboard');

    // 대시보드에서 급여 통계 확인
    await expect(adminPage.locator('text=이번 달 급여 현황')).toBeVisible();
    await expect(adminPage.locator('text=정산 완료')).toBeVisible();
    await expect(adminPage.locator(`text=${STAFF_USERS.length}명`)).toBeVisible();
  });

  test('성능 테스트 - 대량 급여 계산 처리', async () => {
    // 새로운 기간으로 대량 데이터 테스트
    await adminPage.goto('/payroll');

    // 한 달 전체 기간 설정
    const startDate = '2025-01-01';
    const endDate = '2025-01-31';

    await adminPage.fill('input[name="startDate"]', startDate);
    await adminPage.fill('input[name="endDate"]', endDate);

    // 계산 시작 시간 기록
    const calculationStartTime = Date.now();

    // 급여 계산 실행
    await adminPage.click('button:has-text("급여 계산")');

    // 계산 완료 대기
    await adminPage.waitForSelector('text=급여 계산이 완료되었습니다', { timeout: 60000 });

    const calculationTime = Date.now() - calculationStartTime;

    // 성능 검증
    expect(calculationTime).toBeLessThan(30000); // 30초 이내

    console.log(`급여 계산 처리 시간: ${calculationTime}ms`);

    // 메모리 사용량 측정 (브라우저 메트릭스)
    const metrics = await adminPage.evaluate(() => {
      return {
        memory: (performance as any).memory ? {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
        } : null,
      };
    });

    if (metrics.memory) {
      console.log('메모리 사용량:', metrics.memory);

      // 메모리 사용량이 합리적인 범위인지 확인 (100MB 이하)
      expect(metrics.memory.usedJSHeapSize).toBeLessThan(100 * 1024 * 1024);
    }
  });
});