/**
 * Firebase 실시간 동기화 E2E 테스트
 *
 * 시나리오:
 * 1. 여러 브라우저에서 실시간 데이터 동기화 검증
 * 2. 구인공고, 출석, 지원서 실시간 업데이트 확인
 * 3. 네트워크 지연 및 재연결 시나리오
 * 4. 오프라인/온라인 상태 변화 처리
 */

import { test, expect, BrowserContext, Page } from '@playwright/test';

const ADMIN_USER = {
  email: 'admin@test.com',
  password: 'testpass123',
  name: '관리자'
};

const STAFF_USERS = [
  { email: 'staff1@test.com', password: 'testpass123', name: '스태프1' },
  { email: 'staff2@test.com', password: 'testpass123', name: '스태프2' },
];

const APPLICANT_USER = {
  email: 'applicant1@test.com',
  password: 'testpass123',
  name: '지원자1'
};

test.describe('Firebase 실시간 동기화', () => {
  let adminContext: BrowserContext;
  let adminPage: Page;
  let staffContext1: BrowserContext;
  let staffPage1: Page;
  let staffContext2: BrowserContext;
  let staffPage2: Page;
  let applicantContext: BrowserContext;
  let applicantPage: Page;

  test.beforeAll(async ({ browser }) => {
    // 여러 브라우저 컨텍스트 생성
    adminContext = await browser.newContext({ locale: 'ko-KR' });
    adminPage = await adminContext.newPage();

    staffContext1 = await browser.newContext({ locale: 'ko-KR' });
    staffPage1 = await staffContext1.newPage();

    staffContext2 = await browser.newContext({ locale: 'ko-KR' });
    staffPage2 = await staffContext2.newPage();

    applicantContext = await browser.newContext({ locale: 'ko-KR' });
    applicantPage = await applicantContext.newPage();

    // 모든 사용자 로그인
    await Promise.all([
      loginUser(adminPage, ADMIN_USER),
      loginUser(staffPage1, STAFF_USERS[0]),
      loginUser(staffPage2, STAFF_USERS[1]),
      loginUser(applicantPage, APPLICANT_USER),
    ]);
  });

  test.afterAll(async () => {
    await adminContext.close();
    await staffContext1.close();
    await staffContext2.close();
    await applicantContext.close();
  });

  test('구인공고 실시간 동기화', async () => {
    // 모든 사용자가 구인게시판을 보고 있는 상태
    await Promise.all([
      applicantPage.goto('/job-board'),
      staffPage1.goto('/job-board'),
      staffPage2.goto('/job-board'),
    ]);

    // 초기 구인공고 수 확인
    const initialJobCount = await applicantPage.locator('[data-testid="job-card"]').count();

    // 관리자가 새 구인공고 생성
    await adminPage.goto('/admin/job-posting');
    await adminPage.click('text=새 구인공고');

    const jobTitle = `실시간 테스트 구인공고 ${Date.now()}`;
    await adminPage.fill('input[name="title"]', jobTitle);
    await adminPage.selectOption('select[name="location"]', 'seoul');

    // 내일 날짜 설정
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateString = tomorrow.toISOString().split('T')[0];
    await adminPage.fill('input[name="date"]', dateString);

    await adminPage.fill('input[name="startTime"]', '18:00');
    await adminPage.fill('input[name="endTime"]', '23:00');
    await adminPage.fill('input[name="maxStaff"]', '3');
    await adminPage.fill('input[name="hourlyWage"]', '30000');
    await adminPage.check('input[value="dealer"]');

    await adminPage.fill('textarea[name="description"]', '실시간 동기화 테스트용 구인공고');
    await adminPage.click('button:has-text("구인공고 등록")');

    // 성공 메시지 확인
    await expect(adminPage.locator('text=구인공고가 성공적으로 등록되었습니다')).toBeVisible();

    // 다른 사용자들 페이지에서 새 구인공고가 실시간으로 나타나는지 확인
    await Promise.all([
      expect(applicantPage.locator(`text=${jobTitle}`)).toBeVisible({ timeout: 10000 }),
      expect(staffPage1.locator(`text=${jobTitle}`)).toBeVisible({ timeout: 10000 }),
      expect(staffPage2.locator(`text=${jobTitle}`)).toBeVisible({ timeout: 10000 }),
    ]);

    // 구인공고 수가 증가했는지 확인
    const newJobCount = await applicantPage.locator('[data-testid="job-card"]').count();
    expect(newJobCount).toBe(initialJobCount + 1);

    console.log(`실시간 동기화 성공: 구인공고 "${jobTitle}"가 모든 클라이언트에 동기화됨`);
  });

  test('지원서 실시간 동기화', async () => {
    // 지원자가 구인공고에 지원
    await applicantPage.goto('/job-board');
    const firstJobCard = applicantPage.locator('[data-testid="job-card"]').first();
    const jobTitle = await firstJobCard.locator('[data-testid="job-title"]').textContent();

    await firstJobCard.click();
    await applicantPage.click('button:has-text("지원하기")');

    const coverLetter = `실시간 테스트 지원서 ${Date.now()}`;
    await applicantPage.fill('textarea[name="coverLetter"]', coverLetter);
    await applicantPage.click('button:has-text("지원서 제출")');

    // 지원 완료 확인
    await expect(applicantPage.locator('text=지원이 완료되었습니다')).toBeVisible();

    // 관리자 페이지에서 새 지원서가 실시간으로 나타나는지 확인
    await adminPage.goto('/admin/job-posting');
    await adminPage.click(`text=${jobTitle}`);
    await adminPage.click('text=지원자 관리');

    await expect(adminPage.locator(`text=${APPLICANT_USER.name}`)).toBeVisible({ timeout: 10000 });
    await expect(adminPage.locator(`text=${coverLetter}`)).toBeVisible();

    console.log(`실시간 동기화 성공: 지원서가 관리자 페이지에 실시간으로 표시됨`);
  });

  test('출석 상태 실시간 동기화', async () => {
    // 모든 스태프가 출석 페이지 보기
    await Promise.all([
      staffPage1.goto('/attendance'),
      staffPage2.goto('/attendance'),
    ]);

    // 관리자도 출석 관리 페이지 보기
    await adminPage.goto('/attendance');

    // 첫 번째 스태프 체크인
    await staffPage1.click('button:has-text("체크인")');
    await expect(staffPage1.locator('text=체크인이 완료되었습니다')).toBeVisible();

    // 다른 스태프 페이지와 관리자 페이지에서 실시간 업데이트 확인
    await expect(staffPage2.locator(`text=${STAFF_USERS[0].name}`)).toBeVisible({ timeout: 10000 });
    await expect(adminPage.locator(`text=출석: 1명`)).toBeVisible({ timeout: 10000 });

    // 두 번째 스태프도 체크인
    await staffPage2.click('button:has-text("체크인")');
    await expect(staffPage2.locator('text=체크인이 완료되었습니다')).toBeVisible();

    // 관리자 페이지에서 출석 인원 업데이트 확인
    await expect(adminPage.locator('text=출석: 2명')).toBeVisible({ timeout: 10000 });

    console.log('실시간 동기화 성공: 출석 상태가 모든 클라이언트에 동기화됨');
  });

  test('관리자 승인/거절 실시간 동기화', async () => {
    // 지원자가 내 지원현황 페이지를 보고 있음
    await applicantPage.goto('/job-board');
    await applicantPage.click('text=내 지원현황');

    // 초기 상태 확인
    await expect(applicantPage.locator('text=검토 중')).toBeVisible();

    // 관리자가 지원서 승인
    await adminPage.goto('/admin/job-posting');
    const jobCard = adminPage.locator('[data-testid="job-posting-card"]').first();
    await jobCard.click();
    await adminPage.click('text=지원자 관리');

    const applicationRow = adminPage.locator(`[data-testid="application-item"]:has-text("${APPLICANT_USER.name}")`);
    await applicationRow.locator('button:has-text("승인")').click();
    await adminPage.click('button:has-text("확인")');

    // 승인 완료 메시지 확인
    await expect(adminPage.locator('text=지원자가 승인되었습니다')).toBeVisible();

    // 지원자 페이지에서 상태 변경이 실시간으로 반영되는지 확인
    await expect(applicantPage.locator('text=승인됨')).toBeVisible({ timeout: 10000 });

    console.log('실시간 동기화 성공: 승인 상태가 지원자에게 실시간으로 전달됨');
  });

  test('네트워크 지연 상황에서 동기화', async () => {
    // 네트워크 지연 시뮬레이션
    await staffPage1.route('**/*', route => {
      setTimeout(() => route.continue(), 2000); // 2초 지연
    });

    // 지연된 상황에서 체크아웃 시도
    await staffPage1.goto('/attendance');
    const checkOutPromise = staffPage1.click('button:has-text("체크아웃")');

    // 다른 스태프는 정상 속도로 상태 확인
    await staffPage2.goto('/attendance');

    // 지연된 요청 완료 대기
    await checkOutPromise;
    await expect(staffPage1.locator('text=체크아웃이 완료되었습니다')).toBeVisible({ timeout: 15000 });

    // 다른 사용자에게도 업데이트가 전달되는지 확인
    await expect(adminPage.locator('text=출석: 1명')).toBeVisible({ timeout: 10000 });

    // 네트워크 지연 해제
    await staffPage1.unroute('**/*');

    console.log('네트워크 지연 상황에서도 동기화 성공');
  });

  test('오프라인/온라인 상태 변화 처리', async () => {
    // 오프라인 상태 시뮬레이션
    await staffPage1.context().setOffline(true);

    // 오프라인 상태에서 작업 시도
    await staffPage1.goto('/attendance');
    await staffPage1.click('button:has-text("체크인")');

    // 오프라인 메시지 확인
    await expect(staffPage1.locator('text=오프라인 상태입니다')).toBeVisible({ timeout: 5000 });

    // 온라인 상태로 복구
    await staffPage1.context().setOffline(false);

    // 자동 재연결 및 동기화 확인
    await expect(staffPage1.locator('text=온라인 상태로 복구되었습니다')).toBeVisible({ timeout: 10000 });

    // 오프라인 중에 시도했던 작업이 온라인 복구 후 처리되는지 확인
    await expect(staffPage1.locator('text=체크인이 완료되었습니다')).toBeVisible({ timeout: 15000 });

    console.log('오프라인/온라인 상태 변화 처리 성공');
  });

  test('동시 수정 충돌 해결', async () => {
    // 두 관리자가 동일한 데이터를 동시에 수정하는 상황 시뮬레이션
    const secondAdminPage = await adminContext.newPage();
    await loginUser(secondAdminPage, ADMIN_USER);

    // 두 페이지가 동일한 구인공고 편집 페이지 접근
    await adminPage.goto('/admin/job-posting');
    await secondAdminPage.goto('/admin/job-posting');

    const firstJobCard = adminPage.locator('[data-testid="job-posting-card"]').first();
    const jobTitle = await firstJobCard.locator('[data-testid="job-title"]').textContent();

    await Promise.all([
      firstJobCard.click(),
      secondAdminPage.locator(`text=${jobTitle}`).click(),
    ]);

    await Promise.all([
      adminPage.click('button:has-text("수정")'),
      secondAdminPage.click('button:has-text("수정")'),
    ]);

    // 첫 번째 페이지에서 시급 수정
    await adminPage.fill('input[name="hourlyWage"]', '35000');
    await adminPage.click('button:has-text("저장")');

    // 두 번째 페이지에서도 시급 수정 (충돌 상황)
    await secondAdminPage.fill('input[name="hourlyWage"]', '40000');
    await secondAdminPage.click('button:has-text("저장")');

    // 충돌 감지 및 처리 확인
    await expect(
      secondAdminPage.locator('text=다른 사용자가 이미 수정하였습니다')
    ).toBeVisible({ timeout: 10000 });

    // 최신 데이터로 새로고침 제안
    await expect(
      secondAdminPage.locator('button:has-text("최신 데이터 불러오기")')
    ).toBeVisible();

    await secondAdminPage.close();
    console.log('동시 수정 충돌 감지 및 처리 성공');
  });

  test('대량 데이터 실시간 동기화 성능', async () => {
    const startTime = Date.now();

    // 관리자가 대량의 출석 데이터 수정
    await adminPage.goto('/attendance');

    const staffRows = await adminPage.locator('[data-testid="staff-row"]').count();
    const maxRows = Math.min(staffRows, 10); // 최대 10개 행만 테스트

    // 여러 스태프의 출석 상태를 빠르게 변경
    for (let i = 0; i < maxRows; i++) {
      const staffRow = adminPage.locator('[data-testid="staff-row"]').nth(i);
      const statusSelect = staffRow.locator('select[data-testid="attendance-status"]');

      await statusSelect.selectOption('late');
      await adminPage.fill('input[name="lateReason"]', `지연 사유 ${i}`);
      await adminPage.click('button:has-text("확인")');

      // 짧은 대기 시간
      await adminPage.waitForTimeout(100);
    }

    // 다른 페이지에서 모든 변경사항이 동기화되는지 확인
    await staffPage1.goto('/attendance');

    const syncEndTime = Date.now();
    const syncDuration = syncEndTime - startTime;

    // 성능 검증: 10초 이내에 모든 변경사항 동기화
    expect(syncDuration).toBeLessThan(10000);

    // 마지막 변경사항이 동기화되었는지 확인
    await expect(staffPage1.locator('text=지연 사유 9')).toBeVisible({ timeout: 5000 });

    console.log(`대량 데이터 동기화 완료: ${syncDuration}ms`);
  });

  test('실시간 알림 시스템', async () => {
    // 스태프가 알림을 받을 준비
    await staffPage1.goto('/profile');

    // 관리자가 해당 스태프에게 메시지 발송 (있다면)
    await adminPage.goto('/admin/user-management');
    const staffRow = adminPage.locator(`[data-testid="user-row"]:has-text("${STAFF_USERS[0].name}")`);

    if (await staffRow.count() > 0) {
      await staffRow.locator('button:has-text("메시지")').click();
      await adminPage.fill('textarea[name="message"]', '테스트 알림 메시지입니다.');
      await adminPage.click('button:has-text("발송")');

      // 스태프 페이지에서 실시간 알림 확인
      await expect(
        staffPage1.locator('text=테스트 알림 메시지입니다.')
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('연결 끊김 재연결 시나리오', async () => {
    // 연결 강제 종료 시뮬레이션
    await staffPage1.evaluate(() => {
      // WebSocket 연결 강제 종료 시뮬레이션
      window.dispatchEvent(new Event('offline'));
    });

    // 연결 끊김 상태 표시 확인
    await expect(staffPage1.locator('text=연결이 끊어졌습니다')).toBeVisible({ timeout: 5000 });

    // 자동 재연결 시도
    await staffPage1.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });

    // 재연결 성공 메시지 확인
    await expect(staffPage1.locator('text=연결이 복구되었습니다')).toBeVisible({ timeout: 10000 });

    // 재연결 후 데이터 동기화 확인
    await staffPage1.goto('/attendance');
    await expect(staffPage1.locator('[data-testid="attendance-status"]')).toBeVisible();
  });
});

// 헬퍼 함수: 사용자 로그인
async function loginUser(page: Page, user: { email: string; password: string; name: string }) {
  await page.goto('/login');
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await page.click('button[type="submit"]');

  // 로그인 완료 대기
  if (user.email.includes('admin')) {
    await page.waitForURL('**/admin/ceo-dashboard');
  } else {
    await page.waitForURL('**/profile');
  }
}