/**
 * UNIQN Mobile - 회원가입 Step 3: 본인인증
 *
 * @description PortOne KG이니시스 통합 본인인증 1단계로 화면 단순화.
 *              인증 완료 시 이름/생년월일/성별/휴대폰이 자동 채워지며,
 *              사용자 직접 입력 폼은 제공하지 않는다 (입력 후 덮어쓰기 혼란 제거).
 * @version 6.0.0
 */

import React, { useCallback, useState } from 'react';
import { View, Text } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { PortOneIdentityVerification } from '@/components/auth/PortOneIdentityVerification';
import { type VerifiedPortOneIdentity } from '@/services/auth';
import { signUpIdentitySchema } from '@/schemas';
import type { SignUpIdentityData } from '@/schemas';
import { logger } from '@/utils/logger';

interface SignupStepIdentityProps {
  onNext: (data: SignUpIdentityData) => void;
  onBack: () => void;
  initialData?: Partial<SignUpIdentityData>;
  isLoading?: boolean;
  submitLabel?: string;
  /** reverify 등 이전 step 이 없는 경우 "이전" 버튼 숨김 */
  hideBack?: boolean;
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
  submitLabel = '다음',
  hideBack = false,
}: SignupStepIdentityProps) {
  const [portOneIdentity, setPortOneIdentity] = useState<VerifiedPortOneIdentity | null>(() =>
    createInitialPortOneIdentity(initialData)
  );

  const { handleSubmit, setValue } = useForm<SignUpIdentityData>({
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

  const handlePortOneVerified = useCallback(
    (identity: VerifiedPortOneIdentity) => {
      if (!identity.phoneNumber) {
        logger.warn('PortOne identity missing phone', {
          component: 'SignupStepIdentity',
          identityVerificationId: identity.identityVerificationId,
        });
        return;
      }

      setPortOneIdentity(identity);
      setValue('name', identity.name, { shouldValidate: true });
      setValue('birthDate', identity.birthDate, { shouldValidate: true });
      // 2026-05-16: gender 는 PortOne 응답에 있을 때만 form 에 채움.
      // 없으면 가입 후 마이페이지/프로필 화면에서 사용자가 직접 선택해 보완한다.
      if (identity.gender) {
        setValue('gender', identity.gender, { shouldValidate: true });
      }
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

  const isVerified = Boolean(portOneIdentity);

  return (
    <View className="w-full flex-col gap-5">
      <View>
        <Text className="mb-3 text-sm leading-5 text-content-muted dark:text-secondary-300 font-sans">
          본인인증을 진행하면 이름·생년월일·휴대폰이 자동으로 확인됩니다. 성별은 가입 후 프로필에서
          입력합니다.
        </Text>
        <PortOneIdentityVerification
          onVerified={handlePortOneVerified}
          onError={(error) =>
            logger.error('PortOne identity verification error', error, {
              component: 'SignupStepIdentity',
            })
          }
          initialIdentity={portOneIdentity}
          disabled={isLoading}
        />
      </View>

      <View className="mt-4 flex-col gap-3">
        <Button onPress={handleSubmit(onSubmit)} disabled={isLoading || !isVerified} fullWidth>
          {submitLabel}
        </Button>

        {!hideBack && (
          <Button onPress={onBack} variant="ghost" disabled={isLoading} fullWidth>
            이전
          </Button>
        )}
      </View>
    </View>
  );
}
