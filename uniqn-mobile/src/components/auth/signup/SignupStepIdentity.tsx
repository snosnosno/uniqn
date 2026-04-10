/**
 * UNIQN Mobile - 회원가입 Step 2: 본인인증
 *
 * @description 이름/생년월일/성별 입력 + 전화번호 인증
 *              포트원 KG이니시스가 설정된 네이티브 환경에서는 이니시스 본인인증을 우선 사용
 * @version 4.2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Platform, View, Text } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneVerification } from '@/components/auth/PhoneVerification';
import { PortOneIdentityVerification } from '@/components/auth/PortOneIdentityVerification';
import { BirthDateInput } from '@/components/auth/signup/BirthDateInput';
import { GenderSelector } from '@/components/auth/signup/GenderSelector';
import {
  getLinkedPhoneNumber,
  isPortOneInicisIdentityConfigured,
  type VerifiedPortOneIdentity,
} from '@/services/auth';
import { signUpIdentitySchema } from '@/schemas';
import type { SignUpIdentityData } from '@/schemas';
import { logger } from '@/utils/logger';

interface SignupStepIdentityProps {
  onNext: (data: SignUpIdentityData) => void;
  onBack: () => void;
  initialData?: Partial<SignUpIdentityData>;
  isLoading?: boolean;
  phoneMode?: 'signIn' | 'link';
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
  phoneMode = 'signIn',
  isAppleUser = false,
  submitLabel = '다음',
}: SignupStepIdentityProps) {
  const usePortOneIdentity = Platform.OS !== 'web' && isPortOneInicisIdentityConfigured();
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(
    initialData?.verifiedPhone || null
  );
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
  const isIdentityLocked = usePortOneIdentity && Boolean(portOneIdentity);

  const handlePhoneVerified = useCallback(
    (phone: string, otpData?: { verificationId: string; otpCode: string }) => {
      setVerifiedPhone(phone);
      setPortOneIdentity(null);
      setValue('phoneVerified', true, { shouldValidate: true });
      setValue('verifiedPhone', phone, { shouldValidate: true });
      setValue('identityVerificationId', undefined);

      if (otpData) {
        setValue('verificationId', otpData.verificationId);
        setValue('otpCode', otpData.otpCode);
      }
    },
    [setValue]
  );

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
      setVerifiedPhone(identity.phoneNumber);
      setValue('name', identity.name, { shouldValidate: true });
      setValue('birthDate', identity.birthDate, { shouldValidate: true });
      setValue('gender', identity.gender, { shouldValidate: true });
      setValue('phoneVerified', true, { shouldValidate: true });
      setValue('verifiedPhone', identity.phoneNumber, { shouldValidate: true });
      setValue('identityVerificationId', identity.identityVerificationId, {
        shouldValidate: true,
      });
      setValue('verificationId', undefined);
      setValue('otpCode', undefined);
    },
    [setValue]
  );

  useEffect(() => {
    if (phoneMode !== 'link' || usePortOneIdentity) return;

    const linkedPhone = getLinkedPhoneNumber();
    if (!linkedPhone) return;

    logger.info('Social signup linked phone restored', {
      component: 'SignupStepIdentity',
    });
    setVerifiedPhone(linkedPhone);
    setValue('phoneVerified', true, { shouldValidate: true });
    setValue('verifiedPhone', linkedPhone, { shouldValidate: true });
  }, [phoneMode, setValue, usePortOneIdentity]);

  const onSubmit = useCallback(
    (data: SignUpIdentityData) => {
      onNext(data);
    },
    [onNext]
  );

  return (
    <View className="w-full flex-col gap-5">
      <View>
        <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
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
              editable={!isLoading && !isIdentityLocked}
              accessibilityLabel="이름 입력"
              error={errors.name?.message}
            />
          )}
        />
        {isAppleUser && !initialData?.name && (
          <View className="mt-2 rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
            <Text className="text-xs text-blue-700 dark:text-blue-300">
              Apple은 최초 로그인 시에만 이름을 제공합니다. 이전에 이름 공유를 거부했거나 삭제한
              경우 직접 입력해주세요.
            </Text>
          </View>
        )}
      </View>

      <View>
        <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">생년월일</Text>
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
          <Text className="mt-1 text-sm text-error-500">{errors.birthDate.message}</Text>
        )}
      </View>

      <View>
        <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">성별</Text>
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
          <Text className="mt-1 text-sm text-error-500">{errors.gender.message}</Text>
        )}
      </View>

      <View>
        <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          {usePortOneIdentity ? '본인인증' : '전화번호 인증'}
        </Text>
        {usePortOneIdentity ? (
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
        ) : (
          <PhoneVerification
            onVerified={handlePhoneVerified}
            onError={(error) =>
              logger.error('Phone verification error', { component: 'SignupStepIdentity', error })
            }
            initialPhone={verifiedPhone || initialData?.verifiedPhone}
            disabled={isLoading}
            compact
            mode={phoneMode}
          />
        )}
      </View>

      {errors.phoneVerified && !verifiedPhone && (
        <Text className="-mt-2 text-sm text-error-500">{errors.phoneVerified.message}</Text>
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
