/**
 * UNIQN Mobile - 회원가입 Step 1: 계정 정보
 *
 * @description 이메일, 비밀번호 입력
 * @version 1.0.0
 */

import React from 'react';
import { View, Text } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PasswordStrength } from '@/components/auth/PasswordStrength';
import { signUpStep1Schema, type SignUpStep1Data } from '@/schemas';

// ============================================================================
// Types
// ============================================================================

interface SignupStep1Props {
  onNext: (data: SignUpStep1Data) => void;
  initialData?: Partial<SignUpStep1Data>;
  isLoading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function SignupStep1({ onNext, initialData, isLoading = false }: SignupStep1Props) {
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignUpStep1Data>({
    resolver: zodResolver(signUpStep1Schema),
    defaultValues: {
      email: initialData?.email || '',
      password: initialData?.password || '',
      passwordConfirm: initialData?.passwordConfirm || '',
    },
  });

  const password = watch('password');

  return (
    <View className="w-full space-y-4">
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
              editable={!isLoading}
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
              editable={!isLoading}
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
              editable={!isLoading}
            />
          )}
        />
      </View>

      {/* 다음 버튼 */}
      <View className="mt-6">
        <Button
          onPress={handleSubmit(onNext)}
          disabled={isLoading}
          fullWidth
        >
          다음
        </Button>
      </View>
    </View>
  );
}

export default SignupStep1;
