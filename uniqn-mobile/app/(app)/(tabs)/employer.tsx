/**
 * UNIQN Mobile - 내 공고 탭 화면
 * 구인자: 공고 목록 표시 / 일반 사용자: 안내 화면
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHasRole } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import {
  useMyJobPostings,
  useCloseJobPosting,
  useReopenJobPosting,
} from '@/hooks/useJobManagement';
import { Button, Loading, EmptyState, ErrorState, ConfirmModal } from '@/components';
import { JobPostingCard, NonEmployerView } from '@/components/employer';
import { EventQRModal } from '@/components/employer/qr/EventQRModal';
import { TabHeader } from '@/components/headers';
import { PlusIcon, BriefcaseIcon } from '@/components/icons';
import { getDateString } from '@/types/jobPosting/dateRequirement';
import type { JobPosting } from '@/types';

// ============================================================================
// Types
// ============================================================================

type FilterStatus = 'all' | 'active' | 'closed';

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '모집중' },
  { value: 'closed', label: '마감' },
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
  const { isDarkMode } = useThemeStore();

  return (
    <View className="mx-4 mb-4 flex-row rounded-lg bg-gray-100 p-1 dark:bg-surface">
      {FILTER_OPTIONS.map((option) => {
        const isSelected = selected === option.value;
        const count = counts[option.value] || 0;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            className="flex-1 items-center justify-center rounded-md py-2"
            style={{
              backgroundColor: isSelected ? (isDarkMode ? '#1F2937' : '#FFFFFF') : 'transparent',
            }}
            accessibilityLabel={`${option.label} 공고 ${count}건`}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
          >
            <Text
              className="text-sm font-medium"
              style={{
                color: isSelected ? '#4F46E5' : isDarkMode ? '#9CA3AF' : '#6B7280',
              }}
            >
              {option.label} ({count})
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * 공고의 가장 빠른 날짜+시간 문자열 반환 (정렬용)
 */
function getEarliestDateTime(posting: JobPosting, today: string): string {
  const reqs = posting.dateSpecificRequirements ?? [];
  if (reqs.length > 0) {
    const futureDateTimes: string[] = [];
    const pastDateTimes: string[] = [];

    for (const req of reqs) {
      const dateStr = getDateString(req.date);
      const times = (req.timeSlots ?? [])
        .filter((ts) => !(ts as { isTimeToBeAnnounced?: boolean }).isTimeToBeAnnounced)
        .map(
          (ts) =>
            (ts as { startTime?: string; time?: string }).startTime ||
            (ts as { startTime?: string; time?: string }).time ||
            '99:99'
        )
        .sort();
      const earliestTime = times[0] ?? '99:99';
      const dateTime = `${dateStr} ${earliestTime}`;

      if (dateStr >= today) {
        futureDateTimes.push(dateTime);
      } else {
        pastDateTimes.push(dateTime);
      }
    }

    if (futureDateTimes.length > 0) {
      return futureDateTimes.sort()[0] ?? '9999-99-99 99:99';
    }
    if (pastDateTimes.length > 0) {
      return pastDateTimes.sort().reverse()[0] ?? '9999-99-99 99:99';
    }
  }
  // 레거시: workDate
  return `${posting.workDate || '9999-99-99'} 99:99`;
}

// ============================================================================
// Employer View (내 공고 목록)
// ============================================================================

function EmployerView() {
  const { data: postings, isLoading, error, refetch, isRefetching } = useMyJobPostings();
  const closeMutation = useCloseJobPosting();
  const reopenMutation = useReopenJobPosting();
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [closeTargetId, setCloseTargetId] = useState<string | null>(null);
  const [reopenTargetId, setReopenTargetId] = useState<string | null>(null);
  // QR 모달 상태
  const [qrTargetPosting, setQrTargetPosting] = useState<JobPosting | null>(null);

  // 필터링된 목록 + 정렬
  const filteredPostings = useMemo(() => {
    if (!postings) return [];

    const today = new Date().toISOString().split('T')[0] ?? '';

    // 필터링
    const filtered =
      filter === 'all' ? postings : postings.filter((p: JobPosting) => p.status === filter);

    // 정렬: 오늘 이후 날짜 먼저 (가까운 순), 그 다음 과거 날짜 (최근 순)
    return [...filtered].sort((a, b) => {
      const dateTimeA = getEarliestDateTime(a, today);
      const dateTimeB = getEarliestDateTime(b, today);

      const dateA = dateTimeA.split(' ')[0] ?? '';
      const dateB = dateTimeB.split(' ')[0] ?? '';

      const aIsFuture = dateA >= today;
      const bIsFuture = dateB >= today;

      if (aIsFuture && !bIsFuture) return -1;
      if (!aIsFuture && bIsFuture) return 1;

      if (aIsFuture && bIsFuture) {
        return dateTimeA.localeCompare(dateTimeB);
      }

      return dateTimeB.localeCompare(dateTimeA);
    });
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

  // QR 모달 열기
  const handleShowQR = useCallback((posting: JobPosting) => {
    setQrTargetPosting(posting);
  }, []);

  // 공고 마감 - 모달 열기
  const handleClosePosting = useCallback((postingId: string) => {
    setCloseTargetId(postingId);
  }, []);

  // 공고 마감 확인
  const handleCloseConfirm = useCallback(() => {
    if (closeTargetId) {
      closeMutation.mutate(closeTargetId, {
        onSettled: async () => {
          // 데이터 리페치 완료 후 '마감' 필터로 이동
          await refetch();
          setFilter('closed');
        },
      });
      setCloseTargetId(null);
    }
  }, [closeTargetId, closeMutation, refetch]);

  // 공고 재오픈 - 모달 열기
  const handleReopenPosting = useCallback((postingId: string) => {
    setReopenTargetId(postingId);
  }, []);

  // 공고 재오픈 확인
  const handleReopenConfirm = useCallback(() => {
    if (reopenTargetId) {
      reopenMutation.mutate(reopenTargetId, {
        onSettled: async () => {
          // 데이터 리페치 완료 후 '모집중' 필터로 이동
          await refetch();
          setFilter('active');
        },
      });
      setReopenTargetId(null);
    }
  }, [reopenTargetId, reopenMutation, refetch]);

  // 새 공고 작성
  const handleCreatePosting = useCallback(() => {
    router.push('/(employer)/my-postings/create');
  }, []);

  // 렌더 아이템
  const renderItem = useCallback(
    ({ item }: { item: JobPosting }) => (
      <JobPostingCard
        posting={item}
        onPress={handlePostingPress}
        onClose={handleClosePosting}
        onReopen={handleReopenPosting}
        onShowQR={handleShowQR}
        isClosing={closeMutation.isPending}
        isReopening={reopenMutation.isPending}
      />
    ),
    [
      handlePostingPress,
      handleClosePosting,
      handleReopenPosting,
      handleShowQR,
      closeMutation.isPending,
      reopenMutation.isPending,
    ]
  );

  const keyExtractor = useCallback((item: JobPosting) => item.id, []);

  // 로딩 상태
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
        <TabHeader title="내 공고" />
        <View className="flex-1 items-center justify-center">
          <Loading size="large" />
          <Text className="mt-4 text-gray-500 dark:text-gray-400">공고 목록을 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
        <TabHeader title="내 공고" />
        <ErrorState
          title="공고 목록을 불러올 수 없습니다"
          message={error.message}
          onRetry={refetch}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
      <TabHeader title="내 공고" />

      {/* 새 공고 작성 버튼 */}
      <View className="px-4 py-3">
        <Button
          variant="primary"
          onPress={handleCreatePosting}
          icon={<PlusIcon size={20} color="#fff" />}
        >
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
          // @ts-expect-error - estimatedItemSize is required in FlashList 2.x but types may be missing
          estimatedItemSize={200}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}

      {/* 마감 확인 모달 */}
      <ConfirmModal
        visible={!!closeTargetId}
        onClose={() => setCloseTargetId(null)}
        onConfirm={handleCloseConfirm}
        title="공고 마감"
        message="이 공고를 마감하시겠습니까? 마감된 공고는 구직자에게 더 이상 노출되지 않습니다."
        confirmText="마감하기"
        cancelText="취소"
        isDestructive
      />

      {/* 재오픈 확인 모달 */}
      <ConfirmModal
        visible={!!reopenTargetId}
        onClose={() => setReopenTargetId(null)}
        onConfirm={handleReopenConfirm}
        title="공고 재오픈"
        message="이 공고를 다시 활성화하시겠습니까? 재오픈된 공고는 구직자에게 다시 노출됩니다."
        confirmText="재오픈"
        cancelText="취소"
      />

      {/* 현장 QR 모달 */}
      <EventQRModal
        visible={!!qrTargetPosting}
        onClose={() => setQrTargetPosting(null)}
        jobPostingId={qrTargetPosting?.id || ''}
        jobTitle={qrTargetPosting?.title}
      />
    </SafeAreaView>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function EmployerTabScreen() {
  // useHasRole은 RoleResolver.hasPermission으로 계층적 권한 체크 (admin > employer)
  const hasEmployerRole = useHasRole('employer');

  if (!hasEmployerRole) {
    return <NonEmployerView />;
  }

  return <EmployerView />;
}
