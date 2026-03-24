/**
 * UNIQN Mobile - SignUp Screen
 * 3단계 회원가입 화면
 *
 * @description 약관동의 → 계정 → 본인인증 → 가입완료
 *              소셜 모드: 약관동의 → 본인인증 → 가입완료 (계정 생략)
 *              프로필(닉네임 등)은 가입 후 profile-setup 화면에서 입력
 * @version 3.0.0
 */

import { useState, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SignupForm } from '@/components/auth';
import { markCurrentAutoLoginSession } from '@/lib/autoLoginSession';
import { signUp, completeSocialProfile, getCurrentUser } from '@/services';
import { ChevronLeftIcon } from '@/components/icons';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import {
  getResolvedAuthenticatedRoute,
  normalizePostAuthRedirect,
} from '@/shared/navigation/authRedirect';
import { logger } from '@/utils/logger';
import { toStoreProfile } from '@/utils/profileConverter';
import { extractUserMessage } from '@/errors';
import type { SignUpFormData } from '@/schemas';

export default function SignUpScreen() {
  const { mode, redirect } = useLocalSearchParams<{ mode?: 'social'; redirect?: string }>();
  const isSocialMode = mode === 'social';
  const postAuthRedirect = normalizePostAuthRedirect(redirect);
  const [isLoading, setIsLoading] = useState(false);
  const { addToast } = useToastStore();
  const { setUser, setProfile, profile } = useAuthStore();

  // 일반 회원가입 핸들러
  const handleSignUp = useCallback(
    async (data: SignUpFormData) => {
      setIsLoading(true);
      try {
        const result = await signUp(data);

        if (result.user) {
          markCurrentAutoLoginSession(result.user.uid);
          setUser(result.user);
          setProfile(toStoreProfile(result.profile));

          logger.info('회원가입 성공', { userId: result.user.uid });
          addToast({ type: 'success', message: '회원가입이 완료되었습니다!' });
          router.replace(
            getResolvedAuthenticatedRoute({
              socialProvider: result.profile.socialProvider,
              phoneVerified: result.profile.phoneVerified,
              profileCompleted: result.profile.profileCompleted,
              redirect: postAuthRedirect,
            })
          );
        }
      } catch (error) {
        logger.error('회원가입 실패', error as Error);
        addToast({
          type: 'error',
          message: extractUserMessage(error),
        });
      } finally {
        setIsLoading(false);
      }
    },
    [addToast, postAuthRedirect, setUser, setProfile]
  );

  // 소셜 로그인 프로필 완성 핸들러
  const handleSocialSignUp = useCallback(
    async (data: SignUpFormData) => {
      setIsLoading(true);
      try {
        const user = getCurrentUser();
        if (!user) {
          addToast({ type: 'error', message: '인증 정보가 없습니다. 다시 로그인해주세요.' });
          router.replace(
            postAuthRedirect
              ? `/(auth)/login?redirect=${encodeURIComponent(postAuthRedirect)}`
              : '/(auth)/login'
          );
          return;
        }

        const result = await completeSocialProfile(user.uid, {
          name: data.name,
          birthDate: data.birthDate,
          gender: data.gender,
          phone: data.verifiedPhone || '',
          termsAgreed: data.termsAgreed,
          privacyAgreed: data.privacyAgreed,
          marketingAgreed: data.marketingAgreed,
          verificationId: data.verificationId,
          otpCode: data.otpCode,
        });

        if (result.user) {
          markCurrentAutoLoginSession(result.user.uid);
          setUser(result.user);
          setProfile(toStoreProfile(result.profile));

          logger.info('소셜 프로필 등록 완료', { userId: result.user.uid });
          addToast({ type: 'success', message: '프로필 등록이 완료되었습니다!' });
          router.replace(
            getResolvedAuthenticatedRoute({
              socialProvider: result.profile.socialProvider,
              phoneVerified: result.profile.phoneVerified,
              profileCompleted: result.profile.profileCompleted,
              redirect: postAuthRedirect,
            })
          );
        }
      } catch (error) {
        logger.error('소셜 프로필 등록 실패', error as Error);
        addToast({
          type: 'error',
          message: extractUserMessage(error),
        });
      } finally {
        setIsLoading(false);
      }
    },
    [addToast, postAuthRedirect, setUser, setProfile]
  );

  const handleBack = () => {
    router.back();
  };

  const headerTitle = isSocialMode ? '프로필 등록' : '회원가입';

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark">
      {/* 헤더 */}
      <View className="flex-row items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-surface-overlay">
        <Pressable onPress={handleBack} className="p-2 -ml-2" accessibilityLabel="뒤로가기">
          <ChevronLeftIcon size={24} />
        </Pressable>
        <Text className="text-lg font-semibold text-gray-900 dark:text-white">{headerTitle}</Text>
        <View className="w-8" />
      </View>

      {/* 회원가입 폼 */}
      <SignupForm
        onSubmit={isSocialMode ? handleSocialSignUp : handleSignUp}
        isLoading={isLoading}
        mode={isSocialMode ? 'social' : 'default'}
        socialData={
          isSocialMode
            ? { name: profile?.name, socialProvider: profile?.socialProvider }
            : undefined
        }
      />
    </SafeAreaView>
  );
}
