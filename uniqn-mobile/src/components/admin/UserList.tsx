/**
 * UNIQN Mobile - 사용자 목록 컴포넌트 (관리자용)
 *
 * @description 사용자 목록 조회 및 검색 기능
 * @version 1.0.0
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TextInput, Pressable, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { UserCard } from './UserCard';
import { Loading } from '../ui/Loading';
import { EmptyState } from '../ui/EmptyState';
import { Badge } from '../ui/Badge';
import {
  SearchIcon,
  XMarkIcon,
  FilterIcon,
  UsersIcon,
} from '../icons';
import {
  USER_ROLE_LABELS,
  type AdminUser,
  type AdminUserFilters,
  type UserRole,
} from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface UserListProps {
  users: AdminUser[];
  isLoading?: boolean;
  isRefreshing?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onUserPress?: (user: AdminUser) => void;
  onUserEdit?: (user: AdminUser) => void;
  showActions?: boolean;
  ListHeaderComponent?: React.ReactElement;
}

// ============================================================================
// Constants
// ============================================================================

const ROLE_FILTERS: { value: UserRole | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'admin', label: '관리자' },
  { value: 'employer', label: '구인자' },
  { value: 'staff', label: '스태프' },
];

// ============================================================================
// Component
// ============================================================================

export const UserList = React.memo(function UserList({
  users,
  isLoading = false,
  isRefreshing = false,
  error = null,
  onRefresh,
  onUserPress,
  onUserEdit,
  showActions = false,
  ListHeaderComponent,
}: UserListProps) {
  // 필터 상태
  const [filters, setFilters] = useState<AdminUserFilters>({
    search: '',
    role: 'all',
  });
  const [showFilters, setShowFilters] = useState(false);

  // 필터링된 사용자 목록
  const filteredUsers = useMemo(() => {
    let result = [...users];

    // 검색 필터
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        (user) =>
          user.name.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower) ||
          user.phone?.includes(filters.search || '')
      );
    }

    // 역할 필터
    if (filters.role && filters.role !== 'all') {
      result = result.filter((user) => user.role === filters.role);
    }

    // 활성 상태 필터
    if (filters.isActive !== undefined) {
      result = result.filter((user) => user.isActive === filters.isActive);
    }

    // 정렬 (기본: 최근 가입순)
    result.sort((a, b) => {
      const aDate = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
      const bDate = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
      return bDate.getTime() - aDate.getTime();
    });

    return result;
  }, [users, filters]);

  // 검색어 변경
  const handleSearchChange = useCallback((text: string) => {
    setFilters((prev) => ({ ...prev, search: text }));
  }, []);

  // 검색어 초기화
  const handleClearSearch = useCallback(() => {
    setFilters((prev) => ({ ...prev, search: '' }));
  }, []);

  // 역할 필터 변경
  const handleRoleFilter = useCallback((role: UserRole | 'all') => {
    setFilters((prev) => ({ ...prev, role }));
  }, []);

  // 필터 토글
  const toggleFilters = useCallback(() => {
    setShowFilters((prev) => !prev);
  }, []);

  // 필터 초기화
  const handleClearFilters = useCallback(() => {
    setFilters({ search: '', role: 'all' });
  }, []);

  // 아이템 렌더러
  const renderItem = useCallback(
    ({ item }: { item: AdminUser }) => (
      <View className="px-4 mb-3">
        <UserCard
          user={item}
          onPress={onUserPress}
          onEdit={onUserEdit}
          showActions={showActions}
        />
      </View>
    ),
    [onUserPress, onUserEdit, showActions]
  );

  // 키 추출
  const keyExtractor = useCallback((item: AdminUser) => item.id, []);

  // 헤더 컴포넌트
  const renderHeader = useCallback(
    () => (
      <View>
        {ListHeaderComponent}

        {/* 검색 바 */}
        <View className="px-4 py-3">
          <View className="flex-row items-center bg-gray-100 dark:bg-gray-800 rounded-xl px-3">
            <SearchIcon size={18} color="#9CA3AF" />
            <TextInput
              value={filters.search}
              onChangeText={handleSearchChange}
              placeholder="이름, 이메일, 연락처 검색..."
              placeholderTextColor="#9CA3AF"
              className="flex-1 py-3 px-2 text-gray-900 dark:text-white"
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {filters.search ? (
              <Pressable onPress={handleClearSearch} className="p-1">
                <XMarkIcon size={18} color="#9CA3AF" />
              </Pressable>
            ) : null}
            <Pressable
              onPress={toggleFilters}
              className={`ml-2 p-2 rounded-lg ${
                showFilters ? 'bg-primary-100 dark:bg-primary-900/30' : ''
              }`}
            >
              <FilterIcon
                size={18}
                color={showFilters ? '#3B82F6' : '#9CA3AF'}
              />
            </Pressable>
          </View>
        </View>

        {/* 필터 패널 */}
        {showFilters && (
          <View className="px-4 pb-3">
            <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
              {/* 역할 필터 */}
              <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                역할
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {ROLE_FILTERS.map((role) => (
                  <Pressable
                    key={role.value}
                    onPress={() => handleRoleFilter(role.value)}
                    className={`px-3 py-1.5 rounded-full ${
                      filters.role === role.value
                        ? 'bg-primary-500'
                        : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        filters.role === role.value
                          ? 'text-white'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {role.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* 필터 초기화 */}
              {(filters.search || filters.role !== 'all') && (
                <Pressable
                  onPress={handleClearFilters}
                  className="mt-3 self-start"
                >
                  <Text className="text-sm text-primary-500">필터 초기화</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* 결과 개수 */}
        <View className="flex-row items-center justify-between px-4 py-2">
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            총 {filteredUsers.length}명
          </Text>
          {filters.role !== 'all' && (
            <Badge variant="primary" size="sm">
              {USER_ROLE_LABELS[filters.role as UserRole]}
            </Badge>
          )}
        </View>
      </View>
    ),
    [
      ListHeaderComponent,
      filters,
      showFilters,
      filteredUsers.length,
      handleSearchChange,
      handleClearSearch,
      handleRoleFilter,
      handleClearFilters,
      toggleFilters,
    ]
  );

  // 빈 상태 컴포넌트
  const renderEmpty = useCallback(
    () => (
      <EmptyState
        icon={<UsersIcon size={48} color="#9CA3AF" />}
        title={filters.search || filters.role !== 'all'
          ? '검색 결과 없음'
          : '사용자 없음'
        }
        description={
          filters.search || filters.role !== 'all'
            ? '다른 검색어나 필터를 시도해보세요.'
            : '등록된 사용자가 없습니다.'
        }
        actionLabel={
          (filters.search || filters.role !== 'all') ? '필터 초기화' : undefined
        }
        onAction={
          (filters.search || filters.role !== 'all') ? handleClearFilters : undefined
        }
      />
    ),
    [filters.search, filters.role, handleClearFilters]
  );

  // 로딩 상태
  if (isLoading && users.length === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <Loading size="large" message="사용자 목록 로딩 중..." />
      </View>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-red-500 dark:text-red-400 text-center">
          {error}
        </Text>
        {onRefresh && (
          <Pressable
            onPress={onRefresh}
            className="mt-4 px-4 py-2 bg-primary-500 rounded-lg"
          >
            <Text className="text-white font-medium">다시 시도</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      <FlashList
        data={filteredUsers}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        // @ts-expect-error - estimatedItemSize is required in FlashList 2.x but types may be missing
        estimatedItemSize={150}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor="#3B82F6"
            />
          ) : undefined
        }
      />
    </View>
  );
});

export default UserList;
