/**
 * UNIQN Mobile - 소셜 로그인 버튼 컴포넌트
 *
 * @description Apple, Google, Kakao 소셜 로그인 버튼
 * @version 1.1.0
 *
 * @note 소셜 로그인 SDK가 구현되기 전까지 프로덕션에서는 숨김 처리
 */

import React from 'react';
import { View, Text, Pressable, Platform, ActivityIndicator } from 'react-native';
import Constants from 'expo-constants';

// ============================================================================
// Types
// ============================================================================

type SocialProvider = 'apple' | 'google' | 'kakao';

interface SocialLoginButtonsProps {
  onAppleLogin?: () => Promise<void>;
  onGoogleLogin?: () => Promise<void>;
  onKakaoLogin?: () => Promise<void>;
  isLoading?: boolean;
  loadingProvider?: SocialProvider | null;
  disabled?: boolean;
}

interface SocialButtonConfig {
  provider: SocialProvider;
  label: string;
  icon: string;
  bgColor: string;
  textColor: string;
  borderColor?: string;
  showOn: ('ios' | 'android' | 'web')[];
}

// ============================================================================
// Constants
// ============================================================================

const SOCIAL_BUTTONS: SocialButtonConfig[] = [
  {
    provider: 'apple',
    label: 'Apple로 계속하기',
    icon: '', // Apple 아이콘
    bgColor: 'bg-black dark:bg-white',
    textColor: 'text-white dark:text-black',
    showOn: ['ios', 'web'],
  },
  {
    provider: 'google',
    label: 'Google로 계속하기',
    icon: 'G',
    bgColor: 'bg-white dark:bg-surface',
    textColor: 'text-gray-900 dark:text-white',
    borderColor: 'border border-gray-300 dark:border-surface-overlay',
    showOn: ['ios', 'android', 'web'],
  },
  {
    provider: 'kakao',
    label: '카카오로 계속하기',
    icon: '💬',
    bgColor: 'bg-[#FEE500]',
    textColor: 'text-[#191919]',
    showOn: ['ios', 'android', 'web'],
  },
];

// ============================================================================
// Feature Flag
// ============================================================================

/**
 * 소셜 로그인 활성화 여부
 * - 개발 환경(__DEV__): 항상 활성화 (Mock 로그인 사용)
 * - 프로덕션: app.config.ts의 socialLoginEnabled 설정에 따름
 *
 * SDK 구현 완료 후 이 플래그를 true로 변경
 */
const SOCIAL_LOGIN_ENABLED = __DEV__ || Constants.expoConfig?.extra?.socialLoginEnabled === true;

// ============================================================================
// Component
// ============================================================================

export function SocialLoginButtons({
  onAppleLogin,
  onGoogleLogin,
  onKakaoLogin,
  isLoading = false,
  loadingProvider = null,
  disabled = false,
}: SocialLoginButtonsProps) {
  // 프로덕션에서 소셜 로그인 비활성화 시 렌더링하지 않음
  if (!SOCIAL_LOGIN_ENABLED) {
    return null;
  }

  const currentPlatform = Platform.OS as 'ios' | 'android' | 'web';

  const getHandler = (provider: SocialProvider) => {
    switch (provider) {
      case 'apple':
        return onAppleLogin;
      case 'google':
        return onGoogleLogin;
      case 'kakao':
        return onKakaoLogin;
      default:
        return undefined;
    }
  };

  const visibleButtons = SOCIAL_BUTTONS.filter((button) => button.showOn.includes(currentPlatform));

  if (visibleButtons.length === 0) {
    return null;
  }

  return (
    <View className="w-full flex-col gap-3">
      {visibleButtons.map((button) => {
        const handler = getHandler(button.provider);
        const isButtonLoading = loadingProvider === button.provider;
        const isButtonDisabled = disabled || isLoading || !handler;

        return (
          <Pressable
            key={button.provider}
            onPress={handler}
            disabled={isButtonDisabled}
            className={`
              flex-row items-center justify-center
              py-3 px-4 rounded-lg min-h-[48px]
              ${button.bgColor}
              ${button.borderColor || ''}
              ${isButtonDisabled ? 'opacity-50' : ''}
            `}
          >
            {isButtonLoading ? (
              <ActivityIndicator
                size="small"
                color={button.provider === 'kakao' ? '#191919' : undefined}
              />
            ) : (
              <>
                <Text className="text-lg mr-2">{button.icon}</Text>
                <Text className={`font-medium text-base ${button.textColor}`}>{button.label}</Text>
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export default SocialLoginButtons;
