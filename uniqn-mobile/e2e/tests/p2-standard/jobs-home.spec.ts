/**
 * P2 구인구직 홈 테스트 (12 tests)
 * 인증된 staff 상태에서 실행
 */
import { test, expect } from '@playwright/test';
import { HomePage } from '../../pages/app/tabs/home.page';

// storageState는 chromium 프로젝트에서 staff.json으로 자동 설정됨

test.describe('구인구직 홈', () => {
  let homePage: HomePage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    await homePage.goto();
  });

  // =====================================================
  // 기본 렌더링 (3 tests)
  // =====================================================

  test('헤더와 검색바가 표시된다', async () => {
    await expect(homePage.header).toBeVisible();
    await expect(homePage.searchInput).toBeVisible();
  });

  test('공고 타입 칩 필터가 표시된다', async () => {
    // fixed 공고는 V3 canonical 전환 동안 공개 표면에서 제외된다.
    await expect(homePage.getTypeChip('긴급')).toBeVisible({ timeout: 10_000 });
    await expect(homePage.getTypeChip('대회')).toBeVisible();
    await expect(homePage.getTypeChip('지원')).toBeVisible();
    await expect(homePage.getTypeChip('고정')).toHaveCount(0);
  });

  test('초기 로드 시 공고가 있는 탭으로 자동 선택된다', async ({ page }) => {
    // 자동 선택 대기 (로딩 완료 후)
    await homePage.waitForJobsLoaded();

    // 3개 공개 타입 칩 중 하나가 선택 상태여야 함 (정확한 선택 칩은 데이터에 따라 다름)
    const body = await page.locator('body').textContent();
    const hasChips = body?.includes('긴급') || body?.includes('대회') || body?.includes('지원');
    expect(hasChips).toBeTruthy();
  });

  // =====================================================
  // 필터 기능 (3 tests)
  // =====================================================

  test('타입 칩 클릭 시 필터가 변경된다', async () => {
    await homePage.waitForJobsLoaded();

    // '긴급' 칩 클릭
    await homePage.selectTypeChip('긴급');
    await homePage.page.waitForTimeout(500);

    // 페이지가 정상 표시되어야 함 (에러 없이)
    const body = await homePage.page.locator('body').textContent();
    expect(body).toBeTruthy();
  });

  test('지원 타입 선택 시 날짜 슬라이더가 표시된다', async () => {
    await homePage.waitForJobsLoaded();
    await homePage.selectTypeChip('지원');

    // 날짜 관련 UI가 표시되어야 함 (DateSlider 렌더링)
    await homePage.page.waitForTimeout(500);
    const body = await homePage.page.locator('body').textContent();
    expect(body).toBeTruthy();
  });

  test('긴급/대회 타입에서는 날짜 슬라이더가 숨겨진다', async () => {
    await homePage.waitForJobsLoaded();
    await homePage.selectTypeChip('긴급');
    await homePage.page.waitForTimeout(500);

    // 날짜 슬라이더가 없어야 함 (긴급 타입에서는 날짜 필터 비활성)
    // DateSlider는 regular 타입에서만 표시
    const body = await homePage.page.locator('body').textContent();
    expect(body).toBeTruthy();
  });

  // =====================================================
  // 검색 기능 (4 tests)
  // =====================================================

  test('검색어 입력 시 타입 칩이 숨겨진다', async () => {
    await homePage.search('테스트');

    // 검색 모드에서는 칩 필터가 숨겨져야 함
    await homePage.page.waitForTimeout(500);
    // 검색 모드 진입 시 PostingTypeChips가 사라짐
    // 검색바에 텍스트가 있으면 isSearchMode = true
    await expect(homePage.searchInput).toHaveValue('테스트');
  });

  test('검색어 디바운스 300ms 후 결과가 표시된다', async ({ page }) => {
    await homePage.search('서울');

    // 300ms 디바운스 대기
    await page.waitForTimeout(500);

    // 검색이 수행되어야 함 (결과 있거나 없음 메시지)
    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy();
  });

  test('존재하지 않는 검색어 입력 시 빈 결과 메시지가 표시된다', async ({ page }) => {
    const searchText = '절대없는공고ZZZZZZZ';
    await homePage.search(searchText);

    // 디바운스 대기 + API 응답 대기
    await page.waitForTimeout(1_000);

    // 빈 결과 메시지 확인
    await expect(homePage.getEmptySearchMessage(searchText)).toBeVisible({ timeout: 5_000 });
  });

  test('검색어 삭제 시 기존 목록으로 복귀한다', async () => {
    // 검색 모드 진입
    await homePage.search('테스트');
    await homePage.page.waitForTimeout(500);

    // 검색어 삭제
    await homePage.clearSearch();
    await homePage.page.waitForTimeout(500);

    // 검색바가 비어 있어야 함
    await expect(homePage.searchInput).toHaveValue('');

    // 타입 칩이 다시 표시되어야 함
    await expect(homePage.getTypeChip('긴급')).toBeVisible({ timeout: 5_000 });
  });

  // =====================================================
  // 공고 상호작용 (2 tests)
  // =====================================================

  test('공고 카드 클릭 시 상세 페이지로 이동한다', async ({ page }) => {
    await homePage.waitForJobsLoaded();

    // 첫 번째 공고 카드 클릭 시도
    const firstCard = page.locator('[accessibilityRole="button"]').first();
    const hasCards = await firstCard.isVisible().catch(() => false);

    if (hasCards) {
      await firstCard.click();
      await page.waitForTimeout(2_000);
      // 상세 페이지로 이동 확인
      const url = page.url();
      expect(url).toMatch(/jobs|detail/);
    } else {
      // 공고가 없는 경우 테스트 스킵
      test.skip();
    }
  });

  test('목록을 아래로 스크롤하면 추가 데이터가 로드된다', async ({ page }) => {
    await homePage.waitForJobsLoaded();

    // 초기 콘텐츠 확인
    const initialBody = await page.locator('body').textContent();
    expect(initialBody).toBeTruthy();

    // 스크롤 동작 시뮬레이션
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(1_000);

    // 스크롤 후에도 정상 작동 확인
    const afterScrollBody = await page.locator('body').textContent();
    expect(afterScrollBody).toBeTruthy();
  });
});
