/**
 * P0 회원가입 테스트 (2026-07-25 순서 재배치 재작성)
 *
 * 단계 순서: 1=약관동의 → 2=본인인증(PortOne) → 3=계정정보 (STEP_FLOW.default)
 * 비인증 상태에서 실행.
 *
 * 본인인증(2단계)은 PortOne 실인증(iframe + Edge Function)이라 E2E 로 통과할 수 없다.
 * 계정(3단계) 검증은 draft 주입(seedSignupDraft — 실제 A2 복원 기능 경유)으로 진입한다.
 *
 * 구버전 스펙에서 제거된 것:
 * - "Step3: 14세 미만 생년월일 차단" — 순서 재배치와 무관하게 수동 생년월일 입력 UI 가
 *   사라졌다(PortOne 이 생년월일을 제공). 14세 미만 차단은 서버 PORTONE_AGE_RESTRICTED
 *   (verify-portone-identity EF)가 담당 — E2E 범위 밖.
 * - Firebase emulator 전제 주석 — Supabase 전환 이후 유물.
 */
import { test, expect } from '@playwright/test';
import { SignupPage, SIGNUP_STEP_INDEX } from '../../pages/auth/signup.page';
import { TEST_ACCOUNTS } from '../../fixtures/test-accounts';

test.describe('회원가입', () => {
  let signupPage: SignupPage;

  test.beforeEach(async ({ page }) => {
    signupPage = new SignupPage(page);
  });

  // ============================================================
  // Step 1: 약관 동의
  // ============================================================

  test('Step1: 전체 동의 → 다음 버튼 활성화 → Step2(본인인증) 이동', async () => {
    await signupPage.goto();
    await signupPage.acceptAllTerms();
    await signupPage.clickNext();

    await signupPage.waitForStep(2);
    const step = await signupPage.getCurrentStep();
    expect(step).toBe(2);
  });

  test('Step1: 필수 약관 미동의 → 다음 버튼 비활성화', async () => {
    await signupPage.goto();
    const isDisabled = await signupPage.nextButton.isDisabled();
    expect(isDisabled).toBeTruthy();
  });

  test('Step1: 필수만 동의 (마케팅 제외) → 다음 가능', async () => {
    await signupPage.goto();
    await signupPage.acceptRequiredTermsOnly();
    await signupPage.clickNext();

    await signupPage.waitForStep(2);
    const step = await signupPage.getCurrentStep();
    expect(step).toBe(2);
  });

  // ============================================================
  // Step 2: 본인인증 (PortOne 실인증은 불가 — 노출/게이트만 검증)
  // ============================================================

  test('Step2: PortOne 안내 카드 노출 + 인증 전 다음 버튼 비활성', async () => {
    await signupPage.goto();
    await signupPage.acceptAllTerms();
    await signupPage.clickNext();
    await signupPage.waitForStep(2);

    // 빈 상태 온보딩 카드(B9) + 인증 시작 CTA
    await expect(signupPage.identityCard).toBeVisible();
    await expect(signupPage.identityStartButton).toBeEnabled();
    // 인증 완료 전에는 다음 단계로 진행 불가
    await expect(signupPage.nextButton).toBeDisabled();
  });

  // ============================================================
  // Step 3: 계정 정보 — draft 주입으로 본인인증 건너뛰고 진입
  // ============================================================

  test('Step3: 약한 비밀번호 → 검증 에러', async () => {
    await signupPage.seedSignupDraft({ stepIndex: SIGNUP_STEP_INDEX.account });
    await signupPage.goto();
    await signupPage.waitForStep(3);

    await signupPage.fillAccountInfo('new-weak-pw@test.com', '1234', '1234');
    await signupPage.clickNext();

    const error = signupPage.page.getByText('비밀번호는 최소 8자 이상이어야 합니다');
    await expect(error).toBeVisible({ timeout: 5_000 });
  });

  test('Step3: 비밀번호 불일치 → 검증 에러', async () => {
    await signupPage.seedSignupDraft({ stepIndex: SIGNUP_STEP_INDEX.account });
    await signupPage.goto();
    await signupPage.waitForStep(3);

    await signupPage.fillAccountInfo('new-mismatch@test.com', 'TestPass1!', 'DifferentPass1!');
    await signupPage.clickNext();

    const error = signupPage.page.getByText(/일치하지 않/);
    await expect(error).toBeVisible({ timeout: 3_000 });
  });

  test('Step3: 중복 이메일 → 에러 메시지', async () => {
    await signupPage.seedSignupDraft({ stepIndex: SIGNUP_STEP_INDEX.account });
    await signupPage.goto();
    await signupPage.waitForStep(3);

    // pre-seeded QA 계정 이메일 — checkEmailExists 가 signUp 이전에 차단해야 한다
    await signupPage.fillAccountInfo(TEST_ACCOUNTS.staff.email, 'TestPass1!');
    await signupPage.clickNext();

    const error = signupPage.page.getByText('이미 사용 중인 이메일입니다');
    await expect(error).toBeVisible({ timeout: 15_000 });
  });

  // ============================================================
  // Draft 복원 — 순서 재배치 + 5분 신선도 가드 회귀 (2026-07-25 HIGH)
  // ============================================================

  test('Draft 복원: 신선한 draft 는 계정 단계로 복원 + 이메일 프리필', async () => {
    await signupPage.seedSignupDraft({
      stepIndex: SIGNUP_STEP_INDEX.account,
      email: 'draft-restore@test.com',
    });
    await signupPage.goto();

    await signupPage.waitForStep(3);
    await expect(signupPage.emailInput).toHaveValue('draft-restore@test.com');
  });

  test('Draft 복원: 5분 지난 본인인증은 폐기하고 본인인증 단계로 복원', async () => {
    // 서버(verify-and-save-portone-profile)가 verifiedAt 5분 초과를 거부하므로,
    // 만료 identity 를 계정 단계로 복원하면 제출이 영원히 실패하는 dead-end 가 된다.
    // SignupForm 은 savedAt 5분 초과 draft 의 identity 를 버리고 2단계로 복원해야 한다.
    await signupPage.seedSignupDraft({
      stepIndex: SIGNUP_STEP_INDEX.account,
      savedAtOffsetMs: 6 * 60 * 1000,
    });
    await signupPage.goto();

    await signupPage.waitForStep(2);
    // 인증이 초기화되어 "본인인증 시작" CTA 가 다시 노출된다 (완료 카드 아님)
    await expect(signupPage.identityStartButton).toBeVisible();
    const step = await signupPage.getCurrentStep();
    expect(step).toBe(2);
  });
});
