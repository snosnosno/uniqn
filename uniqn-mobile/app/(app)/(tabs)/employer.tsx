import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ConfirmModal, PostingSurfaceState } from '@/components';
import { EventQRModal } from '@/components/employer/qr/EventQRModal';
import { JobPostingCard, NonEmployerView } from '@/components/employer';
import { TabHeader } from '@/components/headers';
import { BriefcaseIcon, PlusIcon } from '@/components/icons';
import { buildPostingFacts } from '@/domains/job-posting';
import {
  useCloseJobPosting,
  useMyJobPostings,
  useReopenJobPosting,
} from '@/hooks/useJobManagement';
import { useHasRole } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import type { JobPosting } from '@/types';

type FilterStatus = 'all' | 'active' | 'closed';

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '모집중' },
  { value: 'closed', label: '마감' },
];

interface FilterTabsProps {
  selected: FilterStatus;
  onChange: (status: FilterStatus) => void;
  counts: Partial<Record<FilterStatus, number>>;
}

function FilterTabs({ selected, onChange, counts }: FilterTabsProps) {
  const { isDarkMode } = useThemeStore();

  return (
    <View className="mx-4 mb-4 flex-row rounded-lg bg-secondary-100 p-1 dark:bg-surface">
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

function getEarliestDateTime(posting: JobPosting, today: string): string {
  const requirements = buildPostingFacts(posting).schedule.dateRequirements;

  if (requirements.length > 0) {
    const futureDateTimes: string[] = [];
    const pastDateTimes: string[] = [];

    for (const requirement of requirements) {
      const times = (requirement.timeSlots ?? [])
        .filter((slot) => !slot.isTimeToBeAnnounced)
        .map((slot) => slot.startTime || '99:99')
        .sort();
      const earliestTime = times[0] ?? '99:99';
      const dateTime = `${requirement.date} ${earliestTime}`;

      if (requirement.date >= today) {
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

  return `${posting.workDate || '9999-99-99'} 99:99`;
}

function EmployerView() {
  const { data: postings, isLoading, error, refetch, isRefetching } = useMyJobPostings();
  const closeMutation = useCloseJobPosting();
  const reopenMutation = useReopenJobPosting();
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [closeTargetId, setCloseTargetId] = useState<string | null>(null);
  const [reopenTargetId, setReopenTargetId] = useState<string | null>(null);
  const [qrTargetPosting, setQrTargetPosting] = useState<JobPosting | null>(null);

  const filteredPostings = useMemo(() => {
    if (!postings) {
      return [];
    }

    const today = new Date().toISOString().split('T')[0] ?? '';
    const filtered =
      filter === 'all' ? postings : postings.filter((posting) => posting.status === filter);

    return [...filtered].sort((left, right) => {
      const leftDateTime = getEarliestDateTime(left, today);
      const rightDateTime = getEarliestDateTime(right, today);
      const leftDate = leftDateTime.split(' ')[0] ?? '';
      const rightDate = rightDateTime.split(' ')[0] ?? '';
      const leftIsFuture = leftDate >= today;
      const rightIsFuture = rightDate >= today;

      if (leftIsFuture && !rightIsFuture) {
        return -1;
      }

      if (!leftIsFuture && rightIsFuture) {
        return 1;
      }

      if (leftIsFuture && rightIsFuture) {
        return leftDateTime.localeCompare(rightDateTime);
      }

      return rightDateTime.localeCompare(leftDateTime);
    });
  }, [filter, postings]);

  const filterCounts = useMemo(() => {
    if (!postings) {
      return {};
    }

    const counts: Partial<Record<FilterStatus, number>> = { all: postings.length };
    postings.forEach((posting) => {
      const status = posting.status as FilterStatus;
      counts[status] = (counts[status] || 0) + 1;
    });

    return counts;
  }, [postings]);

  const handlePostingPress = useCallback((posting: JobPosting) => {
    router.push(`/(employer)/my-postings/${posting.id}`);
  }, []);

  const handleShowQR = useCallback((posting: JobPosting) => {
    setQrTargetPosting(posting);
  }, []);

  const handleClosePosting = useCallback((postingId: string) => {
    setCloseTargetId(postingId);
  }, []);

  const handleCloseConfirm = useCallback(() => {
    if (!closeTargetId) {
      return;
    }

    closeMutation.mutate(closeTargetId, {
      onSettled: async () => {
        await refetch();
        setFilter('closed');
      },
    });
    setCloseTargetId(null);
  }, [closeMutation, closeTargetId, refetch]);

  const handleReopenPosting = useCallback((postingId: string) => {
    setReopenTargetId(postingId);
  }, []);

  const handleReopenConfirm = useCallback(() => {
    if (!reopenTargetId) {
      return;
    }

    reopenMutation.mutate(reopenTargetId, {
      onSettled: async () => {
        await refetch();
        setFilter('active');
      },
    });
    setReopenTargetId(null);
  }, [refetch, reopenMutation, reopenTargetId]);

  const handleCreatePosting = useCallback(() => {
    router.push('/(employer)/my-postings/create');
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-secondary-50 dark:bg-surface-dark" edges={['top']}>
        <TabHeader title="내 공고" />
        <PostingSurfaceState mode="loading" scope="detail" message="공고 목록을 불러오는 중..." />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-secondary-50 dark:bg-surface-dark" edges={['top']}>
        <TabHeader title="내 공고" />
        <PostingSurfaceState
          mode="error"
          scope="detail"
          title="공고 목록을 불러올 수 없습니다"
          message={error.message}
          error={error}
          onRetry={refetch}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-secondary-50 dark:bg-surface-dark" edges={['top']}>
      <TabHeader title="내 공고" />

      <View className="px-4 py-3">
        <Button
          variant="primary"
          onPress={handleCreatePosting}
          icon={<PlusIcon size={20} color="#fff" />}
        >
          <Text className="ml-2 font-semibold text-white">새 공고 작성</Text>
        </Button>
      </View>

      <FilterTabs selected={filter} onChange={setFilter} counts={filterCounts} />

      {filteredPostings.length === 0 ? (
        <PostingSurfaceState
          mode="empty"
          scope="detail"
          icon={<BriefcaseIcon size={48} color="#9CA3AF" />}
          title={
            filter === 'all'
              ? '등록된 공고가 없습니다'
              : `${FILTER_OPTIONS.find((option) => option.value === filter)?.label} 공고가 없습니다`
          }
          message="새 공고를 작성해 보세요."
        />
      ) : (
        <FlashList
          data={filteredPostings}
          renderItem={({ item }) => (
            <JobPostingCard
              posting={item}
              onPress={handlePostingPress}
              onClose={handleClosePosting}
              onReopen={handleReopenPosting}
              onShowQR={handleShowQR}
              isClosing={closeMutation.isPending}
              isReopening={reopenMutation.isPending}
            />
          )}
          keyExtractor={(item) => item.id}
          // @ts-expect-error - estimatedItemSize is required in FlashList 2.x but types may be missing
          estimatedItemSize={200}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}

      <ConfirmModal
        visible={Boolean(closeTargetId)}
        onClose={() => setCloseTargetId(null)}
        onConfirm={handleCloseConfirm}
        confirmTestID="employer-close-posting-confirm"
        cancelTestID="employer-close-posting-cancel"
        title="공고 마감"
        message="이 공고를 마감하시겠습니까? 마감된 공고는 구직자에게 더 이상 노출되지 않습니다."
        confirmText="마감하기"
        cancelText="취소"
        isDestructive
      />

      <ConfirmModal
        visible={Boolean(reopenTargetId)}
        onClose={() => setReopenTargetId(null)}
        onConfirm={handleReopenConfirm}
        title="공고 재오픈"
        message="이 공고를 다시 활성화하시겠습니까? 재오픈한 공고는 다시 구직자에게 노출됩니다."
        confirmText="재오픈"
        cancelText="취소"
      />

      <EventQRModal
        visible={Boolean(qrTargetPosting)}
        onClose={() => setQrTargetPosting(null)}
        jobPostingId={qrTargetPosting?.id || ''}
        jobTitle={qrTargetPosting?.title}
      />
    </SafeAreaView>
  );
}

export default function EmployerTabScreen() {
  const hasEmployerRole = useHasRole('employer');

  if (!hasEmployerRole) {
    return <NonEmployerView />;
  }

  return <EmployerView />;
}
