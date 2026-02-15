/**
 * UNIQN Mobile - SignUp Screen
 * 4단계 회원가입 화면
 *
 * @description 계정 → 본인인증 → 프로필 → 약관동의
 * @version 2.0.0
 */

import { useState, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Timestamp } from '@/lib/firebase';
import { SignupForm } from '@/components/auth';
import { signUp } from '@/services';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore, type UserProfile as StoreUserProfile } from '@/stores/authStore';
import { logger } from '@/utils/logger';
import type { SignUpFormData } from '@/schemas';

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

export default function SignUpScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const { addToast } = useToastStore();
  const { setUser, setProfile } = useAuthStore();

  const handleSignUp = useCallback(
    async (data: SignUpFormData) => {
      setIsLoading(true);
      try {
        const result = await signUp(data);

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
            // 본인인증 정보 (Step 2)
            phoneVerified: result.profile.phoneVerified,
            birthDate: result.profile.birthDate,
            gender: result.profile.gender,
            // 동의 정보
            termsAgreed: result.profile.termsAgreed,
            privacyAgreed: result.profile.privacyAgreed,
            marketingAgreed: result.profile.marketingAgreed,
            // 메타데이터
            createdAt: toDate(result.profile.createdAt),
            updatedAt: toDate(result.profile.updatedAt),
          };
          setProfile(storeProfile);

          logger.info('회원가입 성공', { userId: result.user.uid });
          addToast({ type: 'success', message: '회원가입이 완료되었습니다!' });
          router.replace('/(app)/(tabs)');
        }
      } catch (error) {
        logger.error('회원가입 실패', error as Error);
        addToast({
          type: 'error',
          message: error instanceof Error ? error.message : '회원가입에 실패했습니다.',
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

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark">
      {/* 헤더 */}
      <View className="flex-row items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-surface-overlay">
        <Pressable onPress={handleBack} className="p-2 -ml-2">
          <Text className="text-gray-600 dark:text-gray-400 text-lg">←</Text>
        </Pressable>
        <Text className="text-lg font-semibold text-gray-900 dark:text-white">회원가입</Text>
        <View className="w-8" />
      </View>

      {/* 회원가입 폼 */}
      <SignupForm onSubmit={handleSignUp} isLoading={isLoading} />
    </SafeAreaView>
  );
}
