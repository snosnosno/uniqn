/**
 * UNIQN Mobile - 인앱 모달 컴포넌트
 *
 * @description 화면 중앙에 표시되는 모달형 인앱 메시지
 * @version 1.0.0
 */

import { useCallback } from 'react';
import { View, Text, Pressable, Linking, useWindowDimensions, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  FadeIn,
  FadeOut,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';
import {
  XMarkIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  AlertCircleIcon,
  MegaphoneIcon,
} from '@/components/icons';
import type { InAppMessage, InAppMessagePriority } from '@/types/inAppMessage';

// ============================================================================
// Types
// ============================================================================

interface InAppModalProps {
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
    header: string;
    headerText: string;
    icon: string;
    primaryButton: string;
    primaryButtonText: string;
    IconComponent: React.ComponentType<{ size?: number; color?: string }>;
  }
> = {
  low: {
    header: 'bg-gray-100 dark:bg-gray-700',
    headerText: 'text-gray-700 dark:text-gray-300',
    icon: '#6B7280',
    primaryButton: 'bg-gray-600 dark:bg-gray-500',
    primaryButtonText: 'text-white',
    IconComponent: InformationCircleIcon,
  },
  medium: {
    header: 'bg-primary-100 dark:bg-primary-900/50',
    headerText: 'text-primary-700 dark:text-primary-300',
    icon: '#3B82F6',
    primaryButton: 'bg-primary-600 dark:bg-primary-500',
    primaryButtonText: 'text-white',
    IconComponent: MegaphoneIcon,
  },
  high: {
    header: 'bg-warning-100 dark:bg-warning-900/50',
    headerText: 'text-warning-700 dark:text-warning-300',
    icon: '#F59E0B',
    primaryButton: 'bg-warning-600 dark:bg-warning-500',
    primaryButtonText: 'text-white',
    IconComponent: ExclamationTriangleIcon,
  },
  critical: {
    header: 'bg-error-100 dark:bg-error-900/50',
    headerText: 'text-error-700 dark:text-error-300',
    icon: '#EF4444',
    primaryButton: 'bg-error-600 dark:bg-error-500',
    primaryButtonText: 'text-white',
    IconComponent: AlertCircleIcon,
  },
};

// ============================================================================
// Component
// ============================================================================

export function InAppModal({ message, onDismiss, onDismissPermanently }: InAppModalProps) {
  const { width } = useWindowDimensions();
  const styles = PRIORITY_STYLES[message.priority];
  const IconComponent = styles.IconComponent;
  const isFullscreen = message.type === 'fullscreen';

  // Animation
  const primaryPressed = useSharedValue(false);
  const secondaryPressed = useSharedValue(false);

  const primaryButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: primaryPressed.value ? 0.95 : 1 }],
  }));

  const secondaryButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: secondaryPressed.value ? 0.95 : 1 }],
  }));

  // Handlers
  const handleAction = useCallback(
    async (action: InAppMessage['primaryAction']) => {
      if (!action) {
        onDismiss();
        return;
      }

      switch (action.type) {
        case 'link':
        case 'deeplink':
        case 'update':
          if (action.url) {
            await Linking.openURL(action.url);
          }
          onDismiss();
          break;
        case 'dismiss':
          onDismiss();
          break;
      }
    },
    [onDismiss]
  );

  const handlePrimaryAction = useCallback(() => {
    handleAction(message.primaryAction);
  }, [handleAction, message.primaryAction]);

  const handleSecondaryAction = useCallback(() => {
    if (message.secondaryAction) {
      handleAction(message.secondaryAction);
    } else {
      onDismiss();
    }
  }, [handleAction, message.secondaryAction, onDismiss]);

  const handleDismissPermanently = useCallback(() => {
    if (onDismissPermanently) {
      onDismissPermanently();
    }
  }, [onDismissPermanently]);

  // Fullscreen 모달
  if (isFullscreen) {
    return (
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        className="absolute inset-0 z-50 bg-white dark:bg-gray-900"
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow justify-center items-center p-6"
        >
          {/* 이미지 */}
          {message.imageUrl && (
            <Image
              source={{ uri: message.imageUrl }}
              style={{ width: width - 48, height: (width - 48) * 0.6 }}
              contentFit="cover"
              className="rounded-xl mb-6"
            />
          )}

          {/* 아이콘 */}
          {!message.imageUrl && (
            <View
              className={`w-20 h-20 rounded-full items-center justify-center mb-6 ${styles.header}`}
            >
              <IconComponent size={40} color={styles.icon} />
            </View>
          )}

          {/* 타이틀 */}
          <Text className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mb-4">
            {message.title}
          </Text>

          {/* 콘텐츠 */}
          <Text className="text-base text-center text-gray-600 dark:text-gray-400 mb-8 leading-6">
            {message.content}
          </Text>

          {/* 버튼 */}
          <View className="w-full space-y-3">
            <Animated.View style={primaryButtonStyle}>
              <Pressable
                onPress={handlePrimaryAction}
                onPressIn={() => {
                  primaryPressed.value = true;
                }}
                onPressOut={() => {
                  primaryPressed.value = false;
                }}
                className={`w-full py-4 rounded-xl items-center ${styles.primaryButton}`}
              >
                <Text className={`text-base font-semibold ${styles.primaryButtonText}`}>
                  {message.primaryAction?.buttonText ?? '확인'}
                </Text>
              </Pressable>
            </Animated.View>

            {message.secondaryAction && (
              <Animated.View style={secondaryButtonStyle}>
                <Pressable
                  onPress={handleSecondaryAction}
                  onPressIn={() => {
                    secondaryPressed.value = true;
                  }}
                  onPressOut={() => {
                    secondaryPressed.value = false;
                  }}
                  className="w-full py-4 rounded-xl items-center bg-gray-100 dark:bg-gray-800"
                >
                  <Text className="text-base font-semibold text-gray-700 dark:text-gray-300">
                    {message.secondaryAction.buttonText ?? '나중에'}
                  </Text>
                </Pressable>
              </Animated.View>
            )}

            {message.showDontShowAgain && onDismissPermanently && (
              <Pressable
                onPress={handleDismissPermanently}
                className="py-2 items-center active:opacity-70"
              >
                <Text className="text-sm text-gray-500 dark:text-gray-400 underline">
                  다시 보지 않기
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </Animated.View>
    );
  }

  // 일반 모달
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      className="absolute inset-0 z-50 items-center justify-center bg-black/50"
    >
      <Pressable
        className="absolute inset-0"
        onPress={message.dismissible !== false ? onDismiss : undefined}
      />

      <Animated.View
        entering={ZoomIn.springify().damping(15)}
        exiting={ZoomOut.duration(200)}
        style={{ width: width - 48 }}
        className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-2xl"
      >
        {/* Header with icon */}
        <View className={`px-4 py-3 flex-row items-center ${styles.header}`}>
          <IconComponent size={20} color={styles.icon} />
          <Text className={`ml-2 font-semibold ${styles.headerText}`}>
            {message.priority === 'critical' ? '중요 알림' : '알림'}
          </Text>

          {message.dismissible !== false && (
            <Pressable
              onPress={onDismiss}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              className="ml-auto p-1 active:opacity-70"
            >
              <XMarkIcon size={18} color={styles.icon} />
            </Pressable>
          )}
        </View>

        {/* Content */}
        <View className="p-4">
          {/* 이미지 */}
          {message.imageUrl && (
            <Image
              source={{ uri: message.imageUrl }}
              style={{ width: '100%', height: 160 }}
              contentFit="cover"
              className="rounded-lg mb-4"
            />
          )}

          {/* 타이틀 */}
          {message.title && (
            <Text className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
              {message.title}
            </Text>
          )}

          {/* 콘텐츠 */}
          <Text className="text-sm text-gray-600 dark:text-gray-400 leading-5">
            {message.content}
          </Text>
        </View>

        {/* Actions */}
        <View className="px-4 pb-4 space-y-2">
          <Animated.View style={primaryButtonStyle}>
            <Pressable
              onPress={handlePrimaryAction}
              onPressIn={() => {
                primaryPressed.value = true;
              }}
              onPressOut={() => {
                primaryPressed.value = false;
              }}
              className={`w-full py-3 rounded-lg items-center ${styles.primaryButton}`}
            >
              <Text className={`text-sm font-semibold ${styles.primaryButtonText}`}>
                {message.primaryAction?.buttonText ?? '확인'}
              </Text>
            </Pressable>
          </Animated.View>

          {message.secondaryAction && (
            <Animated.View style={secondaryButtonStyle}>
              <Pressable
                onPress={handleSecondaryAction}
                onPressIn={() => {
                  secondaryPressed.value = true;
                }}
                onPressOut={() => {
                  secondaryPressed.value = false;
                }}
                className="w-full py-3 rounded-lg items-center bg-gray-100 dark:bg-gray-700"
              >
                <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {message.secondaryAction.buttonText ?? '나중에'}
                </Text>
              </Pressable>
            </Animated.View>
          )}

          {message.showDontShowAgain && onDismissPermanently && (
            <Pressable
              onPress={handleDismissPermanently}
              className="py-2 items-center active:opacity-70"
            >
              <Text className="text-xs text-gray-500 dark:text-gray-400 underline">
                다시 보지 않기
              </Text>
            </Pressable>
          )}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

export default InAppModal;
