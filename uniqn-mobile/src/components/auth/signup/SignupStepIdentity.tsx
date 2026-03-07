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
import { getLinkedPhoneNumber, unlinkPhoneProvider } from '@/services/auth';
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
  /** Apple 소셜 로그인 사용자 여부 (이름 미제공 시 안내 메시지 표시) */
  isAppleUser?: boolean;
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
  isAppleUser = false,
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
      phoneVerified: initialData?.phoneVerified || false,
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

    const linkedPhone = getLinkedPhoneNumber();
    if (linkedPhone) {
      logger.info('소셜 모드: 이미 전화번호 링크됨', {
        component: 'SignupStepIdentity',
      });
      setVerifiedPhone(linkedPhone);
      setValue('phoneVerified', true);
      setValue('verifiedPhone', linkedPhone);
    }
  }, [phoneMode, setValue]);

  /** [M2 FIX] "다시 인증하기" 시 부모 상태 + phone provider 초기화 */
  const handlePhoneReset = useCallback(async () => {
    phoneManuallyReset.current = true;
    // link 모드에서는 Firebase Auth에서 phone provider 해제 (재인증 허용)
    if (phoneMode === 'link') {
      try {
        await unlinkPhoneProvider();
      } catch (error) {
        logger.warn('phone provider unlink 실패', { error });
        // unlink 실패 시 Firebase Auth와 일관성 유지: 로컬 상태 초기화하지 않음
        phoneManuallyReset.current = false;
        return;
      }
    }
    setVerifiedPhone(null);
    setValue('phoneVerified', false);
    setValue('verifiedPhone', '');
  }, [phoneMode, setValue]);

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
        {isAppleUser && !initialData?.name && (
          <View className="mt-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3">
            <Text className="text-xs text-blue-700 dark:text-blue-300">
              Apple은 최초 로그인 시에만 이름을 제공합니다. 이전에 이름 공유를 거부했거나 앱을
              재설치한 경우 직접 입력해주세요.
            </Text>
          </View>
        )}
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
