const { chromium } = require('playwright');

async function testWorkTimeModification() {
  console.log('🚀 T-HOLDEM 시간 수정 테스트 시작');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000 // 시각적 확인을 위해 느리게 실행
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  // 콘솔 로그 캡처
  page.on('console', msg => {
    console.log(`🖥️ 브라우저 콘솔: ${msg.text()}`);
  });
  
  // 네트워크 에러 캡처
  page.on('pageerror', error => {
    console.log(`❌ 페이지 에러: ${error.message}`);
  });
  
  try {
    console.log('\n1️⃣ 페이지 접속 중...');
    await page.goto('http://localhost:3000/admin/job-posting/JjIrn5kIlpAMdwghFf6d?tab=staff', {
      waitUntil: 'networkidle'
    });
    
    console.log('2️⃣ 로그인 확인 중...');
    
    // 로그인 폼이 있는지 확인
    const loginForm = await page.locator('input[type="email"]').count();
    if (loginForm > 0) {
      console.log('📝 로그인 필요 - 자동 로그인 진행');
      await page.fill('input[type="email"]', 'admin@test.com');
      await page.fill('input[type="password"]', '456456');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
    }
    
    console.log('3️⃣ 스태프 탭 로딩 대기 중...');
    await page.waitForTimeout(5000);
    
    // 김승호 스태프 찾기
    console.log('4️⃣ 김승호 스태프 검색 중...');
    const staffRows = await page.locator('[data-testid="staff-row"]').count();
    console.log(`📊 총 ${staffRows}개의 스태프 행 발견`);
    
    let targetRow = null;
    let targetIndex = -1;
    
    // 모든 스태프 행에서 김승호 찾기
    for (let i = 0; i < staffRows; i++) {
      const row = page.locator('[data-testid="staff-row"]').nth(i);
      const nameText = await row.locator('.font-semibold').first().textContent();
      console.log(`👤 스태프 ${i}: ${nameText}`);
      
      if (nameText && nameText.includes('김승호')) {
        targetRow = row;
        targetIndex = i;
        console.log(`🎯 김승호 스태프 발견! (행 ${i})`);
        break;
      }
    }
    
    if (!targetRow) {
      console.log('❌ 김승호 스태프를 찾을 수 없습니다. 첫 번째 스태프로 테스트 진행');
      targetRow = page.locator('[data-testid="staff-row"]').first();
      targetIndex = 0;
    }
    
    // 현재 시간 확인
    console.log('5️⃣ 현재 근무시간 확인 중...');
    const currentTime = await targetRow.locator('.text-sm').filter({ hasText: /\d{2}:\d{2}/ }).first().textContent();
    console.log(`⏰ 현재 표시된 시간: ${currentTime}`);
    
    // 스크린샷 1: 수정 전
    await page.screenshot({ 
      path: '/c/Users/user/Desktop/T-HOLDEM/test-before.png',
      fullPage: true 
    });
    console.log('📸 수정 전 스크린샷 저장됨');
    
    // 시간 수정 버튼 클릭
    console.log('6️⃣ 시간 수정 버튼 클릭 중...');
    const timeButton = targetRow.locator('button').filter({ hasText: '🕘' });
    
    if (await timeButton.count() === 0) {
      console.log('🔍 다른 시간 버튼 형태 찾기...');
      // 다른 형태의 시간 버튼 찾기
      const clockButtons = await targetRow.locator('button').filter({ hasText: /시간|출근|퇴근|🕐|🕑|🕒|🕓|🕔|🕕|🕖|🕗|🕘/ });
      if (await clockButtons.count() > 0) {
        await clockButtons.first().click();
      } else {
        // 시간이 표시된 텍스트 영역 클릭
        const timeText = targetRow.locator('.text-sm').filter({ hasText: /\d{2}:\d{2}/ }).first();
        if (await timeText.count() > 0) {
          await timeText.click();
        }
      }
    } else {
      await timeButton.click();
    }
    
    await page.waitForTimeout(2000);
    
    // 시간 수정 모달이나 입력 필드 찾기
    console.log('7️⃣ 시간 입력 필드 찾기 중...');
    
    // 다양한 형태의 시간 입력 필드 시도
    const timeInputs = [
      'input[type="time"]',
      'input[placeholder*="시간"]',
      'input[placeholder*="출근"]',
      'input[placeholder*="퇴근"]',
      '.time-picker input',
      '[data-testid*="time"] input'
    ];
    
    let timeInput = null;
    for (const selector of timeInputs) {
      if (await page.locator(selector).count() > 0) {
        timeInput = page.locator(selector).first();
        console.log(`✅ 시간 입력 필드 발견: ${selector}`);
        break;
      }
    }
    
    if (timeInput) {
      console.log('8️⃣ 시간 수정 중...');
      
      // 출근시간 설정
      await timeInput.fill('11:00');
      await page.waitForTimeout(1000);
      
      // 퇴근시간 입력 필드가 있다면 설정
      const endTimeInput = page.locator('input[type="time"]').nth(1);
      if (await endTimeInput.count() > 0) {
        await endTimeInput.fill('19:00');
        await page.waitForTimeout(1000);
      }
      
      // 저장 버튼 찾기 및 클릭
      const saveButtons = [
        'button:has-text("저장")',
        'button:has-text("확인")',
        'button:has-text("Save")',
        'button[type="submit"]',
        '.btn-primary'
      ];
      
      for (const selector of saveButtons) {
        if (await page.locator(selector).count() > 0) {
          console.log(`💾 저장 버튼 클릭: ${selector}`);
          await page.locator(selector).click();
          break;
        }
      }
      
      await page.waitForTimeout(3000);
      
      // UI 즉시 반영 확인
      console.log('9️⃣ UI 즉시 반영 확인 중...');
      const updatedTime = await targetRow.locator('.text-sm').filter({ hasText: /\d{2}:\d{2}/ }).first().textContent();
      console.log(`⏰ 수정 후 표시된 시간: ${updatedTime}`);
      
      // 스크린샷 2: 수정 후
      await page.screenshot({ 
        path: '/c/Users/user/Desktop/T-HOLDEM/test-after.png',
        fullPage: true 
      });
      console.log('📸 수정 후 스크린샷 저장됨');
      
      // 새로고침 테스트
      console.log('🔄 새로고침 테스트 진행 중...');
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(5000);
      
      // 새로고침 후 시간 확인
      const refreshedRow = page.locator('[data-testid="staff-row"]').nth(targetIndex);
      const refreshedTime = await refreshedRow.locator('.text-sm').filter({ hasText: /\d{2}:\d{2}/ }).first().textContent();
      console.log(`⏰ 새로고침 후 시간: ${refreshedTime}`);
      
      // 스크린샷 3: 새로고침 후
      await page.screenshot({ 
        path: '/c/Users/user/Desktop/T-HOLDEM/test-refreshed.png',
        fullPage: true 
      });
      console.log('📸 새로고침 후 스크린샷 저장됨');
      
      // 결과 분석
      console.log('\n📊 테스트 결과 분석:');
      console.log(`🕐 수정 전: ${currentTime}`);
      console.log(`🕐 수정 후: ${updatedTime}`);
      console.log(`🕐 새로고침 후: ${refreshedTime}`);
      
      if (updatedTime !== currentTime) {
        console.log('✅ UI 즉시 반영: 성공');
      } else {
        console.log('❌ UI 즉시 반영: 실패');
      }
      
      if (refreshedTime === updatedTime) {
        console.log('✅ 새로고침 후 데이터 유지: 성공');
      } else {
        console.log('❌ 새로고침 후 데이터 유지: 실패');
      }
      
    } else {
      console.log('❌ 시간 입력 필드를 찾을 수 없습니다.');
      
      // 전체 페이지 HTML 구조 확인
      console.log('🔍 페이지 구조 분석 중...');
      const pageContent = await page.content();
      
      // 스크린샷으로 현재 상태 확인
      await page.screenshot({ 
        path: '/c/Users/user/Desktop/T-HOLDEM/test-debug.png',
        fullPage: true 
      });
      console.log('📸 디버깅용 스크린샷 저장됨');
    }
    
  } catch (error) {
    console.log(`❌ 테스트 중 오류 발생: ${error.message}`);
    
    // 오류 발생 시 스크린샷
    await page.screenshot({ 
      path: '/c/Users/user/Desktop/T-HOLDEM/test-error.png',
      fullPage: true 
    });
    console.log('📸 오류 상황 스크린샷 저장됨');
  }
  
  // 브라우저를 열어둠 (수동 확인용)
  console.log('\n⏰ 브라우저를 30초간 열어두어 수동 확인 가능합니다...');
  await page.waitForTimeout(30000);
  
  await browser.close();
  console.log('🏁 테스트 완료');
}

// 테스트 실행
testWorkTimeModification().catch(console.error);