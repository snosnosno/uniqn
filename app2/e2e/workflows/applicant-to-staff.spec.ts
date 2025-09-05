import { test, expect, Page } from '@playwright/test';
import { AuthHelper } from '../helpers/auth.helper';
import { DataHelper } from '../helpers/data.helper';
import { FirebaseHelper } from '../helpers/firebase.helper';

/**
 * Test 7: 지원자 확정 및 스태프 전환 테스트
 * 
 * 테스트 범위:
 * - 지원자 상태를 confirmed로 변경
 * - 확정된 지원자의 스태프 탭 자동 등록
 * - 스태프 정보 자동 생성 (staffId, role 등)
 * - workLogs 컬렉션 초기 레코드 생성
 * - UnifiedDataContext를 통한 실시간 동기화
 * - 지원자 탭에서 스태프 탭으로의 데이터 연동
 */

test.describe('지원자 확정 및 스태프 전환', () => {
  let authHelper: AuthHelper;
  let dataHelper: DataHelper;
  let firebaseHelper: FirebaseHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    dataHelper = new DataHelper(page);
    firebaseHelper = new FirebaseHelper(page);

    // Firebase 에뮬레이터 연결 확인
    await firebaseHelper.checkFirebaseConnection();

    // 관리자로 로그인
    await authHelper.loginAsAdmin();

    // 테스트 데이터 준비: 구인공고와 지원자 생성
    await dataHelper.createTestJobPosting('test-job-confirm', {
      title: '포커 딜러 모집 - 확정 테스트',
      location: '서울 강남구',
      roles: [
        { name: '딜러', hourlyWage: 15000, requiredCount: 3 },
        { name: '서버', hourlyWage: 12000, requiredCount: 2 }
      ],
      description: '지원자 확정 및 스태프 전환 테스트용 공고',
      jobDate: '2025-01-20',
      startTime: '18:00',
      endTime: '02:00',
      status: 'active'
    });

    // 확정 대기 중인 지원자들 생성
    const pendingApplicants = [
      { name: '김확정', phone: '010-1234-1234', experience: 'experienced', status: 'pending', preferredRole: '딜러' },
      { name: '이확정', phone: '010-5678-5678', experience: 'intermediate', status: 'pending', preferredRole: '서버' },
      { name: '박확정', phone: '010-9999-9999', experience: 'beginner', status: 'pending', preferredRole: '딜러' }
    ];

    for (const applicant of pendingApplicants) {
      await dataHelper.createTestApplication('test-job-confirm', applicant);
    }

    // 구인공고 관리 페이지로 이동
    await page.goto('http://localhost:3001/admin/job-postings');
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async ({ page }) => {
    // 테스트 데이터 정리
    await dataHelper.cleanupTestData('test-job-confirm');
    await authHelper.logout();
  });

  test('지원자 상태 confirmed 변경 및 기본 검증', async ({ page }) => {
    // 테스트 공고 선택 및 지원자 탭 이동
    const jobRow = page.locator('tr').filter({ hasText: '확정 테스트' });
    await jobRow.click();
    await page.waitForURL(/\/admin\/job-postings\/.*/, { timeout: 5000 });

    // 지원자 탭 클릭
    await page.locator('button').filter({ hasText: /지원자|applicant/i }).first().click();
    await page.waitForTimeout(1000);

    // 김확정 지원자 찾기
    const applicantRow = page.locator('tr').filter({ hasText: '김확정' }).or(
      page.locator('div').filter({ hasText: '김확정' }).locator('..')
    );
    await expect(applicantRow).toBeVisible();

    // 초기 상태가 pending인지 확인
    await expect(applicantRow.locator('text=pending').or(
      applicantRow.locator('text=대기중')
    )).toBeVisible();

    // 상태를 confirmed로 변경
    const statusSelect = applicantRow.locator('select').or(
      applicantRow.locator('button').filter({ hasText: /상태|status/i })
    ).first();

    if (await statusSelect.isVisible()) {
      if (await statusSelect.locator('option').count() > 0) {
        await statusSelect.selectOption('confirmed');
      } else {
        await statusSelect.click();
        await page.locator('text=confirmed').or(page.locator('text=확정')).click();
      }
      
      await page.waitForTimeout(2000);

      // confirmed 상태로 변경 확인
      await expect(applicantRow.locator('text=confirmed').or(
        applicantRow.locator('text=확정')
      )).toBeVisible({ timeout: 5000 });

      console.log('✅ 지원자 상태가 confirmed로 변경됨');
    }

    // Firebase에서 상태 변경 확인
    const isConfirmed = await firebaseHelper.checkApplicationStatus('test-job-confirm', '김확정', 'confirmed');
    expect(isConfirmed).toBe(true);
  });

  test('확정된 지원자의 스태프 탭 자동 등록', async ({ page }) => {
    // 지원자를 confirmed 상태로 변경
    await confirmApplicant(page, '이확정');

    // 스태프 탭으로 이동
    const staffTab = page.locator('button').filter({ hasText: /스태프|staff/i }).first();
    await staffTab.click();
    await page.waitForTimeout(2000);

    // 확정된 지원자가 스태프 목록에 나타나는지 확인
    const staffList = page.locator('[data-testid="staff-list"]').or(
      page.locator('div').filter({ hasText: '이확정' })
    );

    await expect(staffList).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=이확정')).toBeVisible();

    // 스태프 정보 확인
    const staffRow = page.locator('tr').filter({ hasText: '이확정' }).or(
      page.locator('div').filter({ hasText: '이확정' }).locator('..')
    );

    // 역할이 올바르게 설정되었는지 확인
    await expect(staffRow.locator('text=서버')).toBeVisible();

    // staffId가 생성되었는지 Firebase에서 확인
    const staffData = await firebaseHelper.getStaffData('test-job-confirm', '이확정');
    expect(staffData).toBeTruthy();
    expect(staffData.staffId).toBeTruthy();
    expect(staffData.role).toBe('서버');

    console.log('✅ 확정된 지원자가 스태프 탭에 자동 등록됨');
    console.log(`✅ staffId 생성: ${staffData.staffId}`);
  });

  test('workLogs 초기 레코드 자동 생성', async ({ page }) => {
    // 지원자를 confirmed로 변경
    await confirmApplicant(page, '박확정');
    
    // workLogs 컬렉션에 초기 레코드가 생성되었는지 확인
    await page.waitForTimeout(3000); // 자동 생성 대기

    const workLogData = await firebaseHelper.getWorkLogData('test-job-confirm', '박확정');
    expect(workLogData).toBeTruthy();
    expect(workLogData.staffId).toBeTruthy();
    expect(workLogData.eventId).toBe('test-job-confirm');
    expect(workLogData.status).toBe('scheduled'); // 초기 상태

    // 근무 시간 정보가 올바르게 설정되었는지 확인
    expect(workLogData.scheduledStartTime).toBe('18:00');
    expect(workLogData.scheduledEndTime).toBe('02:00');

    console.log('✅ workLogs 초기 레코드 자동 생성 확인');
    console.log(`✅ workLog 데이터: ${JSON.stringify(workLogData, null, 2)}`);
  });

  test('다중 지원자 일괄 확정 처리', async ({ page }) => {
    // 지원자 탭으로 이동
    await navigateToApplicantTab(page);

    // 모든 pending 지원자 선택
    const checkboxes = page.locator('input[type="checkbox"]').filter({ hasText: '' });
    const checkboxCount = await checkboxes.count();
    
    if (checkboxCount > 1) {
      // 전체 선택 체크박스 클릭 (첫 번째)
      await checkboxes.first().check();
      await page.waitForTimeout(500);

      // 일괄 확정 버튼
      const bulkConfirmButton = page.locator('button').filter({ hasText: /일괄 확정|bulk confirm/i }).or(
        page.locator('[data-testid="bulk-confirm-button"]')
      );

      if (await bulkConfirmButton.isVisible()) {
        await bulkConfirmButton.click();
        
        // 확인 다이얼로그가 있다면 확인
        const confirmDialog = page.locator('button').filter({ hasText: /확인|confirm/i });
        if (await confirmDialog.isVisible()) {
          await confirmDialog.click();
        }

        await page.waitForTimeout(3000);

        // 모든 지원자가 confirmed 상태가 되었는지 확인
        const confirmedCount = await page.locator('text=confirmed').or(
          page.locator('text=확정')
        ).count();
        
        expect(confirmedCount).toBeGreaterThanOrEqual(3);

        console.log(`✅ ${confirmedCount}명의 지원자가 일괄 확정됨`);
      }
    }

    // 스태프 탭에서 확정된 모든 지원자 확인
    await page.locator('button').filter({ hasText: /스태프|staff/i }).first().click();
    await page.waitForTimeout(2000);

    await expect(page.locator('text=김확정')).toBeVisible();
    await expect(page.locator('text=이확정')).toBeVisible();
    await expect(page.locator('text=박확정')).toBeVisible();
  });

  test('UnifiedDataContext 실시간 동기화 검증', async ({ page }) => {
    // 두 번째 탭 열기 (다른 관리자 세션 시뮬레이션)
    const secondTab = await page.context().newPage();
    await authHelper.loginAsAdmin(secondTab);
    await secondTab.goto('http://localhost:3001/admin/job-postings');
    await secondTab.waitForLoadState('domcontentloaded');

    // 첫 번째 탭에서 지원자 확정
    await confirmApplicant(page, '김확정');

    // 두 번째 탭에서 실시간 업데이트 확인
    await secondTab.locator('tr').filter({ hasText: '확정 테스트' }).click();
    await secondTab.waitForURL(/\/admin\/job-postings\/.*/, { timeout: 5000 });

    // 지원자 탭에서 상태 업데이트 확인
    await secondTab.locator('button').filter({ hasText: /지원자|applicant/i }).first().click();
    await secondTab.waitForTimeout(2000);

    await expect(secondTab.locator('tr').filter({ hasText: '김확정' }).locator('text=confirmed').or(
      secondTab.locator('tr').filter({ hasText: '김확정' }).locator('text=확정')
    )).toBeVisible({ timeout: 10000 });

    // 스태프 탭에서도 실시간 업데이트 확인
    await secondTab.locator('button').filter({ hasText: /스태프|staff/i }).first().click();
    await secondTab.waitForTimeout(2000);

    await expect(secondTab.locator('text=김확정')).toBeVisible({ timeout: 10000 });

    console.log('✅ UnifiedDataContext 실시간 동기화 확인 완료');

    await secondTab.close();
  });

  test('역할별 스태프 분류 및 시급 설정', async ({ page }) => {
    // 서로 다른 역할의 지원자들 확정
    await confirmApplicant(page, '김확정'); // 딜러
    await confirmApplicant(page, '이확정'); // 서버

    // 스태프 탭으로 이동
    await page.locator('button').filter({ hasText: /스태프|staff/i }).first().click();
    await page.waitForTimeout(2000);

    // 딜러 역할 스태프 확인
    const dealerRow = page.locator('tr').filter({ hasText: '김확정' });
    await expect(dealerRow.locator('text=딜러')).toBeVisible();

    // 서버 역할 스태프 확인
    const serverRow = page.locator('tr').filter({ hasText: '이확정' });
    await expect(serverRow.locator('text=서버')).toBeVisible();

    // Firebase에서 시급 정보 확인
    const dealerData = await firebaseHelper.getStaffData('test-job-confirm', '김확정');
    const serverData = await firebaseHelper.getStaffData('test-job-confirm', '이확정');

    expect(dealerData.hourlyWage).toBe(15000); // 딜러 시급
    expect(serverData.hourlyWage).toBe(12000); // 서버 시급

    console.log('✅ 역할별 스태프 분류 및 시급 설정 확인');
    console.log(`✅ 딜러(김확정): ${dealerData.hourlyWage}원/시간`);
    console.log(`✅ 서버(이확정): ${serverData.hourlyWage}원/시간`);
  });

  test('확정 취소 및 스태프 제거', async ({ page }) => {
    // 지원자 확정 후
    await confirmApplicant(page, '박확정');
    
    // 스태프 탭에서 등록 확인
    await page.locator('button').filter({ hasText: /스태프|staff/i }).first().click();
    await page.waitForTimeout(2000);
    await expect(page.locator('text=박확정')).toBeVisible();

    // 지원자 탭으로 돌아가서 상태를 pending으로 변경
    await page.locator('button').filter({ hasText: /지원자|applicant/i }).first().click();
    await page.waitForTimeout(1000);

    const applicantRow = page.locator('tr').filter({ hasText: '박확정' });
    const statusSelect = applicantRow.locator('select').first();

    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption('pending');
      await page.waitForTimeout(2000);

      // pending 상태로 변경 확인
      await expect(applicantRow.locator('text=pending').or(
        applicantRow.locator('text=대기중')
      )).toBeVisible();
    }

    // 스태프 탭에서 제거 확인
    await page.locator('button').filter({ hasText: /스태프|staff/i }).first().click();
    await page.waitForTimeout(2000);

    // 박확정이 스태프 목록에서 제거되었는지 확인
    const staffList = page.locator('text=박확정');
    await expect(staffList).toHaveCount(0, { timeout: 5000 });

    console.log('✅ 확정 취소 및 스태프 제거 확인');
  });

});

// Helper Methods
async function confirmApplicant(page: Page, applicantName: string) {
    await navigateToApplicantTab(page);

    const applicantRow = page.locator('tr').filter({ hasText: applicantName }).or(
      page.locator('div').filter({ hasText: applicantName }).locator('..')
    );
    
    await expect(applicantRow).toBeVisible();

    const statusSelect = applicantRow.locator('select').or(
      applicantRow.locator('button').filter({ hasText: /상태|status/i })
    ).first();

    if (await statusSelect.isVisible()) {
      if (await statusSelect.locator('option').count() > 0) {
        await statusSelect.selectOption('confirmed');
      } else {
        await statusSelect.click();
        await page.locator('text=confirmed').or(page.locator('text=확정')).click();
      }
      
      await page.waitForTimeout(2000);
    }
  }

async function navigateToApplicantTab(page: Page) {
    const jobRow = page.locator('tr').filter({ hasText: '확정 테스트' });
    if (await jobRow.isVisible()) {
      await jobRow.click();
      await page.waitForURL(/\/admin\/job-postings\/.*/, { timeout: 5000 });
    }

    await page.locator('button').filter({ hasText: /지원자|applicant/i }).first().click();
    await page.waitForTimeout(1000);
}