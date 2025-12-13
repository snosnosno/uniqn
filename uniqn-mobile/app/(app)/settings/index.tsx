/**
 * UNIQN Mobile - Settings Screen
 * 설정 메인 화면
 */

import { View, Text, ScrollView, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Divider } from '@/components/ui';
import {
  BellIcon,
  LockIcon,
  UserIcon,
  ChevronRightIcon,
} from '@/components/icons';
import { useState } from 'react';

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
  const [pushEnabled, setPushEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

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
                value={pushEnabled}
                onValueChange={setPushEnabled}
                trackColor={{ false: '#E5E7EB', true: '#93C5FD' }}
                thumbColor={pushEnabled ? '#3B82F6' : '#f4f3f4'}
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
            onPress={() => {}}
          />
          <Divider spacing="sm" />
          <SettingItem
            icon={<LockIcon size={22} color="#6B7280" />}
            label="비밀번호 변경"
            onPress={() => {}}
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
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{ false: '#E5E7EB', true: '#93C5FD' }}
                thumbColor={darkMode ? '#3B82F6' : '#f4f3f4'}
              />
            }
          />
        </Card>

        {/* 앱 정보 */}
        <Card>
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
            onPress={() => {}}
          />
          <Divider spacing="sm" />
          <SettingItem
            icon={<View className="h-[22px] w-[22px]" />}
            label="개인정보처리방침"
            onPress={() => {}}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
