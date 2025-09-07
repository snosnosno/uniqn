import { test, expect, Page, Browser } from '@playwright/test';

// 테스트 전용 유틸리티 함수들
async function loginAsAdmin(page: Page) {
  await page.goto('http://localhost:3000');
  
  // 로그인 페이지로 이동
  await page.click('text=로그인');
  
  // 관리자 계정으로 로그인
  await page.fill('input[type="email"]', 'admin@test.com');
  await page.fill('input[type="password"]', '456456');
  await page.click('button[type="submit"]');
  
  // 로그인 완료 대기
  await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });
}

async function navigateToStaffPage(page: Page) {
  const targetUrl = 'http://localhost:3000/admin/job-posting/JjIrn5kIlpAMdwghFf6d?tab=staff';
  await page.goto(targetUrl);
  
  // 스태프 탭이 활성화될 때까지 대기
  await page.waitForSelector('[data-testid="staff-tab"]', { timeout: 10000 });
  
  // 김승호 스태프가 로드될 때까지 대기
  await page.waitForSelector('text=김승호', { timeout: 10000 });
}

async function getConsoleMessages(page: Page) {
  const messages: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('🔍 getStaffWorkLog ID 매칭') || 
        text.includes('🔄 새로운 WorkLog 감지') || 
        text.includes('🚀 AttendanceStatusPopover Optimistic Update') ||
        text.includes('WorkLog') || 
        text.includes('출근') || 
        text.includes('퇴근')) {
      messages.push(`[${msg.type().toUpperCase()}] ${text}`);
    }
  });
  return messages;
}

test.describe('WorkLog 관리 시나리오 테스트', () => {
  let browser: Browser;
  let page: Page;
  let consoleMessages: string[];

  test.beforeAll(async ({ browser: b }) => {
    browser = b;
  });

  test.beforeEach(async () => {
    page = await browser.newPage();
    consoleMessages = await getConsoleMessages(page);
    
    // 관리자 로그인
    await loginAsAdmin(page);
    
    // 스태프 페이지로 이동
    await navigateToStaffPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('시나리오 1: 시간 수정 후 새로고침 테스트', async () => {
    console.log('🎯 시나리오 1 시작: 시간 수정 후 새로고침 테스트');
    
    // 1. 김승호 스태프의 출근시간 버튼 클릭
    console.log('1️⃣ 김승호 스태프의 출근시간 버튼 찾기');
    
    // 김승호가 포함된 행을 찾기
    const staffRow = page.locator('tr').filter({ hasText: '김승호' });
    await expect(staffRow).toBeVisible();
    
    // 출근시간 버튼 클릭 (첫 번째 시간 버튼)
    const timeButton = staffRow.locator('button').filter({ hasText: /^\d{2}:\d{2}$|미정/ }).first();
    await timeButton.click();
    
    console.log('2️⃣ 시간 수정 모달 열기');
    
    // 시간 수정 모달이 열릴 때까지 대기
    await page.waitForSelector('[data-testid="work-time-modal"]', { timeout: 5000 });
    
    console.log('3️⃣ 출근시간을 10:00으로 변경');
    
    // 출근시간 입력 필드 찾기 및 수정
    const startTimeInput = page.locator('input[type="time"]').first();
    await startTimeInput.fill('10:00');
    
    console.log('4️⃣ 퇴근시간을 18:00으로 변경');
    
    // 퇴근시간 입력 필드 찾기 및 수정
    const endTimeInput = page.locator('input[type="time"]').last();
    await endTimeInput.fill('18:00');
    
    console.log('5️⃣ 저장 버튼 클릭');
    
    // 저장 버튼 클릭
    await page.click('button:has-text("저장")');
    
    console.log('6️⃣ 모달 닫힘 대기');
    
    // 모달이 닫힐 때까지 대기
    await page.waitForSelector('[data-testid="work-time-modal"]', { state: 'hidden', timeout: 5000 });
    
    console.log('7️⃣ 페이지 새로고침');
    
    // 페이지 새로고침
    await page.reload();
    
    console.log('8️⃣ 데이터 로드 대기');
    
    // 김승호 스태프가 다시 로드될 때까지 대기
    await page.waitForSelector('text=김승호', { timeout: 10000 });
    
    console.log('9️⃣ 시간 유지 확인');
    
    // 변경된 시간이 유지되는지 확인
    const updatedRow = page.locator('tr').filter({ hasText: '김승호' });
    await expect(updatedRow.locator('text=10:00')).toBeVisible();
    await expect(updatedRow.locator('text=18:00')).toBeVisible();
    
    console.log('✅ 시나리오 1 완료: 시간 수정이 정상적으로 저장되고 새로고침 후에도 유지됨');
  });

  test('시나리오 2: 출석상태 변경 즉시 반영 테스트', async () => {
    console.log('🎯 시나리오 2 시작: 출석상태 변경 즉시 반영 테스트');
    
    // 1. 김승호 스태프의 출석상태 버튼 클릭
    console.log('1️⃣ 김승호 스태프의 출석상태 버튼 찾기');
    
    const staffRow = page.locator('tr').filter({ hasText: '김승호' });
    await expect(staffRow).toBeVisible();
    
    // 출석상태 버튼 클릭 ("출근 전" 또는 다른 상태)
    const statusButton = staffRow.locator('button').filter({ hasText: /출근 전|출근|퇴근/ });
    await statusButton.click();
    
    console.log('2️⃣ 출석상태 변경 모달 확인');
    
    // 출석상태 변경 팝오버가 열릴 때까지 대기
    await page.waitForSelector('[data-testid="attendance-status-popover"]', { timeout: 5000 });
    
    console.log('3️⃣ "출근" 상태로 변경');
    
    // "출근" 버튼 클릭
    await page.click('button:has-text("출근")');
    
    console.log('4️⃣ UI 즉시 반영 확인');
    
    // UI에 즉시 "출근" 상태가 반영되는지 확인 (optimistic update)
    await expect(staffRow.locator('text=출근')).toBeVisible({ timeout: 3000 });
    
    console.log('5️⃣ 성공 알림 확인');
    
    // 성공 알림 토스트 확인
    await expect(page.locator('.toast, [data-testid="toast"]')).toBeVisible({ timeout: 5000 });
    
    console.log('6️⃣ 페이지 새로고침 후 상태 유지 확인');
    
    // 페이지 새로고침
    await page.reload();
    
    // 김승호 스태프가 다시 로드될 때까지 대기
    await page.waitForSelector('text=김승호', { timeout: 10000 });
    
    // "출근" 상태가 유지되는지 확인
    const reloadedRow = page.locator('tr').filter({ hasText: '김승호' });
    await expect(reloadedRow.locator('text=출근')).toBeVisible();
    
    console.log('✅ 시나리오 2 완료: 출석상태 변경이 즉시 반영되고 새로고침 후에도 유지됨');
  });

  test('시나리오 3: 복합 테스트', async () => {
    console.log('🎯 시나리오 3 시작: 복합 테스트');
    
    // 1. 출근시간을 11:00으로 재수정
    console.log('1️⃣ 출근시간을 11:00으로 수정');
    
    const staffRow = page.locator('tr').filter({ hasText: '김승호' });
    await expect(staffRow).toBeVisible();
    
    // 출근시간 버튼 클릭
    const timeButton = staffRow.locator('button').filter({ hasText: /^\d{2}:\d{2}$|미정/ }).first();
    await timeButton.click();
    
    // 시간 수정 모달 대기
    await page.waitForSelector('[data-testid="work-time-modal"]', { timeout: 5000 });
    
    // 출근시간을 11:00으로 변경
    const startTimeInput = page.locator('input[type="time"]').first();
    await startTimeInput.fill('11:00');
    
    // 저장
    await page.click('button:has-text("저장")');
    await page.waitForSelector('[data-testid="work-time-modal"]', { state: 'hidden', timeout: 5000 });
    
    console.log('2️⃣ 출석상태를 "퇴근"으로 변경');
    
    // 출석상태 버튼 클릭
    const statusButton = staffRow.locator('button').filter({ hasText: /출근 전|출근|퇴근/ });
    await statusButton.click();
    
    // 출석상태 변경 팝오버 대기
    await page.waitForSelector('[data-testid="attendance-status-popover"]', { timeout: 5000 });
    
    // "퇴근" 버튼 클릭
    await page.click('button:has-text("퇴근")');
    
    console.log('3️⃣ 즉시 반영 확인');
    
    // UI에 즉시 반영되는지 확인
    await expect(staffRow.locator('text=11:00')).toBeVisible({ timeout: 3000 });
    await expect(staffRow.locator('text=퇴근')).toBeVisible({ timeout: 3000 });
    
    console.log('4️⃣ 새로고침 후 모든 변경사항 유지 확인');
    
    // 페이지 새로고침
    await page.reload();
    
    // 김승호 스태프가 다시 로드될 때까지 대기
    await page.waitForSelector('text=김승호', { timeout: 10000 });
    
    // 모든 변경사항이 유지되는지 확인
    const finalRow = page.locator('tr').filter({ hasText: '김승호' });
    await expect(finalRow.locator('text=11:00')).toBeVisible();
    await expect(finalRow.locator('text=퇴근')).toBeVisible();
    
    console.log('✅ 시나리오 3 완료: 복합 변경사항이 모두 정상적으로 저장되고 유지됨');
  });

  test('콘솔 로그 분석 테스트', async () => {
    console.log('🎯 콘솔 로그 분석 테스트 시작');
    
    // 페이지 로드 후 콘솔 메시지 수집
    await page.waitForTimeout(2000);
    
    const staffRow = page.locator('tr').filter({ hasText: '김승호' });
    await expect(staffRow).toBeVisible();
    
    // 출석상태 변경으로 로그 생성
    const statusButton = staffRow.locator('button').filter({ hasText: /출근 전|출근|퇴근/ });
    await statusButton.click();
    
    await page.waitForSelector('[data-testid="attendance-status-popover"]', { timeout: 5000 });
    await page.click('button:has-text("출근")');
    
    // 잠시 대기 후 콘솔 메시지 확인
    await page.waitForTimeout(1000);
    
    console.log('📊 수집된 콘솔 메시지:');
    console.log('총 메시지 수:', consoleMessages.length);
    
    consoleMessages.forEach((message, index) => {
      console.log(`${index + 1}. ${message}`);
    });
    
    // 중요한 로그 패턴 확인
    const hasIdMatching = consoleMessages.some(msg => msg.includes('🔍 getStaffWorkLog ID 매칭'));
    const hasNewWorkLog = consoleMessages.some(msg => msg.includes('🔄 새로운 WorkLog 감지'));
    const hasOptimisticUpdate = consoleMessages.some(msg => msg.includes('🚀 AttendanceStatusPopover Optimistic Update'));
    
    console.log('🔍 ID 매칭 로그 발견:', hasIdMatching);
    console.log('🔄 새로운 WorkLog 감지 로그 발견:', hasNewWorkLog);
    console.log('🚀 Optimistic Update 로그 발견:', hasOptimisticUpdate);
  });
});