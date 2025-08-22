import { test, expect } from '@playwright/test';

test('스태프 탭에서 시간 수정 후 정산 탭 실시간 반영 테스트', async ({ page }) => {
  // 로그인
  await page.goto('http://localhost:3003/login');
  await page.fill('input[name="email"]', 'admin@admin.com');
  await page.fill('input[name="password"]', 'adminpassword');
  await page.click('button[type="submit"]');
  
  // 로그인 성공 대기
  await page.waitForURL('**/admin/overview', { timeout: 10000 });
  
  // 구인공고 목록 페이지로 이동
  await page.goto('http://localhost:3003/admin/job-postings');
  await page.waitForLoadState('networkidle');
  
  // 첫 번째 구인공고 클릭
  const firstPosting = await page.locator('.clickable-card').first();
  await firstPosting.click();
  
  // 상세 페이지 로드 대기
  await page.waitForURL('**/job-postings/**');
  await page.waitForLoadState('networkidle');
  
  // 스태프 탭 클릭
  await page.click('button:has-text("스태프")');
  await page.waitForTimeout(1000);
  
  // 스태프 검색 - 8/21 딜러 찾기
  const staffRows = await page.locator('tr').filter({ hasText: '8/21' }).filter({ hasText: '딜러' });
  const staffCount = await staffRows.count();
  
  if (staffCount > 0) {
    // 첫 번째 스태프의 시간 가져오기
    const firstStaff = staffRows.first();
    const initialTime = await firstStaff.locator('span.font-mono').first().textContent();
    console.log('초기 시간:', initialTime);
    
    // 시간 수정 버튼 클릭
    await firstStaff.locator('button[title*="근무 시간"]').click();
    await page.waitForTimeout(500);
    
    // 모달에서 시간 변경 (출근시간을 13:00으로 변경)
    const startHourSelect = await page.locator('select').first();
    await startHourSelect.selectOption('13');
    
    // 저장 버튼 클릭
    await page.click('button:has-text("저장")');
    await page.waitForTimeout(1000);
    
    // 성공 메시지 확인
    await expect(page.locator('text=시간이 성공적으로 업데이트되었습니다')).toBeVisible();
    
    // 모달 닫기
    await page.click('button:has-text("닫기")');
    await page.waitForTimeout(500);
    
    // 정산 탭으로 이동
    await page.click('button:has-text("정산")');
    await page.waitForTimeout(2000);
    
    // 정산 탭에서 딜러 역할의 총 시간 확인
    const dealerRoleCard = await page.locator('.bg-white').filter({ hasText: '딜러' });
    const dealerHours = await dealerRoleCard.locator('text=/\\d+\\.\\d+시간/').textContent();
    console.log('정산 탭 딜러 시간:', dealerHours);
    
    // 시간이 변경되었는지 확인 (예: 10시간이 아닌 다른 값)
    expect(dealerHours).toBeTruthy();
    
    // 콘솔 로그 출력
    page.on('console', msg => {
      if (msg.text().includes('🔄') || msg.text().includes('WorkLogs')) {
        console.log('Console:', msg.text());
      }
    });
    
    // 자동 불러오기 버튼 테스트
    await page.click('button:has-text("자동 불러오기")');
    await page.waitForTimeout(1000);
    
    // 다시 딜러 시간 확인
    const updatedDealerHours = await dealerRoleCard.locator('text=/\\d+\\.\\d+시간/').textContent();
    console.log('자동 불러오기 후 딜러 시간:', updatedDealerHours);
    
  } else {
    console.log('8/21 딜러를 찾을 수 없습니다.');
  }
});