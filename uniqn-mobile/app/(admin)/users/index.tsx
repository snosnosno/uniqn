/**
 * UNIQN Mobile - Admin Users List
 *
 * @description 사용자 관리 목록 페이지
 * @version 1.0.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
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
  const textClass = isSelected ? 'text-surface-dark' : 'text-secondary-700 dark:text-secondary-300';

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

  return (
    <Pressable
      onPress={onPress}
      className="bg-white dark:bg-surface rounded-md p-4 mb-3 flex-row items-center active:opacity-80"
      style={{
        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
        elevation: 2,
      }}
    >
      <View className="mr-3">
        {user.photoURL ? (
          <Avatar source={user.photoURL} name={user.name} size="lg" />
        ) : (
          <View className="w-12 h-12 rounded-sm bg-secondary-200 dark:bg-surface items-center justify-center">
            <UserIcon size={24} color={SECONDARY_PALETTE[400]} />
          </View>
        )}
      </View>

      <View className="flex-1">
        <View className="flex-row items-center mb-1">
          <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white mr-2">
            {user.name}
          </Text>
          <Badge variant={getRoleBadgeVariant(user.role)} size="sm">
            {getRoleLabel(user.role)}
          </Badge>
        </View>
        <Text className="text-sm text-secondary-500 dark:text-secondary-400 mb-1 font-sans">
          {user.email}
        </Text>
        <View className="flex-row items-center">
          <Text className="text-xs text-content-placeholder font-sans">
            가입일: {formatDate(user.createdAt)}
          </Text>
          {!user.isActive && (
            <View className="ml-2 px-2 py-0.5 bg-error-50 dark:bg-error-900/30 rounded">
              <Text className="text-xs text-error-600 dark:text-error-400 font-sans">비활성</Text>
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
  const [page, setPage] = useState(1);

  const filters: AdminUserFilters = useMemo(
    () => ({
      search: searchQuery || undefined,
      role: selectedRole,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }),
    [searchQuery, selectedRole]
  );

  const { data, isLoading, isRefetching, error, refetch } = useAdminUsers({
    filters,
    page,
    pageSize: 20,
    enabled: true,
  });

  const handleUserPress = useCallback((userId: string) => {
    router.push('/(admin)/users/' + userId);
  }, []);

  const handleRoleFilter = useCallback((role: UserRole | 'all') => {
    setSelectedRole(role);
    setPage(1);
  }, []);

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    setPage(1);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (data?.hasNextPage && !isLoading) {
      setPage((prev) => prev + 1);
    }
  }, [data?.hasNextPage, isLoading]);

  if (isLoading && !data) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page" edges={['top']}>
        <StackHeader title="사용자 관리" fallbackHref="/(admin)" />
        <View className="flex-1 bg-surface-page items-center justify-center">
          <ActivityIndicator size="large" color="#D4AF37" />
          <Text className="mt-4 text-secondary-500 dark:text-secondary-400 font-sans">
            사용자 목록을 불러오는 중...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page" edges={['top']}>
        <StackHeader title="사용자 관리" fallbackHref="/(admin)" />
        <View className="flex-1 bg-surface-page">
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

  const users = data?.users ?? [];
  const total = data?.total ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-surface-page" edges={['top']}>
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
        <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
          총 {total.toLocaleString()}명의 사용자
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor="#D4AF37"
          />
        }
        onScrollEndDrag={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const isEndReached =
            layoutMeasurement.height + contentOffset.y >= contentSize.height - 50;
          if (isEndReached) handleLoadMore();
        }}
      >
        {users.length === 0 ? (
          <EmptyState title="검색 결과 없음" description="검색 조건에 맞는 사용자가 없습니다." />
        ) : (
          <>
            {users.map((user) => (
              <UserCard key={user.id} user={user} onPress={() => handleUserPress(user.id)} />
            ))}
            {data && (
              <View className="py-4 items-center">
                <Text className="text-sm text-content-placeholder font-sans">
                  {data.page} / {data.totalPages} 페이지
                </Text>
                {data.hasNextPage && (
                  <Pressable
                    onPress={handleLoadMore}
                    className="mt-2 px-4 py-2 bg-primary-600 rounded-lg"
                  >
                    <Text className="text-surface-dark font-sans-medium">더 보기</Text>
                  </Pressable>
                )}
              </View>
            )}
          </>
        )}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
