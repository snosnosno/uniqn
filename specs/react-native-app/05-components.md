# 05. 컴포넌트 시스템 설계

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

## 비즈니스 컴포넌트

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
// src/components/ui/index.ts
export * from './Button';
export * from './Input';
export * from './Card';
export * from './Badge';
export * from './BottomSheet';
export * from './ConfirmModal';
export * from './AlertModal';
export * from './Toast';
export * from './ToastManager';
export * from './ModalManager';
export * from './Loading';
export * from './EmptyState';
export * from './Avatar';
export * from './Divider';
export * from './Switch';
export * from './Checkbox';
export * from './Radio';
export * from './Tabs';

// src/components/forms/index.ts
export * from './FormField';
export * from './FormSelect';
export * from './FormDatePicker';
export * from './FormTimePicker';
export * from './FormCheckbox';

// src/components/job/index.ts
export * from './JobCard';
export * from './JobFilters';
export * from './ApplicationStatus';
export * from './JobDetailSheet';

// src/components/schedule/index.ts
export * from './ScheduleCard';
export * from './CalendarView';
export * from './ScheduleStats';
export * from './ScheduleDetailSheet';

// src/components/admin/index.ts
export * from './UserCard';
export * from './InquiryCard';
export * from './ApprovalCard';
```
