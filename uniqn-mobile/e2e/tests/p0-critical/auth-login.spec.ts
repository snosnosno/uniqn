/**
 * P0 로그인 테스트 (6 tests)
 * 비인증 상태에서 실행 (storageState 없음)
 */
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/auth/login.page';
import { TEST_ACCOUNTS } from '../../fixtures/test-accounts';
import { createInvalidLoginData } from '../../factories';

test.describe('로그인', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('이메일/비밀번호 로그인 성공 → 메인 탭 이동', async () => {
    const { email, password } = TEST_ACCOUNTS.staff;
    await loginPage.login(email, password);
    await loginPage.waitForLoginSuccess();

    expect(loginPage.getCurrentPath()).toBe('/');
  });

  test('잘못된 이메일 형식 → 검증 에러 표시', async () => {
    const { invalidEmail } = createInvalidLoginData();
    await loginPage.emailInput.fill(invalidEmail);
    await loginPage.passwordInput.click(); // blur 트리거

    // 이메일 형식 에러 메시지가 표시되어야 함
    const errorText = loginPage.page.getByText(/유효한 이메일|올바른 이메일/);
    await expect(errorText).toBeVisible({ timeout: 3_000 });
  });

  test('잘못된 비밀번호 → 로그인 실패 에러 표시', async () => {
    const { email } = TEST_ACCOUNTS.staff;
    const { wrongPassword } = createInvalidLoginData();

    await loginPage.login(email, wrongPassword);
    await loginPage.waitForLoginError();

    const error = await loginPage.getErrorMessage();
    expect(error).toBeTruthy();
  });

  test('비밀번호 표시/숨기기 토글', async ({ page }) => {
    await loginPage.passwordInput.fill('TestPass1!');

    // 기본: password 타입
    await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');

    // 토글 클릭 → text 타입으로 변경 대기
    await loginPage.togglePasswordVisibility();
    await expect(loginPage.passwordInput).not.toHaveAttribute('type', 'password', { timeout: 3_000 });

    // 토글 후에는 text 타입이어야 함
    await expect(loginPage.passwordInput).toHaveAttribute('type', 'text');
  });

  test('로그인 후 세션 유지 (새 탭에서 접근)', async ({ context }) => {
    const { email, password } = TEST_ACCOUNTS.staff;
    await loginPage.login(email, password);
    await loginPage.waitForLoginSuccess();

    // 새 페이지에서 메인 접근
    const newPage = await context.newPage();
    await newPage.goto('/', { waitUntil: 'domcontentloaded' });
    await newPage.waitForLoadState('networkidle');

    // 로그인 상태 유지되어야 함 (로그인 페이지가 아닌 메인 표시)
    const url = newPage.url();
    expect(url).not.toContain('/login');
    await newPage.close();
  });

  test('빈 폼 제출 방지', async () => {
    // 아무 입력 없이 로그인 버튼 클릭
    await loginPage.loginButton.click();

    // URL이 변하지 않아야 함 (로그인 페이지 유지)
    expect(loginPage.getCurrentPath()).toMatch(/login|auth/);
  });
});
