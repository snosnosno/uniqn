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
import { Timestamp } from 'firebase/firestore';
import { Divider } from '@/components/ui';
import { LoginForm, SocialLoginButtons } from '@/components/auth';
import { login, signInWithApple, signInWithGoogle, signInWithKakao } from '@/services';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore, type UserProfile as StoreUserProfile } from '@/stores/authStore';
import { logger } from '@/utils/logger';
import type { LoginFormData } from '@/schemas';

/**
 * Timestamp를 Date로 변환하는 헬퍼 함수
 */
function toDate(value: Timestamp | Date | unknown): Date {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (value instanceof Date) {
    return value;
  }
  return new Date();
}

type SocialProvider = 'apple' | 'google' | 'kakao';

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(null);
  const { addToast } = useToastStore();
  const { setUser, setProfile } = useAuthStore();

  // 이메일 로그인
  const handleLogin = useCallback(async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const result = await login(data);
      if (result.user) {
        // authStore 업데이트 (Timestamp → Date 변환)
        setUser(result.user);
        const storeProfile: StoreUserProfile = {
          uid: result.profile.uid,
          email: result.profile.email,
          name: result.profile.name,
          nickname: result.profile.nickname,
          phone: result.profile.phone,
          role: result.profile.role,
          photoURL: result.profile.photoURL,
          createdAt: toDate(result.profile.createdAt),
          updatedAt: toDate(result.profile.updatedAt),
        };
        setProfile(storeProfile);

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
  }, [addToast, setUser, setProfile]);

  // 소셜 로그인 공통 처리
  const handleSocialLoginSuccess = useCallback(
    (result: { user: { uid: string }; profile: { uid: string; email: string; name: string; nickname?: string; phone?: string; role: 'staff' | 'employer' | 'admin'; photoURL?: string; createdAt: Timestamp | Date; updatedAt: Timestamp | Date } }, provider: string) => {
      // authStore 업데이트 (Timestamp → Date 변환)
      setUser(result.user as import('firebase/auth').User);
      const storeProfile: StoreUserProfile = {
        uid: result.profile.uid,
        email: result.profile.email,
        name: result.profile.name,
        nickname: result.profile.nickname,
        phone: result.profile.phone,
        role: result.profile.role,
        photoURL: result.profile.photoURL,
        createdAt: toDate(result.profile.createdAt),
        updatedAt: toDate(result.profile.updatedAt),
      };
      setProfile(storeProfile);

      logger.info(`${provider} 로그인 성공`, { userId: result.user.uid });
      addToast({ type: 'success', message: '로그인되었습니다.' });
      router.replace('/(app)/(tabs)');
    },
    [setUser, setProfile, addToast]
  );

  // Apple 로그인
  const handleAppleLogin = useCallback(async () => {
    setLoadingProvider('apple');
    try {
      const result = await signInWithApple();
      if (result.user) {
        handleSocialLoginSuccess(result, 'Apple');
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
  }, [addToast, handleSocialLoginSuccess]);

  // Google 로그인
  const handleGoogleLogin = useCallback(async () => {
    setLoadingProvider('google');
    try {
      const result = await signInWithGoogle();
      if (result.user) {
        handleSocialLoginSuccess(result, 'Google');
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
  }, [addToast, handleSocialLoginSuccess]);

  // Kakao 로그인
  const handleKakaoLogin = useCallback(async () => {
    setLoadingProvider('kakao');
    try {
      const result = await signInWithKakao();
      if (result.user) {
        handleSocialLoginSuccess(result, 'Kakao');
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
  }, [addToast, handleSocialLoginSuccess]);

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
