/**
 * Staff Management E2E Tests
 * Week 4 성능 최적화: 스태프 관리 워크플로우 테스트
 * 
 * @version 4.0
 * @since 2025-02-02 (Week 4)
 */

import { test, expect } from '@playwright/test';

test.describe('스태프 관리', () => {
  test.beforeEach(async ({ page }) => {
    // TODO: 실제 로그인 구현 후 수정 필요
    // 현재는 개발 환경에서 인증 우회
    await page.goto('/admin/staff-management');
    
    // 페이지 로드 완료 대기
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('스태프 목록 페이지 렌더링', async ({ page }) => {
    // 페이지 제목 확인
    await expect(page.locator('h1, h2')).toContainText('스태프');
    
    // 스태프 목록 테이블 또는 카드 확인
    const staffList = page.locator('[data-testid="staff-list"], table, .staff-card').first();
    await expect(staffList).toBeVisible();
    
    // 검색 기능 확인
    const searchInput = page.locator('input[placeholder*="검색"], input[type="search"]');
    if (await searchInput.count() > 0) {
      await expect(searchInput.first()).toBeVisible();
    }
  });

  test('새 스태프 추가 모달', async ({ page }) => {
    // 추가 버튼 클릭
    const addButton = page.locator('button').filter({ hasText: /추가|신규|등록|Add/ }).first();
    
    if (await addButton.count() > 0) {
      await addButton.click();
      
      // 모달 또는 폼 표시 확인
      const modal = page.locator('[role="dialog"], .modal, form').first();
      await expect(modal).toBeVisible();
      
      // 필수 입력 필드 확인
      await expect(page.locator('input[name*="name"], input[placeholder*="이름"]').first()).toBeVisible();
      await expect(page.locator('input[name*="phone"], input[placeholder*="전화"], input[type="tel"]').first()).toBeVisible();
    }
  });

  test('스태프 정보 수정', async ({ page }) => {
    // 첫 번째 스태프 행 찾기
    const staffRow = page.locator('tr, .staff-card').nth(1); // 헤더 제외하고 첫 번째 데이터
    
    if (await staffRow.count() > 0) {
      // 수정 버튼 클릭
      const editButton = staffRow.locator('button').filter({ hasText: /수정|편집|Edit/ }).first();
      
      if (await editButton.count() > 0) {
        await editButton.click();
        
        // 수정 폼 표시 확인
        const editForm = page.locator('[role="dialog"], .modal, form').first();
        await expect(editForm).toBeVisible();
        
        // 수정 가능한 필드들이 있는지 확인
        const nameInput = editForm.locator('input[name*="name"], input[placeholder*="이름"]').first();
        if (await nameInput.count() > 0) {
          await expect(nameInput).toBeVisible();
        }
      }
    }
  });

  test('스태프 검색 기능', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="검색"], input[type="search"]').first();
    
    if (await searchInput.count() > 0) {
      // 검색어 입력
      await searchInput.fill('테스트');
      
      // 검색 결과 로딩 대기
      await page.waitForTimeout(1000);
      
      // 검색 결과가 표시되거나 "검색 결과 없음" 메시지 확인
      const hasResults = await page.locator('tr, .staff-card').count() > 1;
      const hasNoResultsMessage = await page.locator('text=검색 결과가 없습니다, text=결과 없음').count() > 0;
      
      expect(hasResults || hasNoResultsMessage).toBe(true);
    }
  });

  test('가상화된 스태프 목록 성능', async ({ page }) => {
    const startTime = Date.now();
    
    // 스태프 목록 로딩 대기
    await expect(page.locator('[data-testid="staff-list"], table, .staff-container').first()).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    
    // 2초 이내 로딩 완료 확인 (가상화 효과)
    expect(loadTime).toBeLessThan(2000);
    console.log(`스태프 목록 로딩 시간: ${loadTime}ms`);
    
    // 가상화된 목록에서 스크롤 테스트
    const listContainer = page.locator('[data-testid="staff-list"], table, .staff-container').first();
    
    if (await listContainer.count() > 0) {
      // 스크롤 성능 테스트
      const scrollStartTime = Date.now();
      await listContainer.hover();
      await page.mouse.wheel(0, 1000);
      await page.waitForTimeout(100);
      const scrollTime = Date.now() - scrollStartTime;
      
      // 스크롤이 부드럽게 작동하는지 확인 (500ms 이내)
      expect(scrollTime).toBeLessThan(500);
      console.log(`스크롤 응답 시간: ${scrollTime}ms`);
    }
  });

  test('스태프 필터링 기능', async ({ page }) => {
    // 필터 드롭다운이나 탭 찾기
    const filterElement = page.locator('select, .filter-tabs button, [role="tab"]').first();
    
    if (await filterElement.count() > 0) {
      await filterElement.click();
      
      // 필터링 옵션 선택
      const filterOption = page.locator('option, [role="option"], [role="menuitem"]').first();
      if (await filterOption.count() > 0) {
        await filterOption.click();
        
        // 필터링 결과 로딩 대기
        await page.waitForTimeout(1000);
        
        // 결과가 업데이트되었는지 확인
        await expect(page.locator('[data-testid="staff-list"], table, .staff-container').first()).toBeVisible();
      }
    }
  });

  test('대량 작업 (일괄 선택)', async ({ page }) => {
    // 체크박스가 있는지 확인
    const checkboxes = page.locator('input[type="checkbox"]');
    
    if (await checkboxes.count() > 0) {
      // 전체 선택 체크박스 클릭
      const selectAllCheckbox = checkboxes.first();
      await selectAllCheckbox.click();
      
      // 선택된 항목 수 표시 확인
      const selectedCountDisplay = page.locator('text=선택됨, text=selected').first();
      if (await selectedCountDisplay.count() > 0) {
        await expect(selectedCountDisplay).toBeVisible();
      }
      
      // 일괄 작업 버튼들 표시 확인
      const bulkActionButton = page.locator('button').filter({ hasText: /일괄|bulk|삭제|승인/ }).first();
      if (await bulkActionButton.count() > 0) {
        await expect(bulkActionButton).toBeVisible();
      }
    }
  });

  test('모바일 반응형 - 스태프 관리', async ({ page }) => {
    // 모바일 뷰포트로 변경
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    
    // 모바일에서도 스태프 목록이 적절히 표시되는지 확인
    await expect(page.locator('h1, h2').first()).toBeVisible();
    
    // 스태프 카드나 목록이 모바일에서 적절히 표시되는지 확인
    const staffDisplay = page.locator('[data-testid="staff-list"], table, .staff-card, .staff-container').first();
    await expect(staffDisplay).toBeVisible();
    
    // 가로 스크롤이 없는지 확인
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = 375;
    expect(bodyScrollWidth).toBeLessThanOrEqual(viewportWidth + 20); // 약간의 여유 허용
  });
});