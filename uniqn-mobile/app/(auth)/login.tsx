/**
 * UNIQN Mobile - Login Screen
 * 로그인 화면
 *
 * @version 2.1.0
 */

import { useState, useCallback } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Divider } from '@/components/ui';
import { LoginForm, SocialLoginButtons, BiometricButton } from '@/components/auth';
import {
  login,
  signInWithApple,
  signInWithGoogle,
  signInWithKakao,
  type AuthResult,
} from '@/services';
import { useBiometricAuth } from '@/hooks';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';
import { toStoreProfile } from '@/utils/profileConverter';
import { extractErrorMessage } from '@/shared/errors';
import type { LoginFormData } from '@/schemas';

type SocialProvider = 'apple' | 'google' | 'kakao';

// 소셜 로그인 활성화 여부 (SocialLoginButtons.tsx와 동일한 조건)
const SOCIAL_LOGIN_ENABLED = __DEV__ || Constants.expoConfig?.extra?.socialLoginEnabled === true;

// 소셜 로그인 설정
const SOCIAL_CONFIG: Record<
  SocialProvider,
  { loginFn: () => Promise<AuthResult>; label: string; errorMessage: string }
> = {
  apple: { loginFn: signInWithApple, label: 'Apple', errorMessage: 'Apple 로그인에 실패했습니다.' },
  google: {
    loginFn: signInWithGoogle,
    label: 'Google',
    errorMessage: 'Google 로그인에 실패했습니다.',
  },
  kakao: {
    loginFn: signInWithKakao,
    label: '카카오',
    errorMessage: '카카오 로그인에 실패했습니다.',
  },
};

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(null);
  const { addToast } = useToastStore();
  const { setUser, setProfile } = useAuthStore();

  // 생체 인증
  const {
    isEnabled: isBiometricEnabled,
    isAvailable: isBiometricAvailable,
    isAuthenticating: isBiometricAuthenticating,
    biometricTypeName,
    loginWithBiometric,
    updateCredentials: updateBiometricCredentials,
  } = useBiometricAuth();

  /**
   * 로그인 성공 후 공통 처리: Store 업데이트 → 생체인증 갱신 → 네비게이션
   */
  const handleLoginSuccess = useCallback(
    async (result: AuthResult, providerLabel: string) => {
      setUser(result.user);
      setProfile(toStoreProfile(result.profile));

      // 생체인증 갱신은 부가 기능 — 실패해도 로그인 차단하지 않음
      try {
        await updateBiometricCredentials();
      } catch (error) {
        logger.warn('생체인증 자격 증명 갱신 실패', { error });
      }

      logger.info(`${providerLabel} 로그인 성공`, { userId: result.user.uid });
      addToast({ type: 'success', message: '로그인되었습니다.' });
      router.replace('/(app)/(tabs)');
    },
    [setUser, setProfile, addToast, updateBiometricCredentials]
  );

  // 생체 인증 로그인 핸들러 (실패 피드백은 useBiometricAuth 내부에서 처리)
  const handleBiometricLogin = useCallback(async () => {
    const success = await loginWithBiometric();
    if (success) {
      router.replace('/(app)/(tabs)');
    }
  }, [loginWithBiometric]);

  // 이메일 로그인
  const handleLogin = useCallback(
    async (data: LoginFormData) => {
      setIsLoading(true);
      try {
        const result = await login(data);
        if (result.user) {
          await handleLoginSuccess(result, '이메일');
        }
      } catch (error) {
        logger.error('로그인 실패', error as Error);
        addToast({
          type: 'error',
          message: extractErrorMessage(error, '로그인에 실패했습니다.'),
        });
      } finally {
        setIsLoading(false);
      }
    },
    [addToast, handleLoginSuccess]
  );

  // 소셜 로그인 (Apple / Google / Kakao 통합)
  const handleSocialLogin = useCallback(
    async (provider: SocialProvider) => {
      const config = SOCIAL_CONFIG[provider];
      setLoadingProvider(provider);
      try {
        const result = await config.loginFn();
        if (result.user) {
          // 신규 소셜 사용자 (프로필 미완성) → 회원가입 플로우로 리다이렉트
          if (result.profile.socialProvider && !result.profile.phoneVerified) {
            setUser(result.user);
            setProfile(toStoreProfile(result.profile));
            router.replace('/(auth)/signup?mode=social');
            return;
          }
          // 기존 사용자 → 정상 로그인
          await handleLoginSuccess(result, config.label);
        }
      } catch (error) {
        // 사용자 취소 판별: userMessage가 빈 문자열이면 취소 (authService에서 명시적 설정)
        const errorMsg = (error as { userMessage?: string })?.userMessage;
        if (errorMsg === '') {
          // 사용자가 인증 다이얼로그를 취소한 경우 — 에러 표시 안 함
          logger.info(`${config.label} 로그인 취소`);
        } else {
          logger.error(`${config.label} 로그인 실패`, error as Error);
          addToast({ type: 'error', message: errorMsg || config.errorMessage });
        }
      } finally {
        setLoadingProvider(null);
      }
    },
    [addToast, handleLoginSuccess, setUser, setProfile]
  );

  const handleAppleLogin = useCallback(() => handleSocialLogin('apple'), [handleSocialLogin]);
  const handleGoogleLogin = useCallback(() => handleSocialLogin('google'), [handleSocialLogin]);
  const handleKakaoLogin = useCallback(() => handleSocialLogin('kakao'), [handleSocialLogin]);

  const isSocialLoading = loadingProvider !== null;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark">
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
            <Text className="text-4xl font-bold text-primary-600 dark:text-primary-400">UNIQN</Text>
            <Text className="mt-2 text-gray-500 dark:text-gray-400">홀덤 스태프 플랫폼</Text>
          </View>

          {/* 생체 인증 버튼 */}
          {isBiometricEnabled && isBiometricAvailable && (
            <View className="mb-6">
              <BiometricButton
                onPress={handleBiometricLogin}
                isLoading={isBiometricAuthenticating}
                disabled={isLoading || isSocialLoading}
                variant="default"
                size="lg"
                className="w-full"
              />
              <Text className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
                {biometricTypeName}으로 빠르게 로그인하세요
              </Text>
              <Divider label="또는 이메일로" spacing="md" />
            </View>
          )}

          {/* 로그인 폼 */}
          <LoginForm
            onSubmit={handleLogin}
            isLoading={isLoading || isSocialLoading || isBiometricAuthenticating}
          />

          {/* 소셜 로그인 (Apple은 iOS에서 항상 표시) */}
          {(SOCIAL_LOGIN_ENABLED || Platform.OS === 'ios') && (
            <>
              <Divider label="또는" spacing="lg" />
              <SocialLoginButtons
                onAppleLogin={handleAppleLogin}
                onGoogleLogin={handleGoogleLogin}
                onKakaoLogin={handleKakaoLogin}
                isLoading={isLoading || isBiometricAuthenticating}
                loadingProvider={loadingProvider}
                disabled={isLoading || isBiometricAuthenticating}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
