/**
 * UNIQN Mobile - 3단계 회원가입 폼 컴포넌트
 *
 * @description 플로우: 약관동의 → 계정 → 본인인증 → 가입완료
 *              프로필(닉네임 등)은 가입 후 앱 첫 진입 시 별도 화면에서 입력
 *              개인정보보호법 제15조에 따라 약관동의를 최우선 단계로 배치
 * @version 3.0.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Platform } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { StepIndicator, type StepInfo } from '@/components/auth/StepIndicator';
import { clearSignupDraft, loadSignupDraft, saveSignupDraft } from '@/services/auth';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import { SignupStepAccount } from './SignupStepAccount';
import { SignupStepIdentity } from './SignupStepIdentity';
import { SignupStepTerms } from './SignupStepTerms';
import type {
  SignUpAccountData,
  SignUpIdentityData,
  SignUpTermsData,
  SignUpFormData,
} from '@/schemas';

// ============================================================================
// Types
// ============================================================================

interface SignupFormProps {
  onSubmit: (data: SignUpFormData) => Promise<void>;
  isLoading?: boolean;
  /**
   * - `default`: 일반 회원가입 (약관 → 계정 → 본인인증)
   * - `social`: 소셜 로그인 후 프로필 완성 (약관 → 본인인증)
   * - `reverify`: 본인인증만 재진행 (identity_verified=false 회복용)
   */
  mode?: 'default' | 'social' | 'reverify';
}

/**
 * 일반 회원가입 스텝 표시(4단계: 약관 → 계정 → 본인인증 → 프로필)
 * B13: 실제 폼 플로우(STEP_FLOW)는 3단계(약관→계정→본인인증)까지만 진행하고
 * 프로필은 가입 후 별도 화면(profile-setup)에서 입력한다. 여기서는 "다음에
 * 프로필이 남아있다"는 진행률 정합을 위해 4번째 스텝을 표시만 한다(항상 upcoming).
 */
const DEFAULT_SIGNUP_STEPS: StepInfo[] = [
  { label: '약관동의', shortLabel: '약관' },
  { label: '본인인증', shortLabel: '인증' },
  { label: '계정정보', shortLabel: '계정' },
  { label: '프로필', shortLabel: '프로필' },
];

/** 소셜 모드 스텝 표시(3단계: 약관 → 본인인증 → 프로필, 계정정보 생략) */
const SOCIAL_SIGNUP_STEPS: StepInfo[] = [
  { label: '약관동의', shortLabel: '약관' },
  { label: '본인인증', shortLabel: '인증' },
  { label: '프로필', shortLabel: '프로필' },
];

/** Reverify 모드 — 본인인증 1단계만 (약관 동의 기존 유지) */
const REVERIFY_STEPS: StepInfo[] = [{ label: '본인인증', shortLabel: '인증' }];

interface FormDataState {
  terms?: SignUpTermsData; // 약관동의
  account?: SignUpAccountData; // 계정정보 (소셜 모드에서 생략)
  identity?: SignUpIdentityData; // 본인인증
}

// B13: stepKey 기반 — 모드별 flow 순서로 displayStep 도출, 1→3 점프 제거
type StepKey = 'terms' | 'account' | 'identity';

// 2026-07-25: default 순서를 본인인증 → 계정정보로 재배치.
// 이전(계정 → 본인인증)은 본인인증(SMS/카드 등 되돌릴 수 없는 비용)을 마친 뒤에야
// 이메일 중복이 최종 확정돼, 사용자가 이메일을 바꿔 재시도해야 했고 실패한 이메일이
// orphan(auth.users + public.users, profile_completed=false)으로 DB에 잔존했다.
// 계정(이메일)을 마지막 단계로 옮기면 이메일 입력 즉시 중복 검사 → 통과 시 바로 signUp
// 이라 본인인증-이메일 사이 race 창이 사라지고, 이메일 변경 시 본인인증 재진행이 불필요.
const STEP_FLOW: Record<'default' | 'social' | 'reverify', StepKey[]> = {
  default: ['terms', 'identity', 'account'],
  social: ['terms', 'identity'],
  reverify: ['identity'],
};

// ============================================================================
// Component
// ============================================================================

export function SignupForm({ onSubmit, isLoading = false, mode = 'default' }: SignupFormProps) {
  const isSocial = mode === 'social';
  const isReverify = mode === 'reverify';
  const flow = STEP_FLOW[mode];
  // B13: 항상 0-based linear index — 점프 없음. social: 0→1, default: 0→1→2
  const [stepIndex, setStepIndex] = useState(0);
  const currentStepKey = flow[stepIndex];
  const displayStep = stepIndex + 1;

  const [formData, setFormData] = useState<FormDataState>({});
  const toast = useToast();
  // A2: social 모드에서만 user 바인딩. reverify 는 단일 step 이므로 draft 불필요.
  const socialUserId = useAuthStore((state) => state.user?.uid);
  const draftHydratedRef = useRef(false);

  const steps = isReverify ? REVERIFY_STEPS : isSocial ? SOCIAL_SIGNUP_STEPS : DEFAULT_SIGNUP_STEPS;

  const goToStep = useCallback(
    (key: StepKey) => {
      const idx = flow.indexOf(key);
      if (idx === -1) return;
      setStepIndex(idx);
    },
    [flow]
  );

  // A2: 마운트 시 draft 복원. reverify 는 단일 step 이라 draft 미사용.
  useEffect(() => {
    if (isReverify) return;
    if (draftHydratedRef.current) return;
    const draft = loadSignupDraft({
      mode: isSocial ? 'social' : 'default',
      socialUserId: isSocial ? socialUserId : undefined,
    });
    draftHydratedRef.current = true;
    if (!draft) return;

    // stepIndex 는 flow 범위 내로 clamp
    let restoredIndex = Math.min(Math.max(0, draft.stepIndex), flow.length - 1);
    // 보안상 password 는 draft 에 저장되지 않는다(아래 account 복원 참고).
    // 계정 단계를 지나친 위치로 복원되면 비밀번호 없이 본인인증→가입완료로 진행되어
    // 빈 비밀번호로 signUp 이 호출되고 정체불명 실패가 난다. 비번 재입력을 위해
    // 계정 단계 이후로의 복원은 계정 단계로 되돌린다(default 모드 한정, social 은 계정 단계 없음).
    const accountStepIndex = flow.indexOf('account');
    if (
      !isSocial &&
      accountStepIndex !== -1 &&
      draft.formData.accountEmail &&
      restoredIndex > accountStepIndex
    ) {
      restoredIndex = accountStepIndex;
    }
    setStepIndex(restoredIndex);

    setFormData({
      terms: draft.formData.terms as SignUpTermsData | undefined,
      // 보안: password 는 저장되지 않으므로 email 만 복원, password 는 사용자가 재입력
      account: draft.formData.accountEmail
        ? ({ email: draft.formData.accountEmail, password: '' } as SignUpAccountData)
        : undefined,
      identity: draft.formData.identity as SignUpIdentityData | undefined,
    });

    logger.info('회원가입 draft 복원', {
      component: 'SignupForm',
      mode,
      stepIndex: restoredIndex,
      hasTerms: Boolean(draft.formData.terms),
      hasAccountEmail: Boolean(draft.formData.accountEmail),
      hasIdentity: Boolean(draft.formData.identity),
    });
  }, [flow, isReverify, isSocial, mode, socialUserId]);

  // A2: formData / stepIndex 변경 시 draft 저장. reverify·hydration 이전엔 skip.
  useEffect(() => {
    if (isReverify) return;
    if (!draftHydratedRef.current) return;
    // 빈 상태(첫 진입) 은 저장 불필요 — 사용자가 약관 동의 후부터 의미 있음
    const hasAnyData = formData.terms || formData.account || formData.identity || stepIndex > 0;
    if (!hasAnyData) return;
    saveSignupDraft({
      mode: isSocial ? 'social' : 'default',
      socialUserId: isSocial ? socialUserId : undefined,
      stepIndex,
      formData: {
        terms: formData.terms,
        accountEmail: formData.account?.email,
        identity: formData.identity,
      },
    });
  }, [formData, stepIndex, isReverify, isSocial, socialUserId]);

  // ──────────────────────────────────────────────────────────────────────────
  // 약관동의
  // ──────────────────────────────────────────────────────────────────────────

  const handleTermsNext = useCallback((data: SignUpTermsData) => {
    setFormData((prev) => ({ ...prev, terms: data }));
    setStepIndex((prev) => prev + 1);
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // 계정 정보 (소셜 모드에서는 렌더링되지 않음)
  // ──────────────────────────────────────────────────────────────────────────

  // 2026-07-25: default 모드의 최종 제출 지점. account(이메일/비번)가 마지막 단계이므로
  // SignupStepAccount 내부 checkEmailExists 통과 직후 여기서 곧바로 onSubmit(signUp)한다.
  // 이메일 중복 검사와 signUp 사이에 본인인증 같은 무거운 단계가 없어 race 창이 사라진다.
  const handleAccountNext = useCallback(
    async (data: SignUpAccountData) => {
      const updatedFormData = { ...formData, account: data };
      setFormData(updatedFormData);

      // 방어 가드: 앞 단계(약관·본인인증) 데이터 누락 시 해당 단계로 복귀
      if (!updatedFormData.terms) {
        logger.error('필수 폼 데이터 누락', { component: 'SignupForm' });
        toast.error('입력 데이터가 누락되었습니다. 처음부터 다시 시작해주세요.');
        goToStep('terms');
        return;
      }
      if (!updatedFormData.identity) {
        logger.error('본인인증 정보 누락', { component: 'SignupForm' });
        toast.error('본인인증 정보가 누락되었습니다. 다시 인증해주세요.');
        goToStep('identity');
        return;
      }

      // 전체 데이터 조합 (프로필 필드 제외 — 가입 후 별도 입력)
      const identity = updatedFormData.identity;
      const completeData: SignUpFormData = {
        email: data.email,
        password: data.password,
        // PortOne 본인인증 결과 (앞 단계에서 확보)
        name: identity.name,
        birthDate: identity.birthDate,
        gender: identity.gender,
        phoneVerified: identity.phoneVerified as true,
        verifiedPhone: identity.verifiedPhone,
        identityVerificationId: identity.identityVerificationId,
        // 약관동의
        termsAgreed: updatedFormData.terms.termsAgreed,
        privacyAgreed: updatedFormData.terms.privacyAgreed,
        thirdPartyAgreed: updatedFormData.terms.thirdPartyAgreed,
        marketingAgreed: updatedFormData.terms.marketingAgreed,
      };

      try {
        await onSubmit(completeData);
        // 성공 시 draft 정리. 실패 시 throw 되면 보존(다음 시도에 복원 가능).
        clearSignupDraft();
      } catch (error) {
        // onSubmit 의 에러는 signup.tsx 에서 이미 toast 처리. 여기선 draft 만 유지.
        logger.debug('회원가입 onSubmit 실패 — draft 유지', {
          component: 'SignupForm',
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [formData, onSubmit, toast, goToStep]
  );

  const handleAccountBack = useCallback(() => {
    setStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Step 3: 본인인증 (최종 제출)
  // ──────────────────────────────────────────────────────────────────────────

  const handleIdentityNext = useCallback(
    async (data: SignUpIdentityData) => {
      const updatedFormData = { ...formData, identity: data };
      setFormData(updatedFormData);

      // reverify: 약관/계정 검증 모두 스킵 — identity 만 onSubmit (identity 가 최종 단계)
      if (isReverify) {
        await onSubmit({
          email: '',
          password: '',
          name: data.name,
          birthDate: data.birthDate,
          gender: data.gender,
          phoneVerified: data.phoneVerified as true,
          verifiedPhone: data.verifiedPhone,
          identityVerificationId: data.identityVerificationId,
          // 서버에서 무시되지만 schema 충족용
          termsAgreed: true,
          privacyAgreed: true,
          thirdPartyAgreed: true,
          marketingAgreed: false,
        });
        // A2: reverify 는 draft 사용 안 하지만, 혹시 잔존하면 정리 (defensive)
        clearSignupDraft();
        return;
      }

      // social: identity 가 최종 단계(계정 입력 없음) → 프로필 완성 제출
      if (isSocial) {
        if (!updatedFormData.terms) {
          logger.error('필수 폼 데이터 누락', { component: 'SignupForm' });
          toast.error('입력 데이터가 누락되었습니다. 처음부터 다시 시작해주세요.');
          goToStep('terms');
          return;
        }

        const completeData: SignUpFormData = {
          // 계정 정보는 소셜 모드에서 빈 값 — signup.tsx에서 무시됨
          email: '',
          password: '',
          name: data.name,
          birthDate: data.birthDate,
          gender: data.gender,
          phoneVerified: data.phoneVerified as true,
          verifiedPhone: data.verifiedPhone,
          identityVerificationId: data.identityVerificationId,
          termsAgreed: updatedFormData.terms.termsAgreed,
          privacyAgreed: updatedFormData.terms.privacyAgreed,
          thirdPartyAgreed: updatedFormData.terms.thirdPartyAgreed,
          marketingAgreed: updatedFormData.terms.marketingAgreed,
        };

        try {
          await onSubmit(completeData);
          clearSignupDraft();
        } catch (error) {
          logger.debug('소셜 프로필 완성 onSubmit 실패 — draft 유지', {
            component: 'SignupForm',
            message: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
        return;
      }

      // default: identity 는 중간 단계 → 계정 입력(account)으로 이동.
      // 최종 제출(이메일 중복 검사 + signUp)은 마지막 account 단계의 handleAccountNext 가 담당.
      setStepIndex((prev) => prev + 1);
    },
    [formData, onSubmit, toast, isSocial, isReverify, goToStep]
  );

  // B11: 이전 버튼이 인증 결과 silent 폐기 방지 — identity 데이터는 항상 보존하고 step 만 이동.
  // 사용자가 다시 본인인증 step으로 돌아오면 인증된 정보가 그대로 표시됨.
  const handleIdentityBack = useCallback(() => {
    if (isReverify) {
      // reverify: 돌아갈 이전 step 없음. 상위 화면 헤더의 뒤로가기 사용
      return;
    }
    setStepIndex((prev) => Math.max(0, prev - 1));
  }, [isReverify]);

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (currentStepKey) {
      case 'terms':
        return (
          <SignupStepTerms
            onNext={handleTermsNext}
            initialData={formData.terms}
            isLoading={isLoading}
          />
        );
      case 'account':
        return (
          <SignupStepAccount
            onNext={handleAccountNext}
            onBack={handleAccountBack}
            initialData={formData.account}
            isLoading={isLoading}
          />
        );
      case 'identity':
        return (
          <SignupStepIdentity
            onNext={handleIdentityNext}
            onBack={handleIdentityBack}
            initialData={formData.identity}
            isLoading={isLoading}
            // QW8: 프로필 단계가 남아있으므로 여기서 "가입완료"를 선언하지 않는다 (1회화 — 최종 선언은 profile-setup)
            submitLabel={isReverify ? '본인인증 완료' : isSocial ? '프로필 등록' : '다음'}
            hideBack={isReverify}
          />
        );
      default:
        return null;
    }
  };

  return (
    <KeyboardAwareScrollView
      className="flex-1"
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      enableOnAndroid
      enableAutomaticScroll
      extraScrollHeight={Platform.OS === 'ios' ? 20 : 100}
      keyboardOpeningTime={0}
    >
      <View className="flex-1 p-4">
        {/* 스텝 인디케이터 */}
        <View className="mb-8">
          <StepIndicator currentStep={displayStep} steps={steps} />
        </View>

        {/* 현재 스텝 폼 (fade 애니메이션) */}
        <Animated.View
          key={currentStepKey}
          entering={FadeInRight.duration(200).springify()}
          className="flex-1"
        >
          {renderStep()}
        </Animated.View>
      </View>
    </KeyboardAwareScrollView>
  );
}
