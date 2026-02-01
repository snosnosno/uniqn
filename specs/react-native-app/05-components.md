# 05. 컴포넌트 시스템 설계

> **마지막 업데이트**: 2026년 2월 2일

## 컴포넌트 현황 (현재 구현 기준)

### 폴더별 컴포넌트 개수 (2026년 2월 기준)
| 폴더 | 개수 | 설명 |
|------|------|------|
| **employer/** | 62개 | 구인자 전용 (가장 많음) |
| **ui/** | 45개 | 기본 UI 컴포넌트 |
| **jobs/** | 21개 | 공고 관련 |
| **auth/** | 13개 | 인증 (signup 서브폴더 포함) |
| **admin/** | 12개 | 관리자 (announcements, stats 서브폴더 포함) |
| **schedule/** | 9개 | 스케줄 |
| **notifications/** | 7개 | 알림 |
| **support/** | 6개 | 고객지원 |
| **qr/** | 3개 | QR 코드 |
| **headers/** | 2개 | StackHeader, TabHeader |
| **applicant/** | 2개 | 지원자 카드 |
| **settings/** | 2개 | 설정 |
| **기타** | 8개 | applications, notices, navigation, onboarding, profile, modals, lazy, icons |
| **전체** | **192개** | |

### UI 컴포넌트 목록 (35개)
```yaml
기본 (6개):
  - Button (5 variant), Input (5 type), Card (3 variant)
  - Badge (6 variant), Avatar, Divider

상태 표시 (5개):
  - Loading, LoadingOverlay
  - EmptyState (3 variant), ErrorState (5 variant)
  - ErrorBoundary, OfflineBanner

스켈레톤 (1개):
  - Skeleton (shimmer 애니메이션, 10+ 프리셋 포함)

피드백 (5개):
  - Toast, ToastManager
  - InAppBanner, InAppModal, InAppMessageManager

모달 & 시트 (5개):
  - Modal (Reanimated)
  - BottomSheet, ActionSheet, SheetModal
  - ModalManager

폼 (8개):
  - FormField, FormSelect
  - Checkbox, Radio
  - DatePicker, TimePicker, TimeWheelPicker
  - CalendarPicker

레이아웃 (4개):
  - MobileHeader, OptimizedImage, CircularProgress
  - Accordion

기타 (1개):
  - index.ts (배럴 export)
```

---

## 디자인 시스템 개요

### 디자인 토큰

```typescript
// src/constants/colors.ts
export const colors = {
  // Primary (브랜드 컬러)
  primary: {
    50: '#EEF2FF',
    100: '#E0E7FF',
    200: '#C7D2FE',
    300: '#A5B4FC',
    400: '#818CF8',
    500: '#6366F1', // 메인
    600: '#4F46E5',
    700: '#4338CA',
    800: '#3730A3',
    900: '#312E81',
  },

  // Gray (중립색)
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },

  // Semantic (의미적 색상)
  success: {
    light: '#D1FAE5',
    DEFAULT: '#10B981',
    dark: '#059669',
  },
  warning: {
    light: '#FEF3C7',
    DEFAULT: '#F59E0B',
    dark: '#D97706',
  },
  error: {
    light: '#FEE2E2',
    DEFAULT: '#EF4444',
    dark: '#DC2626',
  },
  info: {
    light: '#DBEAFE',
    DEFAULT: '#3B82F6',
    dark: '#2563EB',
  },

  // 특수 색상
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

// src/constants/spacing.ts
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
};

// src/constants/typography.ts
export const typography = {
  // Font Sizes
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,

  // Font Weights
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',

  // Line Heights
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.75,
};

// src/constants/radius.ts
export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};
```

### 테마 시스템
```typescript
// src/constants/theme.ts
import { colors, spacing, typography, radius } from './';

export const lightTheme = {
  colors: {
    background: colors.white,
    surface: colors.gray[50],
    card: colors.white,
    text: colors.gray[900],
    textSecondary: colors.gray[600],
    textTertiary: colors.gray[400],
    border: colors.gray[200],
    divider: colors.gray[100],
    primary: colors.primary[600],
    primaryText: colors.white,
    ...colors,
  },
  spacing,
  typography,
  radius,
};

export const darkTheme = {
  colors: {
    background: colors.gray[900],
    surface: colors.gray[800],
    card: colors.gray[800],
    text: colors.gray[100],
    textSecondary: colors.gray[400],
    textTertiary: colors.gray[500],
    border: colors.gray[700],
    divider: colors.gray[800],
    primary: colors.primary[500],
    primaryText: colors.white,
    ...colors,
  },
  spacing,
  typography,
  radius,
};

export type Theme = typeof lightTheme;
```

---

## 기본 UI 컴포넌트

### Button
```typescript
// src/components/ui/Button.tsx
import { Pressable, Text, ActivityIndicator, View } from 'react-native';
import { styled } from 'nativewind';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  onPress?: () => void;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary-600 dark:bg-primary-500',
  secondary: 'bg-gray-100 dark:bg-gray-800',
  outline: 'bg-transparent border border-gray-300 dark:border-gray-600',
  ghost: 'bg-transparent',
  danger: 'bg-red-600 dark:bg-red-500',
};

const variantTextStyles: Record<ButtonVariant, string> = {
  primary: 'text-white',
  secondary: 'text-gray-900 dark:text-gray-100',
  outline: 'text-gray-900 dark:text-gray-100',
  ghost: 'text-gray-900 dark:text-gray-100',
  danger: 'text-white',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-2',
  md: 'px-4 py-3',
  lg: 'px-6 py-4',
};

const sizeTextStyles: Record<ButtonSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  onPress,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`
        flex-row items-center justify-center rounded-lg
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${isDisabled ? 'opacity-50' : ''}
      `}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? '#fff' : '#6B7280'}
          size="small"
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <View className="mr-2">{icon}</View>
          )}
          <Text
            className={`
              font-semibold
              ${variantTextStyles[variant]}
              ${sizeTextStyles[size]}
            `}
          >
            {children}
          </Text>
          {icon && iconPosition === 'right' && (
            <View className="ml-2">{icon}</View>
          )}
        </>
      )}
    </Pressable>
  );
}
```

### Input
```typescript
// src/components/ui/Input.tsx
import { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  Pressable,
  TextInputProps,
} from 'react-native';
import { EyeIcon, EyeSlashIcon } from '@/components/icons';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  type?: 'text' | 'email' | 'password' | 'number' | 'phone';
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  type = 'text',
  ...props
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const isPassword = type === 'password';

  return (
    <View className="w-full">
      {label && (
        <Text className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </Text>
      )}

      <View
        className={`
          flex-row items-center rounded-lg border px-3
          ${error
            ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
            : isFocused
              ? 'border-primary-500 bg-white dark:bg-gray-800'
              : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800'
          }
        `}
      >
        {leftIcon && <View className="mr-2">{leftIcon}</View>}

        <TextInput
          {...props}
          secureTextEntry={isPassword && !showPassword}
          keyboardType={
            type === 'email'
              ? 'email-address'
              : type === 'number'
                ? 'numeric'
                : type === 'phone'
                  ? 'phone-pad'
                  : 'default'
          }
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          className="flex-1 py-3 text-base text-gray-900 dark:text-gray-100"
          placeholderTextColor="#9CA3AF"
        />

        {isPassword && (
          <Pressable
            onPress={() => setShowPassword(!showPassword)}
            className="p-1"
          >
            {showPassword ? (
              <EyeSlashIcon size={20} color="#6B7280" />
            ) : (
              <EyeIcon size={20} color="#6B7280" />
            )}
          </Pressable>
        )}

        {rightIcon && !isPassword && <View className="ml-2">{rightIcon}</View>}
      </View>

      {(error || hint) && (
        <Text
          className={`mt-1 text-sm ${
            error ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {error || hint}
        </Text>
      )}
    </View>
  );
}
```

### Card
```typescript
// src/components/ui/Card.tsx
import { View, Pressable, ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'outlined' | 'filled';
  onPress?: () => void;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const variantStyles = {
  elevated: 'bg-white dark:bg-gray-800 shadow-md',
  outlined: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
  filled: 'bg-gray-50 dark:bg-gray-800',
};

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function Card({
  children,
  variant = 'elevated',
  onPress,
  padding = 'md',
  className = '',
  ...props
}: CardProps) {
  const content = (
    <View
      className={`
        rounded-xl
        ${variantStyles[variant]}
        ${paddingStyles[padding]}
        ${className}
      `}
      {...props}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} className="active:opacity-80">
        {content}
      </Pressable>
    );
  }

  return content;
}
```

### Badge
```typescript
// src/components/ui/Badge.tsx
import { View, Text } from 'react-native';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 dark:bg-gray-700',
  primary: 'bg-primary-100 dark:bg-primary-900/30',
  success: 'bg-green-100 dark:bg-green-900/30',
  warning: 'bg-yellow-100 dark:bg-yellow-900/30',
  error: 'bg-red-100 dark:bg-red-900/30',
};

const textStyles: Record<BadgeVariant, string> = {
  default: 'text-gray-700 dark:text-gray-300',
  primary: 'text-primary-700 dark:text-primary-300',
  success: 'text-green-700 dark:text-green-300',
  warning: 'text-yellow-700 dark:text-yellow-300',
  error: 'text-red-700 dark:text-red-300',
};

const dotStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-500',
  primary: 'bg-primary-500',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
}: BadgeProps) {
  return (
    <View
      className={`
        flex-row items-center rounded-full
        ${variantStyles[variant]}
        ${size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1'}
      `}
    >
      {dot && (
        <View
          className={`
            mr-1.5 h-1.5 w-1.5 rounded-full
            ${dotStyles[variant]}
          `}
        />
      )}
      <Text
        className={`
          font-medium
          ${textStyles[variant]}
          ${size === 'sm' ? 'text-xs' : 'text-sm'}
        `}
      >
        {children}
      </Text>
    </View>
  );
}
```

---

## 모달 시스템

### ModalManager
```typescript
// src/components/ui/ModalManager.tsx
import { useModalStore } from '@/stores/modalStore';
import { ConfirmModal } from './ConfirmModal';
import { AlertModal } from './AlertModal';
import { BottomSheet } from './BottomSheet';

export function ModalManager() {
  const { activeModal, hide } = useModalStore();

  if (!activeModal) return null;

  switch (activeModal.type) {
    case 'confirm':
      return (
        <ConfirmModal
          visible
          title={activeModal.title}
          message={activeModal.message}
          confirmText={activeModal.confirmText}
          cancelText={activeModal.cancelText}
          dangerous={activeModal.dangerous}
          onConfirm={async () => {
            await activeModal.onConfirm?.();
            hide();
          }}
          onCancel={() => {
            activeModal.onCancel?.();
            hide();
          }}
        />
      );

    case 'alert':
      return (
        <AlertModal
          visible
          title={activeModal.title}
          message={activeModal.message}
          confirmText={activeModal.confirmText}
          onConfirm={() => hide()}
        />
      );

    case 'bottom-sheet':
      return (
        <BottomSheet visible onClose={() => hide()}>
          {activeModal.content}
        </BottomSheet>
      );

    default:
      return null;
  }
}
```

### ConfirmModal
```typescript
// src/components/ui/ConfirmModal.tsx
import { Modal, View, Text, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { Button } from './Button';

interface ConfirmModalProps {
  visible: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  dangerous?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmText = '확인',
  cancelText = '취소',
  dangerous = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/50"
        onPress={onCancel}
      >
        <Pressable
          className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 dark:bg-gray-800"
          onPress={(e) => e.stopPropagation()}
        >
          {title && (
            <Text className="mb-2 text-center text-lg font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </Text>
          )}

          {message && (
            <Text className="mb-6 text-center text-gray-600 dark:text-gray-400">
              {message}
            </Text>
          )}

          <View className="flex-row gap-3">
            <Button
              variant="secondary"
              onPress={onCancel}
              fullWidth
            >
              {cancelText}
            </Button>
            <Button
              variant={dangerous ? 'danger' : 'primary'}
              onPress={onConfirm}
              fullWidth
            >
              {confirmText}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

### BottomSheet
```typescript
// src/components/ui/BottomSheet.tsx
import { useCallback, useEffect } from 'react';
import { View, Pressable, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  snapPoints?: number[]; // [0.25, 0.5, 0.9]
  initialSnap?: number;
}

export function BottomSheet({
  visible,
  onClose,
  children,
  snapPoints = [0.5],
  initialSnap = 0,
}: BottomSheetProps) {
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const context = useSharedValue({ y: 0 });

  const maxHeight = SCREEN_HEIGHT * snapPoints[snapPoints.length - 1];
  const initialHeight = SCREEN_HEIGHT * snapPoints[initialSnap];

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(SCREEN_HEIGHT - initialHeight, {
        damping: 20,
        stiffness: 90,
      });
    } else {
      translateY.value = withSpring(SCREEN_HEIGHT);
    }
  }, [visible]);

  const gesture = Gesture.Pan()
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      translateY.value = Math.max(
        context.value.y + event.translationY,
        SCREEN_HEIGHT - maxHeight
      );
    })
    .onEnd((event) => {
      if (event.velocityY > 500 || translateY.value > SCREEN_HEIGHT * 0.7) {
        translateY.value = withSpring(SCREEN_HEIGHT, {}, () => {
          runOnJS(onClose)();
        });
      } else {
        // Snap to nearest point
        const snapTo = snapPoints.reduce((prev, curr) => {
          const prevDist = Math.abs(
            SCREEN_HEIGHT - SCREEN_HEIGHT * prev - translateY.value
          );
          const currDist = Math.abs(
            SCREEN_HEIGHT - SCREEN_HEIGHT * curr - translateY.value
          );
          return currDist < prevDist ? curr : prev;
        });
        translateY.value = withSpring(SCREEN_HEIGHT - SCREEN_HEIGHT * snapTo);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: visible ? 1 : 0,
  }));

  if (!visible) return null;

  return (
    <View className="absolute inset-0">
      <Animated.View
        style={backdropStyle}
        className="absolute inset-0 bg-black/50"
      >
        <Pressable className="flex-1" onPress={onClose} />
      </Animated.View>

      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[sheetStyle, { maxHeight }]}
          className="absolute left-0 right-0 bottom-0 rounded-t-3xl bg-white dark:bg-gray-800"
        >
          {/* Handle */}
          <View className="items-center py-3">
            <View className="h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600" />
          </View>

          {/* Content */}
          <View className="flex-1 px-4 pb-8">{children}</View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
```

---

## Toast 시스템

### ToastManager
```typescript
// src/components/ui/ToastManager.tsx
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '@/stores/toastStore';
import { Toast } from './Toast';

export function ToastManager() {
  const { toasts, hide } = useToastStore();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="absolute left-4 right-4"
      style={{ top: insets.top + 8 }}
      pointerEvents="box-none"
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          type={toast.type}
          message={toast.message}
          onClose={() => hide(toast.id)}
        />
      ))}
    </View>
  );
}
```

### Toast
```typescript
// src/components/ui/Toast.tsx
import { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@/components/icons';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  type: ToastType;
  message: string;
  onClose: () => void;
}

const typeConfig: Record<
  ToastType,
  { icon: typeof CheckCircleIcon; bgColor: string; iconColor: string }
> = {
  success: {
    icon: CheckCircleIcon,
    bgColor: 'bg-green-50 dark:bg-green-900/30',
    iconColor: '#10B981',
  },
  error: {
    icon: ExclamationCircleIcon,
    bgColor: 'bg-red-50 dark:bg-red-900/30',
    iconColor: '#EF4444',
  },
  warning: {
    icon: ExclamationTriangleIcon,
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/30',
    iconColor: '#F59E0B',
  },
  info: {
    icon: InformationCircleIcon,
    bgColor: 'bg-blue-50 dark:bg-blue-900/30',
    iconColor: '#3B82F6',
  },
};

export function Toast({ type, message, onClose }: ToastProps) {
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  const config = typeConfig[type];
  const Icon = config.icon;

  useEffect(() => {
    translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
    opacity.value = withTiming(1, { duration: 200 });
  }, []);

  const handleClose = () => {
    translateY.value = withTiming(-100, { duration: 200 });
    opacity.value = withTiming(0, { duration: 200 }, () => {
      runOnJS(onClose)();
    });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={animatedStyle}
      className={`
        mb-2 flex-row items-center rounded-xl p-4 shadow-lg
        ${config.bgColor}
      `}
    >
      <Icon size={24} color={config.iconColor} />
      <Text className="mx-3 flex-1 text-gray-900 dark:text-gray-100">
        {message}
      </Text>
      <Pressable onPress={handleClose} hitSlop={8}>
        <XMarkIcon size={20} color="#6B7280" />
      </Pressable>
    </Animated.View>
  );
}
```

---

## 상태 표시 컴포넌트

### Loading (로딩 스피너)
```typescript
// src/components/ui/Loading.tsx
import { View, ActivityIndicator, Text } from 'react-native';

type LoadingSize = 'sm' | 'md' | 'lg';

interface LoadingProps {
  /** 로딩 크기 */
  size?: LoadingSize;
  /** 로딩 메시지 (선택) */
  message?: string;
  /** 전체 화면 중앙 배치 여부 */
  fullScreen?: boolean;
  /** 커스텀 색상 */
  color?: string;
}

const sizeMap: Record<LoadingSize, 'small' | 'large'> = {
  sm: 'small',
  md: 'small',
  lg: 'large',
};

const sizeStyleMap: Record<LoadingSize, string> = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-10 h-10',
};

export function Loading({
  size = 'md',
  message,
  fullScreen = false,
  color,
}: LoadingProps) {
  const content = (
    <View className="items-center justify-center">
      <ActivityIndicator
        size={sizeMap[size]}
        color={color || '#6366F1'}
        className={sizeStyleMap[size]}
      />
      {message && (
        <Text className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {message}
        </Text>
      )}
    </View>
  );

  if (fullScreen) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        {content}
      </View>
    );
  }

  return content;
}
```

**사용 예시:**
```tsx
// 기본 사용
<Loading />

// 메시지와 함께
<Loading size="lg" message="데이터를 불러오는 중..." />

// 전체 화면
<Loading fullScreen message="로딩 중..." />
```

### EmptyState (빈 상태)
```typescript
// src/components/ui/EmptyState.tsx
import { View, Text } from 'react-native';
import { Button } from './Button';
import {
  InboxIcon,
  DocumentIcon,
  CalendarIcon,
  BellIcon,
  MagnifyingGlassIcon,
} from '@/components/icons';

type EmptyStateVariant = 'default' | 'search' | 'schedule' | 'notifications' | 'documents';

interface EmptyStateProps {
  /** 빈 상태 유형 */
  variant?: EmptyStateVariant;
  /** 제목 */
  title?: string;
  /** 설명 메시지 */
  description?: string;
  /** 액션 버튼 텍스트 */
  actionLabel?: string;
  /** 액션 버튼 클릭 핸들러 */
  onAction?: () => void;
  /** 커스텀 아이콘 */
  icon?: React.ReactNode;
}

const variantConfig: Record<
  EmptyStateVariant,
  { icon: typeof InboxIcon; defaultTitle: string; defaultDescription: string }
> = {
  default: {
    icon: InboxIcon,
    defaultTitle: '데이터가 없습니다',
    defaultDescription: '표시할 내용이 없습니다.',
  },
  search: {
    icon: MagnifyingGlassIcon,
    defaultTitle: '검색 결과 없음',
    defaultDescription: '검색 조건을 변경해 보세요.',
  },
  schedule: {
    icon: CalendarIcon,
    defaultTitle: '스케줄이 없습니다',
    defaultDescription: '예정된 일정이 없습니다.',
  },
  notifications: {
    icon: BellIcon,
    defaultTitle: '알림이 없습니다',
    defaultDescription: '새로운 알림이 없습니다.',
  },
  documents: {
    icon: DocumentIcon,
    defaultTitle: '문서가 없습니다',
    defaultDescription: '등록된 문서가 없습니다.',
  },
};

export function EmptyState({
  variant = 'default',
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: EmptyStateProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      {/* 아이콘 */}
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
        {icon || <Icon size={32} color="#9CA3AF" />}
      </View>

      {/* 제목 */}
      <Text className="mb-2 text-center text-lg font-semibold text-gray-900 dark:text-gray-100">
        {title || config.defaultTitle}
      </Text>

      {/* 설명 */}
      <Text className="mb-6 text-center text-sm text-gray-500 dark:text-gray-400">
        {description || config.defaultDescription}
      </Text>

      {/* 액션 버튼 */}
      {actionLabel && onAction && (
        <Button variant="primary" onPress={onAction}>
          {actionLabel}
        </Button>
      )}
    </View>
  );
}
```

**사용 예시:**
```tsx
// 기본 빈 상태
<EmptyState />

// 검색 결과 없음
<EmptyState
  variant="search"
  actionLabel="필터 초기화"
  onAction={() => resetFilters()}
/>

// 커스텀 메시지
<EmptyState
  title="지원 내역이 없습니다"
  description="관심 있는 공고에 지원해 보세요!"
  actionLabel="공고 보기"
  onAction={() => navigate('/job-board')}
/>
```

### ErrorState (에러 상태)
```typescript
// src/components/ui/ErrorState.tsx
import { View, Text } from 'react-native';
import { Button } from './Button';
import {
  ExclamationTriangleIcon,
  WifiIcon,
  ServerIcon,
  ShieldExclamationIcon,
} from '@/components/icons';

type ErrorVariant = 'default' | 'network' | 'server' | 'permission' | 'notFound';

interface ErrorStateProps {
  /** 에러 유형 */
  variant?: ErrorVariant;
  /** 에러 제목 */
  title?: string;
  /** 에러 설명 */
  description?: string;
  /** 재시도 버튼 텍스트 */
  retryLabel?: string;
  /** 재시도 핸들러 */
  onRetry?: () => void;
  /** 뒤로가기 핸들러 */
  onGoBack?: () => void;
  /** 에러 코드 (개발용) */
  errorCode?: string;
}

const variantConfig: Record<
  ErrorVariant,
  { icon: typeof ExclamationTriangleIcon; defaultTitle: string; defaultDescription: string; iconColor: string }
> = {
  default: {
    icon: ExclamationTriangleIcon,
    defaultTitle: '오류가 발생했습니다',
    defaultDescription: '잠시 후 다시 시도해 주세요.',
    iconColor: '#EF4444',
  },
  network: {
    icon: WifiIcon,
    defaultTitle: '네트워크 오류',
    defaultDescription: '인터넷 연결을 확인해 주세요.',
    iconColor: '#F59E0B',
  },
  server: {
    icon: ServerIcon,
    defaultTitle: '서버 오류',
    defaultDescription: '서버에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    iconColor: '#EF4444',
  },
  permission: {
    icon: ShieldExclamationIcon,
    defaultTitle: '접근 권한 없음',
    defaultDescription: '이 페이지에 접근할 권한이 없습니다.',
    iconColor: '#F59E0B',
  },
  notFound: {
    icon: ExclamationTriangleIcon,
    defaultTitle: '페이지를 찾을 수 없습니다',
    defaultDescription: '요청하신 페이지가 존재하지 않습니다.',
    iconColor: '#6B7280',
  },
};

export function ErrorState({
  variant = 'default',
  title,
  description,
  retryLabel = '다시 시도',
  onRetry,
  onGoBack,
  errorCode,
}: ErrorStateProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      {/* 아이콘 */}
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
        <Icon size={32} color={config.iconColor} />
      </View>

      {/* 제목 */}
      <Text className="mb-2 text-center text-lg font-semibold text-gray-900 dark:text-gray-100">
        {title || config.defaultTitle}
      </Text>

      {/* 설명 */}
      <Text className="mb-6 text-center text-sm text-gray-500 dark:text-gray-400">
        {description || config.defaultDescription}
      </Text>

      {/* 에러 코드 (개발 모드) */}
      {__DEV__ && errorCode && (
        <Text className="mb-4 text-xs text-gray-400 dark:text-gray-500">
          에러 코드: {errorCode}
        </Text>
      )}

      {/* 액션 버튼들 */}
      <View className="flex-row gap-3">
        {onGoBack && (
          <Button variant="outline" onPress={onGoBack}>
            뒤로 가기
          </Button>
        )}
        {onRetry && (
          <Button variant="primary" onPress={onRetry}>
            {retryLabel}
          </Button>
        )}
      </View>
    </View>
  );
}
```

**사용 예시:**
```tsx
// 기본 에러
<ErrorState onRetry={() => refetch()} />

// 네트워크 에러
<ErrorState
  variant="network"
  onRetry={() => refetch()}
/>

// 권한 에러
<ErrorState
  variant="permission"
  onGoBack={() => router.back()}
/>

// 커스텀 에러
<ErrorState
  title="데이터를 불러올 수 없습니다"
  description="서버 연결에 실패했습니다."
  errorCode="E2001"
  onRetry={() => refetch()}
/>
```

### LoadingOverlay (전체 로딩 오버레이)
```typescript
// src/components/ui/LoadingOverlay.tsx
import { View, Text, Modal, ActivityIndicator } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';

interface LoadingOverlayProps {
  /** 표시 여부 */
  visible: boolean;
  /** 로딩 메시지 */
  message?: string;
  /** 투명 배경 (true면 반투명, false면 완전 불투명) */
  transparent?: boolean;
  /** 취소 가능 여부 (백버튼/탭으로 닫기) */
  cancellable?: boolean;
  /** 취소 핸들러 */
  onCancel?: () => void;
}

export function LoadingOverlay({
  visible,
  message = '처리 중...',
  transparent = true,
  cancellable = false,
  onCancel,
}: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={cancellable ? onCancel : undefined}
    >
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        className={`
          flex-1 items-center justify-center
          ${transparent ? 'bg-black/50' : 'bg-white dark:bg-gray-900'}
        `}
      >
        <View
          className={`
            items-center rounded-2xl p-6
            ${transparent ? 'bg-white dark:bg-gray-800' : ''}
          `}
        >
          <ActivityIndicator size="large" color="#6366F1" />
          <Text className="mt-4 text-base text-gray-700 dark:text-gray-300">
            {message}
          </Text>
        </View>
      </Animated.View>
    </Modal>
  );
}
```

**사용 예시:**
```tsx
// 기본 사용
<LoadingOverlay visible={isSubmitting} />

// 커스텀 메시지
<LoadingOverlay
  visible={isUploading}
  message="파일 업로드 중..."
/>

// 취소 가능
<LoadingOverlay
  visible={isLoading}
  message="검색 중..."
  cancellable
  onCancel={() => cancelSearch()}
/>
```

### MobileHeader (모바일 헤더)
```typescript
// src/components/ui/MobileHeader.tsx
import { View, Text, Pressable, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeftIcon } from '@/components/icons';

interface MobileHeaderProps {
  /** 헤더 제목 */
  title?: string;
  /** 뒤로가기 표시 여부 */
  showBack?: boolean;
  /** 뒤로가기 커스텀 핸들러 */
  onBack?: () => void;
  /** 왼쪽 커스텀 컴포넌트 */
  leftComponent?: React.ReactNode;
  /** 오른쪽 액션 컴포넌트 */
  rightComponent?: React.ReactNode;
  /** 투명 배경 여부 */
  transparent?: boolean;
  /** 큰 제목 스타일 (iOS 스타일) */
  largeTitle?: boolean;
  /** 하단 테두리 표시 */
  showBorder?: boolean;
}

export function MobileHeader({
  title,
  showBack = true,
  onBack,
  leftComponent,
  rightComponent,
  transparent = false,
  largeTitle = false,
  showBorder = true,
}: MobileHeaderProps) {
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <View
      className={`
        ${transparent ? '' : 'bg-white dark:bg-gray-900'}
        ${showBorder && !transparent ? 'border-b border-gray-200 dark:border-gray-800' : ''}
      `}
      style={{ paddingTop: insets.top }}
    >
      {/* 기본 헤더 */}
      <View className="h-14 flex-row items-center justify-between px-4">
        {/* 왼쪽 영역 */}
        <View className="min-w-[60px] flex-row items-center">
          {leftComponent || (showBack && (
            <Pressable
              onPress={handleBack}
              className="mr-2 -ml-2 p-2"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ChevronLeftIcon size={24} color="#111827" className="dark:text-white" />
            </Pressable>
          ))}
        </View>

        {/* 제목 (중앙) */}
        {title && !largeTitle && (
          <Text
            className="flex-1 text-center text-lg font-semibold text-gray-900 dark:text-gray-100"
            numberOfLines={1}
          >
            {title}
          </Text>
        )}

        {/* 오른쪽 영역 */}
        <View className="min-w-[60px] flex-row items-center justify-end">
          {rightComponent}
        </View>
      </View>

      {/* 큰 제목 (iOS 스타일) */}
      {title && largeTitle && (
        <View className="px-4 pb-2">
          <Text className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {title}
          </Text>
        </View>
      )}
    </View>
  );
}
```

**사용 예시:**
```tsx
// 기본 헤더
<MobileHeader title="공고 상세" />

// 액션 버튼 포함
<MobileHeader
  title="설정"
  rightComponent={
    <Pressable onPress={handleSave}>
      <Text className="text-primary-600">저장</Text>
    </Pressable>
  }
/>

// 큰 제목 스타일
<MobileHeader
  title="내 스케줄"
  largeTitle
  showBack={false}
/>

// 투명 배경 (이미지 위)
<MobileHeader
  showBack
  transparent
  rightComponent={<ShareButton />}
/>

// 커스텀 왼쪽 컴포넌트
<MobileHeader
  title="알림"
  leftComponent={<CloseButton />}
  rightComponent={<SettingsButton />}
/>
```

### Skeleton (스켈레톤 로딩)
```typescript
// src/components/ui/Skeleton.tsx
import { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';

type SkeletonVariant = 'text' | 'avatar' | 'card' | 'list-item' | 'rectangular' | 'circular';

interface SkeletonProps {
  /** 스켈레톤 변형 */
  variant?: SkeletonVariant;
  /** 너비 (숫자 또는 퍼센트 문자열) */
  width?: number | string;
  /** 높이 */
  height?: number;
  /** 둥근 모서리 반경 */
  borderRadius?: number;
  /** 애니메이션 활성화 */
  animated?: boolean;
  /** 커스텀 스타일 */
  style?: ViewStyle;
  /** 다크모드 배경색 사용 */
  dark?: boolean;
}

// 변형별 기본 스타일
const variantStyles: Record<SkeletonVariant, { width: number | string; height: number; borderRadius: number }> = {
  text: { width: '100%', height: 16, borderRadius: 4 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  card: { width: '100%', height: 120, borderRadius: 12 },
  'list-item': { width: '100%', height: 72, borderRadius: 8 },
  rectangular: { width: '100%', height: 100, borderRadius: 0 },
  circular: { width: 40, height: 40, borderRadius: 20 },
};

export function Skeleton({
  variant = 'text',
  width,
  height,
  borderRadius,
  animated = true,
  style,
  dark = false,
}: SkeletonProps) {
  const shimmerValue = useSharedValue(0);

  useEffect(() => {
    if (animated) {
      shimmerValue.value = withRepeat(
        withTiming(1, {
          duration: 1500,
          easing: Easing.linear,
        }),
        -1, // 무한 반복
        false // 리버스 없음
      );
    }
  }, [animated, shimmerValue]);

  const animatedStyle = useAnimatedStyle(() => {
    if (!animated) return {};

    const opacity = interpolate(
      shimmerValue.value,
      [0, 0.5, 1],
      [0.3, 0.6, 0.3]
    );

    return { opacity };
  });

  const defaultStyle = variantStyles[variant];

  const finalWidth = width ?? defaultStyle.width;
  const finalHeight = height ?? defaultStyle.height;
  const finalBorderRadius = borderRadius ?? defaultStyle.borderRadius;

  return (
    <Animated.View
      style={[
        {
          width: typeof finalWidth === 'number' ? finalWidth : undefined,
          height: finalHeight,
          borderRadius: finalBorderRadius,
          backgroundColor: dark ? '#374151' : '#E5E7EB', // gray-700 / gray-200
          overflow: 'hidden',
        },
        typeof finalWidth === 'string' && styles[finalWidth as keyof typeof styles],
        animatedStyle,
        style,
      ]}
      className={`${dark ? 'bg-gray-700' : 'bg-gray-200'}`}
    />
  );
}

const styles = StyleSheet.create({
  '100%': { width: '100%' },
  '75%': { width: '75%' },
  '50%': { width: '50%' },
  '25%': { width: '25%' },
});

// 프리셋 컴포넌트
export function SkeletonText({ lines = 3, ...props }: SkeletonProps & { lines?: number }) {
  return (
    <View className="space-y-2">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          variant="text"
          width={index === lines - 1 ? '60%' : '100%'}
          {...props}
        />
      ))}
    </View>
  );
}

export function SkeletonAvatar({ size = 48, ...props }: SkeletonProps & { size?: number }) {
  return (
    <Skeleton
      variant="circular"
      width={size}
      height={size}
      borderRadius={size / 2}
      {...props}
    />
  );
}

export function SkeletonCard(props: SkeletonProps) {
  return (
    <View className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm">
      <View className="flex-row items-center mb-3">
        <SkeletonAvatar {...props} />
        <View className="ml-3 flex-1">
          <Skeleton variant="text" width="40%" height={14} {...props} />
          <View className="h-2" />
          <Skeleton variant="text" width="60%" height={12} {...props} />
        </View>
      </View>
      <SkeletonText lines={2} {...props} />
    </View>
  );
}

export function SkeletonListItem(props: SkeletonProps) {
  return (
    <View className="flex-row items-center py-3 px-4">
      <SkeletonAvatar size={40} {...props} />
      <View className="ml-3 flex-1">
        <Skeleton variant="text" width="70%" height={16} {...props} />
        <View className="h-1" />
        <Skeleton variant="text" width="40%" height={12} {...props} />
      </View>
      <Skeleton variant="rectangular" width={60} height={24} borderRadius={4} {...props} />
    </View>
  );
}

// 공고 카드 스켈레톤
export function SkeletonJobCard(props: SkeletonProps) {
  return (
    <View className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm mb-3">
      {/* 헤더 */}
      <View className="flex-row justify-between items-start mb-3">
        <Skeleton variant="text" width="60%" height={20} {...props} />
        <Skeleton variant="rectangular" width={60} height={24} borderRadius={12} {...props} />
      </View>

      {/* 위치 정보 */}
      <View className="flex-row items-center mb-2">
        <Skeleton variant="circular" width={16} height={16} {...props} />
        <View className="w-2" />
        <Skeleton variant="text" width="40%" height={14} {...props} />
      </View>

      {/* 날짜 정보 */}
      <View className="flex-row items-center mb-3">
        <Skeleton variant="circular" width={16} height={16} {...props} />
        <View className="w-2" />
        <Skeleton variant="text" width="50%" height={14} {...props} />
      </View>

      {/* 급여 */}
      <Skeleton variant="text" width="30%" height={18} {...props} />
    </View>
  );
}
```

**사용 예시:**
```tsx
// 기본 텍스트 스켈레톤
<Skeleton variant="text" />

// 아바타 스켈레톤
<Skeleton variant="avatar" />
<SkeletonAvatar size={64} />

// 카드 스켈레톤
<Skeleton variant="card" />
<SkeletonCard />

// 리스트 아이템 스켈레톤
<SkeletonListItem />

// 커스텀 크기
<Skeleton width={200} height={100} borderRadius={8} />

// 애니메이션 비활성화
<Skeleton variant="text" animated={false} />

// 다크모드 배경
<Skeleton variant="card" dark />

// 여러 줄 텍스트
<SkeletonText lines={4} />

// 공고 카드 로딩
{isLoading ? (
  <SkeletonJobCard />
) : (
  <JobCard data={job} />
)}

// 리스트 로딩 상태
{isLoading ? (
  <>
    <SkeletonListItem />
    <SkeletonListItem />
    <SkeletonListItem />
  </>
) : (
  <FlatList data={items} ... />
)}
```

---

## 비즈니스 컴포넌트

### DateSlider (날짜 선택)
```typescript
// src/components/job/DateSlider.tsx
import { useRef, useEffect, useMemo } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { subDays, addDays, isSameDay, isToday, isYesterday } from 'date-fns';

interface DateSliderProps {
  selectedDate: Date | null;
  onDateSelect: (date: Date | null) => void;
}

export function DateSlider({ selectedDate, onDateSelect }: DateSliderProps) {
  const scrollRef = useRef<ScrollView>(null);
  const todayRef = useRef<View>(null);

  // 날짜 범위 생성 (어제 ~ +14일 = 16일)
  const dates = useMemo(() => {
    const yesterday = subDays(new Date(), 1);
    return Array.from({ length: 16 }, (_, i) => addDays(yesterday, i));
  }, []);

  // 오늘 날짜로 자동 스크롤 (마운트 시)
  useEffect(() => {
    // ScrollView의 scrollTo로 오늘 위치로 이동
    const todayIndex = dates.findIndex(isToday);
    if (todayIndex > 0 && scrollRef.current) {
      // 대략 버튼 너비 80px * index
      scrollRef.current.scrollTo({ x: todayIndex * 80, animated: true });
    }
  }, []);

  // 날짜 라벨
  const getDateLabel = (date: Date): string => {
    if (isToday(date)) return '오늘';
    if (isYesterday(date)) return '어제';
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // 선택 여부
  const isSelected = (date: Date): boolean => {
    return selectedDate ? isSameDay(date, selectedDate) : false;
  };

  return (
    <View className="mb-4">
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-1"
      >
        {/* 전체 버튼 */}
        <Pressable
          onPress={() => onDateSelect(null)}
          className={`
            px-4 py-2 rounded-lg
            ${selectedDate === null
              ? 'bg-primary-600 dark:bg-primary-500'
              : 'bg-gray-100 dark:bg-gray-700'
            }
          `}
        >
          <Text
            className={`
              font-medium
              ${selectedDate === null
                ? 'text-white'
                : 'text-gray-700 dark:text-gray-300'
              }
            `}
          >
            전체
          </Text>
        </Pressable>

        {/* 날짜 버튼들 */}
        {dates.map((date, index) => {
          const today = isToday(date);
          const selected = isSelected(date);

          return (
            <Pressable
              key={date.toISOString()}
              ref={today ? todayRef : null}
              onPress={() => onDateSelect(date)}
              className={`
                px-4 py-2 rounded-lg min-w-[60px] items-center
                ${selected
                  ? 'bg-primary-600 dark:bg-primary-500'
                  : 'bg-gray-100 dark:bg-gray-700'
                }
              `}
            >
              <Text
                className={`
                  font-medium
                  ${selected
                    ? 'text-white'
                    : 'text-gray-700 dark:text-gray-300'
                  }
                `}
              >
                {getDateLabel(date)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
```

**기능:**
- 가로 스크롤 날짜 선택
- 어제 ~ +14일 범위 (16일)
- "전체" 옵션으로 필터 해제
- 오늘 날짜 자동 스크롤
- "오늘", "어제" 특수 라벨

**사용처:**
- 구인구직 > 지원 탭에서만 표시
- 날짜별 공고 필터링

---

### JobCard
```typescript
// src/components/job/JobCard.tsx
import { View, Text, Pressable } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  MapPinIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  UsersIcon,
} from '@/components/icons';
import { formatDate, formatCurrency } from '@/utils/formatters';
import type { JobPosting } from '@/types';

interface JobCardProps {
  job: JobPosting;
  onPress: (id: string) => void;
}

export function JobCard({ job, onPress }: JobCardProps) {
  const isUrgent = job.postingType === 'urgent';
  const isFixed = job.postingType === 'fixed';

  return (
    <Card onPress={() => onPress(job.id)} className="mb-3">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <View className="mb-1 flex-row items-center">
            {isUrgent && (
              <Badge variant="error" size="sm" className="mr-2">
                긴급
              </Badge>
            )}
            {isFixed && (
              <Badge variant="primary" size="sm" className="mr-2">
                고정
              </Badge>
            )}
            <Text
              className="flex-1 text-lg font-semibold text-gray-900 dark:text-gray-100"
              numberOfLines={1}
            >
              {job.title}
            </Text>
          </View>

          <View className="mt-2 space-y-1">
            <View className="flex-row items-center">
              <MapPinIcon size={16} color="#6B7280" />
              <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-400">
                {job.location.district}
              </Text>
              <Text className="mx-2 text-gray-300">·</Text>
              <CurrencyDollarIcon size={16} color="#6B7280" />
              <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-400">
                {formatCurrency(job.salary)}/일
              </Text>
            </View>

            <View className="flex-row items-center">
              <CalendarIcon size={16} color="#6B7280" />
              <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-400">
                {isFixed
                  ? `매주 ${job.fixedConfig?.daysOfWeek.join(', ')}`
                  : formatDate(job.dates[0])}
                {job.dates.length > 1 && ` 외 ${job.dates.length - 1}일`}
              </Text>
            </View>

            <View className="flex-row items-center">
              <UsersIcon size={16} color="#6B7280" />
              <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-400">
                {job.roles.map((r) => `${r.name} ${r.count}명`).join(', ')}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Card>
  );
}
```

### ScheduleCard
```typescript
// src/components/schedule/ScheduleCard.tsx
import { View, Text } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatTime, formatCurrency } from '@/utils/formatters';
import type { ScheduleEvent } from '@/types';

interface ScheduleCardProps {
  event: ScheduleEvent;
  onPress: (id: string) => void;
}

const statusConfig = {
  applied: { label: '지원', variant: 'warning' as const },
  confirmed: { label: '확정', variant: 'success' as const },
  completed: { label: '완료', variant: 'default' as const },
  cancelled: { label: '취소', variant: 'error' as const },
};

export function ScheduleCard({ event, onPress }: ScheduleCardProps) {
  const status = statusConfig[event.status];

  return (
    <Card onPress={() => onPress(event.id)} className="mb-2">
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <View className="flex-row items-center">
            <Badge variant={status.variant} dot>
              {status.label}
            </Badge>
            <Text className="ml-2 font-medium text-gray-900 dark:text-gray-100">
              {event.jobTitle}
            </Text>
          </View>

          <Text className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {event.role} · {formatTime(event.startTime)} - {formatTime(event.endTime)}
          </Text>
        </View>

        {event.salary && (
          <Text className="font-semibold text-primary-600 dark:text-primary-400">
            {formatCurrency(event.salary)}
          </Text>
        )}
      </View>
    </Card>
  );
}
```

---

## 폼 컴포넌트

### FormField (React Hook Form 통합)
```typescript
// src/components/forms/FormField.tsx
import { Controller, useFormContext } from 'react-hook-form';
import { Input, InputProps } from '@/components/ui/Input';

interface FormFieldProps extends Omit<InputProps, 'value' | 'onChangeText'> {
  name: string;
}

export function FormField({ name, ...props }: FormFieldProps) {
  const { control, formState: { errors } } = useFormContext();
  const error = errors[name]?.message as string | undefined;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value } }) => (
        <Input
          {...props}
          value={value}
          onChangeText={onChange}
          onBlur={onBlur}
          error={error}
        />
      )}
    />
  );
}
```

### FormSelect
```typescript
// src/components/forms/FormSelect.tsx
import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Controller, useFormContext } from 'react-hook-form';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ChevronDownIcon, CheckIcon } from '@/components/icons';

interface Option {
  label: string;
  value: string;
}

interface FormSelectProps {
  name: string;
  label?: string;
  placeholder?: string;
  options: Option[];
}

export function FormSelect({
  name,
  label,
  placeholder = '선택하세요',
  options,
}: FormSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { control, formState: { errors } } = useFormContext();
  const error = errors[name]?.message as string | undefined;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value } }) => {
        const selectedOption = options.find((o) => o.value === value);

        return (
          <View className="w-full">
            {label && (
              <Text className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
              </Text>
            )}

            <Pressable
              onPress={() => setIsOpen(true)}
              className={`
                flex-row items-center justify-between rounded-lg border px-3 py-3
                ${error
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                  : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800'
                }
              `}
            >
              <Text
                className={
                  selectedOption
                    ? 'text-gray-900 dark:text-gray-100'
                    : 'text-gray-400'
                }
              >
                {selectedOption?.label || placeholder}
              </Text>
              <ChevronDownIcon size={20} color="#6B7280" />
            </Pressable>

            {error && (
              <Text className="mt-1 text-sm text-red-500">{error}</Text>
            )}

            <BottomSheet visible={isOpen} onClose={() => setIsOpen(false)}>
              <Text className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
                {label || '선택'}
              </Text>
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className="flex-row items-center justify-between py-3"
                >
                  <Text className="text-gray-900 dark:text-gray-100">
                    {option.label}
                  </Text>
                  {value === option.value && (
                    <CheckIcon size={20} color="#6366F1" />
                  )}
                </Pressable>
              ))}
            </BottomSheet>
          </View>
        );
      }}
    />
  );
}
```

---

## 컴포넌트 Export 구조

```typescript
// src/components/ui/index.ts (실제 구현)
// Core Components
export { Button, Input, Card, Badge, Avatar, Divider } from './...';
export { Accordion, AccordionItem, AccordionGroup } from './Accordion';

// State Components
export { EmptyState, ErrorState } from './...';

// Error Boundary (8가지 세분화)
export {
  ErrorBoundary,
  withErrorBoundary,
  ScreenErrorBoundary,
  FeatureErrorBoundary,
  NetworkErrorBoundary,
  AuthErrorBoundary,
  FormErrorBoundary,
  DataFetchErrorBoundary,
  CompositeErrorBoundary,
} from './ErrorBoundary';

// Feedback Components
export { Toast, ToastManager, ModalManager } from './...';
export { Modal, AlertModal, ConfirmModal } from './Modal';
export { SheetModal, ActionSheet, BottomSheet, SelectBottomSheet } from './...';

// Form Components
export { FormField, FormSection, FormRow } from './FormField';
export { FormSelect, Checkbox, CheckboxGroup, Radio } from './...';
export { DatePicker, DateRangePicker, CalendarPicker } from './...';
export { TimePicker, TimePickerGrid, TimeWheelPicker } from './...';

// Loading / Skeleton Components (15개 프리셋)
export { Loading, LoadingOverlay, InlineLoadingOverlay } from './...';
export {
  Skeleton, SkeletonText, SkeletonCard, SkeletonListItem, SkeletonAvatar,
  SkeletonButton, SkeletonJobCard, SkeletonScheduleCard,
  SkeletonNotificationItem, SkeletonApplicantCard, SkeletonProfileHeader,
  SkeletonStatsCard, SkeletonSettlementRow,
} from './Skeleton';

// Image Components
export { OptimizedImage, AvatarImage, BannerImage, ProductImage } from './OptimizedImage';

// Layout Components
export { MobileHeader, HeaderAction, LargeHeader } from './MobileHeader';
export { CircularProgress } from './CircularProgress';

// In-App Message Components
export { InAppBanner, InAppModal, InAppMessageManager } from './...';

// Network Status
export { OfflineBanner } from './OfflineBanner';
```

### 비즈니스 컴포넌트 (폴더별)

```typescript
// src/components/jobs/ (21개)
// 공고 목록, 상세, 지원 관련
export { JobCard, JobCardSkeleton } from './JobCard';
export { DateSlider } from './DateSlider';
export { DateRequirementDisplay, DateRequirementList } from './...';
export { FixedScheduleDisplay, GroupedDateRequirementDisplay } from './...';
export { AssignmentSelector } from './AssignmentSelector';  // 서브폴더
export { ApplicationForm } from './ApplicationForm';
// ...

// src/components/employer/ (62개)
// 공고 관리, 지원자 관리, 정산
export { ApplicantCard, ApplicantList } from './...';
export { ConfirmedStaffCard, ConfirmedStaffList } from './...';
export { SettlementCard, SettlementList, SettlementDetailModal } from './...';
export { EventQRModal, StaffManagementTab } from './...';
export { JobPostingScrollForm } from './job-form/JobPostingScrollForm';  // 서브폴더
// ...

// src/components/admin/ (12개)
export { UserCard, UserList, UserDetail, UserEditForm } from './...';
export { ReportCard, ApprovalModal } from './...';
export { AnnouncementCard, AnnouncementForm } from './announcements/...';
export { StatsSummaryCard, RoleDistributionChart } from './stats/...';

// src/components/schedule/ (9개)
export { ScheduleCard, ScheduleList } from './...';
// ...

// src/components/auth/ (13개)
export { LoginForm, ForgotPasswordForm, SocialLoginButtons } from './...';
export { SignupStep1, SignupStep2, SignupStep4 } from './signup/...';
export { IdentityVerification, PasswordStrength, StepIndicator } from './...';
export { BiometricButton } from './BiometricButton';
```
