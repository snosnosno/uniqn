import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../base.page';

/**
 * 회원가입 페이지 객체 (2026-07-25 순서 재배치 반영)
 *
 * 단계 순서: 1=약관동의 → 2=본인인증 → 3=계정정보 (STEP_FLOW.default)
 * StepIndicator 는 현재 단계의 전체 라벨('약관동의'/'본인인증'/'계정정보')만 제목으로
 * 렌더하고, 나머지 단계는 축약 라벨('약관'/'인증'/'계정')만 보인다 — 전체 라벨 텍스트가
 * 곧 현재 단계 판별자다.
 *
 * 본인인증(2단계)은 PortOne 실인증(iframe + Edge Function)이라 E2E 로 통과 불가.
 * 계정(3단계) 검증은 draft 주입(seedSignupDraft)으로 본인인증을 건너뛰고 진입한다 —
 * draft 복원은 실제 앱 기능(A2)이므로 프로덕션 코드 수정 없이 성립하는 경로다.
 */

/** SignupForm 의 STEP_FLOW.default 인덱스 (0-based) */
export const SIGNUP_STEP_INDEX = {
  terms: 0,
  identity: 1,
  account: 2,
} as const;

/** src/lib/mmkvStorage.ts STORAGE_KEYS.SIGNUP_DRAFT — 웹은 prefix 없는 localStorage */
const SIGNUP_DRAFT_STORAGE_KEY = 'signup-draft-v1';

interface SeedDraftOptions {
  /** 복원 목표 단계 (0=약관, 1=본인인증, 2=계정) */
  stepIndex: number;
  /** 계정 단계 이메일 프리필 (accountEmail) */
  email?: string;
  /** 본인인증 완료 데이터 포함 여부 (기본 true) */
  withIdentity?: boolean;
  /**
   * savedAt 을 과거로 밀어넣는 오프셋(ms). 5분(서버 신선도 가드) 초과 시
   * SignupForm 이 identity 를 폐기하고 본인인증 단계로 복원해야 한다.
   */
  savedAtOffsetMs?: number;
}

export class SignupPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/signup', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /**
   * 회원가입 draft 를 localStorage 에 주입한다. 반드시 goto() 이전에 호출.
   *
   * payload 형식: src/services/auth/signupDraftService.ts SignupDraftPayload (version 1).
   * identity 는 zod 재검증 없이 복원되므로 형태만 SignUpIdentityData 와 일치하면 된다.
   */
  async seedSignupDraft(options: SeedDraftOptions): Promise<void> {
    const { stepIndex, email, withIdentity = true, savedAtOffsetMs = 0 } = options;
    const payload = {
      version: 1,
      mode: 'default',
      stepIndex,
      formData: {
        terms: {
          termsAgreed: true,
          privacyAgreed: true,
          thirdPartyAgreed: true,
          marketingAgreed: false,
        },
        ...(email ? { accountEmail: email } : {}),
        ...(withIdentity
          ? {
              identity: {
                name: 'E2E테스트',
                birthDate: '19900101',
                phoneVerified: true,
                verifiedPhone: '01012345678',
                identityVerificationId: 'e2e-mock-identity-verification',
              },
            }
          : {}),
      },
      savedAt: Date.now() - savedAtOffsetMs,
    };

    await this.page.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key, value);
      },
      [SIGNUP_DRAFT_STORAGE_KEY, JSON.stringify(payload)] as const
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Step 1: 약관 동의
  // ──────────────────────────────────────────────────────────────────────────

  get selectAllCheckbox(): Locator {
    return this.page.getByRole('checkbox', { name: /전체 동의하기/ }).first();
  }

  get termsCheckbox(): Locator {
    return this.page.getByRole('checkbox', { name: /이용약관 동의/ }).first();
  }

  get privacyCheckbox(): Locator {
    return this.page.getByRole('checkbox', { name: /개인정보처리방침 동의/ }).first();
  }

  get thirdPartyCheckbox(): Locator {
    return this.page.getByRole('checkbox', { name: /개인정보 제3자 제공 동의/ }).first();
  }

  get marketingCheckbox(): Locator {
    return this.page.getByRole('checkbox', { name: /마케팅 정보 수신 동의/ }).first();
  }

  get nextButton(): Locator {
    return this.page.getByRole('button', { name: /다음|가입완료/ }).first();
  }

  get backButton(): Locator {
    return this.page.getByRole('button', { name: /이전/ }).first();
  }

  async acceptAllTerms(): Promise<void> {
    await this.selectAllCheckbox.click();
  }

  async acceptRequiredTermsOnly(): Promise<void> {
    await this.termsCheckbox.click();
    await this.privacyCheckbox.click();
    await this.thirdPartyCheckbox.click();
  }

  async clickNext(): Promise<void> {
    await this.nextButton.click();
  }

  async clickBack(): Promise<void> {
    await this.backButton.click();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Step 2: 본인인증 (PortOne — 실인증 불가, 노출/게이트만 검증)
  // ──────────────────────────────────────────────────────────────────────────

  /** PortOne 안내 카드 헤더 */
  get identityCard(): Locator {
    return this.page.getByText('이니시스 본인인증').first();
  }

  get identityStartButton(): Locator {
    return this.page.getByRole('button', { name: /본인인증 시작/ }).first();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Step 3: 계정 정보
  // ──────────────────────────────────────────────────────────────────────────

  get emailInput(): Locator {
    return this.page.locator('input[placeholder="이메일을 입력하세요"]:visible').first();
  }

  get passwordInput(): Locator {
    return this.page.locator('input[placeholder="비밀번호를 입력하세요"]:visible').first();
  }

  get passwordConfirmInput(): Locator {
    return this.page.locator('input[placeholder="비밀번호를 다시 입력하세요"]:visible').first();
  }

  async fillAccountInfo(email: string, password: string, confirmPassword?: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.passwordConfirmInput.fill(confirmPassword ?? password);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 단계 판별
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * 현재 단계 (1=약관동의, 2=본인인증, 3=계정정보).
   * 전체 라벨은 현재 단계 제목에만 렌더되므로 가시성으로 판별한다.
   * '본인인증' 은 2단계 본문(PortOne 카드)에도 부분 일치하지만 같은 단계라 무해.
   */
  async getCurrentStep(): Promise<number> {
    const accountVisible = await this.page
      .getByText('계정정보')
      .first()
      .isVisible()
      .catch(() => false);
    if (accountVisible) {
      return 3;
    }
    const identityVisible = await this.page
      .getByText('본인인증')
      .first()
      .isVisible()
      .catch(() => false);
    if (identityVisible) {
      return 2;
    }
    return 1;
  }

  async waitForStep(step: number, timeout = 5_000): Promise<void> {
    const stepTexts: Record<number, string> = {
      1: '약관동의',
      2: '본인인증',
      3: '계정정보',
    };
    const text = stepTexts[step];
    if (text) {
      await this.page.getByText(text).first().waitFor({ state: 'visible', timeout });
    }
  }

  async getValidationError(): Promise<string | null> {
    const error = this.page.locator('[role="alert"]').first();
    try {
      await error.waitFor({ state: 'visible', timeout: 3_000 });
      return error.textContent();
    } catch {
      return null;
    }
  }
}
