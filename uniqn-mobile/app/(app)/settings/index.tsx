/**
 * UNIQN Mobile - Settings Screen
 * 설정 메인 화면
 */

import { View, Text, ScrollView, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Card, Divider } from '@/components/ui';
import { DangerZone } from '@/components/settings';
import {
  BellIcon,
  LockIcon,
  UserIcon,
  ChevronRightIcon,
} from '@/components/icons';
import { useThemeStore } from '@/stores/themeStore';
import {
  useNotificationSettingsQuery,
  useSaveNotificationSettings,
} from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';

// 태양 아이콘 (다크모드용)
const SunIcon = ({ size = 24, color = '#6B7280' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ fontSize: size * 0.7, color }}>☀️</Text>
  </View>
);

interface SettingItemProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
}

function SettingItem({ icon, label, value, onPress, rightElement }: SettingItemProps) {
  const content = (
    <View className="flex-row items-center justify-between py-3">
      <View className="flex-row items-center">
        <View className="mr-3">{icon}</View>
        <Text className="text-base text-gray-900 dark:text-gray-100">{label}</Text>
      </View>
      {rightElement || (
        <View className="flex-row items-center">
          {value && <Text className="mr-2 text-gray-500 dark:text-gray-400">{value}</Text>}
          <ChevronRightIcon size={20} color="#9CA3AF" />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} className="active:opacity-70">
        {content}
      </Pressable>
    );
  }

  return content;
}

export default function SettingsScreen() {
  const { isAuthenticated } = useAuth();

  // 테마 설정
  const { isDarkMode, setTheme } = useThemeStore();

  // 알림 설정 (로그인 상태에서만)
  const { data: notificationSettings } = useNotificationSettingsQuery();
  const { saveSettings, isSaving } = useSaveNotificationSettings();

  // 푸시 알림 토글
  const handlePushToggle = (value: boolean) => {
    if (notificationSettings) {
      saveSettings({
        ...notificationSettings,
        pushEnabled: value,
      });
    }
  };

  // 다크모드 토글
  const handleDarkModeToggle = (value: boolean) => {
    setTheme(value ? 'dark' : 'light');
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['bottom']}>
      <ScrollView className="flex-1" contentContainerClassName="p-4">
        {/* 알림 설정 */}
        <Card className="mb-4">
          <Text className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
            알림
          </Text>
          <SettingItem
            icon={<BellIcon size={22} color="#6B7280" />}
            label="푸시 알림"
            rightElement={
              <Switch
                value={notificationSettings?.pushEnabled ?? true}
                onValueChange={handlePushToggle}
                disabled={isSaving || !isAuthenticated}
                trackColor={{ false: '#E5E7EB', true: '#93C5FD' }}
                thumbColor={notificationSettings?.pushEnabled ? '#3B82F6' : '#f4f3f4'}
              />
            }
          />
        </Card>

        {/* 계정 설정 */}
        <Card className="mb-4">
          <Text className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
            계정
          </Text>
          <SettingItem
            icon={<UserIcon size={22} color="#6B7280" />}
            label="프로필 수정"
            onPress={() => router.push('/(app)/settings/profile')}
          />
          <Divider spacing="sm" />
          <SettingItem
            icon={<LockIcon size={22} color="#6B7280" />}
            label="비밀번호 변경"
            onPress={() => router.push('/(app)/settings/change-password')}
          />
        </Card>

        {/* 앱 설정 */}
        <Card className="mb-4">
          <Text className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
            앱 설정
          </Text>
          <SettingItem
            icon={<SunIcon size={22} color="#6B7280" />}
            label="다크 모드"
            rightElement={
              <Switch
                value={isDarkMode}
                onValueChange={handleDarkModeToggle}
                trackColor={{ false: '#E5E7EB', true: '#93C5FD' }}
                thumbColor={isDarkMode ? '#3B82F6' : '#f4f3f4'}
              />
            }
          />
        </Card>

        {/* 앱 정보 */}
        <Card className="mb-4">
          <Text className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
            정보
          </Text>
          <SettingItem
            icon={<View className="h-[22px] w-[22px]" />}
            label="버전"
            value="1.0.0"
          />
          <Divider spacing="sm" />
          <SettingItem
            icon={<View className="h-[22px] w-[22px]" />}
            label="이용약관"
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            onPress={() => {}} // TODO: 이용약관 화면 구현
          />
          <Divider spacing="sm" />
          <SettingItem
            icon={<View className="h-[22px] w-[22px]" />}
            label="개인정보처리방침"
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            onPress={() => {}} // TODO: 개인정보처리방침 화면 구현
          />
        </Card>

        {/* 위험 영역 - 계정 삭제 */}
        {isAuthenticated && (
          <DangerZone
            onDeleteAccount={() => router.push('/(app)/settings/delete-account')}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
