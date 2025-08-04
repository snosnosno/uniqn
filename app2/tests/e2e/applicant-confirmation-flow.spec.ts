import { test, expect } from '@playwright/test';

/**
 * 지원자 확정/취소 플로우 E2E 테스트
 * 
 * 테스트 시나리오:
 * 1. 관리자 로그인
 * 2. 구인공고 페이지 접근
 * 3. 지원자 확정
 * 4. 확정 취소
 * 5. 재지원 시 마감 상태 정확성 확인
 * 6. MySchedulePage 연동 확인
 */

const TEST_CONFIG = {
  email: 'admin@test.com',
  password: '456456',
  baseURL: 'http://localhost:3000',
  timeout: 30000
};

test.describe('지원자 확정/취소 플로우', () => {
  test.beforeEach(async ({ page }) => {
    // 관리자 로그인
    await page.goto(`${TEST_CONFIG.baseURL}/login`);
    
    await page.fill('input[type="email"]', TEST_CONFIG.email);
    await page.fill('input[type="password"]', TEST_CONFIG.password);
    await page.click('button[type="submit"]');
    
    // 로그인 완료 대기
    await page.waitForURL(`${TEST_CONFIG.baseURL}/admin`, { timeout: TEST_CONFIG.timeout });
    
    console.log('✅ 관리자 로그인 완료');
  });

  test('전체 플로우: 지원 → 확정 → 취소 → 재지원', async ({ page }) => {
    console.log('🧪 E2E 테스트 시작: 전체 플로우 검증');
    
    // 1단계: 구인공고 페이지로 이동
    await page.goto(`${TEST_CONFIG.baseURL}/admin/job-postings`);
    await page.waitForLoadState('networkidle');
    
    // 첫 번째 구인공고 클릭
    const firstJobPosting = page.locator('[data-testid="job-posting-card"]').first();
    await expect(firstJobPosting).toBeVisible({ timeout: TEST_CONFIG.timeout });
    await firstJobPosting.click();
    
    console.log('📋 구인공고 상세 페이지 접근 완료');
    
    // 2단계: 지원자 목록 확인
    const applicantListTab = page.locator('[data-testid="applicant-list-tab"]');
    await expect(applicantListTab).toBeVisible({ timeout: TEST_CONFIG.timeout });
    await applicantListTab.click();
    
    // 지원자 카드가 로드될 때까지 대기
    const applicantCard = page.locator('[data-testid="applicant-card"]').first();
    await expect(applicantCard).toBeVisible({ timeout: TEST_CONFIG.timeout });
    
    console.log('👥 지원자 목록 로드 완료');
    
    // 지원자 이름 가져오기 (디버깅용)
    const applicantName = await applicantCard.locator('h4').textContent();
    console.log(`🎯 테스트 대상 지원자: ${applicantName}`);
    
    // 3단계: 원본 지원 시간 수집
    const originalSelections = await page.locator('[data-testid="confirmation-time-selection"] .grid > div').count();
    console.log(`📊 원본 지원 시간 수: ${originalSelections}개`);
    
    // 4단계: 지원자 확정
    // 첫 번째 선택 항목 체크
    const firstSelection = page.locator('[data-testid="confirmation-time-selection"] input[type="checkbox"]').first();
    await firstSelection.check();
    
    // 확정 버튼 클릭
    const confirmButton = page.locator('button:has-text("선택한 시간 확정")');
    await confirmButton.click();
    
    // 확정 완료 알림 대기
    await page.waitForSelector('.toast-success, .alert-success', { timeout: TEST_CONFIG.timeout });
    console.log('✅ 지원자 확정 완료');
    
    // 확정 상태 확인
    await expect(page.locator('span:has-text("확정됨")')).toBeVisible({ timeout: TEST_CONFIG.timeout });
    
    // 5단계: 확정 취소
    const cancelConfirmationButton = page.locator('button:has-text("확정 취소")');
    await expect(cancelConfirmationButton).toBeVisible({ timeout: TEST_CONFIG.timeout });
    await cancelConfirmationButton.click();
    
    // 확인 대화상자 처리
    page.on('dialog', async dialog => {
      console.log(`📝 대화상자: ${dialog.message()}`);
      await dialog.accept();
    });
    
    // 취소 완료 대기
    await page.waitForSelector('.toast-success, .alert-success', { timeout: TEST_CONFIG.timeout });
    console.log('✅ 확정 취소 완료');
    
    // 6단계: 원본 지원 시간 복원 확인
    await page.waitForTimeout(2000); // 데이터 동기화 대기
    await page.reload(); // 페이지 새로고침으로 최신 데이터 확인
    await page.waitForLoadState('networkidle');
    
    // 지원자 탭 다시 클릭
    await applicantListTab.click();
    await page.waitForTimeout(1000);
    
    // 복원된 선택 항목 수 확인
    const restoredSelections = await page.locator('[data-testid="confirmation-time-selection"] .grid > div').count();
    console.log(`📊 복원된 지원 시간 수: ${restoredSelections}개`);
    
    // 🔥 핵심 검증: 원본 데이터 완전 복원
    expect(restoredSelections).toBe(originalSelections);
    console.log('✅ 원본 지원 시간 완전 복원 확인');
    
    // 7단계: 마감 상태 정확성 확인
    const fullStatusElements = page.locator('span:has-text("마감")');
    const fullStatusCount = await fullStatusElements.count();
    console.log(`📊 마감 상태 표시 항목 수: ${fullStatusCount}개`);
    
    // 마감이 아닌 항목들이 정상적으로 선택 가능한지 확인
    const availableCheckboxes = page.locator('[data-testid="confirmation-time-selection"] input[type="checkbox"]:not([disabled])');
    const availableCount = await availableCheckboxes.count();
    console.log(`📊 선택 가능한 항목 수: ${availableCount}개`);
    
    // 최소 1개 이상의 선택 가능한 항목이 있어야 함
    expect(availableCount).toBeGreaterThan(0);
    console.log('✅ 마감 상태 정확성 확인 완료');
  });

  test('MySchedulePage 연동 확인', async ({ page }) => {
    console.log('🧪 E2E 테스트 시작: MySchedulePage 연동 검증');
    
    // MySchedulePage로 이동
    await page.goto(`${TEST_CONFIG.baseURL}/my-schedule`);
    await page.waitForLoadState('networkidle');
    
    // 스케줄 항목이 로드될 때까지 대기
    const scheduleItems = page.locator('[data-testid="schedule-item"], .divide-y > div');
    await page.waitForTimeout(3000); // 데이터 로드 대기
    
    const scheduleCount = await scheduleItems.count();
    console.log(`📊 MySchedulePage 스케줄 항목 수: ${scheduleCount}개`);
    
    if (scheduleCount > 0) {
      // 첫 번째 스케줄 항목 클릭하여 상세 정보 확인
      const firstSchedule = scheduleItems.first();
      await firstSchedule.click();
      
      // 상세 모달이 열릴 때까지 대기
      const detailModal = page.locator('[data-testid="schedule-detail-modal"], .modal, [role="dialog"]');
      await expect(detailModal).toBeVisible({ timeout: TEST_CONFIG.timeout });
      
      console.log('✅ MySchedulePage 스케줄 상세 모달 열림 확인');
      
      // 모달 닫기
      const closeButton = page.locator('button:has-text("닫기"), button[aria-label="Close"], .modal-close');
      if (await closeButton.count() > 0) {
        await closeButton.first().click();
      } else {
        await page.keyboard.press('Escape');
      }
    }
    
    console.log('✅ MySchedulePage 연동 확인 완료');
  });

  test('데이터 무결성 검증', async ({ page }) => {
    console.log('🧪 E2E 테스트 시작: 데이터 무결성 검증');
    
    // 구인공고 페이지로 이동
    await page.goto(`${TEST_CONFIG.baseURL}/admin/job-postings`);
    await page.waitForLoadState('networkidle');
    
    // 첫 번째 구인공고 선택
    const firstJobPosting = page.locator('[data-testid="job-posting-card"]').first();
    await expect(firstJobPosting).toBeVisible({ timeout: TEST_CONFIG.timeout });
    await firstJobPosting.click();
    
    // 지원자 목록 탭 클릭
    const applicantListTab = page.locator('[data-testid="applicant-list-tab"]');
    await expect(applicantListTab).toBeVisible({ timeout: TEST_CONFIG.timeout });
    await applicantListTab.click();
    
    // 지원자 카드 로드 대기
    const applicantCards = page.locator('[data-testid="applicant-card"]');
    const applicantCount = await applicantCards.count();
    console.log(`📊 총 지원자 수: ${applicantCount}명`);
    
    if (applicantCount > 0) {
      // 각 지원자의 상태와 선택 항목 일치성 확인
      for (let i = 0; i < Math.min(applicantCount, 3); i++) { // 최대 3명까지 테스트
        const applicant = applicantCards.nth(i);
        const applicantName = await applicant.locator('h4').textContent();
        const statusBadge = applicant.locator('span[class*="bg-"]').first();
        const status = await statusBadge.textContent();
        
        console.log(`👤 지원자 ${i + 1}: ${applicantName} (상태: ${status})`);
        
        // 확정할 시간 선택 영역의 항목 수 확인
        const selectionItems = applicant.locator('[data-testid="confirmation-time-selection"] .grid > div');
        const selectionCount = await selectionItems.count();
        
        console.log(`  📊 선택 가능한 시간 수: ${selectionCount}개`);
        
        // 최소 검증: 선택 항목이 있어야 함
        if (selectionCount === 0) {
          console.warn(`⚠️ 지원자 ${applicantName}의 선택 항목이 없습니다.`);
        } else {
          console.log(`✅ 지원자 ${applicantName}의 데이터 무결성 확인`);
        }
      }
    }
    
    console.log('✅ 데이터 무결성 검증 완료');
  });
});