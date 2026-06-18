/**
 * UNIQN Mobile - Admin Users List
 *
 * @description 사용자 관리 목록 페이지
 * @version 1.0.0
 */

import { getLayoutColor, getLoadingColor, SECONDARY_PALETTE } from '@/constants/colors';
import { useThemeStore } from '@/stores/themeStore';
import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StackHeader } from '@/components/headers';
import { MagnifyingGlassIcon, UserIcon, ChevronRightIcon } from '@/components/icons';
import { useAdminUsers } from '@/hooks/useAdminDashboard';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { CardStripe, NumericText, type CardStripeTone } from '@/components/ui';
import { AppFlashList } from '@/components/ui/AppFlashList';
import BubbleScoreBadge from '@/components/review/BubbleScoreBadge';
import type { AdminUser, AdminUserFilters } from '@/types/admin';
import type { UserRole } from '@/types/role';

interface RoleChipProps {
  role: UserRole | 'all';
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

function RoleChip({ label, isSelected, onPress }: RoleChipProps) {
  const baseClass = 'px-4 py-2 rounded-sm mr-2';
  const selectedClass = isSelected
    ? 'bg-primary-600 dark:bg-primary-500'
    : 'bg-secondary-200 dark:bg-surface';
  const textClass = isSelected
    ? 'text-content-onGold'
    : 'text-secondary-700 dark:text-secondary-300';

  return (
    <Pressable onPress={onPress} className={baseClass + ' ' + selectedClass}>
      <Text className={'text-sm font-sans-medium ' + textClass}>{label}</Text>
    </Pressable>
  );
}

interface UserCardProps {
  user: AdminUser;
  onPress: () => void;
}

function UserCard({ user, onPress }: UserCardProps) {
  const getRoleBadgeVariant = (role: UserRole): 'error' | 'primary' | 'success' => {
    switch (role) {
      case 'admin':
        return 'error';
      case 'employer':
        return 'primary';
      default:
        return 'success';
    }
  };

  const getRoleLabel = (role: UserRole): string => {
    switch (role) {
      case 'admin':
        return '관리자';
      case 'employer':
        return '구인자';
      default:
        return '스태프';
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  // admin과 staff는 동일하게 gold로 통일 (staff가 주 사용자 · admin은 별도 role Badge로 구분).
  // employer는 info로 구분 · 비활성은 muted.
  const stripeTone: CardStripeTone = !user.isActive
    ? 'muted'
    : user.role === 'employer'
      ? 'info'
      : 'gold';

  return (
    <Pressable
      onPress={onPress}
      className="bg-white dark:bg-surface rounded-md mb-3 border border-divider active:opacity-80"
      style={{
        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
        elevation: 2,
      }}
    >
      <CardStripe tone={stripeTone}>
        <View className="pl-4 pr-4 py-4 flex-row items-center">
          <View className="mr-3">
            {user.photoURL ? (
              <Avatar
                source={user.photoURL}
                name={user.name}
                size="lg"
                blurhash={user.photoURLBlurhash}
              />
            ) : (
              <View className="w-12 h-12 rounded-sm bg-secondary-200 dark:bg-surface items-center justify-center">
                <UserIcon size={24} color={SECONDARY_PALETTE[400]} />
              </View>
            )}
          </View>

          <View className="flex-1">
            <View className="flex-row items-center mb-1 flex-wrap">
              <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white mr-2">
                {user.name}
              </Text>
              <Badge variant={getRoleBadgeVariant(user.role)} size="sm">
                {getRoleLabel(user.role)}
              </Badge>
              {user.bubbleScore && (
                <View className="ml-2">
                  <BubbleScoreBadge score={user.bubbleScore.score} size="sm" />
                </View>
              )}
            </View>
            <Text className="text-sm text-content-secondary mb-1 font-sans">{user.email}</Text>
            <View className="flex-row items-center">
              <NumericText className="text-xs text-content-placeholder font-sans">
                가입일: {formatDate(user.createdAt)}
              </NumericText>
              {!user.isActive && (
                <View className="ml-2 px-2 py-0.5 bg-error-50 dark:bg-error-900/30 rounded">
                  <Text className="text-xs text-error-600 dark:text-error-400 font-sans">
                    비활성
                  </Text>
                </View>
              )}
              {user.isVerified && (
                <View className="ml-2 px-2 py-0.5 bg-success-50 dark:bg-success-900/30 rounded">
                  <Text className="text-xs text-success-600 dark:text-success-400 font-sans">
                    인증됨
                  </Text>
                </View>
              )}
            </View>
          </View>

          <ChevronRightIcon size={20} color={SECONDARY_PALETTE[400]} />
        </View>
      </CardStripe>
    </Pressable>
  );
}

const ROLE_OPTIONS: { role: UserRole | 'all'; label: string }[] = [
  { role: 'all', label: '전체' },
  { role: 'admin', label: '관리자' },
  { role: 'employer', label: '구인자' },
  { role: 'staff', label: '스태프' },
];

export default function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | 'all'>('all');
  const { isDarkMode } = useThemeStore();

  const filters: AdminUserFilters = useMemo(
    () => ({
      search: searchQuery || undefined,
      role: selectedRole,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }),
    [searchQuery, selectedRole]
  );

  const {
    data,
    isLoading,
    isFetchingNextPage,
    isRefetching,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
  } = useAdminUsers({
    filters,
    pageSize: 20,
    enabled: true,
  });

  const handleUserPress = useCallback((userId: string) => {
    router.push('/(admin)/users/' + userId);
  }, []);

  const handleRoleFilter = useCallback((role: UserRole | 'all') => {
    setSelectedRole(role);
  }, []);

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: AdminUser }) => (
      <UserCard user={item} onPress={() => handleUserPress(item.id)} />
    ),
    [handleUserPress]
  );

  const keyExtractor = useCallback((item: AdminUser) => item.id, []);

  if (isLoading && !data) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="사용자 관리" fallbackHref="/(admin)" />
        <View className="flex-1 bg-surface-page dark:bg-surface items-center justify-center">
          <ActivityIndicator size="large" color={getLoadingColor(isDarkMode)} />
          <Text className="mt-4 text-content-secondary font-sans">
            사용자 목록을 불러오는 중...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="사용자 관리" fallbackHref="/(admin)" />
        <View className="flex-1 bg-surface-page dark:bg-surface">
          <EmptyState
            title="오류 발생"
            description="사용자 목록을 불러오는 데 실패했습니다."
            actionLabel="다시 시도"
            onAction={() => refetch()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const users = data?.pages.flatMap((p) => p.users) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="사용자 관리" fallbackHref="/(admin)" />
      <View className="px-4 py-3 bg-white dark:bg-surface border-b border-divider">
        <View className="flex-row items-center bg-surface-card dark:bg-surface rounded-lg px-3 py-2">
          <MagnifyingGlassIcon size={20} color={SECONDARY_PALETTE[400]} />
          <TextInput
            value={searchQuery}
            onChangeText={handleSearch}
            placeholder="이름 또는 이메일로 검색"
            placeholderTextColor={SECONDARY_PALETTE[400]}
            className="flex-1 ml-2 text-base font-sans text-content-primary dark:text-off-white"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <View className="px-4 py-3 bg-white dark:bg-surface border-b border-divider">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {ROLE_OPTIONS.map((option) => (
            <RoleChip
              key={option.role}
              role={option.role}
              label={option.label}
              isSelected={selectedRole === option.role}
              onPress={() => handleRoleFilter(option.role)}
            />
          ))}
        </ScrollView>
      </View>

      <View className="px-4 py-2">
        <Text className="text-sm text-content-secondary font-sans">
          총 {total.toLocaleString()}명의 사용자
        </Text>
      </View>

      <AppFlashList
        data={users}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        estimatedItemSize={96}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={getLayoutColor(isDarkMode, 'refreshTint')}
          />
        }
        ListEmptyComponent={
          <EmptyState title="검색 결과 없음" description="검색 조건에 맞는 사용자가 없습니다." />
        }
        ListFooterComponent={
          users.length > 0 ? (
            <View className="py-4 items-center">
              {isFetchingNextPage ? (
                <ActivityIndicator color={getLoadingColor(isDarkMode)} />
              ) : hasNextPage ? (
                <Pressable onPress={handleLoadMore} className="px-4 py-2 bg-primary-600 rounded-lg">
                  <Text className="text-content-onGold font-sans-medium">더 보기</Text>
                </Pressable>
              ) : (
                <Text className="text-sm text-content-placeholder font-sans">
                  모든 사용자를 불러왔어요
                </Text>
              )}
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
      />
    </SafeAreaView>
  );
}
