/**
 * UNIQN Mobile - Notification permission onboarding screen
 */

import { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import {
  type IconComponent,
  BanknotesIcon,
  BellIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  ClockIcon,
  SettingsIcon,
} from '@/components/icons';
import { PRIMARY_COLORS } from '@/constants/colors';

export type NotificationPermissionStage = 'request' | 'settings';

export interface NotificationPermissionScreenProps {
  onRequestPermission: () => Promise<boolean>;
  onDismiss: () => void;
  onOpenSettings: () => Promise<void>;
  stage?: NotificationPermissionStage;
  isLoading?: boolean;
}

const BENEFITS = [
  {
    icon: BriefcaseIcon,
    title: '새 공고 알림',
    description: '관심 있는 공고가 올라오면 바로 확인할 수 있어요.',
  },
  {
    icon: CheckCircleIcon,
    title: '지원 결과 알림',
    description: '지원 승인과 취소 결과를 놓치지 않게 알려드려요.',
  },
  {
    icon: ClockIcon,
    title: '출근 리마인드',
    description: '근무 시작 전에 필요한 안내를 제때 받아볼 수 있어요.',
  },
  {
    icon: BanknotesIcon,
    title: '정산 알림',
    description: '정산이 완료되면 바로 확인할 수 있어요.',
  },
] satisfies { icon: IconComponent; title: string; description: string }[];

const SETTINGS_TIPS = [
  {
    icon: SettingsIcon,
    title: '설정에서 알림 허용',
    description: 'OS 설정에서 앱 알림을 허용하면 다시 중요한 안내를 받을 수 있어요.',
  },
  {
    icon: BellIcon,
    title: '지원과 일정 알림 복구',
    description: '지원 결과, 출근, 정산 안내를 놓치지 않도록 바로 복구할 수 있어요.',
  },
] satisfies { icon: IconComponent; title: string; description: string }[];

export function NotificationPermissionScreen({
  onRequestPermission,
  onDismiss,
  onOpenSettings,
  stage = 'request',
  isLoading = false,
}: NotificationPermissionScreenProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const isSettingsStage = stage === 'settings';

  const content = useMemo(
    () =>
      isSettingsStage
        ? {
            badgeIcon: SettingsIcon,
            title: '설정에서 알림을 켜 주세요',
            description:
              '알림이 꺼져 있어 지원 결과와 일정 안내를 바로 전달할 수 없어요.\n설정에서 알림을 허용해 주세요.',
            primaryLabel: '설정 열기',
            secondaryLabel: '지금 닫기',
            helperText: '나중에 설정 > 알림에서 언제든 다시 변경할 수 있어요.',
            items: SETTINGS_TIPS,
          }
        : {
            badgeIcon: BellIcon,
            title: '알림을 켜 주세요',
            description: '중요한 소식을 놓치지 않도록\n알림을 허용해 주세요.',
            primaryLabel: '알림 허용하기',
            secondaryLabel: '지금 닫기',
            helperText: '나중에 설정 > 알림에서 언제든 다시 변경할 수 있어요.',
            items: BENEFITS,
          },
    [isSettingsStage]
  );

  const handlePrimaryAction = useCallback(async () => {
    setIsProcessing(true);
    try {
      if (isSettingsStage) {
        await onOpenSettings();
      } else {
        await onRequestPermission();
      }
    } finally {
      setIsProcessing(false);
    }
  }, [isSettingsStage, onOpenSettings, onRequestPermission]);

  const loading = isLoading || isProcessing;
  const BadgeIcon = content.badgeIcon;

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-white dark:bg-surface-dark">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View className="flex-1 px-6 py-8">
          <Animated.View
            entering={FadeInUp.delay(100).duration(500)}
            className="mb-8 items-center pt-4"
          >
            <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30">
              <BadgeIcon size={40} color={PRIMARY_COLORS[500]} />
            </View>
            <Text className="text-center text-2xl font-bold text-gray-900 dark:text-white">
              {content.title}
            </Text>
            <Text className="mt-2 text-center text-base text-gray-500 dark:text-gray-400">
              {content.description}
            </Text>
          </Animated.View>

          <View className="flex-1 justify-center">
            {content.items.map((item, index) => {
              const ItemIcon = item.icon;

              return (
                <Animated.View
                  key={item.title}
                  entering={FadeInUp.delay(200 + index * 100).duration(500)}
                  className="mb-3 flex-row items-center rounded-xl bg-gray-50 px-4 py-4 dark:bg-surface"
                >
                  <View className="mr-4 h-12 w-12 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30">
                    <ItemIcon size={24} color={PRIMARY_COLORS[500]} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900 dark:text-white">
                      {item.title}
                    </Text>
                    <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                      {item.description}
                    </Text>
                  </View>
                </Animated.View>
              );
            })}
          </View>

          <Animated.View entering={FadeInDown.delay(600).duration(500)} className="mt-auto pb-4">
            <Pressable
              onPress={handlePrimaryAction}
              disabled={loading}
              accessibilityRole="button"
              accessibilityState={{ disabled: loading }}
              accessibilityLabel={content.primaryLabel}
              className={`mb-3 items-center rounded-xl py-4 ${
                loading
                  ? 'bg-primary-400 dark:bg-primary-800'
                  : 'bg-primary-600 active:bg-primary-700 dark:bg-primary-700 dark:active:bg-primary-600'
              }`}
            >
              <Text className="text-base font-semibold text-white">
                {loading ? '처리 중...' : content.primaryLabel}
              </Text>
            </Pressable>

            <Pressable
              onPress={onDismiss}
              disabled={loading}
              accessibilityRole="button"
              accessibilityState={{ disabled: loading }}
              accessibilityLabel={content.secondaryLabel}
              className="items-center rounded-xl py-4"
            >
              <Text className="text-base text-gray-500 dark:text-gray-400">
                {content.secondaryLabel}
              </Text>
            </Pressable>

            <Text className="mt-4 text-center text-xs text-gray-400 dark:text-gray-500">
              {content.helperText}
            </Text>
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default NotificationPermissionScreen;
