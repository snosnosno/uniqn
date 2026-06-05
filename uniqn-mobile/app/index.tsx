/**
 * UNIQN Mobile - Splash Screen
 * Root entry splash that forwards to the authenticated or login flow.
 */

import { useEffect, useRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { APP_VERSION } from '@/constants/version';
import { PRIMARY_COLORS } from '@/constants/colors';
import { isPhoneOnlySignupAuthUser } from '@/shared/auth/sessionState';
import {
  AUTH_ENTRY_ROUTES,
  AUTH_LOGIN_ROUTE,
  getAuthenticatedEntryRoute,
} from '@/shared/navigation/authRedirect';
import { selectIsLoading, useAuthStore } from '@/stores/authStore';
import { selectStartupPhase, useAppStartupStore } from '@/stores/appStartupStore';
import { useThemeStore } from '@/stores/themeStore';

const LOGO_SOURCE = require('../assets/1024.png');
const LOGO_SIZE = 160;
const SPLASH_REDIRECT_DELAY_MS = 500;
const PROFILE_RETRY_DELAY_MS = 500;
// 프로필 조회가 지속 실패(orphan/RLS/네트워크)할 때 무한 재시도+배터리 소모를 막는 상한.
const MAX_PROFILE_RETRIES = 5;

const SPINNER_COLOR = {
  light: PRIMARY_COLORS[300],
  dark: PRIMARY_COLORS[200],
} as const;

export default function SplashScreen() {
  const startupPhase = useAppStartupStore(selectStartupPhase);
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const isAuthLoading = useAuthStore(selectIsLoading);
  const checkAuthState = useAuthStore((state) => state.checkAuthState);
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const profileRetryCountRef = useRef(0);

  const authenticatedEntryRoute = getAuthenticatedEntryRoute({
    socialProvider: profile?.socialProvider ?? null,
    phoneVerified: profile?.phoneVerified ?? null,
    profileCompleted: profile?.profileCompleted ?? null,
    identityVerified: profile?.identityVerified ?? null,
  });
  const isPhoneOnlySignupPending = isPhoneOnlySignupAuthUser(user);

  useEffect(() => {
    if (startupPhase !== 'resolved') {
      return;
    }

    if (user && !profile) {
      if (isPhoneOnlySignupPending) {
        const timer = setTimeout(() => {
          router.replace(AUTH_ENTRY_ROUTES.signup);
        }, SPLASH_REDIRECT_DELAY_MS);

        return () => clearTimeout(timer);
      }

      if (isAuthLoading) {
        return; // 로딩 중 — 다음 상태 변화 대기
      }

      // 프로필 조회 재시도. setUser가 매 호출 새 user 객체를 만들어 effect가 재실행되므로
      // 상한이 없으면 500ms마다 무한 재시도된다. MAX 회 초과 시 재시도를 멈추고 아래
      // 리다이렉트로 이탈해 무한 splash + 배터리 소모를 차단한다.
      if (profileRetryCountRef.current < MAX_PROFILE_RETRIES) {
        profileRetryCountRef.current += 1;
        const retryTimer = setTimeout(() => {
          void checkAuthState();
        }, PROFILE_RETRY_DELAY_MS);

        return () => clearTimeout(retryTimer);
      }
      // 재시도 소진 → 아래 인증 진입 라우트로 이탈(프로필 미완성 시 setup/login으로 안내)
    }

    const timer = setTimeout(() => {
      router.replace(user ? authenticatedEntryRoute : AUTH_LOGIN_ROUTE);
    }, SPLASH_REDIRECT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [
    authenticatedEntryRoute,
    checkAuthState,
    isAuthLoading,
    isPhoneOnlySignupPending,
    profile,
    startupPhase,
    user,
  ]);

  return (
    <View className="flex-1 items-center justify-center bg-surface-dark">
      <View className="items-center">
        <Image
          source={LOGO_SOURCE}
          style={{ width: LOGO_SIZE, height: LOGO_SIZE }}
          contentFit="contain"
        />

        <Text className="mt-5 text-lg font-display tracking-widest text-primary-400">UNIQN</Text>
        <Text className="mt-1 text-sm text-secondary-500 font-sans">홀덤 스태프 매칭 플랫폼</Text>

        <ActivityIndicator
          size="large"
          color={isDarkMode ? SPINNER_COLOR.dark : SPINNER_COLOR.light}
          className="mt-8"
        />
      </View>

      <Text className="absolute bottom-12 text-xs text-content-muted font-sans">
        v{APP_VERSION}
      </Text>
    </View>
  );
}
