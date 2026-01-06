/**
 * UNIQN Mobile - Profile Screen
 * 프로필 화면
 */

import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
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
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { signOut } from '@/services/authService';
import { useToastStore } from '@/stores/toastStore';
import { useState } from 'react';

// 역할 한글 변환
const ROLE_LABELS: Record<string, string> = {
  admin: '관리자',
  employer: '구인자',
  staff: '스태프',
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
  const { profile, isLoading, user } = useAuth();
  const reset = useAuthStore((state) => state.reset);
  const addToast = useToastStore((state) => state.addToast);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      '로그아웃',
      '정말 로그아웃 하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '로그아웃',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await signOut();
              reset();
              router.replace('/(auth)/login');
            } catch {
              addToast({ type: 'error', message: '로그아웃에 실패했습니다' });
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  // 로딩 상태
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
        <ActivityIndicator size="large" color="#3B82F6" />
      </SafeAreaView>
    );
  }

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
            <Avatar
              name={profile?.name ?? user?.displayName ?? '사용자'}
              size="xl"
              imageUrl={profile?.photoURL ?? user?.photoURL ?? undefined}
            />
            <View className="ml-4 flex-1">
              <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {profile?.name ?? user?.displayName ?? '이름 없음'}
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                {profile?.email ?? user?.email ?? '이메일 없음'}
              </Text>
              <View className="mt-1 flex-row items-center">
                <View className="rounded-full bg-primary-100 px-2 py-0.5 dark:bg-primary-900/30">
                  <Text className="text-xs font-medium text-primary-700 dark:text-primary-300">
                    {profile?.role ? ROLE_LABELS[profile.role] ?? profile.role : '미설정'}
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
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            onPress={() => {}} // TODO: 고객센터 기능 구현
          />
        </Card>

        {/* 로그아웃 */}
        <Card>
          <MenuItem
            icon={
              isLoggingOut ? (
                <ActivityIndicator size={22} color="#EF4444" />
              ) : (
                <LogOutIcon size={22} color="#EF4444" />
              )
            }
            label={isLoggingOut ? '로그아웃 중...' : '로그아웃'}
            onPress={isLoggingOut ? () => {} : handleLogout}
            danger
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
