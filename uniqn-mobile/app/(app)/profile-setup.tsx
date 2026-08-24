/**
 * UNIQN Mobile - 프로필 완성 화면
 *
 * @description 회원가입 후 첫 진입 시 닉네임(필수) + 선택 필드 입력
 *              profileCompleted = false인 사용자에게만 표시
 * @version 1.1.0 - 죽은 '이전'(토스트만) → 로그아웃 출구로 교체 + 안드로이드 물리 백 위임
 */

import { useState, useCallback, useEffect } from 'react';
import { View, Text, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { router, useLocalSearchParams } from 'expo-router';
import { SignupStepProfile } from '@/components/auth/signup/SignupStepProfile';
import { completeProfile, checkNicknameExists, getUserProfile, signOut } from '@/services/auth';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/stores/toastStore';
import { normalizePostAuthRedirect } from '@/shared/navigation/authRedirect';
import { confirmAction } from '@/utils/confirmAction';
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
  const resetAuthStore = useAuthStore((s) => s.reset);
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const postAuthRedirect = normalizePostAuthRedirect(redirect);
  // 2026-05-16: PortOne 본인인증에서 gender 가 누락된 사용자에게만 입력 필드 노출 + 필수 검증.
  // 본인인증으로 이미 채워진 사용자는 SignupStepProfile 의 성별 섹션을 보지 않는다.
  const requireGender = !profile?.gender;

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

        // 프로필 완성 (gender 는 본인인증 누락 시에만 전달; 서비스 레이어가 set-once 보호)
        await completeProfile({
          nickname: data.nickname,
          region: data.region,
          experienceYears: data.experienceYears,
          career: data.career,
          note: data.note,
          gender: requireGender ? data.gender : undefined,
        });

        // 프로필 갱신
        const updatedProfile = await getUserProfile(user.uid);
        if (updatedProfile) {
          setProfile(toStoreProfile(updatedProfile));
        }

        toast.success('프로필이 완성되었습니다!');
        router.replace(postAuthRedirect ?? '/(app)/(tabs)/home-jobs');
      } catch (error) {
        logger.error('프로필 완성 실패', error as Error, {
          component: 'ProfileSetupScreen',
        });
        toast.error('프로필 저장에 실패했습니다. 다시 시도해주세요.');
      } finally {
        setIsLoading(false);
      }
    },
    [postAuthRedirect, user, setProfile, toast, requireGender]
  );

  /**
   * 화면 이탈 = 로그아웃.
   *
   * 이 화면은 사방이 막혀 있다 — `(app)/_layout.tsx` 가 gestureEnabled:false 로 스와이프
   * 백을 막고, `useAuthGuard` 가 profileCompleted=false 사용자를 다른 경로에서 여기로
   * 되돌린다. 게다가 `handle_new_user` 가 profile_completed 를 DEFAULT false 로 굳히므로
   * **신규 가입자는 100% 이 화면을 거친다.** 예전 '이전' 버튼은 토스트만 띄우는 잔해라
   * (커밋 1d7b2a950), 계정을 잘못 만든 걸 여기서 깨달아도 앱 삭제 외에 방법이 없었다.
   *
   * 가드를 뚫는 대신 세션을 끊어 나간다 — 출구는 signOut 경유만이어야 한다.
   * 참고 형판: `app/(auth)/signup.tsx` 의 social/reverify 이탈 처리.
   */
  const handleExit = useCallback(() => {
    // 저장 진행 중에는 이탈 무시 — completeProfile 과 signOut 이 동시에 돌면
    // 프로필이 절반만 저장된 채 세션이 끊기는 race 가 생긴다.
    if (isLoading) return;

    confirmAction({
      title: '로그아웃할까요?',
      message:
        '계정은 그대로 남아 있고, 다시 로그인하면 여기서 이어서 진행할 수 있어요.\n지금 입력한 내용은 저장되지 않아요.',
      confirmText: '로그아웃',
      cancelText: '계속 작성',
      destructive: true,
      onConfirm: async () => {
        try {
          await signOut();
        } catch (error) {
          // signOut 이 실패해 스토리지에 세션이 남아도 계정은 사라지지 않는다.
          // 다만 재로그인하면 useAuthGuard 가 profileCompleted=false 를 다시 감지해
          // 이 화면으로 돌려보낸다 — 사용자에게 약속한 "이어서 진행"과 같은 결과라
          // 이탈 자체는 막지 않고 계속 진행한다.
          logger.warn('프로필 설정 이탈 signOut 실패', {
            component: 'ProfileSetupScreen',
            error: error instanceof Error ? error.message : String(error),
          });
        } finally {
          resetAuthStore();
          router.replace(
            postAuthRedirect
              ? `/(auth)/login?redirect=${encodeURIComponent(postAuthRedirect)}`
              : '/(auth)/login'
          );
        }
      },
    });
  }, [isLoading, postAuthRedirect, resetAuthStore]);

  // 안드로이드 물리 백 — 가드가 어차피 되돌려 보내지만, 인터셉트가 없으면 확인 없이
  // router.back() 이 먼저 튀어 화면이 깜빡인다. 버튼·제스처·물리 백 세 출구를
  // 하나의 흐름(handleExit)으로 모은다. (형판: app/(auth)/signup.tsx)
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleExit();
      return true;
    });
    return () => subscription.remove();
  }, [handleExit]);

  return (
    <SafeAreaView className="flex-1 bg-surface-card">
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={20}
      >
        <View className="flex-1 p-4">
          {/* 헤더 — 가입 진행률 연속성: 마지막 단계임을 명시 (QW8) */}
          <View className="mb-6">
            <Text className="mb-1 text-xs font-sans-semibold text-primary-600 dark:text-primary-400">
              마지막 단계
            </Text>
            <Text className="text-2xl font-display text-content-primary dark:text-off-white mb-2">
              프로필 설정
            </Text>
            <Text className="text-sm text-content-secondary font-sans">
              프로필을 완성하면 가입이 끝나요.
            </Text>
          </View>

          {/* 프로필 폼 — SignupStepProfile 의 유일한 소비처 */}
          <SignupStepProfile
            onNext={handleSubmit}
            onExit={handleExit}
            isLoading={isLoading}
            requireGender={requireGender}
          />
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
