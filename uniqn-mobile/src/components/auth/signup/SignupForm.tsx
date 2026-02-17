/**
 * UNIQN Mobile - 4단계 회원가입 폼 컴포넌트
 *
 * @description 플로우: 계정 → 본인인증 → 프로필 → 약관동의
 * @version 1.1.0
 */

import React, { useState, useCallback } from 'react';
import { View, Platform } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { deleteUser as webDeleteUser } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { getNativeAuth, nativeDeleteUser } from '@/lib/nativeAuth';
import { StepIndicator, SIGNUP_STEPS, type StepInfo } from '@/components/auth/StepIndicator';
import { checkEmailExists, markOrphanAccount } from '@/services/authService';
import { useToast } from '@/stores/toastStore';
import { useModalStore } from '@/stores/modalStore';
import { logger } from '@/utils/logger';
import { SignupStep1 } from './SignupStep1';
import { SignupStep2 } from './SignupStep2';
import { SignupStep3 } from './SignupStep3';
import { SignupStep4 } from './SignupStep4';
import type {
  SignUpStep1Data,
  SignUpStep2Data,
  SignUpStep3Data,
  SignUpStep4Data,
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
  /** 소셜 로그인에서 받은 데이터 (이름 pre-fill 등) */
  socialData?: { name?: string };
}

/** 소셜 모드 스텝 (Step 1 생략: 본인인증 → 프로필 → 약관) */
const SOCIAL_SIGNUP_STEPS: StepInfo[] = [
  { label: '본인인증', shortLabel: '인증' },
  { label: '프로필', shortLabel: '프로필' },
  { label: '약관동의', shortLabel: '약관' },
];

interface FormDataState {
  step1?: SignUpStep1Data;
  step2?: SignUpStep2Data;
  step3?: SignUpStep3Data;
  step4?: SignUpStep4Data;
}

// ============================================================================
// Component
// ============================================================================

export function SignupForm({
  onSubmit,
  isLoading = false,
  mode = 'default',
  socialData,
}: SignupFormProps) {
  const isSocial = mode === 'social';
  // 소셜 모드: Step 1 생략 → Step 2부터 시작
  const [currentStep, setCurrentStep] = useState(isSocial ? 2 : 1);
  const [formData, setFormData] = useState<FormDataState>({});
  const toast = useToast();
  const showConfirm = useModalStore((s) => s.showConfirm);

  // 소셜 모드용 스텝 표시: Step 2→1, 3→2, 4→3
  const steps = isSocial ? SOCIAL_SIGNUP_STEPS : SIGNUP_STEPS;
  const displayStep = isSocial ? currentStep - 1 : currentStep;

  // Step 1: 계정 정보
  const handleStep1Next = useCallback((data: SignUpStep1Data) => {
    setFormData((prev) => ({ ...prev, step1: data }));
    setCurrentStep(2);
  }, []);

  // Step 2: 본인인증
  const handleStep2Next = useCallback((data: SignUpStep2Data) => {
    setFormData((prev) => ({ ...prev, step2: data }));
    setCurrentStep(3);
  }, []);

  // phone-only 계정 정리 (Step 2에서 생성된 Firebase Auth 계정)
  const cleanupPhoneAccount = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        const webUser = getFirebaseAuth().currentUser;
        if (webUser) {
          await webDeleteUser(webUser);
          logger.info('Step2 뒤로가기 - phone-only 계정 삭제', { uid: webUser.uid });
        }
      } else if (getNativeAuth && nativeDeleteUser) {
        const nativeUser = getNativeAuth().currentUser;
        if (nativeUser) {
          await nativeDeleteUser(nativeUser);
          logger.info('Step2 뒤로가기 - phone-only 계정 삭제', { uid: nativeUser.uid });
        }
      }
    } catch {
      // 삭제 실패 시 고아 계정 마킹
      const failedUid =
        Platform.OS === 'web'
          ? getFirebaseAuth().currentUser?.uid
          : getNativeAuth?.()?.currentUser?.uid;
      if (failedUid) {
        await markOrphanAccount(failedUid, 'step2_back_cleanup_failed');
      }
      logger.warn('Step2 뒤로가기 - phone-only 계정 삭제 실패');
    }
  }, []);

  const handleStep2Back = useCallback(async () => {
    if (isSocial) {
      // 소셜 모드: phone account cleanup 불필요 (이미 Apple 계정 존재)
      // 뒤로가기는 signup.tsx에서 처리 (login 화면으로 이동)
      return;
    }

    // 현재 인증된 계정이 있는지 확인
    const hasPhoneAccount =
      Platform.OS === 'web' ? !!getFirebaseAuth().currentUser : !!getNativeAuth?.()?.currentUser;

    const goBack = async () => {
      await cleanupPhoneAccount();
      setFormData((prev) => ({ ...prev, step2: undefined }));
      setCurrentStep(1);
    };

    if (hasPhoneAccount) {
      showConfirm(
        '전화번호 인증 취소',
        '이전 단계로 돌아가면 전화번호 인증을 다시 해야 합니다. 돌아가시겠습니까?',
        goBack
      );
    } else {
      setFormData((prev) => ({ ...prev, step2: undefined }));
      setCurrentStep(1);
    }
  }, [cleanupPhoneAccount, showConfirm, isSocial]);

  // Step 3: 프로필
  const handleStep3Next = useCallback((data: SignUpStep3Data) => {
    setFormData((prev) => ({ ...prev, step3: data }));
    setCurrentStep(4);
  }, []);

  const handleStep3Back = useCallback(() => {
    setCurrentStep(2);
  }, []);

  // Step 4: 약관동의 및 최종 제출
  const handleStep4Submit = useCallback(
    async (data: SignUpStep4Data) => {
      // 소셜 모드에서는 이메일 중복 체크 불필요 (Step 1 없음)
      if (!isSocial) {
        // 이메일 Race Condition 방지: 제출 직전 이메일 중복 재검증
        try {
          const emailExists = await checkEmailExists(formData.step1!.email);
          if (emailExists) {
            toast.error('이미 사용 중인 이메일입니다. 다른 이메일을 입력해주세요.');
            setCurrentStep(1);
            return;
          }
        } catch {
          // 네트워크 오류 시 경고만 남기고 계속 진행 (Firebase Auth가 최종 방어)
          logger.warn('Step4 제출 전 이메일 재검증 실패 - 계속 진행');
        }
      }

      const updatedFormData = { ...formData, step4: data };
      setFormData(updatedFormData);

      // 전체 데이터 조합
      const completeData: SignUpFormData = {
        // Step 1: 계정 정보 (소셜 모드에서는 빈 값 — signup.tsx에서 무시됨)
        email: isSocial ? '' : updatedFormData.step1!.email,
        password: isSocial ? '' : updatedFormData.step1!.password,
        // Step 2: 본인인증
        name: updatedFormData.step2!.name,
        birthDate: updatedFormData.step2!.birthDate,
        gender: updatedFormData.step2!.gender,
        phoneVerified: updatedFormData.step2!.phoneVerified,
        verifiedPhone: updatedFormData.step2!.verifiedPhone,
        // Step 3: 프로필
        nickname: updatedFormData.step3!.nickname,
        role: updatedFormData.step3!.role,
        region: updatedFormData.step3!.region,
        experienceYears: updatedFormData.step3!.experienceYears,
        career: updatedFormData.step3!.career,
        note: updatedFormData.step3!.note,
        // Step 4: 약관동의
        termsAgreed: data.termsAgreed,
        privacyAgreed: data.privacyAgreed,
        marketingAgreed: data.marketingAgreed,
      };

      await onSubmit(completeData);
    },
    [formData, onSubmit, toast, isSocial]
  );

  const handleStep4Back = useCallback(() => {
    setCurrentStep(3);
  }, []);

  // 현재 스텝 렌더링
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <SignupStep1
            onNext={handleStep1Next}
            initialData={formData.step1}
            isLoading={isLoading}
          />
        );
      case 2:
        return (
          <SignupStep2
            onNext={handleStep2Next}
            onBack={handleStep2Back}
            initialData={
              isSocial && !formData.step2
                ? { name: socialData?.name || '' }
                : formData.step2
            }
            isLoading={isLoading}
            phoneMode={isSocial ? 'link' : 'signIn'}
          />
        );
      case 3:
        return (
          <SignupStep3
            onNext={handleStep3Next}
            onBack={handleStep3Back}
            initialData={formData.step3}
            isLoading={isLoading}
          />
        );
      case 4:
        return (
          <SignupStep4
            onSubmit={handleStep4Submit}
            onBack={handleStep4Back}
            initialData={formData.step4}
            isLoading={isLoading}
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
