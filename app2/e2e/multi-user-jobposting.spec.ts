/**
 * 멀티유저 구인공고 플로우 E2E 테스트
 *
 * 시나리오:
 * 1. 관리자가 구인공고 생성
 * 2. 여러 지원자가 동시에 지원
 * 3. 관리자가 지원자 관리 및 승인
 * 4. 승인된 스태프가 스케줄 확인
 */

import { test, expect, BrowserContext, Page } from '@playwright/test';

// 테스트 사용자 정보
const ADMIN_USER = {
  email: 'admin@test.com',
  password: 'testpass123',
  name: '관리자'
};

const APPLICANTS = [
  { email: 'applicant1@test.com', password: 'testpass123', name: '지원자1' },
  { email: 'applicant2@test.com', password: 'testpass123', name: '지원자2' },
  { email: 'applicant3@test.com', password: 'testpass123', name: '지원자3' },
];

test.describe('멀티유저 구인공고 플로우', () => {
  let adminContext: BrowserContext;
  let adminPage: Page;
  let applicantContexts: BrowserContext[] = [];
  let applicantPages: Page[] = [];

  test.beforeAll(async ({ browser }) => {
    // 관리자 브라우저 컨텍스트 생성
    adminContext = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
    });
    adminPage = await adminContext.newPage();

    // 지원자들 브라우저 컨텍스트 생성 (멀티 탭 시뮬레이션)
    for (let i = 0; i < APPLICANTS.length; i++) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        locale: 'ko-KR',
        timezoneId: 'Asia/Seoul',
      });
      const page = await context.newPage();

      applicantContexts.push(context);
      applicantPages.push(page);
    }
  });

  test.afterAll(async () => {
    // 모든 컨텍스트 정리
    await adminContext.close();
    for (const context of applicantContexts) {
      await context.close();
    }
  });

  test('관리자 로그인 및 구인공고 생성', async () => {
    // 관리자 로그인
    await adminPage.goto('/login');
    await adminPage.fill('input[name="email"]', ADMIN_USER.email);
    await adminPage.fill('input[name="password"]', ADMIN_USER.password);
    await adminPage.click('button[type="submit"]');

    // 로그인 완료 대기
    await adminPage.waitForURL('**/admin/ceo-dashboard');
    await expect(adminPage.locator('text=CEO 대시보드')).toBeVisible();

    // 구인공고 작성 페이지로 이동
    await adminPage.goto('/admin/job-posting');
    await expect(adminPage.locator('text=구인공고 관리')).toBeVisible();

    // 새 구인공고 작성
    await adminPage.click('text=새 구인공고');

    // 구인공고 정보 입력
    await adminPage.fill('input[name="title"]', '테스트 홀덤 토너먼트 딜러 모집');
    await adminPage.selectOption('select[name="location"]', 'seoul');

    // 날짜 설정 (내일)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateString = tomorrow.toISOString().split('T')[0];
    await adminPage.fill('input[name="date"]', dateString);

    await adminPage.fill('input[name="startTime"]', '18:00');
    await adminPage.fill('input[name="endTime"]', '23:00');
    await adminPage.fill('input[name="maxStaff"]', '5');
    await adminPage.fill('input[name="hourlyWage"]', '30000');

    // 역할 선택
    await adminPage.check('input[value="dealer"]');
    await adminPage.check('input[value="floorman"]');

    // 상세 설명 입력
    await adminPage.fill('textarea[name="description"]',
      '테스트용 홀덤 토너먼트입니다. 경험이 있는 딜러를 우대합니다.');

    // 구인공고 저장
    await adminPage.click('button:has-text("구인공고 등록")');

    // 성공 메시지 확인
    await expect(adminPage.locator('text=구인공고가 성공적으로 등록되었습니다')).toBeVisible();

    // 구인공고 목록에서 새로 생성된 공고 확인
    await expect(adminPage.locator('text=테스트 홀덤 토너먼트 딜러 모집')).toBeVisible();
  });

  test('여러 지원자가 동시에 구인공고에 지원', async () => {
    // 모든 지원자가 동시에 로그인하여 지원
    const applicationPromises = APPLICANTS.map(async (applicant, index) => {
      const page = applicantPages[index];

      // 로그인
      await page.goto('/login');
      await page.fill('input[name="email"]', applicant.email);
      await page.fill('input[name="password"]', applicant.password);
      await page.click('button[type="submit"]');

      // 구인게시판으로 이동
      await page.waitForURL('**/profile');
      await page.goto('/job-board');

      // 구인공고 목록 로드 대기
      await page.waitForSelector('text=테스트 홀덤 토너먼트 딜러 모집');

      // 구인공고 클릭
      await page.click('text=테스트 홀덤 토너먼트 딜러 모집');

      // 구인공고 상세 정보 확인
      await expect(page.locator('text=딜러')).toBeVisible();
      await expect(page.locator('text=30,000원')).toBeVisible();

      // 지원하기 버튼 클릭
      await page.click('button:has-text("지원하기")');

      // 지원 모달에서 자기소개서 작성
      const coverLetter = `안녕하세요. ${applicant.name}입니다. 홀덤 딜링 경험이 2년 있습니다. 성실히 근무하겠습니다.`;
      await page.fill('textarea[name="coverLetter"]', coverLetter);

      // 지원서 제출
      await page.click('button:has-text("지원서 제출")');

      // 지원 완료 메시지 확인
      await expect(page.locator('text=지원이 완료되었습니다')).toBeVisible();

      return `${applicant.name} 지원 완료`;
    });

    // 모든 지원자의 지원 완료 대기
    const results = await Promise.all(applicationPromises);
    expect(results).toHaveLength(APPLICANTS.length);

    // 관리자 페이지에서 지원자 확인
    await adminPage.reload();
    await adminPage.goto('/admin/job-posting');

    // 구인공고 클릭하여 상세보기
    await adminPage.click('text=테스트 홀덤 토너먼트 딜러 모집');

    // 지원자 탭 클릭
    await adminPage.click('text=지원자 관리');

    // 모든 지원자가 표시되는지 확인
    for (const applicant of APPLICANTS) {
      await expect(adminPage.locator(`text=${applicant.name}`)).toBeVisible();
    }

    // 지원자 수 확인
    const applicationCount = await adminPage.locator('[data-testid="application-item"]').count();
    expect(applicationCount).toBe(APPLICANTS.length);
  });

  test('관리자가 지원자 검토 및 승인/거절', async () => {
    // 구인공고 상세 페이지로 이동 (이미 있다고 가정)
    await adminPage.goto('/admin/job-posting');
    await adminPage.click('text=테스트 홀덤 토너먼트 딜러 모집');
    await adminPage.click('text=지원자 관리');

    // 첫 번째 지원자 승인
    const firstApplicationRow = adminPage.locator('[data-testid="application-item"]').first();
    await firstApplicationRow.locator('button:has-text("승인")').click();

    // 승인 확인 모달
    await adminPage.click('button:has-text("확인")');
    await expect(adminPage.locator('text=지원자가 승인되었습니다')).toBeVisible();

    // 두 번째 지원자 승인
    const secondApplicationRow = adminPage.locator('[data-testid="application-item"]').nth(1);
    await secondApplicationRow.locator('button:has-text("승인")').click();
    await adminPage.click('button:has-text("확인")');
    await expect(adminPage.locator('text=지원자가 승인되었습니다')).toBeVisible();

    // 세 번째 지원자 거절
    const thirdApplicationRow = adminPage.locator('[data-testid="application-item"]').nth(2);
    await thirdApplicationRow.locator('button:has-text("거절")').click();

    // 거절 사유 입력
    await adminPage.fill('textarea[name="rejectionReason"]', '경험 부족으로 인한 거절');
    await adminPage.click('button:has-text("거절 확인")');
    await expect(adminPage.locator('text=지원자가 거절되었습니다')).toBeVisible();

    // 상태 변경 확인
    await expect(adminPage.locator('text=승인됨').first()).toBeVisible();
    await expect(adminPage.locator('text=거절됨')).toBeVisible();

    // 통계 정보 확인
    const stats = adminPage.locator('[data-testid="application-stats"]');
    await expect(stats.locator('text=전체: 3')).toBeVisible();
    await expect(stats.locator('text=승인: 2')).toBeVisible();
    await expect(stats.locator('text=거절: 1')).toBeVisible();
  });

  test('승인된 지원자들이 스태프로 전환되어 스케줄 확인', async () => {
    // 승인된 지원자들 (첫 번째, 두 번째)이 스케줄 확인
    for (let i = 0; i < 2; i++) {
      const page = applicantPages[i];
      const applicant = APPLICANTS[i];

      // 페이지 새로고침하여 최신 상태 반영
      await page.reload();

      // 내 지원현황 페이지로 이동
      await page.goto('/job-board');
      await page.click('text=내 지원현황');

      // 승인된 상태 확인
      await expect(page.locator('text=승인됨')).toBeVisible();

      // 내 스케줄 페이지로 이동
      await page.goto('/my-schedule');

      // 스케줄에 해당 이벤트가 표시되는지 확인
      await expect(page.locator('text=테스트 홀덤 토너먼트 딜러 모집')).toBeVisible();

      // 이벤트 상세 정보 확인
      await page.click('text=테스트 홀덤 토너먼트 딜러 모집');

      // 모달에서 상세 정보 확인
      await expect(page.locator('text=18:00 - 23:00')).toBeVisible();
      await expect(page.locator('text=30,000원/시간')).toBeVisible();
      await expect(page.locator('text=딜러')).toBeVisible();

      // 모달 닫기
      await page.press('body', 'Escape');
    }

    // 거절된 지원자는 스케줄에 없음을 확인
    const rejectedPage = applicantPages[2];
    await rejectedPage.reload();
    await rejectedPage.goto('/my-schedule');

    // 거절된 이벤트는 스케줄에 없음
    await expect(rejectedPage.locator('text=테스트 홀덤 토너먼트 딜러 모집')).not.toBeVisible();

    // 빈 스케줄 메시지 확인
    await expect(rejectedPage.locator('text=예정된 일정이 없습니다')).toBeVisible();
  });

  test('실시간 동기화 검증 - 한 브라우저의 변경사항이 다른 브라우저에 반영', async () => {
    // 관리자가 구인공고 정보 수정
    await adminPage.goto('/admin/job-posting');
    await adminPage.click('text=테스트 홀덤 토너먼트 딜러 모집');

    // 수정 버튼 클릭
    await adminPage.click('button:has-text("수정")');

    // 시급 변경
    await adminPage.fill('input[name="hourlyWage"]', '35000');

    // 저장
    await adminPage.click('button:has-text("저장")');
    await expect(adminPage.locator('text=구인공고가 수정되었습니다')).toBeVisible();

    // 승인된 지원자 페이지들에서 변경사항 확인
    await Promise.all([0, 1].map(async (i) => {
      const page = applicantPages[i];

      // 내 스케줄 페이지 새로고침
      await page.goto('/my-schedule');
      await page.waitForSelector('text=테스트 홀덤 토너먼트 딜러 모집');

      // 상세 정보 클릭
      await page.click('text=테스트 홀덤 토너먼트 딜러 모집');

      // 변경된 시급 확인
      await expect(page.locator('text=35,000원/시간')).toBeVisible();

      // 모달 닫기
      await page.press('body', 'Escape');
    }));
  });

  test('구인공고 마감 처리 및 알림', async () => {
    // 관리자가 구인공고 마감 처리
    await adminPage.goto('/admin/job-posting');
    await adminPage.click('text=테스트 홀덤 토너먼트 딜러 모집');

    // 마감 버튼 클릭
    await adminPage.click('button:has-text("마감")');

    // 마감 확인
    await adminPage.click('button:has-text("확인")');
    await expect(adminPage.locator('text=구인공고가 마감되었습니다')).toBeVisible();

    // 상태가 '마감됨'으로 변경되었는지 확인
    await expect(adminPage.locator('text=마감됨')).toBeVisible();

    // 일반 사용자들이 더 이상 지원할 수 없는지 확인
    const newApplicantPage = applicantPages[2]; // 거절된 지원자 재활용
    await newApplicantPage.goto('/job-board');

    // 마감된 구인공고는 목록에서 보이지 않거나 마감 표시
    const jobPostings = await newApplicantPage.locator('[data-testid="job-card"]').count();

    if (jobPostings > 0) {
      // 마감된 공고가 있다면 마감 표시 확인
      await expect(newApplicantPage.locator('text=마감')).toBeVisible();

      // 지원하기 버튼이 비활성화되었는지 확인
      const applyButton = newApplicantPage.locator('button:has-text("지원하기")');
      if (await applyButton.count() > 0) {
        await expect(applyButton).toBeDisabled();
      }
    }
  });

  test('성능 검증 - 동시 접속자 수 처리', async () => {
    // 여러 사용자가 동시에 페이지를 로드할 때의 성능 측정
    const startTime = Date.now();

    // 모든 페이지가 동시에 구인게시판 접근
    const loadPromises = applicantPages.map(async (page) => {
      const pageStartTime = Date.now();
      await page.goto('/job-board');
      await page.waitForSelector('[data-testid="job-list"]');
      const pageLoadTime = Date.now() - pageStartTime;
      return pageLoadTime;
    });

    const loadTimes = await Promise.all(loadPromises);
    const totalTime = Date.now() - startTime;

    // 성능 검증
    expect(totalTime).toBeLessThan(10000); // 10초 이내

    // 개별 페이지 로드 시간도 합리적인지 확인
    for (const loadTime of loadTimes) {
      expect(loadTime).toBeLessThan(5000); // 각 페이지 5초 이내
    }

    console.log(`총 로드 시간: ${totalTime}ms`);
    console.log(`개별 로드 시간: ${loadTimes.join(', ')}ms`);
  });
});