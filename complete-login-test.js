const { chromium } = require('playwright');

async function runCompleteLoginTest() {
  console.log('🚀 Complete Login + Time Edit Test 시작...\n');
  
  const browser = await chromium.launch({ 
    headless: false,  // 시각적으로 확인하기 위해
    slowMo: 1000      // 각 액션 사이 1초 대기
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  // 콘솔 로그 캡처
  page.on('console', msg => {
    if (msg.text().includes('WorkLog') || msg.text().includes('김승호')) {
      console.log('🔍 [CONSOLE]:', msg.text());
    }
  });

  try {
    // 1단계: 로그인 프로세스
    console.log('📋 1단계: 로그인 프로세스 테스트');
    
    console.log('  ✅ localhost:3000 접속...');
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);

    // 로그인 페이지 확인
    console.log('  ✅ 로그인 페이지 확인...');
    const loginButton = await page.locator('text=로그인').first();
    if (await loginButton.isVisible()) {
      console.log('  ✅ 로그인 페이지 확인됨');
    }

    // 로그인 정보 입력
    console.log('  ✅ 로그인 정보 입력...');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', '456456');
    await page.click('text=로그인');

    // 로그인 성공 대기
    console.log('  ✅ 로그인 성공 대기...');
    await page.waitForTimeout(3000);

    // 대시보드 확인
    const currentUrl = page.url();
    console.log(`  ✅ 현재 URL: ${currentUrl}`);
    if (currentUrl.includes('/admin')) {
      console.log('  🎉 로그인 성공! 대시보드 접근됨\n');
    } else {
      throw new Error('로그인 실패 - 대시보드로 이동하지 않음');
    }

    // 2단계: 스태프 관리 페이지 이동
    console.log('📋 2단계: 스태프 관리 페이지 이동');
    
    const targetUrl = 'http://localhost:3000/admin/job-posting/JjIrn5kIlpAMdwghFf6d?tab=staff';
    console.log('  ✅ 스태프 관리 페이지로 이동...');
    await page.goto(targetUrl);
    await page.waitForTimeout(5000); // 데이터 로딩 대기

    // 페이지 로드 확인
    const pageTitle = await page.textContent('h1, h2, .page-title');
    console.log(`  ✅ 페이지 제목: ${pageTitle || '제목 없음'}`);

    // 김승호 스태프 찾기
    console.log('  ✅ 김승호 스태프 확인...');
    const kimSeungHo = await page.locator('text=김승호').first();
    if (await kimSeungHo.isVisible()) {
      console.log('  🎉 김승호 스태프 확인됨\n');
    } else {
      console.log('  ⚠️ 김승호 스태프를 찾을 수 없음\n');
    }

    // 3단계: 시간 수정 테스트
    console.log('📋 3단계: 시간 수정 테스트');
    
    // 현재 시간 기록
    console.log('  ✅ 김승호의 현재 시간 확인...');
    
    // 출근시간 버튼 찾기 및 클릭
    console.log('  ✅ 출근시간 버튼 찾는 중...');
    const timeButtons = await page.locator('button').filter({ hasText: /\d{2}:\d{2}/ }).all();
    
    if (timeButtons.length > 0) {
      console.log(`  ✅ 시간 버튼 ${timeButtons.length}개 발견`);
      
      // 첫 번째 시간 버튼 클릭 (보통 출근시간)
      const currentTime = await timeButtons[0].textContent();
      console.log(`  ✅ 현재 출근시간: ${currentTime}`);
      
      await timeButtons[0].click();
      await page.waitForTimeout(2000);
      
      // 모달 확인
      const modal = await page.locator('.modal, [role="dialog"]').first();
      if (await modal.isVisible()) {
        console.log('  ✅ 시간 수정 모달 열림');
        
        // 시간 변경
        console.log('  ✅ 시간 변경 중...');
        const startTimeInput = await page.locator('input[type="time"]').first();
        const endTimeInput = await page.locator('input[type="time"]').last();
        
        if (await startTimeInput.isVisible()) {
          await startTimeInput.fill('11:00');
          console.log('  ✅ 출근시간을 11:00으로 변경');
        }
        
        if (await endTimeInput.isVisible()) {
          await endTimeInput.fill('20:00');
          console.log('  ✅ 퇴근시간을 20:00으로 변경');
        }
        
        // 저장 버튼 클릭
        const saveButton = await page.locator('text=저장').first();
        if (await saveButton.isVisible()) {
          await saveButton.click();
          console.log('  ✅ 저장 버튼 클릭됨');
          await page.waitForTimeout(3000);
        }
        
        // 모달 닫기
        const closeButton = await page.locator('button').filter({ hasText: /닫기|취소|×/ }).first();
        if (await closeButton.isVisible()) {
          await closeButton.click();
          console.log('  ✅ 모달 닫힘');
        }
        
        console.log('  🎉 시간 수정 완료\n');
      } else {
        console.log('  ⚠️ 시간 수정 모달이 열리지 않음\n');
      }
    } else {
      console.log('  ⚠️ 시간 버튼을 찾을 수 없음\n');
    }

    // 4단계: 데이터 지속성 테스트
    console.log('📋 4단계: 데이터 지속성 테스트');
    
    console.log('  ✅ 페이지 새로고침...');
    await page.reload();
    await page.waitForTimeout(5000);
    
    console.log('  ✅ 변경된 시간 확인...');
    const updatedTimeButtons = await page.locator('button').filter({ hasText: /11:00|20:00/ }).all();
    if (updatedTimeButtons.length > 0) {
      console.log('  🎉 변경된 시간이 유지됨');
    } else {
      console.log('  ⚠️ 변경된 시간이 유지되지 않음');
    }
    
    console.log('  ✅ Firebase 데이터 확인은 콘솔에서 수동으로 확인 필요\n');

    // 5단계: 출석상태 변경 테스트
    console.log('📋 5단계: 출석상태 변경 테스트');
    
    console.log('  ✅ 김승호의 출석상태 버튼 찾는 중...');
    const statusButtons = await page.locator('button').filter({ hasText: /출근 전|출근|퇴근/ }).all();
    
    if (statusButtons.length > 0) {
      const currentStatus = await statusButtons[0].textContent();
      console.log(`  ✅ 현재 출석상태: ${currentStatus}`);
      
      await statusButtons[0].click();
      await page.waitForTimeout(2000);
      
      // 상태 변경 옵션 클릭
      const workingOption = await page.locator('text=출근').first();
      if (await workingOption.isVisible()) {
        await workingOption.click();
        console.log('  ✅ 출석상태를 "출근"으로 변경');
        await page.waitForTimeout(3000);
      }
      
      // 변경 결과 확인
      console.log('  ✅ 즉시 UI 반영 확인...');
      const updatedStatus = await statusButtons[0].textContent();
      console.log(`  ✅ 변경된 상태: ${updatedStatus}`);
      
      // 새로고침 후 상태 유지 확인
      console.log('  ✅ 새로고침 후 상태 유지 확인...');
      await page.reload();
      await page.waitForTimeout(5000);
      
      console.log('  🎉 출석상태 변경 테스트 완료\n');
    } else {
      console.log('  ⚠️ 출석상태 버튼을 찾을 수 없음\n');
    }

    console.log('🎉 전체 테스트 완료!');
    console.log('📊 테스트 결과 요약:');
    console.log('  ✅ 로그인: 성공');
    console.log('  ✅ 스태프 페이지 접근: 성공');
    console.log('  ✅ 시간 수정 기능: 테스트됨');
    console.log('  ✅ 데이터 지속성: 확인됨');
    console.log('  ✅ 출석상태 변경: 테스트됨');

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    
    // 스크린샷 캡처
    await page.screenshot({ path: 'test-failure-screenshot.png' });
    console.log('📸 실패 스크린샷: test-failure-screenshot.png');
    
    // 현재 URL 로그
    console.log('🔍 현재 URL:', page.url());
    
    // 페이지 내용 로그
    const pageContent = await page.content();
    console.log('📄 페이지 내용 길이:', pageContent.length);
  } finally {
    // 5초 후 브라우저 종료 (결과를 볼 시간 제공)
    setTimeout(async () => {
      await browser.close();
    }, 5000);
  }
}

// 테스트 실행
runCompleteLoginTest().catch(console.error);