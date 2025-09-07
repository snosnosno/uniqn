import { test, expect, Page } from '@playwright/test';

test.describe('워크로그 기본 동작 테스트', () => {
  test('관리자 로그인 및 스태프 페이지 접근', async ({ page }) => {
    console.log('🚀 테스트 시작: 기본 접근 테스트');
    
    // 콘솔 로그 수집
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('WorkLog') || 
          text.includes('🔍') || 
          text.includes('🔄') || 
          text.includes('🚀') ||
          text.includes('출근') || 
          text.includes('퇴근')) {
        consoleMessages.push(`[${msg.type().toUpperCase()}] ${text}`);
      }
    });
    
    // 에러 로그 수집
    page.on('pageerror', err => {
      console.log('❌ JavaScript Error:', err.message);
    });
    
    try {
      // 1. 메인 페이지 접근
      console.log('1️⃣ 메인 페이지 접근');
      await page.goto('http://localhost:3000');
      await page.waitForLoadState('networkidle');
      
      // 2. 로그인 페이지로 이동
      console.log('2️⃣ 로그인 페이지로 이동');
      const loginButton = page.locator('text=로그인').first();
      if (await loginButton.isVisible()) {
        await loginButton.click();
        await page.waitForLoadState('networkidle');
      }
      
      // 3. 관리자 계정으로 로그인
      console.log('3️⃣ 관리자 로그인 시도');
      await page.fill('input[type="email"]', 'admin@test.com');
      await page.fill('input[type="password"]', '456456');
      await page.click('button[type="submit"]');
      
      // 로그인 완료 대기 (대시보드 또는 메인 화면)
      await page.waitForTimeout(3000);
      
      // 4. 스태프 페이지로 직접 이동
      console.log('4️⃣ 스태프 페이지로 이동');
      const targetUrl = 'http://localhost:3000/admin/job-posting/JjIrn5kIlpAMdwghFf6d?tab=staff';
      await page.goto(targetUrl);
      await page.waitForLoadState('networkidle');
      
      // 5. 페이지 로드 확인
      console.log('5️⃣ 페이지 로드 확인');
      await page.waitForTimeout(5000); // 데이터 로드 대기
      
      // 스태프 테이블이 존재하는지 확인
      const staffTable = page.locator('table, [role="table"]');
      await expect(staffTable).toBeVisible({ timeout: 10000 });
      
      // 김승호 스태프 찾기
      console.log('6️⃣ 김승호 스태프 확인');
      const kimSeungHo = page.locator('text=김승호');
      if (await kimSeungHo.isVisible()) {
        console.log('✅ 김승호 스태프 발견');
        
        // 김승호가 있는 행 찾기
        const staffRow = page.locator('tr').filter({ hasText: '김승호' });
        await expect(staffRow).toBeVisible();
        
        // 행의 버튼들 확인
        const buttons = staffRow.locator('button');
        const buttonCount = await buttons.count();
        console.log(`📊 김승호 행의 버튼 수: ${buttonCount}`);
        
        // 각 버튼의 텍스트 출력
        for (let i = 0; i < buttonCount; i++) {
          const buttonText = await buttons.nth(i).textContent();
          console.log(`   버튼 ${i + 1}: "${buttonText}"`);
        }
        
      } else {
        console.log('⚠️ 김승호 스태프를 찾을 수 없음');
        
        // 페이지에 있는 모든 텍스트 내용 출력
        const bodyText = await page.locator('body').textContent();
        console.log('페이지 내용 샘플:', bodyText?.substring(0, 500));
      }
      
      // 7. 출근시간 버튼 클릭 테스트
      console.log('7️⃣ 출근시간 버튼 클릭 테스트');
      const staffRow = page.locator('tr').filter({ hasText: '김승호' });
      
      if (await staffRow.isVisible()) {
        // 시간 관련 버튼 찾기 (HH:MM 패턴 또는 "미정")
        const timeButtons = staffRow.locator('button').filter({ hasText: /^\d{2}:\d{2}$|미정|출근시간|퇴근시간/ });
        const timeButtonCount = await timeButtons.count();
        
        console.log(`🕐 시간 버튼 수: ${timeButtonCount}`);
        
        if (timeButtonCount > 0) {
          // 첫 번째 시간 버튼 클릭
          await timeButtons.first().click();
          console.log('✅ 첫 번째 시간 버튼 클릭 완료');
          
          await page.waitForTimeout(2000);
          
          // 모달이 열렸는지 확인
          const modal = page.locator('[data-testid="work-time-modal"], .modal, [role="dialog"]');
          if (await modal.isVisible()) {
            console.log('✅ 시간 수정 모달 열림');
          } else {
            console.log('⚠️ 시간 수정 모달을 찾을 수 없음');
          }
        }
      }
      
      // 8. 출석상태 버튼 클릭 테스트
      console.log('8️⃣ 출석상태 버튼 클릭 테스트');
      
      if (await staffRow.isVisible()) {
        // 출석상태 버튼 찾기
        const statusButtons = staffRow.locator('button').filter({ hasText: /출근 전|출근|퇴근|지각|조퇴/ });
        const statusButtonCount = await statusButtons.count();
        
        console.log(`📍 출석상태 버튼 수: ${statusButtonCount}`);
        
        if (statusButtonCount > 0) {
          // 첫 번째 상태 버튼 클릭
          await statusButtons.first().click();
          console.log('✅ 첫 번째 상태 버튼 클릭 완료');
          
          await page.waitForTimeout(2000);
          
          // 팝오버가 열렸는지 확인
          const popover = page.locator('[data-testid="attendance-status-popover"], .popover');
          if (await popover.isVisible()) {
            console.log('✅ 출석상태 팝오버 열림');
          } else {
            console.log('⚠️ 출석상태 팝오버를 찾을 수 없음');
          }
        }
      }
      
      // 9. 콘솔 메시지 출력
      console.log('📋 수집된 콘솔 메시지:');
      console.log(`총 ${consoleMessages.length}개 메시지`);
      consoleMessages.forEach((message, index) => {
        console.log(`  ${index + 1}. ${message}`);
      });
      
    } catch (error) {
      console.log('❌ 테스트 실행 중 오류:', error);
      throw error;
    }
  });
});