/**
 * UNIQN Mobile - 회원가입 Step 2: 본인인증
 *
 * @description 이름/생년월일/성별 입력 + Firebase Phone Auth(SMS OTP) 전화번호 인증
 * @version 4.1.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneVerification } from '@/components/auth/PhoneVerification';
import { BirthDateInput } from '@/components/auth/signup/BirthDateInput';
import { GenderSelector } from '@/components/auth/signup/GenderSelector';
import { getFirebaseAuth } from '@/lib/firebase';
import { signUpIdentitySchema } from '@/schemas';
import type { SignUpIdentityData } from '@/schemas';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

interface SignupStepIdentityProps {
  onNext: (data: SignUpIdentityData) => void;
  onBack: () => void;
  initialData?: Partial<SignUpIdentityData>;
  isLoading?: boolean;
  /** PhoneVerification 모드: signIn(기본)=새 계정 생성, link=기존 계정에 링크 */
  phoneMode?: 'signIn' | 'link';
}

// ============================================================================
// Component
// ============================================================================

export function SignupStepIdentity({
  onNext,
  onBack,
  initialData,
  isLoading = false,
  phoneMode = 'signIn',
}: SignupStepIdentityProps) {
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(
    initialData?.verifiedPhone || null
  );
  // "다시 인증하기" 클릭 시 true → useEffect 자동 복원 방지
  const phoneManuallyReset = useRef(false);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SignUpIdentityData>({
    resolver: zodResolver(signUpIdentitySchema),
    defaultValues: {
      name: initialData?.name || '',
      birthDate: initialData?.birthDate || '',
      gender: initialData?.gender,
      phoneVerified: initialData?.phoneVerified || (false),
      verifiedPhone: initialData?.verifiedPhone || '',
    },
  });

  const handleVerified = useCallback(
    (phone: string) => {
      setVerifiedPhone(phone);
      setValue('phoneVerified', true);
      setValue('verifiedPhone', phone);
    },
    [setValue]
  );

  // 소셜 모드: 이미 link된 전화번호 자동 감지 (중단 복구 / 뒤로가기 후 재진입)
  // "다시 인증하기"로 명시적 리셋된 경우에는 자동 복원하지 않음
  useEffect(() => {
    if (phoneMode !== 'link' || phoneManuallyReset.current) return;

    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser) return;

    const phoneProvider = currentUser.providerData.find(
      (p) => p.providerId === 'phone'
    );

    if (phoneProvider?.phoneNumber) {
      logger.info('소셜 모드: 이미 전화번호 링크됨', {
        component: 'SignupStepIdentity',
      });
      setVerifiedPhone(phoneProvider.phoneNumber);
      setValue('phoneVerified', true);
      setValue('verifiedPhone', phoneProvider.phoneNumber);
    }
  }, [phoneMode, setValue]);

  /** [M2 FIX] "다시 인증하기" 시 부모 상태 초기화 */
  const handlePhoneReset = useCallback(() => {
    phoneManuallyReset.current = true;
    setVerifiedPhone(null);
    setValue('phoneVerified', false);
    setValue('verifiedPhone', '');
  }, [setValue]);

  const onSubmit = useCallback(
    (data: SignUpIdentityData) => {
      onNext(data);
    },
    [onNext]
  );

  return (
    <View className="w-full flex-col gap-5">
      {/* 이름 입력 */}
      <View>
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          이름 (실명)
        </Text>
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              placeholder="실명을 입력해주세요"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              editable={!isLoading}
              accessibilityLabel="이름 입력"
              error={errors.name?.message}
            />
          )}
        />
      </View>

      {/* 생년월일 입력 */}
      <View>
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">생년월일</Text>
        <Controller
          control={control}
          name="birthDate"
          render={({ field: { onChange, value } }) => (
            <BirthDateInput value={value} onChange={onChange} disabled={isLoading} />
          )}
        />
        {errors.birthDate && (
          <Text className="text-sm text-error-500 mt-1">{errors.birthDate.message}</Text>
        )}
      </View>

      {/* 성별 선택 */}
      <View>
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">성별</Text>
        <Controller
          control={control}
          name="gender"
          render={({ field: { onChange, value } }) => (
            <GenderSelector value={value} onChange={onChange} disabled={isLoading} />
          )}
        />
        {errors.gender && (
          <Text className="text-sm text-error-500 mt-1">{errors.gender.message}</Text>
        )}
      </View>

      {/* 전화번호 인증 */}
      <View>
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          전화번호 인증
        </Text>
        <PhoneVerification
          onVerified={handleVerified}
          onReset={handlePhoneReset}
          onError={(error) =>
            logger.error('전화번호 인증 오류', { component: 'SignupStepIdentity', error })
          }
          initialPhone={verifiedPhone || initialData?.verifiedPhone}
          disabled={isLoading}
          compact
          mode={phoneMode}
        />
      </View>
      {errors.phoneVerified && !verifiedPhone && (
        <Text className="text-sm text-error-500 -mt-2">{errors.phoneVerified.message}</Text>
      )}

      {/* 버튼 영역 */}
      <View className="mt-4 flex-col gap-3">
        <Button onPress={handleSubmit(onSubmit)} disabled={isLoading} fullWidth>
          다음
        </Button>

        <Button onPress={onBack} variant="ghost" disabled={isLoading} fullWidth>
          이전
        </Button>
      </View>
    </View>
  );
}

export default SignupStepIdentity;
