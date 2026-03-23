import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Divider } from '@/components/ui';
import { BiometricButton, LoginForm, SocialLoginButtons } from '@/components/auth';
import { useAutoLogin, useBiometricAuth, AUTO_LOGIN_HELPER_TEXT } from '@/hooks';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { login, signInWithApple, signOut, type AuthResult } from '@/services';
import { extractErrorMessage } from '@/shared/errors';
import {
  getResolvedAuthenticatedRoute,
  normalizePostAuthRedirect,
} from '@/shared/navigation/authRedirect';
import { logger } from '@/utils/logger';
import { toStoreProfile } from '@/utils/profileConverter';
import type { LoginFormData } from '@/schemas';

export default function LoginScreen() {
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<'apple' | null>(null);
  const [loginAutoLoginEnabled, setLoginAutoLoginEnabled] = useState(true);
  const { addToast } = useToastStore();
  const { setUser, setProfile } = useAuthStore();
  const {
    autoLoginEnabled: storedAutoLoginEnabled,
    setAutoLoginEnabled,
    isLoading: isAutoLoginLoading,
  } = useAutoLogin();
  const {
    isEnabled: isBiometricEnabled,
    isAvailable: isBiometricAvailable,
    isAuthenticating: isBiometricAuthenticating,
    biometricTypeName,
    loginWithBiometric,
    updateCredentials: updateBiometricCredentials,
  } = useBiometricAuth();
  const postAuthRedirect = normalizePostAuthRedirect(redirect);

  useEffect(() => {
    setLoginAutoLoginEnabled(storedAutoLoginEnabled);
  }, [storedAutoLoginEnabled]);

  const persistAutoLoginPreference = useCallback(async () => {
    await setAutoLoginEnabled(loginAutoLoginEnabled);
  }, [loginAutoLoginEnabled, setAutoLoginEnabled]);

  const handleLoginSuccess = useCallback(
    async (result: AuthResult, providerLabel: string) => {
      setUser(result.user);
      setProfile(toStoreProfile(result.profile));

      try {
        await updateBiometricCredentials();
      } catch (error) {
        logger.warn('생체인증 자격 증명 갱신 실패', { error });
      }

      logger.info(`${providerLabel} 로그인 성공`, { userId: result.user.uid });
      addToast({ type: 'success', message: '로그인되었습니다.' });
      router.replace(
        getResolvedAuthenticatedRoute({
          socialProvider: result.profile.socialProvider,
          phoneVerified: result.profile.phoneVerified,
          profileCompleted: result.profile.profileCompleted,
          redirect: postAuthRedirect,
        })
      );
    },
    [addToast, postAuthRedirect, setProfile, setUser, updateBiometricCredentials]
  );

  const handleBiometricLogin = useCallback(async () => {
    const success = await loginWithBiometric();
    if (success) {
      router.replace(postAuthRedirect ?? '/(app)/(tabs)');
    }
  }, [loginWithBiometric, postAuthRedirect]);

  const handleLogin = useCallback(
    async (data: LoginFormData) => {
      setIsLoading(true);
      try {
        const result = await login(data);
        if (result.user) {
          try {
            await persistAutoLoginPreference();
          } catch (preferenceError) {
            await signOut();
            throw preferenceError;
          }

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
    [addToast, handleLoginSuccess, persistAutoLoginPreference]
  );

  const handleAppleLogin = useCallback(async () => {
    setLoadingProvider('apple');
    try {
      const result = await signInWithApple();
      if (!result.user) {
        return;
      }

      try {
        await persistAutoLoginPreference();
      } catch (preferenceError) {
        await signOut();
        throw preferenceError;
      }

      if (result.profile.socialProvider && !result.profile.phoneVerified) {
        setUser(result.user);
        setProfile(toStoreProfile(result.profile));
        router.replace(
          getResolvedAuthenticatedRoute({
            socialProvider: result.profile.socialProvider,
            phoneVerified: result.profile.phoneVerified,
            profileCompleted: result.profile.profileCompleted,
            redirect: postAuthRedirect,
          })
        );
        return;
      }

      await handleLoginSuccess(result, 'Apple');
    } catch (error) {
      const userMessage = (error as { userMessage?: string })?.userMessage;
      if (userMessage !== '') {
        logger.error('Apple 로그인 실패', error as Error);
        addToast({ type: 'error', message: userMessage || 'Apple 로그인에 실패했습니다.' });
      }
    } finally {
      setLoadingProvider(null);
    }
  }, [
    addToast,
    handleLoginSuccess,
    persistAutoLoginPreference,
    postAuthRedirect,
    setProfile,
    setUser,
  ]);

  const authActionDisabled = isAutoLoginLoading;
  const isSocialLoading = loadingProvider !== null;
  const shouldShowBiometric = loginAutoLoginEnabled && isBiometricEnabled && isBiometricAvailable;

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
          <View className="mb-10 items-center">
            <Text className="text-4xl font-bold text-primary-600 dark:text-primary-400">UNIQN</Text>
            <Text className="mt-2 text-gray-500 dark:text-gray-400">안전한 스태프 채용 플랫폼</Text>
          </View>

          {shouldShowBiometric ? (
            <View className="mb-6">
              <BiometricButton
                onPress={handleBiometricLogin}
                isLoading={isBiometricAuthenticating}
                disabled={isLoading || isSocialLoading || authActionDisabled}
                variant="default"
                size="lg"
                className="w-full"
              />
              <Text className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
                {biometricTypeName}으로 빠르게 로그인하세요
              </Text>
              <Divider label="또는 이메일로" spacing="md" />
            </View>
          ) : null}

          <LoginForm
            onSubmit={handleLogin}
            autoLoginEnabled={loginAutoLoginEnabled}
            onAutoLoginChange={setLoginAutoLoginEnabled}
            autoLoginDisabled={authActionDisabled}
            autoLoginHelperText={AUTO_LOGIN_HELPER_TEXT}
            isLoading={isLoading || isSocialLoading || isBiometricAuthenticating}
            disabled={authActionDisabled}
          />

          {Platform.OS === 'ios' ? (
            <>
              <Divider label="또는" spacing="lg" />
              <SocialLoginButtons
                onAppleLogin={handleAppleLogin}
                isLoading={isLoading || isSocialLoading || isBiometricAuthenticating}
                loadingProvider={loadingProvider}
                disabled={
                  isLoading || isSocialLoading || isBiometricAuthenticating || authActionDisabled
                }
              />
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
