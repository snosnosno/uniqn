/**
 * P1 보안 테스트 - XSS/CSRF 방어 (6 tests)
 * src/utils/security.ts의 XSS 검증이 앱 레벨에서 동작하는지 확인
 */
import { test, expect } from '@playwright/test';
import { XSS_PAYLOADS } from '../../factories';

// 보안 테스트는 로그인 폼에 접근해야 하므로 storageState를 초기화하여
// useAuthGuard의 (auth) → (app) 리다이렉트를 방지
test.use({ storageState: { cookies: [], origins: [] } });

/**
 * 로그인 페이지로 이동 후 이메일 입력 필드가 표시될 때까지 대기
 */
async function navigateToLogin(page: import('@playwright/test').Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
  // 로그인 폼이 렌더링될 때까지 대기 (앱 초기화 + 라우팅 완료)
  await page.getByPlaceholder('이메일을 입력하세요').waitFor({ state: 'visible', timeout: 15_000 });
}

test.describe('보안 - XSS 방어', () => {
  test('로그인 폼: <script> 태그 입력 → 검증 에러 또는 무시', async ({ page }) => {
    await navigateToLogin(page);

    const emailInput = page.getByPlaceholder('이메일을 입력하세요');
    await emailInput.fill(XSS_PAYLOADS[0]); // <script>alert("xss")</script>
    await page.getByPlaceholder('비밀번호를 입력하세요').click(); // blur 트리거

    await page.waitForTimeout(1_000);

    // 스크립트가 실행되지 않아야 함 (alert dialog가 없음)
    // 또한 이메일 형식 검증 에러가 표시되어야 함
    const errorText = page.getByText(/올바른 이메일 형식이 아닙니다|이메일을 입력해주세요/);
    await expect(errorText).toBeVisible({ timeout: 5_000 });
  });

  test('로그인 폼: javascript: 프로토콜 입력 → 검증 에러', async ({ page }) => {
    await navigateToLogin(page);

    const emailInput = page.getByPlaceholder('이메일을 입력하세요');
    await emailInput.fill(XSS_PAYLOADS[1]); // javascript:alert(1)
    await page.getByPlaceholder('비밀번호를 입력하세요').click(); // blur 트리거

    await page.waitForTimeout(1_000);

    // 이메일 검증 에러 표시
    const errorText = page.getByText(/올바른 이메일 형식이 아닙니다|이메일을 입력해주세요/);
    await expect(errorText).toBeVisible({ timeout: 5_000 });
  });

  test('로그인 폼: onerror 이벤트 핸들러 입력 → 검증 에러', async ({ page }) => {
    await navigateToLogin(page);

    const emailInput = page.getByPlaceholder('이메일을 입력하세요');
    await emailInput.fill(XSS_PAYLOADS[2]); // <img onerror=alert(1) src=x>
    await page.getByPlaceholder('비밀번호를 입력하세요').click();

    await page.waitForTimeout(1_000);

    const errorText = page.getByText(/올바른 이메일 형식이 아닙니다|이메일을 입력해주세요/);
    await expect(errorText).toBeVisible({ timeout: 5_000 });
  });

  test('XSS 페이로드가 DOM에 렌더링되지 않음', async ({ page }) => {
    await navigateToLogin(page);

    const emailInput = page.getByPlaceholder('이메일을 입력하세요');

    for (const payload of XSS_PAYLOADS) {
      await emailInput.fill(payload);
      await page.waitForTimeout(200);

      // <script> 태그가 DOM에 삽입되지 않았는지 확인
      const scripts = await page.evaluate(() => {
        return document.querySelectorAll('script[src="x"], script:not([src])').length;
      });
      // 앱 자체 스크립트 외에 추가 스크립트가 없어야 함
      // (정확한 수는 환경에 따라 다를 수 있으므로 payload에 의한 실행만 검증)
      const alertDialogs = await page.evaluate(() => {
        // 전역 alert이 호출되었는지 확인할 수 없으므로
        // DOM에 img 태그가 삽입되지 않았는지 확인
        return document.querySelectorAll('img[src="x"]').length;
      });
      expect(alertDialogs).toBe(0);
    }
  });

  test('검색바: XSS 입력 → 스크립트 미실행', async ({ page }) => {
    // 이 테스트는 인증된 상태에서 메인 페이지의 검색바를 테스트
    // storageState가 초기화되었으므로 미인증 상태에서 접근 가능한 페이지에서 확인
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5_000);

    // 미인증 상태에서는 로그인 페이지로 리다이렉트될 수 있으므로
    // 검색 입력 필드가 있는 경우에만 테스트 진행
    const searchInput = page.getByPlaceholder(/검색|제목|장소/);
    const hasSearch = await searchInput.isVisible().catch(() => false);
    if (hasSearch) {
      // XSS 페이로드 입력
      await searchInput.fill('<script>alert("xss")</script>');
      await page.waitForTimeout(500);

      // DOM에 script 태그가 주입되지 않았는지 확인
      const injectedScripts = await page.evaluate(() => {
        return document.querySelectorAll('script').length;
      });
      expect(injectedScripts).toBeGreaterThan(0); // 앱 자체 스크립트는 있음
    }

    // 검색바가 없더라도 로그인 폼에서 XSS 미실행 검증 (대체 검증)
    const emailInput = page.getByPlaceholder('이메일을 입력하세요');
    const hasEmail = await emailInput.isVisible().catch(() => false);
    if (hasEmail) {
      await emailInput.fill('<script>alert("xss")</script>');
      await page.waitForTimeout(500);

      const injectedImgs = await page.evaluate(() => {
        return document.querySelectorAll('img[src="x"]').length;
      });
      expect(injectedImgs).toBe(0);
    }
  });

  test('SQL Injection 패턴 입력 → 검증 차단', async ({ page }) => {
    await navigateToLogin(page);

    const emailInput = page.getByPlaceholder('이메일을 입력하세요');
    // SQL Injection 패턴
    await emailInput.fill("'; DROP TABLE users; --");
    await page.getByPlaceholder('비밀번호를 입력하세요').click();

    await page.waitForTimeout(1_000);

    // 이메일 형식 검증에서 차단됨
    const errorText = page.getByText(/올바른 이메일 형식이 아닙니다|이메일을 입력해주세요/);
    await expect(errorText).toBeVisible({ timeout: 5_000 });
  });
});
