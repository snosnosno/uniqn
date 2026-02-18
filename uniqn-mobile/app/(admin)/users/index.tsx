/**
 * UNIQN Mobile - Admin Users List
 *
 * @description 사용자 관리 목록 페이지
 * @version 1.0.0
 */

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
import { router } from 'expo-router';
import { MagnifyingGlassIcon, UserIcon, ChevronRightIcon } from '@/components/icons';
import { useAdminUsers } from '@/hooks/useAdminDashboard';
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
  const baseClass = 'px-4 py-2 rounded-full mr-2';
  const selectedClass = isSelected
    ? 'bg-primary-600 dark:bg-primary-500'
    : 'bg-gray-200 dark:bg-surface';
  const textClass = isSelected ? 'text-white' : 'text-gray-700 dark:text-gray-300';

  return (
    <Pressable onPress={onPress} className={baseClass + ' ' + selectedClass}>
      <Text className={'text-sm font-medium ' + textClass}>{label}</Text>
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
      className="bg-white dark:bg-surface rounded-xl p-4 mb-3 flex-row items-center active:opacity-80"
      style={{
        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
        elevation: 2,
      }}
    >
      <View className="w-12 h-12 rounded-full bg-gray-200 dark:bg-surface items-center justify-center mr-3">
        {user.photoURL ? (
          <Text className="text-xl">{user.name.charAt(0)}</Text>
        ) : (
          <UserIcon size={24} color="#9CA3AF" />
        )}
      </View>

      <View className="flex-1">
        <View className="flex-row items-center mb-1">
          <Text className="text-base font-semibold text-gray-900 dark:text-white mr-2">
            {user.name}
          </Text>
          <Badge variant={getRoleBadgeVariant(user.role)} size="sm">
            {getRoleLabel(user.role)}
          </Badge>
        </View>
        <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1">{user.email}</Text>
        <View className="flex-row items-center">
          <Text className="text-xs text-gray-400 dark:text-gray-500">
            가입일: {formatDate(user.createdAt)}
          </Text>
          {!user.isActive && (
            <View className="ml-2 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 rounded">
              <Text className="text-xs text-red-600 dark:text-red-400">비활성</Text>
            </View>
          )}
          {user.isVerified && (
            <View className="ml-2 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 rounded">
              <Text className="text-xs text-green-600 dark:text-green-400">인증됨</Text>
            </View>
          )}
        </View>
      </View>

      <ChevronRightIcon size={20} color="#9CA3AF" />
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
      <View className="flex-1 bg-gray-50 dark:bg-surface-dark items-center justify-center">
        <ActivityIndicator size="large" color="#A855F7" />
        <Text className="mt-4 text-gray-500 dark:text-gray-400">사용자 목록을 불러오는 중...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-surface-dark">
        <EmptyState
          title="오류 발생"
          description="사용자 목록을 불러오는 데 실패했습니다."
          icon="❌"
          actionLabel="다시 시도"
          onAction={() => refetch()}
        />
      </View>
    );
  }

  const users = data?.users ?? [];
  const total = data?.total ?? 0;

  return (
    <View className="flex-1 bg-gray-50 dark:bg-surface-dark">
      <View className="px-4 py-3 bg-white dark:bg-surface border-b border-gray-200 dark:border-surface-overlay">
        <View className="flex-row items-center bg-gray-100 dark:bg-surface rounded-lg px-3 py-2">
          <MagnifyingGlassIcon size={20} color="#9CA3AF" />
          <TextInput
            value={searchQuery}
            onChangeText={handleSearch}
            placeholder="이름 또는 이메일로 검색"
            placeholderTextColor="#9CA3AF"
            className="flex-1 ml-2 text-base text-gray-900 dark:text-white"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <View className="px-4 py-3 bg-white dark:bg-surface border-b border-gray-200 dark:border-surface-overlay">
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
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          총 {total.toLocaleString()}명의 사용자
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor="#A855F7"
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
          <EmptyState
            title="검색 결과 없음"
            description="검색 조건에 맞는 사용자가 없습니다."
            icon="🔍"
          />
        ) : (
          <>
            {users.map((user) => (
              <UserCard key={user.id} user={user} onPress={() => handleUserPress(user.id)} />
            ))}
            {data && (
              <View className="py-4 items-center">
                <Text className="text-sm text-gray-400 dark:text-gray-500">
                  {data.page} / {data.totalPages} 페이지
                </Text>
                {data.hasNextPage && (
                  <Pressable
                    onPress={handleLoadMore}
                    className="mt-2 px-4 py-2 bg-primary-600 rounded-lg"
                  >
                    <Text className="text-white font-medium">더 보기</Text>
                  </Pressable>
                )}
              </View>
            )}
          </>
        )}
        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
