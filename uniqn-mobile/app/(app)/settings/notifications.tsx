/**
 * UNIQN Mobile - Notification Settings Screen
 * 알림 설정 전용 화면 — 권한 배너·푸시 마스터/카테고리 토글·마케팅 수신
 */

import { SECONDARY_PALETTE, STATUS_COLORS } from '@/constants/colors';
import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Switch, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackHeader } from '@/components/headers';
import { Card, Divider } from '@/components/ui';
import { SettingItem } from '@/components/settings';
import { BellIcon, BellSlashIcon, ChevronRightIcon } from '@/components/icons';
import { pushNotificationService } from '@/services/notifications/pushNotificationService';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import {
  useNotificationSettingsQuery,
  useSaveNotificationSettings,
} from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';
import { updateMarketingConsent } from '@/services/auth';
import { logger } from '@/utils/logger';
import { triggerHaptic } from '@/utils/haptics';
import { NotificationCategory, NOTIFICATION_CATEGORY_LABELS } from '@/types/notification';

// 설정 화면에 노출하는 알림 카테고리 (M3) — admin은 일반 사용자 비대상이라 제외
const NOTIFICATION_SETTING_CATEGORIES: NotificationCategory[] = [
  NotificationCategory.APPLICATION,
  NotificationCategory.ATTENDANCE,
  NotificationCategory.SETTLEMENT,
  NotificationCategory.JOB,
  NotificationCategory.REVIEW,
  NotificationCategory.SYSTEM,
];

export default function NotificationSettingsScreen() {
  const { isAuthenticated, profile, user } = useAuth();

  // 마케팅 동의 상태
  const [isMarketingUpdating, setIsMarketingUpdating] = useState(false);
  const setProfile = useAuthStore((state) => state.setProfile);
  const addToast = useToastStore((state) => state.addToast);

  // 알림 설정 (로그인 상태에서만)
  const { data: notificationSettings } = useNotificationSettingsQuery();
  const { saveSettings, isSaving } = useSaveNotificationSettings();

  // 알림 권한 상태 (useNotificationHandler 중복 호출 방지 — 경량 체크)
  const [permissionStatus, setPermissionStatus] = useState<
    'granted' | 'denied' | 'undetermined' | null
  >(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    pushNotificationService.checkPermission().then((result) => {
      setPermissionStatus(result.status);
    });
  }, []);

  const handleRequestPermission = useCallback(async () => {
    const result = await pushNotificationService.requestPermission();
    setPermissionStatus(result.status);
  }, []);

  const handleOpenSettings = useCallback(async () => {
    if (Platform.OS === 'ios') {
      await Linking.openURL('app-settings:');
    } else {
      await Linking.openSettings();
    }
  }, []);

  // 푸시 알림 토글 (§17 — Light)
  const handlePushToggle = (value: boolean) => {
    void triggerHaptic('light');
    if (notificationSettings) {
      saveSettings({
        ...notificationSettings,
        pushEnabled: value,
      });
    }
  };

  // 카테고리별 알림 토글 (M3) — 토글 1개가 enabled/pushEnabled를 함께 제어.
  // 발송(Edge Function send-push-notification)과 포그라운드 표시가 이 값을 존중한다.
  const handleCategoryToggle = (category: NotificationCategory, value: boolean) => {
    void triggerHaptic('light');
    if (notificationSettings) {
      saveSettings({
        ...notificationSettings,
        categories: {
          ...notificationSettings.categories,
          [category]: { enabled: value, pushEnabled: value },
        },
      });
    }
  };

  const isPushMasterOff = notificationSettings?.pushEnabled === false;

  // 마케팅 정보 수신 토글 핸들러 (§17 — Light)
  const handleMarketingConsentChange = async (value: boolean) => {
    if (!user?.uid || !profile) return;

    void triggerHaptic('light');

    // 낙관적 반영 — Switch가 서버 왕복 동안 옛 위치에 멈추지 않도록 즉시 이동
    const previousMarketing = profile.marketingAgreed ?? false;
    setProfile({
      ...profile,
      marketingAgreed: value,
      updatedAt: new Date(),
    });
    setIsMarketingUpdating(true);
    try {
      await updateMarketingConsent(user.uid, value);

      addToast({
        type: 'success',
        message: value ? '마케팅 수신에 동의했습니다.' : '마케팅 수신 동의를 철회했습니다.',
      });
    } catch (error) {
      // 롤백 — 실패 시 이전 동의 상태로 복원
      setProfile({
        ...profile,
        marketingAgreed: previousMarketing,
        updatedAt: new Date(),
      });
      logger.error('마케팅 동의 업데이트 실패', error as Error);
      addToast({
        type: 'error',
        message: '동의 상태 변경에 실패했습니다.',
      });
    } finally {
      setIsMarketingUpdating(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="알림 설정" fallbackHref="/(app)/settings" />
      <ScrollView className="flex-1" contentContainerClassName="p-4">
        {/* 푸시 알림 */}
        <Card className="mb-4">
          <Text className="text-micro uppercase tracking-wider text-content-muted font-sans-bold mb-2">
            푸시 알림
          </Text>
          {permissionStatus === 'denied' && (
            <Pressable
              onPress={handleOpenSettings}
              className="mb-3 p-3 bg-error-50 dark:bg-error-900/20 rounded-lg flex-row items-center"
            >
              <BellSlashIcon size={20} color={STATUS_COLORS.error} />
              <Text className="flex-1 ml-2 text-error-700 dark:text-error-300 text-sm font-sans">
                알림 권한이 거부되었습니다. 탭하여 설정에서 허용해주세요.
              </Text>
              <ChevronRightIcon size={16} color={STATUS_COLORS.error} />
            </Pressable>
          )}
          {permissionStatus === 'undetermined' && (
            <Pressable
              onPress={handleRequestPermission}
              className="mb-3 p-3 bg-warning-50 dark:bg-warning-900/20 rounded-lg flex-row items-center"
            >
              <BellIcon size={20} color={STATUS_COLORS.warning} />
              <Text className="flex-1 ml-2 text-warning-700 dark:text-warning-300 text-sm font-sans">
                푸시 알림이 꺼져있습니다. 탭하여 허용해주세요.
              </Text>
            </Pressable>
          )}
          <SettingItem
            icon={<BellIcon size={22} color={SECONDARY_PALETTE[500]} />}
            label="푸시 알림"
            rightElement={
              <Switch
                value={notificationSettings?.pushEnabled ?? true}
                onValueChange={handlePushToggle}
                disabled={isSaving || !isAuthenticated}
                trackColor={{ false: SECONDARY_PALETTE[200], true: '#D4AF37' }}
                thumbColor={notificationSettings?.pushEnabled ? '#FFFFFF' : SECONDARY_PALETTE[50]}
              />
            }
          />

          {/* 카테고리별 알림 설정 (M3) — 마스터 토글 OFF 시 비활성 */}
          {isAuthenticated && (
            <View className={isPushMasterOff ? 'opacity-40' : ''}>
              {NOTIFICATION_SETTING_CATEGORIES.map((category) => {
                const categoryEnabled =
                  notificationSettings?.categories?.[category]?.enabled ?? true;
                return (
                  <View key={category}>
                    <Divider spacing="sm" />
                    <SettingItem
                      // 마스터 행 아이콘(22px)과 정렬을 맞추는 들여쓰기 스페이서
                      icon={<View style={{ width: 22 }} />}
                      label={NOTIFICATION_CATEGORY_LABELS[category]}
                      rightElement={
                        <Switch
                          value={categoryEnabled}
                          onValueChange={(value) => handleCategoryToggle(category, value)}
                          disabled={isSaving || !isAuthenticated || isPushMasterOff}
                          trackColor={{ false: SECONDARY_PALETTE[200], true: '#D4AF37' }}
                          thumbColor={categoryEnabled ? '#FFFFFF' : SECONDARY_PALETTE[50]}
                        />
                      }
                    />
                  </View>
                );
              })}
              <Text className="mt-1 text-xs text-content-muted dark:text-secondary-400 font-sans">
                카테고리를 끄면 해당 알림의 푸시 수신과 앱 사용 중 표시가 중단됩니다.
              </Text>
            </View>
          )}
        </Card>

        {/* 마케팅 정보 수신 */}
        {isAuthenticated && (
          <Card className="mb-4">
            <Text className="text-micro uppercase tracking-wider text-content-muted font-sans-bold mb-2">
              마케팅
            </Text>
            <SettingItem
              icon={<BellIcon size={22} color={SECONDARY_PALETTE[500]} />}
              label="마케팅 정보 수신"
              rightElement={
                <Switch
                  value={profile?.marketingAgreed ?? false}
                  onValueChange={handleMarketingConsentChange}
                  disabled={isMarketingUpdating}
                  trackColor={{ false: SECONDARY_PALETTE[200], true: '#D4AF37' }}
                  thumbColor={profile?.marketingAgreed ? '#FFFFFF' : SECONDARY_PALETTE[50]}
                />
              }
            />
            <Text className="mt-1 text-xs text-content-muted dark:text-secondary-400 font-sans">
              이벤트·혜택 소식을 푸시와 문자로 받아볼 수 있습니다.
            </Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
