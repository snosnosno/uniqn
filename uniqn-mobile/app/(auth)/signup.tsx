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
import { Alert, View, Text, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SignupForm } from '@/components/auth';
import { markCurrentAutoLoginSession } from '@/lib/autoLoginSession';
import {
  signUp,
  completeSocialProfile,
  getCurrentUserAsync,
  callReverifyIdentity,
  getUserProfile,
} from '@/services';
import { ChevronLeftIcon } from '@/components/icons';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import {
  getResolvedAuthenticatedRoute,
  normalizePostAuthRedirect,
} from '@/shared/navigation/authRedirect';
import { logger } from '@/utils/logger';
import { toStoreProfile } from '@/utils/profileConverter';
import { extractUserMessage, isAppError } from '@/errors';
import type { SignUpFormData } from '@/schemas';

/**
 * A3: 회원가입 시 기존 계정이 감지된 경우(PROFILE_ALREADY_COMPLETED) UI 분기.
 * Toast 대신 Alert 으로 사용자에게 로그인 화면 이동/비밀번호 찾기 선택지 제공.
 */
function isProfileAlreadyCompletedError(error: unknown): boolean {
  if (!isAppError(error)) return false;
  const reason = (error.metadata as { reason?: string } | undefined)?.reason;
  return reason === 'PROFILE_ALREADY_COMPLETED';
}

function showAlreadyRegisteredAlert(redirect?: string) {
  Alert.alert(
    '이미 가입된 계정입니다',
    '이 이메일로 가입이 완료되어 있어요.\n로그인 화면에서 비밀번호로 로그인하거나 비밀번호 찾기를 이용해주세요.',
    [
      { text: '취소', style: 'cancel' },
      {
        text: '로그인하기',
        onPress: () =>
          router.replace(
            redirect ? `/(auth)/login?redirect=${encodeURIComponent(redirect)}` : '/(auth)/login'
          ),
      },
    ],
    { cancelable: true }
  );
}

type SignupMode = 'social' | 'reverify';

export default function SignUpScreen() {
  const { mode, redirect } = useLocalSearchParams<{ mode?: SignupMode; redirect?: string }>();
  const isSocialMode = mode === 'social';
  const isReverifyMode = mode === 'reverify';
  const postAuthRedirect = normalizePostAuthRedirect(redirect);
  const [isLoading, setIsLoading] = useState(false);
  const { addToast, clearAllToasts } = useToastStore();
  const { setUser, setProfile } = useAuthStore();

  // 일반 회원가입 핸들러
  const handleSignUp = useCallback(
    async (data: SignUpFormData) => {
      setIsLoading(true);
      try {
        const result = await signUp(data);

        if (result.user) {
          markCurrentAutoLoginSession(result.user.id);
          setUser(result.user);
          setProfile(toStoreProfile(result.profile));

          logger.info('회원가입 성공', { userId: result.user.id });
          // 이전 실패 시도의 stale 에러 토스트 제거 (ISSUE-001 동일 패턴)
          clearAllToasts();
          addToast({ type: 'success', message: '회원가입이 완료되었습니다!' });
          router.replace(
            getResolvedAuthenticatedRoute({
              socialProvider: result.profile.socialProvider,
              phoneVerified: result.profile.phoneVerified,
              profileCompleted: result.profile.profileCompleted,
              identityVerified: result.profile.identityVerified,
              redirect: postAuthRedirect,
            })
          );
        }
      } catch (error) {
        logger.error('회원가입 실패', error as Error);
        // A3: 기존 계정 감지 — Toast 대신 Alert 으로 로그인 화면 안내
        if (isProfileAlreadyCompletedError(error)) {
          showAlreadyRegisteredAlert(postAuthRedirect ?? undefined);
        } else {
          addToast({
            type: 'error',
            message: extractUserMessage(error),
          });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [addToast, clearAllToasts, postAuthRedirect, setUser, setProfile]
  );

  // 소셜 로그인 프로필 완성 핸들러
  const handleSocialSignUp = useCallback(
    async (data: SignUpFormData) => {
      setIsLoading(true);
      try {
        const user = await getCurrentUserAsync();
        if (!user) {
          addToast({ type: 'error', message: '인증 정보가 없습니다. 다시 로그인해주세요.' });
          router.replace(
            postAuthRedirect
              ? `/(auth)/login?redirect=${encodeURIComponent(postAuthRedirect)}`
              : '/(auth)/login'
          );
          return;
        }

        if (!data.identityVerificationId) {
          addToast({ type: 'error', message: '본인인증을 완료해주세요.' });
          return;
        }

        const result = await completeSocialProfile(user.id, {
          name: data.name,
          birthDate: data.birthDate,
          gender: data.gender,
          phone: data.verifiedPhone || '',
          identityVerificationId: data.identityVerificationId,
          termsAgreed: data.termsAgreed,
          privacyAgreed: data.privacyAgreed,
          marketingAgreed: data.marketingAgreed,
        });

        if (result.user) {
          markCurrentAutoLoginSession(result.user.id);
          setUser(result.user);
          setProfile(toStoreProfile(result.profile));

          logger.info('소셜 프로필 등록 완료', { userId: result.user.id });
          // 이전 실패 시도의 stale 에러 토스트 제거 (ISSUE-001 동일 패턴)
          clearAllToasts();
          addToast({ type: 'success', message: '프로필 등록이 완료되었습니다!' });
          router.replace(
            getResolvedAuthenticatedRoute({
              socialProvider: result.profile.socialProvider,
              phoneVerified: result.profile.phoneVerified,
              profileCompleted: result.profile.profileCompleted,
              identityVerified: result.profile.identityVerified,
              redirect: postAuthRedirect,
            })
          );
        }
      } catch (error) {
        logger.error('소셜 프로필 등록 실패', error as Error);
        // A3: 소셜 모드에서도 같은 분기 — 같은 OAuth user 의 profile 이 이미 완료된 케이스
        if (isProfileAlreadyCompletedError(error)) {
          showAlreadyRegisteredAlert(postAuthRedirect ?? undefined);
        } else {
          addToast({
            type: 'error',
            message: extractUserMessage(error),
          });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [addToast, clearAllToasts, postAuthRedirect, setUser, setProfile]
  );

  // 본인인증 재인증 핸들러 (mode=reverify) — 약관/계정 스킵, 본인인증 핵심 필드만 update
  const handleReverify = useCallback(
    async (data: SignUpFormData) => {
      setIsLoading(true);
      try {
        const user = await getCurrentUserAsync();
        if (!user) {
          addToast({ type: 'error', message: '인증 정보가 없습니다. 다시 로그인해주세요.' });
          router.replace(
            postAuthRedirect
              ? `/(auth)/login?redirect=${encodeURIComponent(postAuthRedirect)}`
              : '/(auth)/login'
          );
          return;
        }

        if (!data.identityVerificationId) {
          addToast({ type: 'error', message: '본인인증을 완료해주세요.' });
          return;
        }

        await callReverifyIdentity(data.identityVerificationId);

        // 업데이트된 프로필 동기화
        const refreshedProfile = await getUserProfile(user.id);
        if (refreshedProfile) {
          setProfile(toStoreProfile(refreshedProfile));
        }

        logger.info('본인인증 재인증 완료', { userId: user.id });
        clearAllToasts();
        addToast({ type: 'success', message: '본인인증이 완료되었습니다.' });
        router.replace(
          getResolvedAuthenticatedRoute({
            socialProvider: refreshedProfile?.socialProvider,
            phoneVerified: refreshedProfile?.phoneVerified,
            profileCompleted: refreshedProfile?.profileCompleted,
            identityVerified: refreshedProfile?.identityVerified,
            redirect: postAuthRedirect,
          })
        );
      } catch (error) {
        logger.error('본인인증 재인증 실패', error as Error);
        addToast({ type: 'error', message: extractUserMessage(error) });
      } finally {
        setIsLoading(false);
      }
    },
    [addToast, clearAllToasts, postAuthRedirect, setProfile]
  );

  const handleBack = () => {
    router.back();
  };

  const headerTitle = isReverifyMode ? '본인인증' : isSocialMode ? '프로필 등록' : '회원가입';
  const formMode = isReverifyMode ? 'reverify' : isSocialMode ? 'social' : 'default';
  const handleSubmitForMode = isReverifyMode
    ? handleReverify
    : isSocialMode
      ? handleSocialSignUp
      : handleSignUp;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark">
      {/* 헤더 */}
      <View className="flex-row items-center justify-between px-4 py-2 border-b border-divider">
        <Pressable onPress={handleBack} className="p-2 -ml-2" accessibilityLabel="뒤로가기">
          <ChevronLeftIcon size={24} />
        </Pressable>
        <Text className="text-lg font-display-semibold text-content-primary dark:text-off-white">
          {headerTitle}
        </Text>
        <View className="w-8" />
      </View>

      {/* 회원가입 폼 */}
      <SignupForm onSubmit={handleSubmitForMode} isLoading={isLoading} mode={formMode} />
    </SafeAreaView>
  );
}
