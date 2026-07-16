/**
 * UNIQN Mobile - Profile Screen
 * 프로필 화면
 */

import { SECONDARY_PALETTE, STATUS_COLORS } from '@/constants/colors';
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
  HomeIcon,
  UsersIcon,
  StarIcon,
  BriefcaseIcon,
  TrophyOutlineIcon,
} from '@/components/icons';
import { useAuth } from '@/hooks/useAuth';
import { useBubbleScore } from '@/hooks/useReviews';
import { useOpsHubEnabled } from '@/hooks/useOpsHubEnabled';
import { useOpsHubImpressionOnce } from '@/hooks/ops/useOpsHubImpressionOnce';
import { OpsHubIntroCard } from '@/components/ops/OpsHubIntroCard';
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
  // A1 진입 표면: ops 허브 게이트(전 회원). 로딩/OFF 면 enabled=false → 3표면 미노출.
  const { enabled: opsHubEnabled } = useOpsHubEnabled();
  // 노출 시 impression 퍼널을 마운트당 1회만 발화(재렌더 반복 발화 가드).
  // 스켈레톤(auth 로딩) 구간엔 메뉴가 실제로 안 보이므로 !isLoading 까지 만족해야 발화.
  useOpsHubImpressionOnce(opsHubEnabled && !isLoading);
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
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
        <TabHeader title="프로필" showThemeToggle />
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
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
      <TabHeader title="프로필" showThemeToggle />

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
              blurhash={currentUserIdentity.photoURLBlurhash}
            />
            <View className="ml-4 flex-1">
              <Text className="text-lg font-display-semibold text-content-primary dark:text-secondary-100">
                {currentUserIdentity.displayName}
              </Text>
              <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                {profile?.email ?? user?.email ?? '이메일 없음'}
              </Text>
              <View className="mt-1 flex-row items-center gap-2">
                <View className="rounded-sm bg-secondary-100 px-2 py-0.5 dark:bg-surface-overlay">
                  <Text className="text-xs font-sans-medium text-secondary-700 dark:text-secondary-300">
                    {profile?.role ? getRoleDisplayName(profile.role) : '미설정'}
                  </Text>
                </View>
                {bubbleScore && <BubbleScoreBadge score={bubbleScore.score} />}
              </View>
            </View>
            <EditIcon size={20} color={SECONDARY_PALETTE[400]} />
          </Pressable>
        </Card>

        {/* A1 진입 표면 ②: ops 허브 1회성 신기능 안내 카드(게이트 OFF/dismiss 시 자체 미노출) */}
        <OpsHubIntroCard />

        <Card className="mb-4">
          {profile?.role === 'staff' && (
            <>
              <MenuItem
                icon={<BriefcaseIcon size={22} color={SECONDARY_PALETTE[500]} />}
                label="구인자 신청"
                onPress={() => router.push('/(app)/employer-application-status')}
              />
              <Divider spacing="sm" />
            </>
          )}
          {/* A1 진입 표면 ①: 라이브 대회 운영(전 회원 — 역할 조건 없음, ops 허브 게이트) */}
          {opsHubEnabled && (
            <>
              <MenuItem
                icon={<TrophyOutlineIcon size={20} color={SECONDARY_PALETTE[500]} />}
                label="라이브 대회 운영"
                onPress={() => router.push('/(ops)/tournaments')}
              />
              <Divider spacing="sm" />
            </>
          )}
          <MenuItem
            icon={<StarIcon size={20} color={SECONDARY_PALETTE[500]} />}
            label="내 평점·리뷰 이력"
            onPress={() => router.push('/(app)/reviews/history')}
          />
          <Divider spacing="sm" />
          <MenuItem
            icon={<HomeIcon size={20} color={SECONDARY_PALETTE[500]} />}
            label="대시보드"
            onPress={() => router.push('/(app)/home')}
          />
          <Divider spacing="sm" />
          <MenuItem
            icon={<UsersIcon size={20} color={SECONDARY_PALETTE[500]} />}
            label="커뮤니티"
            onPress={() => router.push('/(app)/(tabs)/board')}
          />
          <Divider spacing="sm" />
          <MenuItem
            icon={<SettingsIcon size={20} color={SECONDARY_PALETTE[500]} />}
            label="설정센터"
            onPress={() => router.push('/(app)/settings')}
          />
          <Divider spacing="sm" />
          <MenuItem
            icon={<MessageIcon size={20} color={SECONDARY_PALETTE[500]} />}
            label="고객센터"
            onPress={() => router.push('/(app)/support')}
          />
          {isAdmin && (
            <>
              <Divider spacing="sm" />
              <MenuItem
                icon={<ShieldIcon size={20} color={STATUS_COLORS.error} />}
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
                <ActivityIndicator size={20} color={STATUS_COLORS.error} />
              ) : (
                <LogOutIcon size={20} color={STATUS_COLORS.error} />
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
