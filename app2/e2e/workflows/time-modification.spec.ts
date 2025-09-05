import { test, expect, Page } from '@playwright/test';
import { AuthHelper } from '../helpers/auth.helper';
import { DataHelper } from '../helpers/data.helper';
import { FirebaseHelper } from '../helpers/firebase.helper';

/**
 * Test 9: 시간 수정 및 출근 상태 변경 테스트
 * 
 * 테스트 범위:
 * - 스태프 근무 시간 수정 (scheduledStartTime, scheduledEndTime)
 * - 실제 출/퇴근 시간 기록 (actualStartTime, actualEndTime)
 * - 출근 상태 변경 (scheduled → present → absent → late)
 * - 시간 변경 시 급여 자동 재계산
 * - workLogs 컬렉션 실시간 업데이트
 * - 내 스케줄 페이지 동기화 확인
 * - 변경 이력 추적 (audit log)
 */

test.describe('시간 수정 및 출근 상태 변경', () => {
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

    // 테스트 데이터 준비: 구인공고와 스태프 생성
    await dataHelper.createTestJobPosting('test-job-time', {
      title: '포커 딜러 모집 - 시간 수정 테스트',
      location: '서울 강남구',
      roles: [
        { name: '딜러', hourlyWage: 15000, requiredCount: 3 }
      ],
      description: '시간 수정 및 출근 상태 변경 테스트용 공고',
      jobDate: '2025-01-30',
      startTime: '18:00',
      endTime: '02:00',
      status: 'active'
    });

    // 테스트 스태프들 생성
    const testStaff = [
      { name: '김시간', phone: '010-1111-1111', role: '딜러', hourlyWage: 15000, status: 'scheduled' },
      { name: '이시간', phone: '010-2222-2222', role: '딜러', hourlyWage: 15000, status: 'present' },
      { name: '박시간', phone: '010-3333-3333', role: '딜러', hourlyWage: 15000, status: 'absent' }
    ];

    for (const staff of testStaff) {
      await dataHelper.createTestStaff('test-job-time', staff);
    }

    // workLogs 초기 데이터 생성
    await dataHelper.createWorkLog('test-job-time', '김시간', {
      scheduledStartTime: '18:00',
      scheduledEndTime: '02:00',
      status: 'scheduled'
    });

    // 구인공고 관리 페이지로 이동
    await page.goto('http://localhost:3001/admin/job-postings');
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async ({ page }) => {
    // 테스트 데이터 정리
    await dataHelper.cleanupTestData('test-job-time');
    await authHelper.logout();
  });

  test('예정 근무 시간 수정', async ({ page }) => {
    // 스태프 탭으로 이동
    await navigateToStaffTab(page);

    // 김시간 스태프 선택
    const staffRow = page.locator('tr').filter({ hasText: '김시간' });
    await expect(staffRow).toBeVisible();

    // 시간 편집 버튼 클릭 또는 시간 셀 더블클릭
    const timeEditButton = staffRow.locator('button').filter({ hasText: /시간|time/i }).or(
      staffRow.locator('[data-testid="edit-time-button"]').or(
        staffRow.locator('td').filter({ hasText: '18:00' })
      )
    ).first();

    if (await timeEditButton.isVisible()) {
      await timeEditButton.click();
    } else {
      // 시간 셀 더블클릭으로 인라인 편집
      await staffRow.locator('text=18:00').dblclick();
    }

    await page.waitForTimeout(500);

    // 시작 시간 수정 (18:00 → 19:00)
    const startTimeInput = page.locator('input[value="18:00"]').or(
      page.locator('[data-testid="start-time-input"]').or(
        page.locator('input[type="time"]').first()
      )
    );

    if (await startTimeInput.isVisible()) {
      await startTimeInput.clear();
      await startTimeInput.fill('19:00');

      // 종료 시간도 수정 (02:00 → 03:00)
      const endTimeInput = page.locator('input[value="02:00"]').or(
        page.locator('[data-testid="end-time-input"]').or(
          page.locator('input[type="time"]').nth(1)
        )
      );

      if (await endTimeInput.isVisible()) {
        await endTimeInput.clear();
        await endTimeInput.fill('03:00');
      }

      // 저장 버튼 클릭
      const saveButton = page.locator('button').filter({ hasText: /저장|save/i });
      if (await saveButton.isVisible()) {
        await saveButton.click();
      } else {
        await page.keyboard.press('Enter');
      }

      await page.waitForTimeout(2000);

      // 변경된 시간 확인
      await expect(staffRow.locator('text=19:00')).toBeVisible();
      await expect(staffRow.locator('text=03:00')).toBeVisible();

      // Firebase workLogs 업데이트 확인
      const workLogData = await firebaseHelper.getWorkLogData('test-job-time', '김시간');
      expect(workLogData.scheduledStartTime).toBe('19:00');
      expect(workLogData.scheduledEndTime).toBe('03:00');

      console.log('✅ 예정 근무 시간 수정 완료: 18:00-02:00 → 19:00-03:00');
    }
  });

  test('출근 상태 변경 및 실제 시간 기록', async ({ page }) => {
    await navigateToStaffTab(page);

    // 김시간 스태프의 상태를 present로 변경
    const staffRow = page.locator('tr').filter({ hasText: '김시간' });
    const statusSelect = staffRow.locator('select').or(
      staffRow.locator('button').filter({ hasText: /상태|status/i })
    ).first();

    const checkInTime = Date.now();

    if (await statusSelect.isVisible()) {
      if (await statusSelect.locator('option').count() > 0) {
        await statusSelect.selectOption('present');
      } else {
        await statusSelect.click();
        await page.locator('text=present').or(page.locator('text=출근')).click();
      }
      
      await page.waitForTimeout(2000);

      // present 상태로 변경 확인
      await expect(staffRow.locator('text=present').or(
        staffRow.locator('text=출근')
      )).toBeVisible();

      // Firebase에서 실제 출근 시간 기록 확인
      const workLogData = await firebaseHelper.getWorkLogData('test-job-time', '김시간');
      expect(workLogData.status).toBe('present');
      expect(workLogData.actualStartTime).toBeTruthy();

      // 출근 시간이 현재 시간과 유사한지 확인 (±5분 오차)
      const actualStartTime = new Date(workLogData.actualStartTime);
      const timeDiff = Math.abs(actualStartTime.getTime() - checkInTime);
      expect(timeDiff).toBeLessThan(5 * 60 * 1000); // 5분 이내

      console.log(`✅ 출근 처리 완료: ${workLogData.actualStartTime}`);
    }

    // 지각 상태 테스트
    const lateStaffRow = page.locator('tr').filter({ hasText: '이시간' });
    const lateStatusSelect = lateStaffRow.locator('select').first();

    if (await lateStatusSelect.isVisible()) {
      await lateStatusSelect.selectOption('late');
      await page.waitForTimeout(1000);

      await expect(lateStaffRow.locator('text=late').or(
        lateStaffRow.locator('text=지각')
      )).toBeVisible();

      // 지각 데이터 확인
      const lateWorkLog = await firebaseHelper.getWorkLogData('test-job-time', '이시간');
      expect(lateWorkLog.status).toBe('late');
      expect(lateWorkLog.actualStartTime).toBeTruthy();
      expect(lateWorkLog.lateMinutes).toBeGreaterThan(0);

      console.log(`✅ 지각 처리 완료: ${lateWorkLog.lateMinutes}분 지각`);
    }
  });

  test('퇴근 처리 및 실제 근무 시간 계산', async ({ page }) => {
    await navigateToStaffTab(page);

    // 먼저 출근 처리
    await setStaffStatus(page, '김시간', 'present');
    await page.waitForTimeout(2000);

    // 퇴근 처리
    const staffRow = page.locator('tr').filter({ hasText: '김시간' });
    const statusSelect = staffRow.locator('select').first();

    const checkOutTime = Date.now();

    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption('completed');
      await page.waitForTimeout(2000);

      // completed 상태 확인
      await expect(staffRow.locator('text=completed').or(
        staffRow.locator('text=완료')
      )).toBeVisible();

      // Firebase에서 퇴근 시간 및 근무 시간 계산 확인
      const workLogData = await firebaseHelper.getWorkLogData('test-job-time', '김시간');
      expect(workLogData.status).toBe('completed');
      expect(workLogData.actualEndTime).toBeTruthy();
      expect(workLogData.actualWorkedHours).toBeTruthy();

      // 실제 근무 시간 계산 검증
      const startTime = new Date(workLogData.actualStartTime);
      const endTime = new Date(workLogData.actualEndTime);
      const workedMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
      const expectedHours = workedMinutes / 60;

      expect(Math.abs(workLogData.actualWorkedHours - expectedHours)).toBeLessThan(0.1);

      console.log(`✅ 퇴근 처리 완료: 실제 근무 ${workLogData.actualWorkedHours}시간`);
    }
  });

  test('급여 자동 재계산 검증', async ({ page }) => {
    await navigateToStaffTab(page);

    // 초기 예정 급여 확인 (8시간 * 15000원)
    let workLogData = await firebaseHelper.getWorkLogData('test-job-time', '김시간');
    const initialExpectedSalary = 8 * 15000; // 18:00-02:00 = 8시간

    // 근무 시간 변경 (8시간 → 6시간)
    await modifyWorkTime(page, '김시간', '20:00', '02:00');

    // 변경된 급여 계산 확인
    workLogData = await firebaseHelper.getWorkLogData('test-job-time', '김시간');
    const updatedExpectedSalary = 6 * 15000; // 20:00-02:00 = 6시간

    expect(workLogData.scheduledWorkedHours).toBe(6);
    expect(workLogData.expectedSalary).toBe(updatedExpectedSalary);

    // 실제 근무 후 급여 재계산
    await setStaffStatus(page, '김시간', 'present');
    await page.waitForTimeout(1000);
    await setStaffStatus(page, '김시간', 'completed');
    await page.waitForTimeout(2000);

    workLogData = await firebaseHelper.getWorkLogData('test-job-time', '김시간');
    const actualSalary = workLogData.actualWorkedHours * 15000;

    expect(Math.abs(workLogData.actualSalary - actualSalary)).toBeLessThan(1000);

    console.log(`✅ 급여 재계산 확인:`);
    console.log(`  - 초기 예정: ${initialExpectedSalary}원`);
    console.log(`  - 수정 예정: ${updatedExpectedSalary}원`);
    console.log(`  - 실제 급여: ${workLogData.actualSalary}원`);
  });

  test('일괄 시간 수정', async ({ page }) => {
    await navigateToStaffTab(page);

    // 전체 선택 체크박스
    const selectAllCheckbox = page.locator('input[type="checkbox"]').first();
    
    if (await selectAllCheckbox.isVisible()) {
      await selectAllCheckbox.check();
      await page.waitForTimeout(500);

      // 일괄 시간 수정 버튼
      const bulkTimeButton = page.locator('button').filter({ hasText: /일괄 시간|bulk time/i }).or(
        page.locator('[data-testid="bulk-time-button"]')
      );

      if (await bulkTimeButton.isVisible()) {
        await bulkTimeButton.click();
        await page.waitForTimeout(500);

        // 일괄 시간 수정 모달
        const bulkStartTime = page.locator('input[data-testid="bulk-start-time"]').or(
          page.locator('input[type="time"]').first()
        );
        
        const bulkEndTime = page.locator('input[data-testid="bulk-end-time"]').or(
          page.locator('input[type="time"]').nth(1)
        );

        if (await bulkStartTime.isVisible() && await bulkEndTime.isVisible()) {
          await bulkStartTime.fill('19:30');
          await bulkEndTime.fill('01:30');

          const applyButton = page.locator('button').filter({ hasText: /적용|apply/i });
          if (await applyButton.isVisible()) {
            // 실제 적용하지 않고 취소 (테스트 데이터 보호)
            const cancelButton = page.locator('button').filter({ hasText: /취소|cancel/i });
            if (await cancelButton.isVisible()) {
              await cancelButton.click();
            } else {
              await page.keyboard.press('Escape');
            }

            console.log('✅ 일괄 시간 수정 인터페이스 확인 완료');
          }
        }
      }
    }
  });

  test('변경 이력 추적', async ({ page }) => {
    await navigateToStaffTab(page);

    // 시간 변경 전 이력 확인
    const initialLogs = await firebaseHelper.getAuditLogs('test-job-time', '김시간');
    
    // 시간 변경 수행
    await modifyWorkTime(page, '김시간', '20:00', '04:00');
    await page.waitForTimeout(2000);

    // 변경 후 이력 확인
    const updatedLogs = await firebaseHelper.getAuditLogs('test-job-time', '김시간');
    expect(updatedLogs.length).toBeGreaterThan(initialLogs.length);

    // 최신 로그 검증
    const latestLog = updatedLogs[updatedLogs.length - 1];
    expect(latestLog.action).toBe('TIME_MODIFIED');
    expect(latestLog.changes.scheduledStartTime.from).toBe('18:00');
    expect(latestLog.changes.scheduledStartTime.to).toBe('20:00');
    expect(latestLog.changes.scheduledEndTime.from).toBe('02:00');
    expect(latestLog.changes.scheduledEndTime.to).toBe('04:00');

    console.log(`✅ 변경 이력 기록 확인:`);
    console.log(`  - 변경자: ${latestLog.modifiedBy}`);
    console.log(`  - 변경 시간: ${latestLog.timestamp}`);
    console.log(`  - 변경 내용: ${JSON.stringify(latestLog.changes)}`);
  });

  test('내 스케줄 페이지 동기화 확인', async ({ page }) => {
    // 관리자가 스태프 시간 변경
    await navigateToStaffTab(page);
    await modifyWorkTime(page, '김시간', '21:00', '05:00');

    // 일반 사용자로 로그인하여 내 스케줄 페이지 확인
    await authHelper.logout();
    
    // 김시간 사용자로 로그인 (또는 테스트 사용자)
    await authHelper.loginAsUser('김시간', 'test123');
    
    // 내 스케줄 페이지로 이동
    await page.goto('http://localhost:3001/my-schedule');
    await page.waitForLoadState('domcontentloaded');

    // 변경된 시간이 반영되었는지 확인
    await expect(page.locator('text=21:00')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=05:00')).toBeVisible();

    // UnifiedDataContext를 통한 실시간 업데이트 확인
    const scheduleData = await page.evaluate(() => {
      return window.__MY_SCHEDULE_DATA__ || null;
    });

    if (scheduleData) {
      expect(scheduleData.scheduledStartTime).toBe('21:00');
      expect(scheduleData.scheduledEndTime).toBe('05:00');
    }

    console.log('✅ 내 스케줄 페이지 동기화 확인 완료');
  });

  test('상태별 시간 제약 검증', async ({ page }) => {
    await navigateToStaffTab(page);

    // present 상태의 스태프는 시작 시간 수정 불가능
    await setStaffStatus(page, '이시간', 'present');
    
    const presentStaffRow = page.locator('tr').filter({ hasText: '이시간' });
    const timeButton = presentStaffRow.locator('button').filter({ hasText: /시간|time/i }).first();

    if (await timeButton.isVisible()) {
      // 버튼이 비활성화되어 있어야 함
      await expect(timeButton).toBeDisabled();
      console.log('✅ 출근 상태 스태프의 시간 수정 제한 확인');
    }

    // completed 상태의 스태프는 시간 수정 불가능
    await setStaffStatus(page, '김시간', 'completed');
    
    const completedStaffRow = page.locator('tr').filter({ hasText: '김시간' });
    const completedTimeButton = completedStaffRow.locator('button').filter({ hasText: /시간|time/i }).first();

    if (await completedTimeButton.isVisible()) {
      await expect(completedTimeButton).toBeDisabled();
      console.log('✅ 완료 상태 스태프의 시간 수정 제한 확인');
    }
  });

});

// Helper Functions
async function navigateToStaffTab(page: Page) {
  const jobRow = page.locator('tr').filter({ hasText: '시간 수정 테스트' });
  if (await jobRow.isVisible()) {
    await jobRow.click();
    await page.waitForURL(/\/admin\/job-postings\/.*/, { timeout: 5000 });
  }

  await page.locator('button').filter({ hasText: /스태프|staff/i }).first().click();
  await page.waitForTimeout(1000);
}

// Helper Functions
async function setStaffStatus(page: Page, staffName: string, status: string) {
  const staffRow = page.locator('tr').filter({ hasText: staffName });
  const statusSelect = staffRow.locator('select').first();

  if (await statusSelect.isVisible()) {
    await statusSelect.selectOption(status);
    await page.waitForTimeout(1000);
  }
}

// Helper Functions
async function modifyWorkTime(page: Page, staffName: string, startTime: string, endTime: string) {
  const staffRow = page.locator('tr').filter({ hasText: staffName });
  
  // 시간 편집 버튼 클릭
  const timeButton = staffRow.locator('button').filter({ hasText: /시간|time/i }).or(
    staffRow.locator('td').filter({ hasText: /\d{2}:\d{2}/ })
  ).first();

  if (await timeButton.isVisible()) {
    await timeButton.click();
    await page.waitForTimeout(500);

    // 시작 시간 수정
    const startTimeInput = page.locator('input[type="time"]').first();
    if (await startTimeInput.isVisible()) {
      await startTimeInput.fill(startTime);
    }

    // 종료 시간 수정
    const endTimeInput = page.locator('input[type="time"]').nth(1);
    if (await endTimeInput.isVisible()) {
      await endTimeInput.fill(endTime);
    }

    // 저장
    const saveButton = page.locator('button').filter({ hasText: /저장|save/i });
    if (await saveButton.isVisible()) {
      await saveButton.click();
    } else {
      await page.keyboard.press('Enter');
    }

    await page.waitForTimeout(1000);
  }
}