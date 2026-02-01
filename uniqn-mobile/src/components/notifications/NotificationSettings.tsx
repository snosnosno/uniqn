/**
 * UNIQN Mobile - NotificationSettings 컴포넌트
 *
 * @description 알림 설정 관리 컴포넌트
 * @version 1.0.0
 */

import React, { memo, useCallback } from 'react';
import { View, Text, Switch, Pressable, ScrollView } from 'react-native';
import {
  BellIcon,
  BellSlashIcon,
  MoonIcon,
  DevicePhoneMobileIcon,
  ChevronRightIcon,
  Squares2X2Icon,
} from '@/components/icons';
import { Card } from '@/components/ui/Card';
import {
  NotificationCategory,
  NotificationSettings as NotificationSettingsType,
  NOTIFICATION_CATEGORY_LABELS,
} from '@/types/notification';

export interface NotificationSettingsProps {
  /** 현재 설정 */
  settings: NotificationSettingsType;
  /** 설정 변경 핸들러 */
  onSettingsChange: (settings: NotificationSettingsType) => void;
  /** 푸시 알림 권한 상태 */
  pushPermission?: {
    granted: boolean;
    canAskAgain: boolean;
  };
  /** 권한 요청 핸들러 */
  onRequestPermission?: () => void;
  /** 설정 앱 열기 핸들러 (권한 거부 + 재요청 불가 시) */
  onOpenSettings?: () => void;
  /** 저장 중 상태 */
  isSaving?: boolean;
}

// 카테고리별 아이콘과 설명
const categoryInfo: Record<NotificationCategory, { description: string; color: string }> = {
  [NotificationCategory.APPLICATION]: {
    description: '지원, 확정, 거절 관련 알림',
    color: 'bg-primary-500',
  },
  [NotificationCategory.ATTENDANCE]: {
    description: '출근, 퇴근, 리마인더 알림',
    color: 'bg-success-500',
  },
  [NotificationCategory.SETTLEMENT]: {
    description: '급여 정산 관련 알림',
    color: 'bg-warning-500',
  },
  [NotificationCategory.JOB]: {
    description: '새 공고, 마감 임박 알림',
    color: 'bg-primary-500',
  },
  [NotificationCategory.SYSTEM]: {
    description: '공지사항, 시스템 점검 알림',
    color: 'bg-gray-500',
  },
  [NotificationCategory.ADMIN]: {
    description: '문의 답변, 신고 처리 알림',
    color: 'bg-indigo-500',
  },
};

export const NotificationSettingsComponent = memo(function NotificationSettings({
  settings,
  onSettingsChange,
  pushPermission,
  onRequestPermission,
  onOpenSettings,
  isSaving = false,
}: NotificationSettingsProps) {
  // 전체 알림 토글
  const handleMasterToggle = useCallback(
    (enabled: boolean) => {
      onSettingsChange({
        ...settings,
        enabled,
      });
    },
    [settings, onSettingsChange]
  );

  // 카테고리 토글
  const handleCategoryToggle = useCallback(
    (category: NotificationCategory, enabled: boolean) => {
      onSettingsChange({
        ...settings,
        categories: {
          ...settings.categories,
          [category]: {
            ...settings.categories[category],
            enabled,
          },
        },
      });
    },
    [settings, onSettingsChange]
  );

  // 푸시 알림 토글
  const handlePushToggle = useCallback(
    (category: NotificationCategory, pushEnabled: boolean) => {
      onSettingsChange({
        ...settings,
        categories: {
          ...settings.categories,
          [category]: {
            ...settings.categories[category],
            pushEnabled,
          },
        },
      });
    },
    [settings, onSettingsChange]
  );

  // 방해 금지 모드 토글
  const handleQuietHoursToggle = useCallback(
    (enabled: boolean) => {
      onSettingsChange({
        ...settings,
        quietHours: {
          ...settings.quietHours,
          enabled,
          start: settings.quietHours?.start || '22:00',
          end: settings.quietHours?.end || '08:00',
        },
      });
    },
    [settings, onSettingsChange]
  );

  // 알림 그룹화 토글
  const handleGroupingToggle = useCallback(
    (enabled: boolean) => {
      onSettingsChange({
        ...settings,
        grouping: {
          ...settings.grouping,
          enabled,
          minGroupSize: settings.grouping?.minGroupSize || 2,
          timeWindowHours: settings.grouping?.timeWindowHours || 24,
        },
      });
    },
    [settings, onSettingsChange]
  );

  const categoryKeys = Object.values(NotificationCategory);

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-surface-dark" contentContainerClassName="p-4">
      {/* 푸시 알림 권한 영구 거부 배너 */}
      {pushPermission && !pushPermission.granted && !pushPermission.canAskAgain && (
        <Pressable
          onPress={onOpenSettings}
          className="mb-4 p-4 bg-error-100 dark:bg-error-900/30 rounded-xl flex-row items-center"
        >
          <BellSlashIcon size={24} color="#dc2626" />
          <View className="flex-1 ml-3">
            <Text className="text-error-800 dark:text-error-200 font-medium">
              알림 권한이 거부되었습니다
            </Text>
            <Text className="text-error-600 dark:text-error-400 text-sm">
              설정에서 알림 권한을 직접 허용해주세요
            </Text>
          </View>
          <ChevronRightIcon size={20} color="#dc2626" />
        </Pressable>
      )}

      {/* 푸시 알림 권한 요청 배너 */}
      {pushPermission && !pushPermission.granted && pushPermission.canAskAgain && (
        <Pressable
          onPress={onRequestPermission}
          className="mb-4 p-4 bg-warning-100 dark:bg-warning-900/30 rounded-xl flex-row items-center"
        >
          <DevicePhoneMobileIcon size={24} color="#d97706" />
          <View className="flex-1 ml-3">
            <Text className="text-warning-800 dark:text-warning-200 font-medium">
              푸시 알림이 꺼져있습니다
            </Text>
            <Text className="text-warning-600 dark:text-warning-400 text-sm">
              탭하여 알림 권한을 허용하세요
            </Text>
          </View>
        </Pressable>
      )}

      {/* 마스터 토글 */}
      <Card className="mb-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            {settings.enabled ? (
              <BellIcon size={24} color="#A855F7" />
            ) : (
              <BellSlashIcon size={24} color="#9ca3af" />
            )}
            <View className="ml-3">
              <Text className="text-base font-medium text-gray-900 dark:text-white">알림 받기</Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                모든 알림을 켜거나 끕니다
              </Text>
            </View>
          </View>
          <Switch
            value={settings.enabled}
            onValueChange={handleMasterToggle}
            trackColor={{ false: '#d1d5db', true: '#A855F7' }}
            thumbColor="#ffffff"
            disabled={isSaving}
          />
        </View>
      </Card>

      {/* 방해 금지 시간 */}
      <Card className="mb-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <MoonIcon size={24} color="#6b7280" />
            <View className="ml-3">
              <Text className="text-base font-medium text-gray-900 dark:text-white">
                방해 금지 시간
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                {settings.quietHours?.start || '22:00'} - {settings.quietHours?.end || '08:00'}
              </Text>
            </View>
          </View>
          <Switch
            value={settings.quietHours?.enabled || false}
            onValueChange={handleQuietHoursToggle}
            trackColor={{ false: '#d1d5db', true: '#A855F7' }}
            thumbColor="#ffffff"
            disabled={isSaving || !settings.enabled}
          />
        </View>
      </Card>

      {/* 알림 그룹화 */}
      <Card className="mb-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Squares2X2Icon size={24} color="#6b7280" />
            <View className="ml-3">
              <Text className="text-base font-medium text-gray-900 dark:text-white">
                알림 그룹화
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                같은 공고의 알림을 묶어서 표시
              </Text>
            </View>
          </View>
          <Switch
            value={settings.grouping?.enabled ?? true}
            onValueChange={handleGroupingToggle}
            trackColor={{ false: '#d1d5db', true: '#A855F7' }}
            thumbColor="#ffffff"
            disabled={isSaving || !settings.enabled}
          />
        </View>
      </Card>

      {/* 카테고리별 설정 */}
      <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase mb-2 px-1">
        카테고리별 설정
      </Text>

      <Card padding="none">
        {categoryKeys.map((category, index) => {
          const info = categoryInfo[category];
          const categorySettings = settings.categories[category];
          const isLast = index === categoryKeys.length - 1;

          return (
            <View
              key={category}
              className={`p-4 ${!isLast ? 'border-b border-gray-100 dark:border-surface' : ''}`}
            >
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center flex-1">
                  <View className={`w-3 h-3 rounded-full ${info.color} mr-2`} />
                  <Text className="text-base font-medium text-gray-900 dark:text-white">
                    {NOTIFICATION_CATEGORY_LABELS[category]}
                  </Text>
                </View>
                <Switch
                  value={categorySettings?.enabled ?? true}
                  onValueChange={(enabled) => handleCategoryToggle(category, enabled)}
                  trackColor={{ false: '#d1d5db', true: '#A855F7' }}
                  thumbColor="#ffffff"
                  disabled={isSaving || !settings.enabled}
                />
              </View>

              <Text className="text-sm text-gray-500 dark:text-gray-400 ml-5">
                {info.description}
              </Text>

              {/* 푸시 알림 토글 (서브 옵션) */}
              {categorySettings?.enabled && (
                <View className="flex-row items-center justify-between mt-3 ml-5 pt-3 border-t border-gray-100 dark:border-surface">
                  <Text className="text-sm text-gray-600 dark:text-gray-400">푸시 알림 받기</Text>
                  <Switch
                    value={categorySettings?.pushEnabled ?? true}
                    onValueChange={(pushEnabled) => handlePushToggle(category, pushEnabled)}
                    trackColor={{ false: '#d1d5db', true: '#A855F7' }}
                    thumbColor="#ffffff"
                    disabled={isSaving || !settings.enabled}
                  />
                </View>
              )}
            </View>
          );
        })}
      </Card>

      {/* 하단 안내 */}
      <Text className="text-xs text-gray-400 dark:text-gray-500 text-center mt-4 px-4">
        알림 설정은 자동으로 저장됩니다.
        {'\n'}
        푸시 알림을 받으려면 기기 설정에서도 알림을 허용해야 합니다.
      </Text>
    </ScrollView>
  );
});

export { NotificationSettingsComponent as NotificationSettings };
export default NotificationSettingsComponent;
