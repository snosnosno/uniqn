/**
 * UNIQN Mobile - 4단계 회원가입 폼 컴포넌트
 *
 * @description 플로우: 약관동의 → 계정 → 본인인증 → 프로필
 *              개인정보보호법 제15조에 따라 약관동의를 최우선 단계로 배치
 * @version 2.0.0
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

/** 소셜 모드 스텝 (계정정보 생략: 약관 → 본인인증 → 프로필) */
const SOCIAL_SIGNUP_STEPS: StepInfo[] = [
  { label: '약관동의', shortLabel: '약관' },
  { label: '본인인증', shortLabel: '인증' },
  { label: '프로필', shortLabel: '프로필' },
];

interface FormDataState {
  terms?: SignUpStep4Data; // Step 1: 약관동의
  account?: SignUpStep1Data; // Step 2: 계정정보 (소셜 모드에서 생략)
  identity?: SignUpStep2Data; // Step 3: 본인인증
  profile?: SignUpStep3Data; // Step 4: 프로필
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
  // 양쪽 모두 Step 1(약관동의)부터 시작
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormDataState>({});
  const toast = useToast();
  const showConfirm = useModalStore((s) => s.showConfirm);

  // 소셜 모드: Step 2(계정) 건너뛰므로 displayStep 조정 (1→1, 3→2, 4→3)
  const steps = isSocial ? SOCIAL_SIGNUP_STEPS : SIGNUP_STEPS;
  const displayStep = isSocial && currentStep >= 3 ? currentStep - 1 : currentStep;

  // ──────────────────────────────────────────────────────────────────────────
  // Step 1: 약관동의
  // ──────────────────────────────────────────────────────────────────────────

  const handleTermsNext = useCallback(
    (data: SignUpStep4Data) => {
      setFormData((prev) => ({ ...prev, terms: data }));
      // 소셜 모드: 계정정보 건너뛰고 본인인증(Step 3)으로
      setCurrentStep(isSocial ? 3 : 2);
    },
    [isSocial]
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Step 2: 계정 정보 (소셜 모드에서는 렌더링되지 않음)
  // ──────────────────────────────────────────────────────────────────────────

  const handleAccountNext = useCallback((data: SignUpStep1Data) => {
    setFormData((prev) => ({ ...prev, account: data }));
    setCurrentStep(3);
  }, []);

  const handleAccountBack = useCallback(() => {
    setCurrentStep(1);
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Step 3: 본인인증
  // ──────────────────────────────────────────────────────────────────────────

  const handleIdentityNext = useCallback((data: SignUpStep2Data) => {
    setFormData((prev) => ({ ...prev, identity: data }));
    setCurrentStep(4);
  }, []);

  // phone-only 계정 정리 (본인인증 단계에서 생성된 Firebase Auth 계정)
  const cleanupPhoneAccount = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        const webUser = getFirebaseAuth().currentUser;
        if (webUser) {
          await webDeleteUser(webUser);
          logger.info('본인인증 뒤로가기 - phone-only 계정 삭제', { uid: webUser.uid });
        }
      } else if (getNativeAuth && nativeDeleteUser) {
        const nativeUser = getNativeAuth().currentUser;
        if (nativeUser) {
          await nativeDeleteUser(nativeUser);
          logger.info('본인인증 뒤로가기 - phone-only 계정 삭제', { uid: nativeUser.uid });
        }
      }
    } catch {
      // 삭제 실패 시 고아 계정 마킹
      const failedUid =
        Platform.OS === 'web'
          ? getFirebaseAuth().currentUser?.uid
          : getNativeAuth?.()?.currentUser?.uid;
      if (failedUid) {
        await markOrphanAccount(failedUid, 'identity_back_cleanup_failed');
      }
      logger.warn('본인인증 뒤로가기 - phone-only 계정 삭제 실패');
    }
  }, []);

  const handleIdentityBack = useCallback(async () => {
    if (isSocial) {
      // 소셜 모드: phone account cleanup 불필요 (이미 Apple 계정 존재)
      // 약관동의(Step 1)로 이동
      setFormData((prev) => ({ ...prev, identity: undefined }));
      setCurrentStep(1);
      return;
    }

    // 현재 인증된 계정이 있는지 확인
    const hasPhoneAccount =
      Platform.OS === 'web' ? !!getFirebaseAuth().currentUser : !!getNativeAuth?.()?.currentUser;

    const goBack = async () => {
      await cleanupPhoneAccount();
      setFormData((prev) => ({ ...prev, identity: undefined }));
      setCurrentStep(2); // 계정정보로 이동
    };

    if (hasPhoneAccount) {
      showConfirm(
        '전화번호 인증 취소',
        '이전 단계로 돌아가면 전화번호 인증을 다시 해야 합니다. 돌아가시겠습니까?',
        goBack
      );
    } else {
      setFormData((prev) => ({ ...prev, identity: undefined }));
      setCurrentStep(2); // 계정정보로 이동
    }
  }, [cleanupPhoneAccount, showConfirm, isSocial]);

  // ──────────────────────────────────────────────────────────────────────────
  // Step 4: 프로필 (최종 제출)
  // ──────────────────────────────────────────────────────────────────────────

  const handleProfileSubmit = useCallback(
    async (data: SignUpStep3Data) => {
      // 소셜 모드에서는 이메일 중복 체크 불필요 (계정정보 없음)
      if (!isSocial) {
        // 이메일 Race Condition 방지: 제출 직전 이메일 중복 재검증
        try {
          const emailExists = await checkEmailExists(formData.account!.email);
          if (emailExists) {
            toast.error('이미 사용 중인 이메일입니다. 다른 이메일을 입력해주세요.');
            setCurrentStep(2); // 계정정보(Step 2)로 이동
            return;
          }
        } catch {
          // 네트워크 오류 시 경고만 남기고 계속 진행 (Firebase Auth가 최종 방어)
          logger.warn('최종 제출 전 이메일 재검증 실패 - 계속 진행');
        }
      }

      const updatedFormData = { ...formData, profile: data };
      setFormData(updatedFormData);

      // 전체 데이터 조합
      const completeData: SignUpFormData = {
        // 계정 정보 (소셜 모드에서는 빈 값 — signup.tsx에서 무시됨)
        email: isSocial ? '' : updatedFormData.account!.email,
        password: isSocial ? '' : updatedFormData.account!.password,
        // 본인인증
        name: updatedFormData.identity!.name,
        birthDate: updatedFormData.identity!.birthDate,
        gender: updatedFormData.identity!.gender,
        phoneVerified: updatedFormData.identity!.phoneVerified,
        verifiedPhone: updatedFormData.identity!.verifiedPhone,
        // 프로필
        nickname: data.nickname,
        role: data.role,
        region: data.region,
        experienceYears: data.experienceYears,
        career: data.career,
        note: data.note,
        // 약관동의
        termsAgreed: updatedFormData.terms!.termsAgreed,
        privacyAgreed: updatedFormData.terms!.privacyAgreed,
        marketingAgreed: updatedFormData.terms!.marketingAgreed,
      };

      await onSubmit(completeData);
    },
    [formData, onSubmit, toast, isSocial]
  );

  const handleProfileBack = useCallback(() => {
    setCurrentStep(3);
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (currentStep) {
      case 1: // 약관동의
        return (
          <SignupStep4
            onNext={handleTermsNext}
            initialData={formData.terms}
            isLoading={isLoading}
          />
        );
      case 2: // 계정정보 (소셜 모드에서는 건너뜀)
        return (
          <SignupStep1
            onNext={handleAccountNext}
            onBack={handleAccountBack}
            initialData={formData.account}
            isLoading={isLoading}
          />
        );
      case 3: // 본인인증
        return (
          <SignupStep2
            onNext={handleIdentityNext}
            onBack={handleIdentityBack}
            initialData={
              isSocial && !formData.identity ? { name: socialData?.name || '' } : formData.identity
            }
            isLoading={isLoading}
            phoneMode={isSocial ? 'link' : 'signIn'}
          />
        );
      case 4: // 프로필 (최종 제출)
        return (
          <SignupStep3
            onNext={handleProfileSubmit}
            onBack={handleProfileBack}
            initialData={formData.profile}
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
