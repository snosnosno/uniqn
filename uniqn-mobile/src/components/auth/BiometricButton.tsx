/**
 * UNIQN Mobile - 생체 인증 버튼 컴포넌트
 *
 * @description Face ID / Touch ID 로그인 버튼
 * @version 1.0.0
 */

import React, { memo } from 'react';
import { View, Text, Pressable, ActivityIndicator, Platform } from 'react-native';
import { useBiometricAuth } from '@/hooks';
import { useThemeStore } from '@/stores/themeStore';

// ============================================================================
// Types
// ============================================================================

interface BiometricButtonProps {
  /** 버튼 클릭 핸들러 */
  onPress: () => Promise<void> | void;
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 비활성화 상태 */
  disabled?: boolean;
  /** 스타일 변형 */
  variant?: 'default' | 'outline' | 'ghost';
  /** 버튼 크기 */
  size?: 'sm' | 'md' | 'lg';
  /** 추가 클래스 */
  className?: string;
}

// ============================================================================
// Icons
// ============================================================================

/**
 * Face ID 아이콘
 */
const FaceIdIcon = ({ size = 24, color = '#000' }: { size?: number; color?: string }) => (
  <View
    style={{
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <Text style={{ fontSize: size * 0.8, color }}>{''}</Text>
  </View>
);

/**
 * 지문 아이콘
 */
const FingerprintIcon = ({ size = 24, color = '#000' }: { size?: number; color?: string }) => (
  <View
    style={{
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <Text style={{ fontSize: size * 0.8, color }}>{''}</Text>
  </View>
);

// ============================================================================
// Component
// ============================================================================

/**
 * 생체 인증 버튼
 *
 * @example
 * ```tsx
 * const { loginWithBiometric, isAuthenticating } = useBiometricAuth();
 *
 * <BiometricButton
 *   onPress={loginWithBiometric}
 *   isLoading={isAuthenticating}
 * />
 * ```
 */
export const BiometricButton = memo(function BiometricButton({
  onPress,
  isLoading = false,
  disabled = false,
  variant = 'outline',
  size = 'md',
  className = '',
}: BiometricButtonProps) {
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const { biometricTypeName, status } = useBiometricAuth();
  const primaryColor = isDarkMode ? '#D4AF37' : '#8A7228';

  // 생체 인증 타입에 따른 아이콘 선택
  const isFaceId = status?.biometricTypes.includes('facial');
  const iconSize = size === 'sm' ? 18 : size === 'lg' ? 28 : 22;

  // 버튼 크기 스타일
  const sizeStyles = {
    sm: 'py-2 px-4',
    md: 'py-3 px-5',
    lg: 'py-4 px-6',
  };

  // 버튼 변형 스타일
  const variantStyles = {
    default: 'bg-primary-600 dark:bg-primary-700',
    outline: 'bg-transparent border border-secondary-300 dark:border-surface-overlay',
    ghost: 'bg-transparent',
  };

  // 텍스트 스타일
  const textStyles = {
    default: 'text-white',
    outline: 'text-secondary-900 dark:text-secondary-100',
    ghost: 'text-primary-600 dark:text-primary-400',
  };

  // 텍스트 크기
  const textSizeStyles = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const buttonLabel = Platform.OS === 'ios' ? biometricTypeName : `${biometricTypeName}으로 로그인`;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || isLoading}
      accessibilityRole="button"
      accessibilityLabel={`${biometricTypeName}으로 로그인`}
      accessibilityState={{ disabled: disabled || isLoading }}
      className={`
        flex-row items-center justify-center rounded-lg
        ${sizeStyles[size]}
        ${variantStyles[variant]}
        ${disabled || isLoading ? 'opacity-50' : 'active:opacity-80'}
        ${className}
      `}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={variant === 'default' ? '#fff' : primaryColor} />
      ) : (
        <>
          {isFaceId ? (
            <FaceIdIcon size={iconSize} color={variant === 'default' ? '#fff' : primaryColor} />
          ) : (
            <FingerprintIcon
              size={iconSize}
              color={variant === 'default' ? '#fff' : primaryColor}
            />
          )}
          <Text
            className={`
              ml-2 font-medium
              ${textStyles[variant]}
              ${textSizeStyles[size]}
            `}
          >
            {buttonLabel}
          </Text>
        </>
      )}
    </Pressable>
  );
});

export default BiometricButton;
