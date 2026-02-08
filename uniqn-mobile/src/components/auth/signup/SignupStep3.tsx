/**
 * UNIQN Mobile - 회원가입 Step 3: 프로필 정보
 *
 * @description 닉네임 입력 (역할은 스태프로 고정, 구인자는 로그인 후 별도 등록)
 * @version 1.1.0
 */

import React from 'react';
import { View, Text } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { signUpStep3Schema, type SignUpStep3Data } from '@/schemas';

// ============================================================================
// Types
// ============================================================================

interface SignupStep3Props {
  onNext: (data: SignUpStep3Data) => void;
  onBack: () => void;
  initialData?: Partial<SignUpStep3Data>;
  isLoading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function SignupStep3({ onNext, onBack, initialData, isLoading = false }: SignupStep3Props) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpStep3Data>({
    resolver: zodResolver(signUpStep3Schema),
    mode: 'onBlur',
    defaultValues: {
      nickname: initialData?.nickname || '',
      role: 'staff', // 모든 사용자는 스태프로 가입
    },
  });

  return (
    <View className="w-full flex-col gap-4">
      {/* 닉네임 입력 */}
      <View>
        <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          닉네임 <Text className="text-error-500">*</Text>
        </Text>
        <Controller
          control={control}
          name="nickname"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              placeholder="닉네임을 입력하세요 (2-15자)"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoCapitalize="none"
              error={errors.nickname?.message}
              editable={!isLoading}
              maxLength={15}
            />
          )}
        />
        <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          다른 사용자에게 보여지는 이름입니다.
        </Text>
      </View>

      {/* 안내 문구 */}
      <View className="mt-4 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
        <Text className="text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
          💼 구인자로 활동하고 싶으신가요?
        </Text>
        <Text className="text-xs text-primary-600 dark:text-primary-400">
          회원가입 후 '내 공고' 탭에서 구인자로 등록할 수 있습니다.
        </Text>
      </View>

      {/* 버튼 영역 */}
      <View className="mt-6 flex-col gap-3">
        <Button onPress={handleSubmit(onNext)} disabled={isLoading} fullWidth>
          다음
        </Button>

        <Button onPress={onBack} variant="ghost" disabled={isLoading} fullWidth>
          이전
        </Button>
      </View>
    </View>
  );
}

export default SignupStep3;
