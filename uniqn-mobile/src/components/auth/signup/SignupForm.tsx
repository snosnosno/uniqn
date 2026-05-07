/**
 * UNIQN Mobile - 3단계 회원가입 폼 컴포넌트
 *
 * @description 플로우: 약관동의 → 계정 → 본인인증 → 가입완료
 *              프로필(닉네임 등)은 가입 후 앱 첫 진입 시 별도 화면에서 입력
 *              개인정보보호법 제15조에 따라 약관동의를 최우선 단계로 배치
 * @version 3.0.0
 */

import React, { useState, useCallback } from 'react';
import { View, Platform } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { StepIndicator, type StepInfo } from '@/components/auth/StepIndicator';
import { checkEmailExists } from '@/services/auth';
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
  /** 모드: default(일반 회원가입), social(소셜 로그인 후 프로필 완성) */
  mode?: 'default' | 'social';
}

/** 일반 회원가입 스텝 (3단계: 약관 → 계정 → 본인인증) */
const DEFAULT_SIGNUP_STEPS: StepInfo[] = [
  { label: '약관동의', shortLabel: '약관' },
  { label: '계정정보', shortLabel: '계정' },
  { label: '본인인증', shortLabel: '인증' },
];

/** 소셜 모드 스텝 (계정정보 생략: 약관 → 본인인증) */
const SOCIAL_SIGNUP_STEPS: StepInfo[] = [
  { label: '약관동의', shortLabel: '약관' },
  { label: '본인인증', shortLabel: '인증' },
];

interface FormDataState {
  terms?: SignUpTermsData; // Step 1: 약관동의
  account?: SignUpAccountData; // Step 2: 계정정보 (소셜 모드에서 생략)
  identity?: SignUpIdentityData; // Step 3: 본인인증
}

// ============================================================================
// Component
// ============================================================================

export function SignupForm({ onSubmit, isLoading = false, mode = 'default' }: SignupFormProps) {
  const isSocial = mode === 'social';
  // 양쪽 모두 Step 1(약관동의)부터 시작
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormDataState>({});
  const toast = useToast();

  // 소셜 모드: Step 2(계정) 건너뛰므로 displayStep 조정 (1→1, 3→2)
  const steps = isSocial ? SOCIAL_SIGNUP_STEPS : DEFAULT_SIGNUP_STEPS;
  const displayStep = isSocial && currentStep >= 3 ? currentStep - 1 : currentStep;

  // ──────────────────────────────────────────────────────────────────────────
  // Step 1: 약관동의
  // ──────────────────────────────────────────────────────────────────────────

  const handleTermsNext = useCallback(
    (data: SignUpTermsData) => {
      setFormData((prev) => ({ ...prev, terms: data }));
      // 소셜 모드: 계정정보 건너뛰고 본인인증(Step 3)으로
      setCurrentStep(isSocial ? 3 : 2);
    },
    [isSocial]
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Step 2: 계정 정보 (소셜 모드에서는 렌더링되지 않음)
  // ──────────────────────────────────────────────────────────────────────────

  const handleAccountNext = useCallback((data: SignUpAccountData) => {
    setFormData((prev) => ({ ...prev, account: data }));
    setCurrentStep(3);
  }, []);

  const handleAccountBack = useCallback(() => {
    setCurrentStep(1);
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Step 3: 본인인증 (최종 제출)
  // ──────────────────────────────────────────────────────────────────────────

  const handleIdentityNext = useCallback(
    async (data: SignUpIdentityData) => {
      const updatedFormData = { ...formData, identity: data };
      setFormData(updatedFormData);

      // 소셜 모드에서는 이메일 중복 체크 불필요 (계정정보 없음)
      if (!isSocial) {
        // 이메일 Race Condition 방지: 제출 직전 이메일 중복 재검증
        try {
          const emailExists = await checkEmailExists(updatedFormData.account!.email);
          if (emailExists) {
            toast.error('이미 사용 중인 이메일입니다. 다른 이메일을 입력해주세요.');
            setCurrentStep(2); // 계정정보(Step 2)로 이동
            return;
          }
        } catch {
          logger.warn('최종 제출 전 이메일 재검증 실패');
          toast.error('이메일 확인 중 오류가 발생했습니다. 다시 시도해주세요.');
          return;
        }
      }

      // 필수 폼 데이터 방어적 체크
      if (!updatedFormData.terms) {
        logger.error('필수 폼 데이터 누락', { component: 'SignupForm' });
        toast.error('입력 데이터가 누락되었습니다. 처음부터 다시 시작해주세요.');
        setCurrentStep(1);
        return;
      }

      if (!isSocial && !updatedFormData.account) {
        logger.error('계정 정보 누락', { component: 'SignupForm' });
        toast.error('계정 정보가 누락되었습니다. 다시 입력해주세요.');
        setCurrentStep(2);
        return;
      }

      // 전체 데이터 조합 (프로필 필드 제외 — 가입 후 별도 입력)
      const completeData: SignUpFormData = {
        // 계정 정보 (소셜 모드에서는 빈 값 — signup.tsx에서 무시됨)
        email: isSocial ? '' : updatedFormData.account!.email,
        password: isSocial ? '' : updatedFormData.account!.password,
        // PortOne 본인인증 결과
        name: data.name,
        birthDate: data.birthDate,
        gender: data.gender,
        phoneVerified: data.phoneVerified as true,
        verifiedPhone: data.verifiedPhone,
        identityVerificationId: data.identityVerificationId,
        // 약관동의
        termsAgreed: updatedFormData.terms.termsAgreed,
        privacyAgreed: updatedFormData.terms.privacyAgreed,
        marketingAgreed: updatedFormData.terms.marketingAgreed,
      };

      await onSubmit(completeData);
    },
    [formData, onSubmit, toast, isSocial]
  );

  const handleIdentityBack = useCallback(() => {
    if (isSocial) {
      // 소셜 모드: identity 데이터 보존 (phone link 상태 유지)
      setCurrentStep(1);
      return;
    }

    setFormData((prev) => ({ ...prev, identity: undefined }));
    setCurrentStep(2); // 계정정보로 이동
  }, [isSocial]);

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (currentStep) {
      case 1: // 약관동의
        return (
          <SignupStepTerms
            onNext={handleTermsNext}
            initialData={formData.terms}
            isLoading={isLoading}
          />
        );
      case 2: // 계정정보 (소셜 모드에서는 건너뜀)
        return (
          <SignupStepAccount
            onNext={handleAccountNext}
            onBack={handleAccountBack}
            initialData={formData.account}
            isLoading={isLoading}
          />
        );
      case 3: // 본인인증 (최종 제출)
        return (
          <SignupStepIdentity
            onNext={handleIdentityNext}
            onBack={handleIdentityBack}
            initialData={formData.identity}
            isLoading={isLoading}
            submitLabel={isSocial ? undefined : '가입완료'}
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
          key={currentStep}
          entering={FadeInRight.duration(200).springify()}
          className="flex-1"
        >
          {renderStep()}
        </Animated.View>
      </View>
    </KeyboardAwareScrollView>
  );
}

export default SignupForm;
