/**
 * UNIQN Mobile - 비밀번호 재설정 폼 컴포넌트
 *
 * @version 1.0.0
 */

import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { MailIcon } from '@/components/icons';
import { resetPasswordSchema, type ResetPasswordFormData } from '@/schemas';

// ============================================================================
// Types
// ============================================================================

interface ForgotPasswordFormProps {
  onSubmit: (data: ResetPasswordFormData) => Promise<void>;
  isLoading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function ForgotPasswordForm({ onSubmit, isLoading = false }: ForgotPasswordFormProps) {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onBlur',
    defaultValues: {
      email: '',
    },
  });

  const loading = isLoading || isSubmitting;

  const handleFormSubmit = async (data: ResetPasswordFormData) => {
    await onSubmit(data);
    setSubmittedEmail(data.email);
    setIsSubmitted(true);
  };

  // 성공 상태
  if (isSubmitted) {
    return (
      <View className="w-full items-center">
        <View className="w-16 h-16 rounded-sm bg-success-100 dark:bg-success-900 items-center justify-center mb-4">
          <MailIcon size={32} color="#16A34A" />
        </View>

        <Text className="text-lg font-display text-content-primary dark:text-off-white text-center mb-2">
          이메일이 발송되었습니다
        </Text>

        <Text className="text-sm text-content-muted dark:text-secondary-400 text-center mb-6 font-sans">
          {submittedEmail}로 비밀번호 재설정 링크를 발송했습니다.{'\n'}
          이메일을 확인해주세요.
        </Text>

        <View className="w-full flex-col gap-3">
          <Button onPress={() => setIsSubmitted(false)} variant="outline" fullWidth>
            다시 시도하기
          </Button>

          <Link href="/login" asChild>
            <Pressable className="py-3 min-h-[44px] justify-center rounded-md active:opacity-80">
              <Text className="text-center text-primary-600 dark:text-primary-400 font-sans-medium">
                로그인으로 돌아가기
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    );
  }

  // 입력 폼
  return (
    <View className="w-full flex-col gap-4">
      {/* 안내 문구 */}
      <View className="mb-4">
        <Text className="text-sm text-content-muted dark:text-secondary-400 text-center font-sans">
          가입하신 이메일 주소를 입력하시면{'\n'}
          비밀번호 재설정 링크를 보내드립니다.
        </Text>
      </View>

      {/* 이메일 입력 */}
      <View>
        <Text className="mb-2 text-sm font-sans-medium text-content-secondary">이메일</Text>
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

      {/* 제출 버튼 */}
      <View className="mt-6">
        <Button onPress={handleSubmit(handleFormSubmit)} loading={loading} fullWidth>
          재설정 링크 발송
        </Button>
      </View>

      {/* 로그인 링크 */}
      <View className="mt-4 flex-row items-center justify-center">
        <Text className="text-content-muted dark:text-secondary-400 font-sans">
          비밀번호가 기억나셨나요?{' '}
        </Text>
        <Link href="/login" asChild>
          <Pressable
            hitSlop={8}
            className="min-h-[44px] justify-center px-2 -mx-2 active:opacity-80"
          >
            <Text className="font-sans-medium text-primary-600 dark:text-primary-400">로그인</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}
