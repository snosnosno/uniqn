/**
 * UNIQN Mobile - 로그인 폼 컴포넌트
 *
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { loginSchema, type LoginFormData } from '@/schemas';

// ============================================================================
// Types
// ============================================================================

interface LoginFormProps {
  onSubmit: (data: LoginFormData) => Promise<void>;
  isLoading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function LoginForm({ onSubmit, isLoading = false }: LoginFormProps) {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const loading = isLoading || isSubmitting;

  return (
    <View className="w-full flex-col gap-4">
      {/* 이메일 입력 */}
      <View>
        <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">이메일</Text>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              placeholder="이메일을 입력하세요"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={errors.email?.message}
              editable={!loading}
            />
          )}
        />
      </View>

      {/* 비밀번호 입력 */}
      <View className="mt-4">
        <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">비밀번호</Text>
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
              autoComplete="password"
              error={errors.password?.message}
              editable={!loading}
            />
          )}
        />
      </View>

      {/* 비밀번호 찾기 링크 */}
      <View className="mt-2 items-end">
        <Link href="/forgot-password" asChild>
          <Pressable>
            <Text className="text-sm text-primary-600 dark:text-primary-400">
              비밀번호를 잊으셨나요?
            </Text>
          </Pressable>
        </Link>
      </View>

      {/* 로그인 버튼 */}
      <View className="mt-6">
        <Button onPress={handleSubmit(onSubmit)} disabled={loading} className="w-full">
          {loading ? (
            <View className="flex-row items-center justify-center">
              <ActivityIndicator color="white" size="small" />
              <Text className="ml-2 text-white font-medium">로그인 중...</Text>
            </View>
          ) : (
            <Text className="text-white font-medium">로그인</Text>
          )}
        </Button>
      </View>

      {/* 회원가입 링크 */}
      <View className="mt-4 flex-row justify-center">
        <Text className="text-gray-600 dark:text-gray-400">계정이 없으신가요? </Text>
        <Link href="/signup" asChild>
          <Pressable>
            <Text className="font-medium text-primary-600 dark:text-primary-400">회원가입</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

export default LoginForm;
