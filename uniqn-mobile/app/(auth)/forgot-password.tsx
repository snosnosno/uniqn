/**
 * UNIQN Mobile - Forgot Password Screen
 * 비밀번호 찾기 화면
 *
 * @version 2.0.0
 */

import { useState, useCallback } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ForgotPasswordForm } from '@/components/auth';
import { resetPassword } from '@/services';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import { extractUserMessage } from '@/errors';
import { ChevronLeftIcon } from '@/components/icons';
import type { ResetPasswordFormData } from '@/schemas';

export default function ForgotPasswordScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const { addToast } = useToastStore();

  const handleSubmit = useCallback(
    async (data: ResetPasswordFormData) => {
      setIsLoading(true);
      try {
        await resetPassword(data.email);
        logger.info('비밀번호 재설정 이메일 발송', { email: data.email });
        // 성공 시 ForgotPasswordForm 내부에서 성공 상태로 전환됨
      } catch (error) {
        logger.error('비밀번호 재설정 실패', error as Error);
        addToast({
          type: 'error',
          message: extractUserMessage(error) || '이메일 발송에 실패했습니다.',
        });
        throw error; // Form에서 에러 상태 처리를 위해 다시 throw
      } finally {
        setIsLoading(false);
      }
    },
    [addToast]
  );

  const handleBack = () => {
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark">
      {/* 헤더 */}
      <View className="flex-row items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-surface-overlay">
        <Pressable onPress={handleBack} className="p-2 -ml-2" accessibilityLabel="뒤로가기">
          <ChevronLeftIcon size={24} />
        </Pressable>
        <Text className="text-lg font-semibold text-gray-900 dark:text-white">비밀번호 찾기</Text>
        <View className="w-8" />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          className="px-6 py-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ForgotPasswordForm onSubmit={handleSubmit} isLoading={isLoading} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
