/**
 * UNIQN Mobile - 회원가입 Step 1: 계정 정보
 *
 * @description 이메일, 비밀번호 입력 + 이메일 중복 확인
 * @version 1.1.0
 */

import React, { useState, useCallback } from 'react';
import { View, Text } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PasswordStrength } from '@/components/ui/PasswordStrength';
import { signUpStep1Schema, type SignUpStep1Data } from '@/schemas';
import { checkEmailExists } from '@/services/authService';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

interface SignupStep1Props {
  onNext: (data: SignUpStep1Data) => void;
  onBack: () => void;
  initialData?: Partial<SignUpStep1Data>;
  isLoading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function SignupStep1({ onNext, onBack, initialData, isLoading = false }: SignupStep1Props) {
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<SignUpStep1Data>({
    resolver: zodResolver(signUpStep1Schema),
    mode: 'onBlur',
    defaultValues: {
      email: initialData?.email || '',
      password: initialData?.password || '',
      passwordConfirm: initialData?.passwordConfirm || '',
    },
  });

  const password = watch('password');

  const handleNext = useCallback(
    async (data: SignUpStep1Data) => {
      setIsCheckingEmail(true);
      try {
        const exists = await checkEmailExists(data.email);

        if (exists) {
          setError('email', {
            type: 'manual',
            message: '이미 사용 중인 이메일입니다',
          });
          return;
        }

        onNext(data);
      } catch (error) {
        logger.error('이메일 중복 확인 실패', error as Error);
        setError('email', {
          type: 'manual',
          message: '이메일 확인 중 오류가 발생했습니다. 다시 시도해주세요.',
        });
      } finally {
        setIsCheckingEmail(false);
      }
    },
    [onNext, setError]
  );

  const isProcessing = isLoading || isCheckingEmail;

  return (
    <View className="w-full flex-col gap-4">
      {/* 이메일 입력 */}
      <View>
        <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          이메일 <Text className="text-error-500">*</Text>
        </Text>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              placeholder="이메일을 입력하세요"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              type="email"
              autoCapitalize="none"
              autoComplete="email"
              error={errors.email?.message}
              editable={!isProcessing}
            />
          )}
        />
      </View>

      {/* 비밀번호 입력 */}
      <View className="mt-4">
        <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          비밀번호 <Text className="text-error-500">*</Text>
        </Text>
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              placeholder="비밀번호를 입력하세요"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              type="password"
              autoComplete="new-password"
              error={errors.password?.message}
              editable={!isProcessing}
            />
          )}
        />
        <PasswordStrength password={password} />
      </View>

      {/* 비밀번호 확인 */}
      <View className="mt-4">
        <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          비밀번호 확인 <Text className="text-error-500">*</Text>
        </Text>
        <Controller
          control={control}
          name="passwordConfirm"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              placeholder="비밀번호를 다시 입력하세요"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              type="password"
              autoComplete="new-password"
              error={errors.passwordConfirm?.message}
              editable={!isProcessing}
            />
          )}
        />
      </View>

      {/* 버튼 영역 */}
      <View className="mt-6 flex-col gap-3">
        <Button
          onPress={handleSubmit(handleNext)}
          disabled={isProcessing}
          loading={isCheckingEmail}
          fullWidth
        >
          {isCheckingEmail ? '이메일 확인 중...' : '다음'}
        </Button>

        <Button onPress={onBack} variant="ghost" disabled={isProcessing} fullWidth>
          이전
        </Button>
      </View>
    </View>
  );
}

export default SignupStep1;
