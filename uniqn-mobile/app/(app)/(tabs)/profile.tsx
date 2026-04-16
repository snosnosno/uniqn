/**
 * UNIQN Mobile - Profile Screen
 * 프로필 화면
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
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
import { type ReactNode, useState } from 'react';
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
import { useAuth } from '@/hooks/useAuth';
import { useBubbleScore } from '@/hooks/useReviews';
import BubbleScoreBadge from '@/components/review/BubbleScoreBadge';
import { signOut } from '@/services/auth';
import { buildCurrentUserIdentitySnapshot } from '@/shared/profile/identity';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { getRoleDisplayName } from '@/types/unified';
import { EmployerApplicationStatusBanner } from '@/components/employer-application';

interface MenuItemProps {
  icon: ReactNode;
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
          className={`text-base font-sans ${
            danger
              ? 'text-error-600 dark:text-error-400'
              : 'text-secondary-900 dark:text-secondary-100'
          }`}
        >
          {label}
        </Text>
      </View>
      <ChevronRightIcon size={20} color={SECONDARY_PALETTE[400]} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { profile, isLoading, user, isAdmin } = useAuth();
  const reset = useAuthStore((state) => state.reset);
  const addToast = useToastStore((state) => state.addToast);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const bubbleScore = useBubbleScore();
  const currentUserIdentity = buildCurrentUserIdentitySnapshot({
    profile,
    authUser: user,
    fallbackName: '이름 없음',
  });

  const handleLogout = () => {
    const performLogout = async () => {
      setIsLoggingOut(true);
      try {
        await signOut();
        reset();
        router.replace('/(auth)/login');
      } catch {
        addToast({ type: 'error', message: '로그아웃에 실패했습니다.' });
      } finally {
        setIsLoggingOut(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('정말 로그아웃 하시겠습니까?')) {
        performLogout();
      }
      return;
    }

    Alert.alert('로그아웃', '정말 로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: performLogout,
      },
    ]);
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page" edges={['top']}>
        <TabHeader title="프로필" showSettings />
        <ScrollView className="flex-1" contentContainerClassName="p-4">
          <Card className="mb-4">
            <SkeletonProfileHeader />
          </Card>
          <Card className="mb-4">
            {[1, 2, 3].map((i) => (
              <SkeletonListItem key={i} />
            ))}
          </Card>
          <Card>
            <SkeletonListItem />
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page" edges={['top']}>
      <TabHeader title="프로필" showSettings />

      <ScrollView className="flex-1" contentContainerClassName="p-4">
        {profile?.role === 'staff' && <EmployerApplicationStatusBanner />}
        <Card className="mb-4">
          <Pressable
            onPress={() => router.push('/(app)/settings/profile')}
            className="flex-row items-center active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="프로필 수정"
          >
            <Avatar
              name={currentUserIdentity.displayName || '사용자'}
              size="xl"
              source={currentUserIdentity.photoURL}
            />
            <View className="ml-4 flex-1">
              <Text className="text-lg font-display-semibold text-content-primary dark:text-secondary-100">
                {currentUserIdentity.displayName}
              </Text>
              <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                {profile?.email ?? user?.email ?? '이메일 없음'}
              </Text>
              <View className="mt-1 flex-row items-center gap-2">
                <View className="rounded-sm bg-primary-100 px-2 py-0.5 dark:bg-primary-900/30">
                  <Text className="text-xs font-sans-medium text-primary-700 dark:text-primary-300">
                    {profile?.role ? getRoleDisplayName(profile.role) : '미설정'}
                  </Text>
                </View>
                {bubbleScore && (
                  <Pressable onPress={() => router.push('/(app)/reviews/history')}>
                    <BubbleScoreBadge score={bubbleScore.score} />
                  </Pressable>
                )}
              </View>
            </View>
            <EditIcon size={20} color={SECONDARY_PALETTE[400]} />
          </Pressable>
        </Card>

        <Card className="mb-4">
          <MenuItem
            icon={<MegaphoneIcon size={22} color={SECONDARY_PALETTE[500]} />}
            label="공지사항"
            onPress={() => router.push('/(app)/(tabs)/board/notice')}
          />
          <Divider spacing="sm" />
          <MenuItem
            icon={<SettingsIcon size={22} color={SECONDARY_PALETTE[500]} />}
            label="설정센터"
            onPress={() => router.push('/(app)/settings')}
          />
          <Divider spacing="sm" />
          <MenuItem
            icon={<MessageIcon size={22} color={SECONDARY_PALETTE[500]} />}
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

        <Card>
          <MenuItem
            icon={
              isLoggingOut ? (
                <ActivityIndicator size={22} color="#DC2626" />
              ) : (
                <LogOutIcon size={22} color="#DC2626" />
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
