/**
 * UNIQN Mobile - 4단계 회원가입 폼 컴포넌트
 *
 * @description 플로우: 계정 → 본인인증 → 프로필 → 약관동의
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { View, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { StepIndicator, SIGNUP_STEPS } from '@/components/auth/StepIndicator';
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
}

interface FormDataState {
  step1?: SignUpStep1Data;
  step2?: SignUpStep2Data;
  step3?: SignUpStep3Data;
  step4?: SignUpStep4Data;
}

// ============================================================================
// Component
// ============================================================================

export function SignupForm({ onSubmit, isLoading = false }: SignupFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormDataState>({});

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

  const handleStep2Back = useCallback(() => {
    setCurrentStep(1);
  }, []);

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
      const updatedFormData = { ...formData, step4: data };
      setFormData(updatedFormData);

      // 전체 데이터 조합
      const completeData: SignUpFormData = {
        // Step 1: 계정 정보
        email: updatedFormData.step1!.email,
        password: updatedFormData.step1!.password,
        // Step 2: 본인인증
        identityVerified: updatedFormData.step2!.identityVerified,
        identityProvider: updatedFormData.step2!.identityProvider,
        verifiedName: updatedFormData.step2!.verifiedName,
        verifiedPhone: updatedFormData.step2!.verifiedPhone,
        verifiedBirthDate: updatedFormData.step2!.verifiedBirthDate,
        verifiedGender: updatedFormData.step2!.verifiedGender,
        // Step 3: 프로필
        nickname: updatedFormData.step3!.nickname,
        role: updatedFormData.step3!.role,
        // Step 4: 약관동의
        termsAgreed: data.termsAgreed,
        privacyAgreed: data.privacyAgreed,
        marketingAgreed: data.marketingAgreed,
      };

      await onSubmit(completeData);
    },
    [formData, onSubmit]
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
            initialData={formData.step2}
            isLoading={isLoading}
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
          <StepIndicator currentStep={currentStep} steps={SIGNUP_STEPS} />
        </View>

        {/* 현재 스텝 폼 */}
        <View className="flex-1">{renderStep()}</View>
      </View>
    </KeyboardAwareScrollView>
  );
}

export default SignupForm;
