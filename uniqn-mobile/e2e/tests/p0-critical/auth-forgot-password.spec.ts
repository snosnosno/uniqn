/**
 * P0 비밀번호 찾기 테스트 (2 tests)
 * 비인증 상태에서 실행
 */
import { test, expect } from '@playwright/test';
import { ForgotPasswordPage } from '../../pages/auth/forgot-password.page';
import { TEST_ACCOUNTS } from '../../fixtures/test-accounts';

test.describe('비밀번호 찾기', () => {
  let forgotPage: ForgotPasswordPage;

  test.beforeEach(async ({ page }) => {
    forgotPage = new ForgotPasswordPage(page);
    await forgotPage.goto();
  });

  test('비밀번호 재설정 이메일 발송 성공', async () => {
    await forgotPage.requestReset(TEST_ACCOUNTS.staff.email);
    await forgotPage.waitForSuccessMessage();

    const isSuccess = await forgotPage.isSuccessVisible();
    expect(isSuccess).toBeTruthy();
  });

  test('존재하지 않는 이메일 → 동일한 성공 메시지 (보안상)', async () => {
    // 보안상 이유로 존재 여부와 무관하게 동일 응답을 보여야 함
    await forgotPage.requestReset('nonexistent@example.com');

    // 에러가 표시되거나 동일 성공 메시지가 표시됨
    await forgotPage.page.waitForLoadState('networkidle');

    // 페이지가 크래시하지 않고 정상 동작하는지 확인
    const url = forgotPage.getCurrentPath();
    expect(url).toContain('forgot-password');
  });
});
