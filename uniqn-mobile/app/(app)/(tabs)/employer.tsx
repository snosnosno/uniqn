/**
 * UNIQN Mobile - 내 공고 탭 화면
 * 구인자: 공고 목록 표시 / 일반 사용자: 안내 화면
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useMyJobPostings } from '@/hooks/useJobManagement';
import { useUnreadCountRealtime } from '@/hooks/useNotifications';
import { Card, Badge, Button, Loading, EmptyState, ErrorState } from '@/components';
import {
  PlusIcon,
  MapPinIcon,
  ClockIcon,
  UsersIcon,
  BriefcaseIcon,
  QrCodeIcon,
  BellIcon,
} from '@/components/icons';
import type { JobPosting } from '@/types';

// ============================================================================
// Types
// ============================================================================

type FilterStatus = 'all' | 'active' | 'closed' | 'draft';

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '모집중' },
  { value: 'closed', label: '마감' },
  { value: 'draft', label: '임시저장' },
];

// ============================================================================
// Sub-components
// ============================================================================

interface FilterTabsProps {
  selected: FilterStatus;
  onChange: (status: FilterStatus) => void;
  counts: Partial<Record<FilterStatus, number>>;
}

function FilterTabs({ selected, onChange, counts }: FilterTabsProps) {
  return (
    <View className="mx-4 mb-4 flex-row rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
      {FILTER_OPTIONS.map((option) => {
        const isSelected = selected === option.value;
        const count = counts[option.value] || 0;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            className={`flex-1 items-center justify-center rounded-md py-2 ${
              isSelected ? 'bg-white shadow-sm dark:bg-gray-700' : ''
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                isSelected
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {option.label} ({count})
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

interface JobPostingCardProps {
  posting: JobPosting;
  onPress: (posting: JobPosting) => void;
}

function JobPostingCard({ posting, onPress }: JobPostingCardProps) {
  const statusConfig = {
    active: { label: '모집중', variant: 'success' as const },
    closed: { label: '마감', variant: 'default' as const },
    draft: { label: '임시저장', variant: 'warning' as const },
    cancelled: { label: '취소됨', variant: 'error' as const },
  };

  const status = statusConfig[posting.status] || statusConfig.active;

  return (
    <Card variant="elevated" padding="md" onPress={() => onPress(posting)} className="mx-4 mb-3">
      {/* 헤더 */}
      <View className="mb-2 flex-row items-center justify-between">
        <Text
          className="flex-1 text-lg font-semibold text-gray-900 dark:text-white"
          numberOfLines={1}
        >
          {posting.title}
        </Text>
        <Badge variant={status.variant} size="sm">
          {status.label}
        </Badge>
      </View>

      {/* 장소 */}
      <View className="mb-2 flex-row items-center">
        <MapPinIcon size={14} color="#9CA3AF" />
        <Text className="ml-1 text-sm text-gray-600 dark:text-gray-400" numberOfLines={1}>
          {posting.location.name}
        </Text>
      </View>

      {/* 날짜/시간 */}
      <View className="mb-3 flex-row items-center">
        <ClockIcon size={14} color="#9CA3AF" />
        <Text className="ml-1 text-sm text-gray-600 dark:text-gray-400">
          {posting.workDate} {posting.timeSlot}
        </Text>
      </View>

      {/* 통계 */}
      <View className="flex-row items-center border-t border-gray-100 pt-3 dark:border-gray-700">
        <View className="mr-6 flex-row items-center">
          <UsersIcon size={16} color="#2563EB" />
          <Text className="ml-1 text-sm font-medium text-primary-600 dark:text-primary-400">
            지원자 {posting.applicationCount || 0}명
          </Text>
        </View>
        <View className="flex-row items-center">
          <BriefcaseIcon size={16} color="#10B981" />
          <Text className="ml-1 text-sm font-medium text-success-600 dark:text-success-400">
            확정 {posting.filledPositions || 0}/{posting.totalPositions || 0}명
          </Text>
        </View>
      </View>
    </Card>
  );
}

// ============================================================================
// Header Component
// ============================================================================

interface HeaderProps {
  title: string;
}

function Header({ title }: HeaderProps) {
  const unreadCount = useUnreadCountRealtime();

  return (
    <View className="flex-row items-center justify-between bg-white px-4 py-3 dark:bg-gray-800">
      <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</Text>
      <View className="flex-row items-center gap-2">
        <Pressable onPress={() => router.push('/(app)/(tabs)/qr')} className="p-2" hitSlop={8}>
          <QrCodeIcon size={24} color="#6B7280" />
        </Pressable>
        <Pressable onPress={() => router.push('/(app)/notifications')} className="p-2" hitSlop={8}>
          <BellIcon size={24} color="#6B7280" />
          {unreadCount > 0 && (
            <View className="absolute -right-1 -top-1 min-w-[18px] items-center justify-center rounded-full bg-error-500 px-1">
              <Text className="text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ============================================================================
// Non-Employer View
// ============================================================================

function NonEmployerView() {
  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['top']}>
      <Header title="내 공고" />
      <View className="flex-1 items-center justify-center px-6">
        <View className="mb-6 h-24 w-24 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
          <BriefcaseIcon size={48} color="#9CA3AF" />
        </View>
        <Text className="mb-2 text-center text-xl font-bold text-gray-900 dark:text-white">
          구인자 전용 기능입니다
        </Text>
        <Text className="mb-8 text-center text-base text-gray-500 dark:text-gray-400">
          구인자로 등록하면 공고를 등록하고{'\n'}스태프를 모집할 수 있습니다.
        </Text>
        <Button
          variant="primary"
          onPress={() => router.push('/(app)/settings')}
          className="min-w-[200px]"
        >
          <Text className="font-semibold text-white">구인자로 등록하기</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}

// ============================================================================
// Employer View (내 공고 목록)
// ============================================================================

function EmployerView() {
  const { data: postings, isLoading, error, refetch, isRefetching } = useMyJobPostings();
  const [filter, setFilter] = useState<FilterStatus>('all');

  // 필터링된 목록
  const filteredPostings = useMemo(() => {
    if (!postings) return [];
    if (filter === 'all') return postings;
    return postings.filter((p: JobPosting) => p.status === filter);
  }, [postings, filter]);

  // 필터별 카운트
  const filterCounts = useMemo(() => {
    if (!postings) return {};
    const counts: Partial<Record<FilterStatus, number>> = {
      all: postings.length,
    };
    postings.forEach((p: JobPosting) => {
      const status = p.status as FilterStatus;
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [postings]);

  // 공고 클릭
  const handlePostingPress = useCallback((posting: JobPosting) => {
    router.push(`/(employer)/my-postings/${posting.id}`);
  }, []);

  // 새 공고 작성
  const handleCreatePosting = useCallback(() => {
    router.push('/(employer)/my-postings/create');
  }, []);

  // 렌더 아이템
  const renderItem = useCallback(
    ({ item }: { item: JobPosting }) => (
      <JobPostingCard posting={item} onPress={handlePostingPress} />
    ),
    [handlePostingPress]
  );

  const keyExtractor = useCallback((item: JobPosting) => item.id, []);

  // 로딩 상태
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['top']}>
        <Header title="내 공고" />
        <View className="flex-1 items-center justify-center">
          <Loading size="large" />
          <Text className="mt-4 text-gray-500 dark:text-gray-400">
            공고 목록을 불러오는 중...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['top']}>
        <Header title="내 공고" />
        <ErrorState
          title="공고 목록을 불러올 수 없습니다"
          message={error.message}
          onRetry={refetch}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['top']}>
      <Header title="내 공고" />

      {/* 새 공고 작성 버튼 */}
      <View className="px-4 py-3">
        <Button
          variant="primary"
          onPress={handleCreatePosting}
          className="flex-row items-center justify-center"
        >
          <PlusIcon size={20} color="#fff" />
          <Text className="ml-2 font-semibold text-white">새 공고 작성</Text>
        </Button>
      </View>

      {/* 필터 탭 */}
      <FilterTabs selected={filter} onChange={setFilter} counts={filterCounts} />

      {/* 공고 목록 */}
      {filteredPostings.length === 0 ? (
        <EmptyState
          icon={<BriefcaseIcon size={48} color="#9CA3AF" />}
          title={
            filter === 'all'
              ? '등록된 공고가 없습니다'
              : `${FILTER_OPTIONS.find((o) => o.value === filter)?.label} 공고가 없습니다`
          }
          description="새 공고를 작성해보세요."
        />
      ) : (
        <FlashList
          data={filteredPostings}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function EmployerTabScreen() {
  const { profile } = useAuth();
  const hasEmployerRole = profile?.role === 'employer' || profile?.role === 'admin';

  if (!hasEmployerRole) {
    return <NonEmployerView />;
  }

  return <EmployerView />;
}
