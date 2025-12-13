/**
 * UNIQN Mobile - Profile Screen
 * 프로필 화면
 */

import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Card, Avatar, Divider } from '@/components/ui';
import {
  SettingsIcon,
  ChevronRightIcon,
  BellIcon,
  LockIcon,
  MessageIcon,
  LogOutIcon,
} from '@/components/icons';

// 임시 사용자 데이터
const MOCK_USER = {
  name: '홍길동',
  email: 'user@example.com',
  phone: '010-1234-5678',
  role: '딜러',
};

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
}

function MenuItem({ icon, label, onPress, danger }: MenuItemProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between py-3 active:opacity-70"
    >
      <View className="flex-row items-center">
        <View className="mr-3">{icon}</View>
        <Text
          className={`text-base ${
            danger ? 'text-error-600 dark:text-error-400' : 'text-gray-900 dark:text-gray-100'
          }`}
        >
          {label}
        </Text>
      </View>
      <ChevronRightIcon size={20} color="#9CA3AF" />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const handleLogout = () => {
    // TODO: 로그아웃 처리
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['top']}>
      {/* 헤더 */}
      <View className="flex-row items-center justify-between bg-white px-4 py-3 dark:bg-gray-800">
        <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">프로필</Text>
        <Pressable
          onPress={() => router.push('/(app)/settings')}
          className="p-2"
          hitSlop={8}
        >
          <SettingsIcon size={24} color="#6B7280" />
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-4">
        {/* 프로필 정보 */}
        <Card className="mb-4">
          <View className="flex-row items-center">
            <Avatar name={MOCK_USER.name} size="xl" />
            <View className="ml-4 flex-1">
              <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {MOCK_USER.name}
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">{MOCK_USER.email}</Text>
              <View className="mt-1 flex-row items-center">
                <View className="rounded-full bg-primary-100 px-2 py-0.5 dark:bg-primary-900/30">
                  <Text className="text-xs font-medium text-primary-700 dark:text-primary-300">
                    {MOCK_USER.role}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </Card>

        {/* 메뉴 */}
        <Card className="mb-4">
          <MenuItem
            icon={<BellIcon size={22} color="#6B7280" />}
            label="알림 설정"
            onPress={() => router.push('/(app)/settings')}
          />
          <Divider spacing="sm" />
          <MenuItem
            icon={<LockIcon size={22} color="#6B7280" />}
            label="보안 설정"
            onPress={() => router.push('/(app)/settings')}
          />
          <Divider spacing="sm" />
          <MenuItem
            icon={<MessageIcon size={22} color="#6B7280" />}
            label="고객센터"
            onPress={() => {}}
          />
        </Card>

        {/* 로그아웃 */}
        <Card>
          <MenuItem
            icon={<LogOutIcon size={22} color="#EF4444" />}
            label="로그아웃"
            onPress={handleLogout}
            danger
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
