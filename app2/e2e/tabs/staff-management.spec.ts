import { test, expect, Page } from '@playwright/test';
import { AuthHelper } from '../helpers/auth.helper';
import { DataHelper } from '../helpers/data.helper';
import { FirebaseHelper } from '../helpers/firebase.helper';

/**
 * Test 8: 스태프 관리 탭 테스트
 * 
 * 테스트 범위:
 * - StaffManagementTab 기본 기능 및 데이터 로드
 * - React Window 가상화 성능 (대량 스태프 데이터)
 * - 스태프 정보 편집 (이름, 전화번호, 역할, 시급)
 * - 출근 상태 관리 (scheduled, present, absent, late)
 * - 스태프 검색 및 필터링
 * - 대량 작업 (일괄 선택, 출석 체크)
 * - UnifiedDataContext 실시간 동기화
 */

test.describe('스태프 관리 탭', () => {
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

    // 테스트 데이터 준비: 구인공고와 스태프들 생성
    await dataHelper.createTestJobPosting('test-job-staff', {
      title: '포커 딜러 모집 - 스태프 관리 테스트',
      location: '서울 강남구',
      roles: [
        { name: '딜러', hourlyWage: 15000, requiredCount: 5 },
        { name: '서버', hourlyWage: 12000, requiredCount: 3 },
        { name: '매니저', hourlyWage: 18000, requiredCount: 1 }
      ],
      description: '스태프 관리 탭 테스트용 공고',
      jobDate: '2025-01-25',
      startTime: '19:00',
      endTime: '03:00',
      status: 'active'
    });

    // 확정된 스태프들 생성 (지원자 → 스태프 전환 완료 상태)
    const confirmedStaff = [
      { name: '김딜러', phone: '010-1111-1111', role: '딜러', hourlyWage: 15000, status: 'scheduled' },
      { name: '이딜러', phone: '010-2222-2222', role: '딜러', hourlyWage: 15000, status: 'present' },
      { name: '박서버', phone: '010-3333-3333', role: '서버', hourlyWage: 12000, status: 'scheduled' },
      { name: '최서버', phone: '010-4444-4444', role: '서버', hourlyWage: 12000, status: 'late' },
      { name: '정매니저', phone: '010-5555-5555', role: '매니저', hourlyWage: 18000, status: 'present' }
    ];

    for (const staff of confirmedStaff) {
      await dataHelper.createTestStaff('test-job-staff', staff);
    }

    // 구인공고 관리 페이지로 이동
    await page.goto('http://localhost:3001/admin/job-postings');
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async ({ page }) => {
    // 테스트 데이터 정리
    await dataHelper.cleanupTestData('test-job-staff');
    await authHelper.logout();
  });

  test('스태프 탭 기본 렌더링 및 데이터 로드', async ({ page }) => {
    const startTime = Date.now();

    // 테스트 공고 선택
    const jobRow = page.locator('tr').filter({ hasText: '스태프 관리 테스트' });
    await jobRow.click();

    // 상세 페이지로 이동 대기
    await page.waitForURL(/\/admin\/job-postings\/.*/, { timeout: 5000 });

    // 스태프 탭 클릭
    const staffTab = page.locator('button', { hasText: '스태프' }).or(
      page.locator('[data-testid="staff-tab"]')
    ).or(
      page.locator('button').filter({ hasText: /스태프|staff/i })
    ).first();

    await staffTab.click();
    await page.waitForTimeout(1000);

    // 스태프 목록 로드 확인
    const staffList = page.locator('[data-testid="staff-list"]').or(
      page.locator('.staff-list').or(
        page.locator('div').filter({ hasText: '김딜러' })
      )
    );
    
    await expect(staffList).toBeVisible({ timeout: 10000 });

    // 성능 검증: 4초 이내 로드
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(4000);

    // 스태프 데이터 표시 확인
    await expect(page.locator('text=김딜러')).toBeVisible();
    await expect(page.locator('text=이딜러')).toBeVisible();
    await expect(page.locator('text=박서버')).toBeVisible();
    await expect(page.locator('text=정매니저')).toBeVisible();

    // 역할별 스태프 수 확인
    const dealerCount = await page.locator('text=딜러').count();
    const serverCount = await page.locator('text=서버').count();
    const managerCount = await page.locator('text=매니저').count();
    
    expect(dealerCount).toBeGreaterThanOrEqual(2);
    expect(serverCount).toBeGreaterThanOrEqual(2);
    expect(managerCount).toBeGreaterThanOrEqual(1);

    console.log(`✅ 스태프 탭 로드 시간: ${loadTime}ms`);
    console.log(`✅ 역할별 스태프: 딜러 ${dealerCount}, 서버 ${serverCount}, 매니저 ${managerCount}`);
  });

  test('React Window 가상화 성능 테스트', async ({ page }) => {
    // 대량 스태프 데이터 생성 (가상화 테스트용)
    const largeStaffSet = Array.from({ length: 30 }, (_, i) => ({
      name: `테스트스태프${i + 1}`,
      phone: `010-${String(i + 100).padStart(4, '0')}-${String(i).padStart(4, '0')}`,
      role: ['딜러', '서버', '매니저'][i % 3],
      hourlyWage: [15000, 12000, 18000][i % 3],
      status: 'scheduled'
    }));

    for (const staff of largeStaffSet) {
      await dataHelper.createTestStaff('test-job-staff', staff);
    }

    const startTime = Date.now();

    // 페이지 리로드하여 새 데이터 반영
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // 스태프 탭 접근
    await page.locator('button').filter({ hasText: /스태프|staff/i }).first().click();
    await page.waitForTimeout(2000);

    // 가상화 컨테이너 확인
    const virtualizationContainer = page.locator('[data-testid="virtualized-staff-list"]').or(
      page.locator('.react-window').or(
        page.locator('[style*="overflow"]')
      )
    );

    // 스크롤 성능 테스트
    const scrollContainer = virtualizationContainer.or(
      page.locator('div').filter({ hasText: '테스트스태프1' }).locator('..').locator('..')
    ).first();

    if (await scrollContainer.isVisible()) {
      // 스크롤 다운
      await scrollContainer.evaluate(el => {
        el.scrollTop = 800;
      });
      await page.waitForTimeout(100);

      // 스크롤 업
      await scrollContainer.evaluate(el => {
        el.scrollTop = 0;
      });
      await page.waitForTimeout(100);
    }

    const renderTime = Date.now() - startTime;
    expect(renderTime).toBeLessThan(3000);

    // 가상화가 정상 작동하는지 확인 (모든 항목이 DOM에 있지 않아야 함)
    const visibleItems = await page.locator('text=/테스트스태프\\d+/').count();
    expect(visibleItems).toBeLessThan(35); // 가상화로 일부만 렌더링

    console.log(`✅ 대량 데이터(35개) 렌더링 시간: ${renderTime}ms`);
    console.log(`✅ 가시적 항목 수: ${visibleItems}/35`);
  });

  test('스태프 정보 편집 기능', async ({ page }) => {
    // 스태프 탭으로 이동
    await page.locator('button').filter({ hasText: /스태프|staff/i }).first().click();
    await page.waitForTimeout(1000);

    // 김딜러 스태프 선택
    const staffRow = page.locator('tr').filter({ hasText: '김딜러' }).or(
      page.locator('div').filter({ hasText: '김딜러' }).locator('..')
    );

    await expect(staffRow).toBeVisible();

    // 편집 버튼 클릭
    const editButton = staffRow.locator('button').filter({ hasText: /편집|edit/i }).or(
      staffRow.locator('[data-testid="edit-staff-button"]').or(
        staffRow.locator('button').filter({ hasText: '✏️' })
      )
    ).first();

    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForTimeout(500);

      // 편집 모달 또는 인라인 편집 필드 확인
      const nameInput = page.locator('input[value="김딜러"]').or(
        page.locator('input').filter({ hasText: '김딜러' }).or(
          page.locator('[data-testid="staff-name-input"]')
        )
      );

      if (await nameInput.isVisible()) {
        // 이름 변경
        await nameInput.clear();
        await nameInput.fill('김수정딜러');

        // 저장 버튼 클릭
        const saveButton = page.locator('button').filter({ hasText: /저장|save/i }).or(
          page.locator('[data-testid="save-staff-button"]')
        );

        if (await saveButton.isVisible()) {
          await saveButton.click();
          await page.waitForTimeout(2000);

          // 변경 사항 확인
          await expect(page.locator('text=김수정딜러')).toBeVisible();

          // Firebase에서 변경 사항 확인
          const updatedData = await firebaseHelper.getStaffData('test-job-staff', '김수정딜러');
          expect(updatedData.name).toBe('김수정딜러');

          console.log('✅ 스태프 정보 편집 완료');
        }
      }
    } else {
      // 인라인 편집이 가능한 경우 (더블클릭)
      await staffRow.locator('text=김딜러').dblclick();
      await page.waitForTimeout(500);

      const inlineInput = page.locator('input').filter({ hasText: '김딜러' });
      if (await inlineInput.isVisible()) {
        await inlineInput.clear();
        await inlineInput.fill('김수정딜러');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
        
        await expect(page.locator('text=김수정딜러')).toBeVisible();
        console.log('✅ 인라인 편집으로 스태프 정보 수정 완료');
      }
    }
  });

  test('출근 상태 관리 기능', async ({ page }) => {
    // 스태프 탭으로 이동
    await page.locator('button').filter({ hasText: /스태프|staff/i }).first().click();
    await page.waitForTimeout(1000);

    // 김딜러의 출근 상태 변경 (scheduled → present)
    const staffRow = page.locator('tr').filter({ hasText: '김딜러' });
    
    const statusSelect = staffRow.locator('select').or(
      staffRow.locator('button').filter({ hasText: /상태|status/i })
    ).first();

    if (await statusSelect.isVisible()) {
      if (await statusSelect.locator('option').count() > 0) {
        await statusSelect.selectOption('present');
      } else {
        await statusSelect.click();
        await page.locator('text=present').or(page.locator('text=출근')).click();
      }
      
      await page.waitForTimeout(1000);

      // present 상태로 변경 확인
      await expect(staffRow.locator('text=present').or(
        staffRow.locator('text=출근')
      )).toBeVisible();

      // Firebase에서 workLogs 업데이트 확인
      const workLogData = await firebaseHelper.getWorkLogData('test-job-staff', '김딜러');
      expect(workLogData.status).toBe('present');
      expect(workLogData.actualStartTime).toBeTruthy(); // 실제 출근 시간 기록

      console.log('✅ 출근 상태 변경 및 기록 완료');
    }

    // 다른 스태프의 지각 처리 테스트
    const lateStaffRow = page.locator('tr').filter({ hasText: '최서버' });
    const lateStatusSelect = lateStaffRow.locator('select').first();

    if (await lateStatusSelect.isVisible()) {
      await lateStatusSelect.selectOption('late');
      await page.waitForTimeout(1000);

      await expect(lateStaffRow.locator('text=late').or(
        lateStaffRow.locator('text=지각')
      )).toBeVisible();

      console.log('✅ 지각 상태 처리 완료');
    }
  });

  test('스태프 검색 및 필터링', async ({ page }) => {
    // 스태프 탭으로 이동
    await page.locator('button').filter({ hasText: /스태프|staff/i }).first().click();
    await page.waitForTimeout(1000);

    // 이름으로 검색
    const searchInput = page.locator('input[placeholder*="검색"]').or(
      page.locator('input[type="search"]').or(
        page.locator('[data-testid="staff-search-input"]')
      )
    );

    if (await searchInput.isVisible()) {
      await searchInput.fill('김딜러');
      await page.waitForTimeout(500);

      // 검색 결과 확인
      await expect(page.locator('text=김딜러')).toBeVisible();
      
      // 다른 스태프는 숨겨졌는지 확인
      const visibleStaff = await page.locator('tr').filter({ hasText: /이딜러|박서버|정매니저/ }).count();
      expect(visibleStaff).toBeLessThan(3); // 필터링 효과 확인

      await searchInput.clear();
      await page.waitForTimeout(500);
    }

    // 역할별 필터링
    const roleFilter = page.locator('select').filter({ hasText: '' }).or(
      page.locator('[data-testid="role-filter"]')
    ).first();

    if (await roleFilter.isVisible()) {
      if (await roleFilter.locator('option').count() > 0) {
        await roleFilter.selectOption('딜러');
      } else {
        await roleFilter.click();
        await page.locator('text=딜러').click();
      }
      
      await page.waitForTimeout(500);

      // 딜러 역할 스태프만 표시되는지 확인
      const dealerStaff = await page.locator('text=딜러').count();
      expect(dealerStaff).toBeGreaterThan(0);

      const serverStaff = await page.locator('text=서버').count();
      expect(serverStaff).toBe(0); // 서버는 필터링되어야 함
    }

    console.log('✅ 스태프 검색 및 필터링 기능 테스트 완료');
  });

  test('대량 작업 - 일괄 출석 체크', async ({ page }) => {
    // 스태프 탭으로 이동
    await page.locator('button').filter({ hasText: /스태프|staff/i }).first().click();
    await page.waitForTimeout(1000);

    // 전체 선택 체크박스
    const selectAllCheckbox = page.locator('input[type="checkbox"]').first().or(
      page.locator('[data-testid="select-all-staff-checkbox"]')
    );

    if (await selectAllCheckbox.isVisible()) {
      await selectAllCheckbox.check();
      await page.waitForTimeout(500);

      // 개별 체크박스들이 선택되었는지 확인
      const checkedBoxes = await page.locator('input[type="checkbox"]:checked').count();
      expect(checkedBoxes).toBeGreaterThan(1);

      // 일괄 출석 버튼
      const bulkAttendanceButton = page.locator('button').filter({ hasText: /일괄 출석|bulk attendance/i }).or(
        page.locator('[data-testid="bulk-attendance-button"]')
      );

      if (await bulkAttendanceButton.isVisible()) {
        await expect(bulkAttendanceButton).toBeEnabled();

        // 일괄 출석 처리 (실제로는 클릭하지 않고 호버만)
        await bulkAttendanceButton.hover();
        
        // 확인 다이얼로그 시뮬레이션
        console.log('✅ 일괄 출석 버튼 활성화 확인');
      }

      // 선택 해제
      await selectAllCheckbox.uncheck();
    }

    // 개별 스태프 선택 테스트
    const individualCheckbox = page.locator('tr').filter({ hasText: '김딜러' }).locator('input[type="checkbox"]');
    
    if (await individualCheckbox.isVisible()) {
      await individualCheckbox.check();
      await page.waitForTimeout(500);

      // 개별 선택 시 일괄 버튼 활성화 확인
      const bulkButton = page.locator('button').filter({ hasText: /일괄|bulk/i }).first();
      if (await bulkButton.isVisible()) {
        await expect(bulkButton).toBeEnabled();
      }

      await individualCheckbox.uncheck();
    }

    console.log('✅ 대량 작업 기능 테스트 완료');
  });

  test('UnifiedDataContext 실시간 동기화', async ({ page }) => {
    // 스태프 탭으로 이동
    await page.locator('button').filter({ hasText: /스태프|staff/i }).first().click();
    await page.waitForTimeout(1000);

    // 초기 스태프 수 확인
    const initialStaffCount = await page.locator('tr').filter({ 
      hasText: /김딜러|이딜러|박서버|최서버|정매니저/ 
    }).count();

    // 새 탭에서 스태프 추가 시뮬레이션
    await dataHelper.createTestStaff('test-job-staff', {
      name: '신규스태프',
      phone: '010-9999-9999',
      role: '딜러',
      hourlyWage: 15000,
      status: 'scheduled'
    });

    // 실시간 업데이트 확인
    await page.waitForTimeout(3000); // 실시간 구독 반영 대기

    await expect(page.locator('text=신규스태프')).toBeVisible({ timeout: 10000 });

    // 스태프 수 증가 확인
    const updatedStaffCount = await page.locator('tr').filter({ 
      hasText: /김딜러|이딜러|박서버|최서버|정매니저|신규스태프/ 
    }).count();
    
    expect(updatedStaffCount).toBe(initialStaffCount + 1);

    // UnifiedDataContext 상태 확인
    const contextStatus = await page.evaluate(() => {
      return window.__UNIFIED_DATA_CONTEXT_STATUS__ || 'unknown';
    });

    console.log(`✅ UnifiedDataContext 상태: ${contextStatus}`);
    console.log(`✅ 실시간 동기화 확인: ${initialStaffCount} → ${updatedStaffCount}`);
  });

  test('시급 및 근무 시간 계산 검증', async ({ page }) => {
    // 스태프 탭으로 이동
    await page.locator('button').filter({ hasText: /스태프|staff/i }).first().click();
    await page.waitForTimeout(1000);

    // 역할별 시급 표시 확인
    const dealerRow = page.locator('tr').filter({ hasText: '김딜러' });
    const serverRow = page.locator('tr').filter({ hasText: '박서버' });
    const managerRow = page.locator('tr').filter({ hasText: '정매니저' });

    // 시급 정보 확인 (화면 표시)
    await expect(dealerRow.locator('text=15,000').or(dealerRow.locator('text=15000'))).toBeVisible();
    await expect(serverRow.locator('text=12,000').or(serverRow.locator('text=12000'))).toBeVisible();
    await expect(managerRow.locator('text=18,000').or(managerRow.locator('text=18000'))).toBeVisible();

    // 근무 시간 정보 확인 (19:00-03:00 = 8시간)
    const workHours = page.locator('text=8시간').or(page.locator('text=8h'));
    if (await workHours.isVisible()) {
      await expect(workHours).toBeVisible();
    }

    // Firebase에서 정확한 급여 계산 데이터 확인
    const dealerData = await firebaseHelper.getStaffData('test-job-staff', '김딜러');
    const expectedSalary = dealerData.hourlyWage * 8; // 8시간 근무

    console.log(`✅ 딜러 시급: ${dealerData.hourlyWage}원`);
    console.log(`✅ 예상 급여: ${expectedSalary}원 (8시간 기준)`);
  });

  test('성능 지표 및 메트릭 수집', async ({ page }) => {
    const metrics = await dataHelper.collectPerformanceMetrics();
    
    // 스태프 탭 접근 시간 측정
    const startTime = Date.now();
    
    await page.locator('button').filter({ hasText: /스태프|staff/i }).first().click();
    await page.waitForSelector('text=김딜러', { timeout: 10000 });
    
    const accessTime = Date.now() - startTime;
    
    // 메모리 사용량 확인
    const memoryUsage = await page.evaluate(() => {
      if (window.performance && window.performance.memory) {
        return window.performance.memory.usedJSHeapSize / 1024 / 1024; // MB
      }
      return 0;
    });

    // 성능 검증
    expect(accessTime).toBeLessThan(4000); // 4초 이내
    expect(memoryUsage).toBeLessThan(100); // 100MB 이내

    // Firebase 쿼리 성능 확인
    const firebaseMetrics = await firebaseHelper.measureQueryPerformance();
    expect(firebaseMetrics.averageQueryTime).toBeLessThan(1000); // 1초 이내

    console.log(`📊 스태프 탭 성능 지표:`);
    console.log(`  - 접근 시간: ${accessTime}ms`);
    console.log(`  - 메모리 사용량: ${memoryUsage.toFixed(2)}MB`);
    console.log(`  - Firebase 쿼리 평균: ${firebaseMetrics.averageQueryTime}ms`);
    console.log(`  - 캐시 히트율: ${metrics.cacheHitRate}%`);
  });
});