/**
 * UNIQN Mobile - Profile Screen
 * 프로필 화면
 */

import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Card, Avatar, Divider, SkeletonProfileHeader, SkeletonListItem } from '@/components/ui';
import { TabHeader } from '@/components/headers';
import {
  SettingsIcon,
  ChevronRightIcon,
  MessageIcon,
  LogOutIcon,
  ShieldIcon,
  EditIcon,
  MegaphoneIcon,
} from '@/components/icons';
import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { signOut } from '@/services/authService';
import { useToastStore } from '@/stores/toastStore';
import { getRoleDisplayName } from '@/types/unified';
import BubbleScoreBadge from '@/components/review/BubbleScoreBadge';
import { useBubbleScore } from '@/hooks/useReviews';

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}

function MenuItem({ icon, label, onPress, danger, disabled }: MenuItemProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center justify-between py-3 ${disabled ? 'opacity-50' : 'active:opacity-70'}`}
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
  const bubbleScore = useBubbleScore();

  // useUserProfile 훅과 동일한 displayName 로직
  const displayName = useMemo(() => {
    const baseName = profile?.name ?? user?.displayName ?? '이름 없음';
    const nickname = profile?.nickname;
    if (nickname && nickname !== baseName) {
      return `${baseName}(${nickname})`;
    }
    return baseName;
  }, [profile?.name, profile?.nickname, user?.displayName]);

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
      Alert.alert('로그아웃', '정말 로그아웃 하시겠습니까?', [
        { text: '취소', style: 'cancel' },
        {
          text: '로그아웃',
          style: 'destructive',
          onPress: performLogout,
        },
      ]);
    }
  };

  // 로딩 상태 (스켈레톤 UI)
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
        <TabHeader title="프로필" showSettings />
        <ScrollView className="flex-1" contentContainerClassName="p-4">
          {/* 프로필 헤더 스켈레톤 */}
          <Card className="mb-4">
            <SkeletonProfileHeader />
          </Card>
          {/* 메뉴 스켈레톤 */}
          <Card className="mb-4">
            {[1, 2, 3].map((i) => (
              <SkeletonListItem key={i} />
            ))}
          </Card>
          {/* 로그아웃 버튼 스켈레톤 */}
          <Card>
            <SkeletonListItem />
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
      {/* 헤더 */}
      <TabHeader title="프로필" showSettings />

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
                {displayName}
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                {profile?.email ?? user?.email ?? '이메일 없음'}
              </Text>
              <View className="mt-1 flex-row items-center gap-2">
                <View className="rounded-full bg-primary-100 px-2 py-0.5 dark:bg-primary-900/30">
                  <Text className="text-xs font-medium text-primary-700 dark:text-primary-300">
                    {profile?.role ? getRoleDisplayName(profile.role) : '미설정'}
                  </Text>
                </View>
                {bubbleScore && <BubbleScoreBadge score={bubbleScore.score} />}
              </View>
            </View>
            <EditIcon size={20} color="#9CA3AF" />
          </Pressable>
        </Card>

        {/* 메뉴 */}
        <Card className="mb-4">
          <MenuItem
            icon={<MegaphoneIcon size={22} color="#6B7280" />}
            label="공지사항"
            onPress={() => router.push('/(app)/notices')}
          />
          <Divider spacing="sm" />
          <MenuItem
            icon={<SettingsIcon size={22} color="#6B7280" />}
            label="설정센터"
            onPress={() => router.push('/(app)/settings')}
          />
          <Divider spacing="sm" />
          <MenuItem
            icon={<MessageIcon size={22} color="#6B7280" />}
            label="고객센터"
            onPress={() => router.push('/(app)/support')}
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
            onPress={handleLogout}
            disabled={isLoggingOut}
            danger
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
