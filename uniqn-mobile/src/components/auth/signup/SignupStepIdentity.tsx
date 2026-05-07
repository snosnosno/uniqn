/**
 * UNIQN Mobile - 회원가입 Step 2: 본인인증
 *
 * @description PortOne KG이니시스 통합 본인인증.
 *              인증 결과(이름/생년월일/성별/휴대폰)는 표시 전용으로 잠긴다.
 * @version 5.0.0
 */

import React, { useCallback, useState } from 'react';
import { View, Text } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PortOneIdentityVerification } from '@/components/auth/PortOneIdentityVerification';
import { BirthDateInput } from '@/components/auth/signup/BirthDateInput';
import { GenderSelector } from '@/components/auth/signup/GenderSelector';
import { type VerifiedPortOneIdentity } from '@/services/auth';
import { signUpIdentitySchema } from '@/schemas';
import type { SignUpIdentityData } from '@/schemas';
import { logger } from '@/utils/logger';

interface SignupStepIdentityProps {
  onNext: (data: SignUpIdentityData) => void;
  onBack: () => void;
  initialData?: Partial<SignUpIdentityData>;
  isLoading?: boolean;
  isAppleUser?: boolean;
  submitLabel?: string;
}

function createInitialPortOneIdentity(
  initialData?: Partial<SignUpIdentityData>
): VerifiedPortOneIdentity | null {
  if (
    !initialData?.identityVerificationId ||
    !initialData.name ||
    !initialData.birthDate ||
    !initialData.verifiedPhone
  ) {
    return null;
  }

  return {
    provider: 'portone',
    channel: 'inicis_unified',
    identityVerificationId: initialData.identityVerificationId,
    verifiedAt: new Date().toISOString(),
    name: initialData.name,
    birthDate: initialData.birthDate,
    gender: initialData.gender,
    phoneNumber: initialData.verifiedPhone,
  };
}

export function SignupStepIdentity({
  onNext,
  onBack,
  initialData,
  isLoading = false,
  isAppleUser = false,
  submitLabel = '다음',
}: SignupStepIdentityProps) {
  const [portOneIdentity, setPortOneIdentity] = useState<VerifiedPortOneIdentity | null>(() =>
    createInitialPortOneIdentity(initialData)
  );

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SignUpIdentityData>({
    resolver: zodResolver(signUpIdentitySchema),
    defaultValues: {
      name: initialData?.name || '',
      birthDate: initialData?.birthDate || '',
      gender: initialData?.gender,
      phoneVerified: initialData?.phoneVerified || false,
      verifiedPhone: initialData?.verifiedPhone || '',
      identityVerificationId: initialData?.identityVerificationId,
    },
  });

  const watchedName = watch('name');
  const isIdentityLocked = Boolean(portOneIdentity);

  const handlePortOneVerified = useCallback(
    (identity: VerifiedPortOneIdentity) => {
      if (!identity.phoneNumber || !identity.gender) {
        logger.warn('PortOne identity missing required fields', {
          component: 'SignupStepIdentity',
          identityVerificationId: identity.identityVerificationId,
        });
        return;
      }

      setPortOneIdentity(identity);
      setValue('name', identity.name, { shouldValidate: true });
      setValue('birthDate', identity.birthDate, { shouldValidate: true });
      setValue('gender', identity.gender, { shouldValidate: true });
      setValue('phoneVerified', true, { shouldValidate: true });
      setValue('verifiedPhone', identity.phoneNumber, { shouldValidate: true });
      setValue('identityVerificationId', identity.identityVerificationId, {
        shouldValidate: true,
      });
    },
    [setValue]
  );

  const onSubmit = useCallback(
    (data: SignUpIdentityData) => {
      onNext(data);
    },
    [onNext]
  );

  return (
    <View className="w-full flex-col gap-5">
      <View>
        <Text className="mb-2 text-sm font-sans-medium text-content-secondary">이름 (실명)</Text>
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              placeholder="실명을 입력해주세요"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              editable={!isLoading && !isIdentityLocked}
              accessibilityLabel="이름 입력"
              error={errors.name?.message}
            />
          )}
        />
        {isAppleUser && !initialData?.name && (
          <View className="mt-2 rounded-lg bg-info-50 p-3 dark:bg-info-900/20">
            <Text className="text-xs text-info-700 dark:text-info-300 font-sans">
              Apple은 최초 로그인 시에만 이름을 제공합니다. 이전에 이름 공유를 거부했거나 삭제한
              경우 직접 입력해주세요.
            </Text>
          </View>
        )}
      </View>

      <View>
        <Text className="mb-2 text-sm font-sans-medium text-content-secondary">생년월일</Text>
        <Controller
          control={control}
          name="birthDate"
          render={({ field: { onChange, value } }) => (
            <BirthDateInput
              value={value}
              onChange={onChange}
              disabled={isLoading || isIdentityLocked}
            />
          )}
        />
        {errors.birthDate && (
          <Text className="mt-1 text-sm text-error-500 font-sans">{errors.birthDate.message}</Text>
        )}
      </View>

      <View>
        <Text className="mb-2 text-sm font-sans-medium text-content-secondary">성별</Text>
        <Controller
          control={control}
          name="gender"
          render={({ field: { onChange, value } }) => (
            <GenderSelector
              value={value}
              onChange={onChange}
              disabled={isLoading || isIdentityLocked}
            />
          )}
        />
        {errors.gender && (
          <Text className="mt-1 text-sm text-error-500 font-sans">{errors.gender.message}</Text>
        )}
      </View>

      <View>
        <Text className="mb-2 text-sm font-sans-medium text-content-secondary">본인인증</Text>
        <PortOneIdentityVerification
          onVerified={handlePortOneVerified}
          onError={(error) =>
            logger.error('PortOne identity verification error', error, {
              component: 'SignupStepIdentity',
            })
          }
          initialIdentity={portOneIdentity}
          disabled={isLoading}
          customerFullName={watchedName || undefined}
        />
      </View>

      {errors.phoneVerified && !portOneIdentity && (
        <Text className="-mt-2 text-sm text-error-500 font-sans">
          {errors.phoneVerified.message}
        </Text>
      )}

      <View className="mt-4 flex-col gap-3">
        <Button onPress={handleSubmit(onSubmit)} disabled={isLoading} fullWidth>
          {submitLabel}
        </Button>

        <Button onPress={onBack} variant="ghost" disabled={isLoading} fullWidth>
          이전
        </Button>
      </View>
    </View>
  );
}

export default SignupStepIdentity;
