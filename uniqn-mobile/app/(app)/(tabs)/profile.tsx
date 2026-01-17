/**
 * UNIQN Mobile - Profile Screen
 * 프로필 화면
 */

import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
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
  QrCodeIcon,
  ShieldIcon,
  EditIcon,
  MegaphoneIcon,
} from '@/components/icons';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { useUnreadCountRealtime } from '@/hooks/useNotifications';
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
  const { profile, isLoading, user, isAdmin } = useAuth();
  const reset = useAuthStore((state) => state.reset);
  const addToast = useToastStore((state) => state.addToast);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const unreadCount = useUnreadCountRealtime();

  const handleLogout = () => {
    const performLogout = async () => {
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
    };

    if (Platform.OS === 'web') {
      // 웹에서는 window.confirm 사용
      if (window.confirm('정말 로그아웃 하시겠습니까?')) {
        performLogout();
      }
    } else {
      // 네이티브에서는 Alert.alert 사용
      Alert.alert(
        '로그아웃',
        '정말 로그아웃 하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '로그아웃',
            style: 'destructive',
            onPress: performLogout,
          },
        ]
      );
    }
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
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => router.push('/(app)/(tabs)/qr')}
            className="p-2"
            hitSlop={8}
          >
            <QrCodeIcon size={24} color="#6B7280" />
          </Pressable>
          <Pressable
            onPress={() => router.push('/(app)/notifications')}
            className="p-2"
            hitSlop={8}
          >
            <BellIcon size={24} color="#6B7280" />
            {unreadCount > 0 && (
              <View className="absolute -right-1 -top-1 min-w-[18px] items-center justify-center rounded-full bg-error-500 px-1">
                <Text className="text-[10px] font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </Pressable>
          <Pressable
            onPress={() => router.push('/(app)/settings')}
            className="p-2"
            hitSlop={8}
          >
            <SettingsIcon size={24} color="#6B7280" />
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-4">
        {/* 프로필 정보 */}
        <Card className="mb-4">
          <Pressable
            onPress={() => router.push('/(app)/settings/profile')}
            className="flex-row items-center active:opacity-70"
          >
            <Avatar
              name={profile?.name ?? user?.displayName ?? '사용자'}
              size="xl"
              source={profile?.photoURL ?? user?.photoURL ?? undefined}
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
            <EditIcon size={20} color="#9CA3AF" />
          </Pressable>
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
            onPress={() => router.push('/(app)/support')}
          />
          <Divider spacing="sm" />
          <MenuItem
            icon={<MegaphoneIcon size={22} color="#6B7280" />}
            label="공지사항"
            onPress={() => router.push('/(app)/notices')}
          />
          {isAdmin && (
            <>
              <Divider spacing="sm" />
              <MenuItem
                icon={<ShieldIcon size={22} color="#DC2626" />}
                label="관리자 대시보드"
                onPress={() => router.push('/(admin)')}
              />
            </>
          )}
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
