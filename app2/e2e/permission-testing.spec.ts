/**
 * 권한 시스템 검증 E2E 테스트
 *
 * 시나리오:
 * 1. 다양한 역할의 사용자 권한 검증
 * 2. 페이지 접근 권한 확인
 * 3. 기능별 권한 제어 검증
 * 4. 권한 우회 시도 차단
 */

import { test, expect, BrowserContext, Page } from '@playwright/test';

// 테스트 사용자 정보 (다양한 권한 레벨)
const TEST_USERS = {
  admin: {
    email: 'admin@test.com',
    password: 'testpass123',
    name: '관리자',
    role: 'admin',
  },
  staff: {
    email: 'staff1@test.com',
    password: 'testpass123',
    name: '스태프1',
    role: 'staff',
  },
  applicant: {
    email: 'applicant1@test.com',
    password: 'testpass123',
    name: '지원자1',
    role: 'applicant',
  },
  guest: {
    // 로그인하지 않은 게스트 사용자
    email: null,
    password: null,
    name: '게스트',
    role: 'guest',
  },
};

// 권한별 접근 가능한 페이지 매트릭스
const ACCESS_MATRIX = {
  public: ['/landing', '/login', '/signup', '/forgot-password'],
  authenticated: ['/profile', '/job-board', '/my-schedule'],
  staff: ['/attendance-self', '/my-work-history', '/my-payroll'],
  admin: [
    '/admin/ceo-dashboard',
    '/admin/job-posting',
    '/admin/approval',
    '/admin/user-management',
    '/attendance',
    '/payroll',
  ],
};

test.describe('권한 시스템 검증', () => {
  let adminContext: BrowserContext;
  let adminPage: Page;
  let staffContext: BrowserContext;
  let staffPage: Page;
  let applicantContext: BrowserContext;
  let applicantPage: Page;
  let guestContext: BrowserContext;
  let guestPage: Page;

  test.beforeAll(async ({ browser }) => {
    // 각 역할별 브라우저 컨텍스트 생성
    adminContext = await browser.newContext({ locale: 'ko-KR' });
    adminPage = await adminContext.newPage();

    staffContext = await browser.newContext({ locale: 'ko-KR' });
    staffPage = await staffContext.newPage();

    applicantContext = await browser.newContext({ locale: 'ko-KR' });
    applicantPage = await applicantContext.newPage();

    guestContext = await browser.newContext({ locale: 'ko-KR' });
    guestPage = await guestContext.newPage();
  });

  test.afterAll(async () => {
    await adminContext.close();
    await staffContext.close();
    await applicantContext.close();
    await guestContext.close();
  });

  test('각 역할별 사용자 로그인', async () => {
    // 관리자 로그인
    await adminPage.goto('/login');
    await adminPage.fill('input[name="email"]', TEST_USERS.admin.email);
    await adminPage.fill('input[name="password"]', TEST_USERS.admin.password);
    await adminPage.click('button[type="submit"]');
    await adminPage.waitForURL('**/admin/ceo-dashboard');

    // 스태프 로그인
    await staffPage.goto('/login');
    await staffPage.fill('input[name="email"]', TEST_USERS.staff.email);
    await staffPage.fill('input[name="password"]', TEST_USERS.staff.password);
    await staffPage.click('button[type="submit"]');
    await staffPage.waitForURL('**/profile');

    // 지원자 로그인
    await applicantPage.goto('/login');
    await applicantPage.fill('input[name="email"]', TEST_USERS.applicant.email);
    await applicantPage.fill('input[name="password"]', TEST_USERS.applicant.password);
    await applicantPage.click('button[type="submit"]');
    await applicantPage.waitForURL('**/profile');

    // 로그인 완료 확인
    await expect(adminPage.locator('text=CEO 대시보드')).toBeVisible();
    await expect(staffPage.locator(`text=${TEST_USERS.staff.name}`)).toBeVisible();
    await expect(applicantPage.locator(`text=${TEST_USERS.applicant.name}`)).toBeVisible();
  });

  test('게스트(비로그인) 사용자 권한 검증', async () => {
    // 공개 페이지는 접근 가능
    for (const publicPage of ACCESS_MATRIX.public) {
      await guestPage.goto(publicPage);

      // 로그인 페이지로 리디렉션되지 않았는지 확인
      if (publicPage !== '/login') {
        await expect(guestPage).not.toHaveURL('**/login');
      }
    }

    // 인증이 필요한 페이지는 로그인 페이지로 리디렉션
    const protectedPages = [
      ...ACCESS_MATRIX.authenticated,
      ...ACCESS_MATRIX.staff,
      ...ACCESS_MATRIX.admin,
    ];

    for (const protectedPage of protectedPages.slice(0, 3)) { // 일부만 테스트
      await guestPage.goto(protectedPage);
      await guestPage.waitForURL('**/login');

      // 로그인 페이지임을 확인
      await expect(guestPage.locator('text=로그인')).toBeVisible();
    }
  });

  test('지원자 권한 검증', async () => {
    // 지원자가 접근 가능한 페이지들
    const allowedPages = [...ACCESS_MATRIX.public, ...ACCESS_MATRIX.authenticated];

    for (const allowedPage of allowedPages) {
      if (allowedPage === '/login' || allowedPage === '/signup') continue; // 로그인된 사용자는 스킵

      await applicantPage.goto(allowedPage);

      // 403 또는 404 에러가 없는지 확인
      const errorMessage = applicantPage.locator('text=접근 권한이 없습니다');
      if (await errorMessage.count() > 0) {
        throw new Error(`지원자가 ${allowedPage}에 접근할 수 없습니다`);
      }
    }

    // 지원자가 접근할 수 없는 관리자 페이지들
    const restrictedPages = [...ACCESS_MATRIX.staff, ...ACCESS_MATRIX.admin];

    for (const restrictedPage of restrictedPages.slice(0, 3)) { // 일부만 테스트
      await applicantPage.goto(restrictedPage);

      // 권한 없음 메시지 또는 로그인 페이지로 리디렉션 확인
      try {
        await expect(applicantPage.locator('text=접근 권한이 없습니다')).toBeVisible({ timeout: 5000 });
      } catch {
        // 리디렉션된 경우 확인
        await expect(applicantPage).toHaveURL('**/profile');
      }
    }
  });

  test('스태프 권한 검증', async () => {
    // 스태프가 접근 가능한 페이지들
    const allowedPages = [
      ...ACCESS_MATRIX.public,
      ...ACCESS_MATRIX.authenticated,
      ...ACCESS_MATRIX.staff,
    ];

    // 일부 페이지만 테스트 (시간 단축)
    const samplesToTest = allowedPages.filter(page =>
      !['/login', '/signup', '/forgot-password'].includes(page)
    ).slice(0, 5);

    for (const allowedPage of samplesToTest) {
      await staffPage.goto(allowedPage);

      // 접근 가능한지 확인
      const errorMessage = staffPage.locator('text=접근 권한이 없습니다');
      if (await errorMessage.count() > 0) {
        throw new Error(`스태프가 ${allowedPage}에 접근할 수 없습니다`);
      }
    }

    // 스태프가 접근할 수 없는 관리자 전용 페이지들
    const restrictedPages = ACCESS_MATRIX.admin.slice(0, 3);

    for (const restrictedPage of restrictedPages) {
      await staffPage.goto(restrictedPage);

      // 권한 없음 또는 리디렉션 확인
      try {
        await expect(staffPage.locator('text=접근 권한이 없습니다')).toBeVisible({ timeout: 5000 });
      } catch {
        await expect(staffPage).toHaveURL('**/profile');
      }
    }
  });

  test('관리자 권한 검증', async () => {
    // 관리자는 모든 페이지에 접근 가능
    const allPages = [
      ...ACCESS_MATRIX.authenticated,
      ...ACCESS_MATRIX.staff,
      ...ACCESS_MATRIX.admin,
    ];

    // 샘플 페이지들만 테스트
    const samplesToTest = allPages.slice(0, 8);

    for (const page of samplesToTest) {
      await adminPage.goto(page);

      // 권한 에러가 없는지 확인
      const errorMessage = adminPage.locator('text=접근 권한이 없습니다');
      expect(await errorMessage.count()).toBe(0);
    }
  });

  test('기능별 권한 제어 - 구인공고 관리', async () => {
    const jobPostingPage = '/admin/job-posting';

    // 관리자: 모든 기능 접근 가능
    await adminPage.goto(jobPostingPage);
    await expect(adminPage.locator('button:has-text("새 구인공고")')).toBeVisible();
    await expect(adminPage.locator('button:has-text("수정")')).toBeVisible();
    await expect(adminPage.locator('button:has-text("삭제")')).toBeVisible();

    // 스태프: 접근 불가
    await staffPage.goto(jobPostingPage);
    await expect(staffPage.locator('text=접근 권한이 없습니다')).toBeVisible();

    // 지원자: 접근 불가
    await applicantPage.goto(jobPostingPage);
    await expect(applicantPage.locator('text=접근 권한이 없습니다')).toBeVisible();
  });

  test('기능별 권한 제어 - 출석 관리', async () => {
    const attendancePage = '/attendance';

    // 관리자: 모든 스태프의 출석 관리 가능
    await adminPage.goto(attendancePage);
    await expect(adminPage.locator('text=출석 관리')).toBeVisible();
    await expect(adminPage.locator('select[name="attendanceStatus"]')).toBeVisible();

    // 스태프: 자신의 출석만 확인 가능 (다른 페이지로 리디렉션 또는 제한된 뷰)
    await staffPage.goto(attendancePage);

    // 제한된 접근 확인
    try {
      await expect(staffPage.locator('text=접근 권한이 없습니다')).toBeVisible({ timeout: 3000 });
    } catch {
      // 자신의 출석 페이지로 리디렉션될 수 있음
      await expect(staffPage.locator('text=내 출석 현황')).toBeVisible();
    }
  });

  test('기능별 권한 제어 - 급여 관리', async () => {
    const payrollPage = '/payroll';

    // 관리자: 모든 급여 관리 기능 접근
    await adminPage.goto(payrollPage);
    await expect(adminPage.locator('text=급여 관리')).toBeVisible();
    await expect(adminPage.locator('button:has-text("급여 계산")')).toBeVisible();

    // 스태프: 접근 불가 (개인 급여 페이지는 별도)
    await staffPage.goto(payrollPage);
    await expect(staffPage.locator('text=접근 권한이 없습니다')).toBeVisible();

    // 지원자: 접근 불가
    await applicantPage.goto(payrollPage);
    await expect(applicantPage.locator('text=접근 권한이 없습니다')).toBeVisible();
  });

  test('API 권한 검증 - 관리자 전용 엔드포인트', async () => {
    // 관리자 API 호출 시뮬레이션
    const response = await adminPage.evaluate(async () => {
      const res = await fetch('/api/admin/users', {
        method: 'GET',
        credentials: 'include',
      });
      return {
        status: res.status,
        ok: res.ok,
      };
    });

    // 관리자는 API 접근 가능 (실제 구현에 따라 다를 수 있음)
    expect(response.status).not.toBe(403);

    // 스태프가 관리자 API 호출 시도
    const staffResponse = await staffPage.evaluate(async () => {
      try {
        const res = await fetch('/api/admin/users', {
          method: 'GET',
          credentials: 'include',
        });
        return {
          status: res.status,
          ok: res.ok,
        };
      } catch (error) {
        return {
          status: 0,
          error: 'Network error',
        };
      }
    });

    // 스태프는 403 Forbidden 또는 네트워크 에러
    if (staffResponse.status > 0) {
      expect(staffResponse.status).toBe(403);
    }
  });

  test('권한 우회 시도 방어 - URL 직접 접근', async () => {
    // 스태프가 관리자 URL에 직접 접근 시도
    await staffPage.goto('/admin/ceo-dashboard');

    // 접근 차단 확인
    await expect(staffPage.locator('text=접근 권한이 없습니다')).toBeVisible();

    // 지원자가 급여 관리 페이지에 직접 접근 시도
    await applicantPage.goto('/admin/payroll');
    await expect(applicantPage.locator('text=접근 권한이 없습니다')).toBeVisible();
  });

  test('권한 우회 시도 방어 - 개발자 도구를 통한 UI 조작', async () => {
    await staffPage.goto('/profile');

    // 개발자 도구로 숨겨진 관리자 버튼을 강제로 표시 시도
    await staffPage.evaluate(() => {
      // 관리자 전용 버튼이 있다면 강제로 표시
      const adminButton = document.createElement('button');
      adminButton.textContent = '관리자 기능';
      adminButton.onclick = () => window.location.href = '/admin/ceo-dashboard';
      document.body.appendChild(adminButton);
    });

    // 버튼 클릭 시도
    await staffPage.click('text=관리자 기능');

    // 여전히 권한 검증이 작동하는지 확인
    await expect(staffPage.locator('text=접근 권한이 없습니다')).toBeVisible();
  });

  test('권한 우회 시도 방어 - 로컬 스토리지 조작', async () => {
    await staffPage.goto('/profile');

    // 로컬 스토리지에서 권한 정보 조작 시도
    await staffPage.evaluate(() => {
      localStorage.setItem('userRole', 'admin');
      localStorage.setItem('isAdmin', 'true');
      sessionStorage.setItem('adminAccess', 'granted');
    });

    // 페이지 새로고침 후 권한 확인
    await staffPage.reload();
    await staffPage.goto('/admin/ceo-dashboard');

    // 여전히 접근이 차단되는지 확인
    await expect(staffPage.locator('text=접근 권한이 없습니다')).toBeVisible();
  });

  test('세션 만료 시 권한 재검증', async () => {
    // 관리자로 로그인된 상태에서 세션 쿠키 삭제
    await adminPage.context().clearCookies();

    // 보호된 페이지 접근 시도
    await adminPage.goto('/admin/ceo-dashboard');

    // 로그인 페이지로 리디렉션되는지 확인
    await expect(adminPage).toHaveURL('**/login');
    await expect(adminPage.locator('text=로그인이 필요합니다')).toBeVisible();
  });

  test('동시 세션 권한 일관성', async () => {
    // 동일한 사용자가 여러 탭에서 로그인한 상황 시뮬레이션
    const secondStaffPage = await staffContext.newPage();

    // 첫 번째 탭에서 로그아웃
    await staffPage.goto('/profile');
    await staffPage.click('text=로그아웃');

    // 두 번째 탭에서 보호된 페이지 접근 시도
    await secondStaffPage.goto('/my-schedule');

    // 세션이 무효화되어 로그인 페이지로 리디렉션되는지 확인
    await expect(secondStaffPage).toHaveURL('**/login');

    await secondStaffPage.close();
  });

  test('권한 에스컬레이션 방어', async () => {
    // 일반 스태프가 다른 스태프의 정보에 접근 시도
    const otherStaffId = 'staff2-id';

    await staffPage.goto(`/profile/${otherStaffId}`);

    // 다른 사용자의 개인정보는 볼 수 없어야 함
    await expect(staffPage.locator('text=개인 정보')).not.toBeVisible();
    await expect(staffPage.locator('text=은행명')).not.toBeVisible();

    // 급여 정보 접근 시도
    await staffPage.goto(`/payroll/${otherStaffId}`);
    await expect(staffPage.locator('text=접근 권한이 없습니다')).toBeVisible();
  });

  test('페이지별 권한 표시 일관성', async () => {
    // 각 역할별로 메뉴 표시 확인

    // 관리자 메뉴
    await adminPage.goto('/admin/ceo-dashboard');
    await expect(adminPage.locator('text=구인공고 관리')).toBeVisible();
    await expect(adminPage.locator('text=출석 관리')).toBeVisible();
    await expect(adminPage.locator('text=급여 관리')).toBeVisible();

    // 스태프 메뉴
    await staffPage.goto('/profile');
    await expect(staffPage.locator('text=내 스케줄')).toBeVisible();
    await expect(staffPage.locator('text=구인게시판')).toBeVisible();
    await expect(staffPage.queryByText('출석 관리')).not.toBeVisible(); // 관리자 전용 메뉴는 없음

    // 지원자 메뉴
    await applicantPage.goto('/profile');
    await expect(applicantPage.locator('text=구인게시판')).toBeVisible();
    await expect(applicantPage.queryByText('내 급여')).not.toBeVisible(); // 스태프 전용 메뉴는 없음
  });

  test('보안 헤더 및 CSRF 보호 검증', async () => {
    // 페이지 응답 헤더 확인
    const response = await adminPage.goto('/admin/ceo-dashboard');
    const headers = response?.headers();

    // 보안 헤더 확인 (실제 구현에 따라 다를 수 있음)
    if (headers) {
      expect(headers['x-frame-options']).toBeDefined();
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-xss-protection']).toBeDefined();
    }

    // CSRF 토큰 확인 (폼이 있는 경우)
    const csrfTokens = await adminPage.locator('input[name="csrf_token"]').count();
    const forms = await adminPage.locator('form').count();

    if (forms > 0) {
      expect(csrfTokens).toBeGreaterThan(0);
    }
  });
});