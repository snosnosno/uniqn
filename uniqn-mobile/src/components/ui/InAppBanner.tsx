/**
 * UNIQN Mobile - 인앱 배너 컴포넌트
 *
 * @description 화면 상단에 표시되는 배너형 인앱 메시지
 * @version 1.0.0
 */

import { useCallback } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  SlideInUp,
  SlideOutUp,
} from 'react-native-reanimated';
import {
  XMarkIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  AlertCircleIcon,
  MegaphoneIcon,
  ArrowRightIcon,
} from '@/components/icons';
import type { InAppMessage, InAppMessagePriority } from '@/types/inAppMessage';

// ============================================================================
// Types
// ============================================================================

interface InAppBannerProps {
  message: InAppMessage;
  onDismiss: () => void;
  onDismissPermanently?: () => void;
}

// ============================================================================
// Styles by Priority
// ============================================================================

const PRIORITY_STYLES: Record<
  InAppMessagePriority,
  {
    container: string;
    text: string;
    icon: string;
    IconComponent: React.ComponentType<{ size?: number; color?: string }>;
  }
> = {
  low: {
    container: 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600',
    text: 'text-gray-700 dark:text-gray-300',
    icon: '#6B7280',
    IconComponent: InformationCircleIcon,
  },
  medium: {
    container: 'bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-700',
    text: 'text-primary-700 dark:text-primary-300',
    icon: '#3B82F6',
    IconComponent: MegaphoneIcon,
  },
  high: {
    container: 'bg-warning-50 dark:bg-warning-900/30 border-warning-200 dark:border-warning-700',
    text: 'text-warning-700 dark:text-warning-300',
    icon: '#F59E0B',
    IconComponent: ExclamationTriangleIcon,
  },
  critical: {
    container: 'bg-error-50 dark:bg-error-900/30 border-error-200 dark:border-error-700',
    text: 'text-error-700 dark:text-error-300',
    icon: '#EF4444',
    IconComponent: AlertCircleIcon,
  },
};

// ============================================================================
// Component
// ============================================================================

export function InAppBanner({ message, onDismiss, onDismissPermanently }: InAppBannerProps) {
  const insets = useSafeAreaInsets();
  const styles = PRIORITY_STYLES[message.priority];
  const IconComponent = styles.IconComponent;

  // Animation values
  const pressed = useSharedValue(false);

  const animatedPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressed.value ? 0.98 : 1 }],
    opacity: pressed.value ? 0.9 : 1,
  }));

  // Handlers
  const handleAction = useCallback(async () => {
    const action = message.primaryAction;
    if (!action) return;

    switch (action.type) {
      case 'link':
      case 'deeplink':
      case 'update':
        if (action.url) {
          await Linking.openURL(action.url);
        }
        break;
      case 'dismiss':
        onDismiss();
        break;
    }
  }, [message.primaryAction, onDismiss]);

  const handleDismiss = useCallback(() => {
    if (message.dismissible !== false) {
      onDismiss();
    }
  }, [message.dismissible, onDismiss]);

  const handleDismissPermanently = useCallback(() => {
    if (onDismissPermanently) {
      onDismissPermanently();
    }
  }, [onDismissPermanently]);

  return (
    <Animated.View
      entering={SlideInUp.springify().damping(15)}
      exiting={SlideOutUp.duration(200)}
      style={[{ paddingTop: insets.top }]}
      className={`absolute top-0 left-0 right-0 z-50 border-b ${styles.container}`}
    >
      <Animated.View style={animatedPressStyle}>
        <Pressable
          onPress={message.primaryAction ? handleAction : undefined}
          onPressIn={() => {
            if (message.primaryAction) {
              pressed.value = true;
            }
          }}
          onPressOut={() => {
            pressed.value = false;
          }}
          disabled={!message.primaryAction}
          className="px-4 py-3"
        >
          <View className="flex-row items-start">
            {/* Icon */}
            <View className="mr-3 mt-0.5">
              <IconComponent size={20} color={styles.icon} />
            </View>

            {/* Content */}
            <View className="flex-1">
              {message.title && (
                <Text className={`text-sm font-semibold ${styles.text}`} numberOfLines={1}>
                  {message.title}
                </Text>
              )}
              <Text className={`text-sm ${styles.text} mt-0.5`} numberOfLines={2}>
                {message.content}
              </Text>

              {/* Action Button */}
              {message.primaryAction && (
                <View className="flex-row items-center mt-2">
                  <Text className={`text-sm font-medium ${styles.text}`}>
                    {message.primaryAction.buttonText ?? '자세히 보기'}
                  </Text>
                  <ArrowRightIcon size={14} color={styles.icon} />
                </View>
              )}

              {/* Don't show again option */}
              {message.showDontShowAgain && onDismissPermanently && (
                <Pressable
                  onPress={handleDismissPermanently}
                  hitSlop={8}
                  className="mt-2 py-1 active:opacity-70"
                >
                  <Text className="text-xs text-gray-500 dark:text-gray-400 underline">
                    다시 보지 않기
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Close Button */}
            {message.dismissible !== false && (
              <Pressable
                onPress={handleDismiss}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                className="ml-2 p-1 active:opacity-70"
              >
                <XMarkIcon size={18} color={styles.icon} />
              </Pressable>
            )}
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

export default InAppBanner;
