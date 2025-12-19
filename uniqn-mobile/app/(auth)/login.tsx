/**
 * UNIQN Mobile - Login Screen
 * 로그인 화면
 *
 * @version 2.0.0
 */

import { useState, useCallback } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Divider } from '@/components/ui';
import { LoginForm, SocialLoginButtons } from '@/components/auth';
import { login, signInWithApple, signInWithGoogle, signInWithKakao } from '@/services';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import type { LoginFormData } from '@/schemas';

type SocialProvider = 'apple' | 'google' | 'kakao';

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(null);
  const { addToast } = useToastStore();

  // 이메일 로그인
  const handleLogin = useCallback(async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const result = await login(data);
      if (result.user) {
        logger.info('로그인 성공', { userId: result.user.uid });
        addToast({ type: 'success', message: '로그인되었습니다.' });
        router.replace('/(app)/(tabs)');
      }
    } catch (error) {
      logger.error('로그인 실패', error as Error);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '로그인에 실패했습니다.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  // Apple 로그인
  const handleAppleLogin = useCallback(async () => {
    setLoadingProvider('apple');
    try {
      const result = await signInWithApple();
      if (result.user) {
        logger.info('Apple 로그인 성공', { userId: result.user.uid });
        addToast({ type: 'success', message: '로그인되었습니다.' });
        router.replace('/(app)/(tabs)');
      }
    } catch (error) {
      logger.error('Apple 로그인 실패', error as Error);
      addToast({
        type: 'error',
        message: 'Apple 로그인에 실패했습니다.',
      });
    } finally {
      setLoadingProvider(null);
    }
  }, [addToast]);

  // Google 로그인
  const handleGoogleLogin = useCallback(async () => {
    setLoadingProvider('google');
    try {
      const result = await signInWithGoogle();
      if (result.user) {
        logger.info('Google 로그인 성공', { userId: result.user.uid });
        addToast({ type: 'success', message: '로그인되었습니다.' });
        router.replace('/(app)/(tabs)');
      }
    } catch (error) {
      logger.error('Google 로그인 실패', error as Error);
      addToast({
        type: 'error',
        message: 'Google 로그인에 실패했습니다.',
      });
    } finally {
      setLoadingProvider(null);
    }
  }, [addToast]);

  // Kakao 로그인
  const handleKakaoLogin = useCallback(async () => {
    setLoadingProvider('kakao');
    try {
      const result = await signInWithKakao();
      if (result.user) {
        logger.info('Kakao 로그인 성공', { userId: result.user.uid });
        addToast({ type: 'success', message: '로그인되었습니다.' });
        router.replace('/(app)/(tabs)');
      }
    } catch (error) {
      logger.error('Kakao 로그인 실패', error as Error);
      addToast({
        type: 'error',
        message: '카카오 로그인에 실패했습니다.',
      });
    } finally {
      setLoadingProvider(null);
    }
  }, [addToast]);

  const isSocialLoading = loadingProvider !== null;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
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
          {/* 로고 */}
          <View className="mb-10 items-center">
            <Text className="text-4xl font-bold text-primary-600 dark:text-primary-400">
              UNIQN
            </Text>
            <Text className="mt-2 text-gray-500 dark:text-gray-400">
              홀덤 스태프 플랫폼
            </Text>
          </View>

          {/* 로그인 폼 */}
          <LoginForm
            onSubmit={handleLogin}
            isLoading={isLoading || isSocialLoading}
          />

          <Divider label="또는" spacing="lg" />

          {/* 소셜 로그인 */}
          <SocialLoginButtons
            onAppleLogin={handleAppleLogin}
            onGoogleLogin={handleGoogleLogin}
            onKakaoLogin={handleKakaoLogin}
            isLoading={isLoading}
            loadingProvider={loadingProvider}
            disabled={isLoading}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
