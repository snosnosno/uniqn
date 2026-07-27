/**
 * 관리자 - 전체 공고 묶음 공유
 *
 * @description 서비스 전체의 공고를 훑어보고 여러 건을 골라 한 번에 공유한다.
 *
 *   모수는 공개 브라우즈 쿼리(useJobPostings)를 그대로 쓴다. 관리자 전용 조회나 RLS 변경이
 *   필요 없는 이유: 공유 가능 공고(canShareJob) = 브라우징 가능(active/capacity_full) +
 *   승인된 대회 = 이 쿼리의 기본 모수와 정확히 일치한다. draft/pending/closed 는 공유해도
 *   죽은 링크라 목록에 없어도 기능 손실이 0이다.
 */

import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppFlashList } from '@/components/ui/AppFlashList';
import { Checkbox } from '@/components/ui';
import { EmptyState } from '@/components/ui/EmptyState';
import { StackHeader } from '@/components/headers';
import { BriefcaseIcon } from '@/components/icons';
import { PostingCardSurface } from '@/components/jobs/shared/PostingCardSurface';
import { PostingSurfaceState } from '@/components';
import {
  BulkShareActionBar,
  BULK_SHARE_ACTION_BAR_HEIGHT,
} from '@/components/share/BulkShareActionBar';
import { PTR_REFRESH_PROPS } from '@/constants/ptr';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { useBulkShare } from '@/hooks/share/useBulkShare';
import { useBulkShareSelection } from '@/hooks/share/useBulkShareSelection';
import { useJobPostings } from '@/hooks/useJobPostings';
import { extractPostingFilledSubmap, usePostingFilledCounts } from '@/hooks/usePostingFilledCounts';
import type { JobPostingCard, PostingType } from '@/types';

const TYPE_FILTERS: { value: PostingType | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'tournament', label: '대회' },
  { value: 'regular', label: '일반' },
  { value: 'urgent', label: '급구' },
];

export default function AdminPostingsScreen() {
  const [typeFilter, setTypeFilter] = useState<PostingType | 'all'>('all');
  const selection = useBulkShareSelection();
  const { shareJobs, isSharing } = useBulkShare();

  const filters = useMemo(
    () => (typeFilter === 'all' ? {} : { postingType: typeFilter }),
    [typeFilter]
  );
  const { jobs, isLoading, error, refresh, isRefreshing, loadMore, hasMore } = useJobPostings({
    filters,
  });

  const filledCountIds = useMemo(() => jobs.map((job) => job.id), [jobs]);
  const filledCountsQuery = usePostingFilledCounts(filledCountIds);

  // 전체선택 토글. "전부"의 기준은 화면에 보이는 공유 가능 공고이되, 상한(10건)에서 잘린다 —
  // 상한을 안 끼우면 공유 가능 공고가 11건일 때 영원히 "전체 해제" 로 안 바뀐다.
  const shareableCount = useMemo(
    () => jobs.filter((job) => selection.canSelect(job)).length,
    [jobs, selection]
  );
  const isAllSelected =
    selection.selectedCount > 0 &&
    selection.selectedCount >= Math.min(shareableCount, selection.maxCount);

  const handleSelectAll = useCallback(() => {
    if (isAllSelected) {
      selection.clear();
      return;
    }
    selection.selectAll(jobs);
  }, [isAllSelected, jobs, selection]);

  const handleBulkShare = useCallback(async () => {
    const result = await shareJobs(Array.from(selection.selectedIds), 'admin');
    if (result.success) {
      selection.exitSelectionMode();
    }
  }, [selection, shareJobs]);

  const renderItem = useCallback(
    ({ item }: { item: JobPostingCard }) => {
      const selectable = selection.canSelect(item);
      const selected = selection.selectedIds.has(item.id);

      return (
        <View className="mx-4 mb-3">
          <PostingCardSurface
            card={item}
            onPress={() => selectable && selection.toggle(item)}
            pressableClassName="p-4"
            accessibilityLabel={`${item.title} 공고 선택`}
            stripeTone={selected ? 'gold' : 'muted'}
            containerClassName={`overflow-hidden ${selectable ? '' : 'opacity-50'} ${
              selected ? 'border-2 border-primary-500 dark:border-primary-400' : ''
            }`}
            filledCounts={extractPostingFilledSubmap(filledCountsQuery.data, item.id)}
            topStatus={
              <View className="flex-row items-center justify-between">
                <Checkbox
                  checked={selected}
                  disabled={!selectable}
                  onChange={() => selection.toggle(item)}
                  size="md"
                  testID={`admin-bulk-share-checkbox-${item.id}`}
                />
                {item.ownerName ? (
                  <Text
                    numberOfLines={1}
                    className="ml-2 max-w-[160px] text-xs text-content-secondary font-sans"
                  >
                    {item.ownerName}
                  </Text>
                ) : null}
              </View>
            }
          />
        </View>
      );
    },
    [filledCountsQuery.data, selection]
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="공고 묶음 공유" fallbackHref="/(admin)" />
        <PostingSurfaceState mode="loading" scope="list" message="공고 목록을 불러오는 중..." />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="공고 묶음 공유" fallbackHref="/(admin)" />
        <PostingSurfaceState
          mode="error"
          scope="detail"
          title="공고 목록을 불러올 수 없습니다"
          error={error}
          onRetry={() => void refresh()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
      <StackHeader title="공고 묶음 공유" fallbackHref="/(admin)" />

      <View className="flex-row gap-2 px-4 py-3">
        {TYPE_FILTERS.map((option) => {
          const active = typeFilter === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setTypeFilter(option.value)}
              className={`min-h-[40px] justify-center rounded-md px-4 active:opacity-70 ${
                active
                  ? 'bg-primary-600 dark:bg-primary-500'
                  : 'bg-secondary-100 dark:bg-surface-elevated'
              }`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${option.label} 공고만 보기`}
            >
              <Text
                className={`text-sm font-sans-medium ${
                  active ? 'text-content-onGold' : 'text-content-secondary'
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text className="px-4 pb-2 text-xs text-content-secondary font-sans">
        공유 가능한 공고(모집중·승인 완료)만 표시됩니다. 최대 {selection.maxCount}건까지 한 번에
        공유할 수 있어요.
      </Text>

      {jobs.length === 0 ? (
        <EmptyState
          icon={<BriefcaseIcon size={48} color={SECONDARY_PALETTE[400]} />}
          title="공유할 수 있는 공고가 없습니다"
          description="모집중이면서 승인이 완료된 공고만 공유할 수 있어요."
        />
      ) : (
        <AppFlashList
          data={jobs}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          estimatedItemSize={200}
          onEndReached={() => {
            if (hasMore) loadMore();
          }}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void refresh()}
              {...PTR_REFRESH_PROPS}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: BULK_SHARE_ACTION_BAR_HEIGHT + 24 }}
        />
      )}

      <BulkShareActionBar
        selectedCount={selection.selectedCount}
        maxCount={selection.maxCount}
        onSelectAll={handleSelectAll}
        isAllSelected={isAllSelected}
        onShare={handleBulkShare}
        onCancel={selection.clear}
        isSharing={isSharing}
      />
    </SafeAreaView>
  );
}
