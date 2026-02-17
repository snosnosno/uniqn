/**
 * UNIQN Mobile - SignUp Screen
 * 4단계 회원가입 화면
 *
 * @description 계정 → 본인인증 → 프로필 → 약관동의
 *              소셜 모드: 본인인증 → 프로필 → 약관동의 (Step 1 생략)
 * @version 2.1.0
 */

import { useState, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getFirebaseAuth } from '@/lib/firebase';
import { SignupForm } from '@/components/auth';
import { signUp, completeSocialProfile } from '@/services';
import { ChevronLeftIcon } from '@/components/icons';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';
import { toStoreProfile } from '@/utils/profileConverter';
import { extractUserMessage } from '@/errors';
import type { SignUpFormData } from '@/schemas';

export default function SignUpScreen() {
  const { mode } = useLocalSearchParams<{ mode?: 'social' }>();
  const isSocialMode = mode === 'social';
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
          setUser(result.user);
          setProfile(toStoreProfile(result.profile));

          logger.info('회원가입 성공', { userId: result.user.uid });
          addToast({ type: 'success', message: '회원가입이 완료되었습니다!' });
          router.replace('/(app)/(tabs)');
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
    [addToast, setUser, setProfile]
  );

  // 소셜 로그인 프로필 완성 핸들러
  const handleSocialSignUp = useCallback(
    async (data: SignUpFormData) => {
      setIsLoading(true);
      try {
        const user = getFirebaseAuth().currentUser;
        if (!user) {
          addToast({ type: 'error', message: '인증 정보가 없습니다. 다시 로그인해주세요.' });
          router.replace('/(auth)/login');
          return;
        }

        const result = await completeSocialProfile(user.uid, {
          name: data.name,
          birthDate: data.birthDate,
          gender: data.gender,
          phone: data.verifiedPhone || '',
          nickname: data.nickname,
          region: data.region,
          experienceYears: data.experienceYears,
          career: data.career,
          note: data.note,
          termsAgreed: data.termsAgreed,
          privacyAgreed: data.privacyAgreed,
          marketingAgreed: data.marketingAgreed,
        });

        if (result.user) {
          setUser(result.user);
          setProfile(toStoreProfile(result.profile));

          logger.info('소셜 프로필 등록 완료', { userId: result.user.uid });
          addToast({ type: 'success', message: '프로필 등록이 완료되었습니다!' });
          router.replace('/(app)/(tabs)');
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
    [addToast, setUser, setProfile]
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
        socialData={isSocialMode ? { name: profile?.name } : undefined}
      />
    </SafeAreaView>
  );
}
