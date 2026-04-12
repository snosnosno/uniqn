/**
 * UNIQN Mobile - 프로필 완성 화면
 *
 * @description 회원가입 후 첫 진입 시 닉네임(필수) + 선택 필드 입력
 *              profileCompleted = false인 사용자에게만 표시
 * @version 1.0.0
 */

import { useState, useCallback } from 'react';
import { View, Text, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { router, useLocalSearchParams } from 'expo-router';
import { SignupStepProfile } from '@/components/auth/signup/SignupStepProfile';
import { completeProfile, checkNicknameExists, getUserProfile } from '@/services/auth';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/stores/toastStore';
import { normalizePostAuthRedirect } from '@/shared/navigation/authRedirect';
import { toStoreProfile } from '@/utils/profileConverter';
import { logger } from '@/utils/logger';
import type { SignUpProfileData } from '@/schemas';

// ============================================================================
// Component
// ============================================================================

export default function ProfileSetupScreen() {
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();
  const setProfile = useAuthStore((s) => s.setProfile);
  const user = useAuthStore((s) => s.user);
  const postAuthRedirect = normalizePostAuthRedirect(redirect);

  const handleSubmit = useCallback(
    async (data: SignUpProfileData) => {
      if (!user) return;

      setIsLoading(true);
      try {
        // 닉네임 중복 체크
        const nicknameExists = await checkNicknameExists(data.nickname);
        if (nicknameExists) {
          toast.error('이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해주세요.');
          setIsLoading(false);
          return;
        }

        // 프로필 완성
        await completeProfile({
          nickname: data.nickname,
          region: data.region,
          experienceYears: data.experienceYears,
          career: data.career,
          note: data.note,
        });

        // 프로필 갱신
        const updatedProfile = await getUserProfile(user.uid);
        if (updatedProfile) {
          setProfile(toStoreProfile(updatedProfile));
        }

        toast.success('프로필이 완성되었습니다!');
        router.replace(postAuthRedirect ?? '/(app)/(tabs)');
      } catch (error) {
        logger.error('프로필 완성 실패', error as Error, {
          component: 'ProfileSetupScreen',
        });
        toast.error('프로필 저장에 실패했습니다. 다시 시도해주세요.');
      } finally {
        setIsLoading(false);
      }
    },
    [postAuthRedirect, user, setProfile, toast]
  );

  // 뒤로가기 방지 (프로필 완성 필수)
  const handleBack = useCallback(() => {
    toast.info('프로필을 완성해야 서비스를 이용할 수 있습니다.');
  }, [toast]);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface">
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid
        enableAutomaticScroll
        extraScrollHeight={Platform.OS === 'ios' ? 20 : 100}
        keyboardOpeningTime={0}
      >
        <View className="flex-1 p-4">
          {/* 헤더 */}
          <View className="mb-6">
            <Text className="text-2xl font-bold text-secondary-900 dark:text-off-white mb-2">
              프로필 설정
            </Text>
            <Text className="text-sm text-secondary-500 dark:text-secondary-400">
              서비스 이용을 위해 프로필을 완성해주세요.
            </Text>
          </View>

          {/* 프로필 폼 (기존 SignupStepProfile 재사용) */}
          <SignupStepProfile onNext={handleSubmit} onBack={handleBack} isLoading={isLoading} />
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
