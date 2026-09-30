import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, RefreshControl, View } from 'react-native';
import { AppFlashList } from '@/components/ui/AppFlashList';
import { LIST_CONTAINER_STYLES } from '@/constants';
import { PTR_REFRESH_PROPS } from '@/constants/ptr';
import type { JobPostingCard } from '@/types';
import { JobCard, type ApplicationStatusType } from './JobCard';
import { PostingSurfaceState } from './shared';
import { ScreenSkeleton } from '@/components/ui';
import { loadFailed } from '@/constants/messages';
import { useShare } from '@/hooks/useShare';
import { groupPostingFilledCounts } from '@/hooks/usePostingFilledCounts';

interface JobListProps {
  jobs: JobPostingCard[];
  isLoading: boolean;
  isRefreshing: boolean;
  isFetchingMore: boolean;
  hasMore: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
  onJobPress: (jobId: string) => void;
  emptyMessage?: string;
  error?: Error | null;
  filledCounts?: Map<string, number>;
  /** jobPostingId → 내 활성 지원 상태. 카드 "지원완료/확정" 칩 표시용 (O(1) lookup) */
  applicationStatuses?: Map<string, ApplicationStatusType>;
  /** 빈 상태 액션 버튼 (예: "필터 초기화"). label과 handler 둘 다 있어야 노출 */
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  /**
   * 리스트 하단 여백. 탭바가 있는 화면은 useTabBarBottomPadding() 값을 넘겨야
   * 마지막 카드가 탭바에 가려지지 않는다. 미지정 시 기본 16px 패딩만 적용.
   */
  contentBottomPadding?: number;
}

export function JobList({
  jobs,
  isLoading,
  isRefreshing,
  isFetchingMore,
  hasMore,
  onRefresh,
  onLoadMore,
  onJobPress,
  emptyMessage = '등록된 공고가 없습니다',
  error,
  filledCounts,
  applicationStatuses,
  emptyActionLabel,
  onEmptyAction,
  contentBottomPadding,
}: JobListProps) {
  // 공유 훅은 목록에 하나만 둔다(카드마다 두면 카드 수만큼 스토어·토스트 구독이 생긴다).
  // shareJobById 는 isSharing 에 따라 identity 가 바뀌므로 ref 로 감싸 renderItem 을 안정시킨다
  // — 그렇지 않으면 공유 한 번에 모든 카드가 두 번씩 다시 그려진다.
  const { shareJobById } = useShare();
  const shareRef = useRef(shareJobById);
  useEffect(() => {
    shareRef.current = shareJobById;
  }, [shareJobById]);
  // 훅의 isSharing 가드는 리렌더 뒤에야 반영된다 — 같은 프레임 연타는 동기 ref 로 막는다.
  const sharingRef = useRef(false);
  const handleShare = useCallback((jobId: string) => {
    if (sharingRef.current) return;
    sharingRef.current = true;
    void shareRef.current(jobId).finally(() => {
      sharingRef.current = false;
    });
  }, []);

  // 전역 확정맵을 공고별로 한 번만 묶는다 — 카드마다 전역맵을 훑으면 카드 수 × 맵 크기.
  const filledByPosting = useMemo(() => groupPostingFilledCounts(filledCounts), [filledCounts]);

  const renderItem = useCallback(
    ({ item }: { item: JobPostingCard }) => (
      <JobCard
        job={item}
        onPress={onJobPress}
        onShare={handleShare}
        filledSubmap={filledByPosting.get(item.id)}
        applicationStatus={applicationStatuses?.get(item.id)}
      />
    ),
    [onJobPress, handleShare, filledByPosting, applicationStatuses]
  );

  const renderFooter = useCallback(() => {
    if (!isFetchingMore) {
      return null;
    }

    return (
      <View className="items-center py-4">
        <ActivityIndicator size="small" />
      </View>
    );
  }, [isFetchingMore]);

  const handleEndReached = useCallback(() => {
    if (!isFetchingMore && hasMore) {
      onLoadMore();
    }
  }, [hasMore, isFetchingMore, onLoadMore]);

  if (isLoading && jobs.length === 0) {
    return <ScreenSkeleton type="jobsList" count={5} />;
  }

  if (error && jobs.length === 0) {
    return (
      <PostingSurfaceState
        mode="error"
        scope="list"
        title={loadFailed('공고 목록')}
        error={error}
        onRetry={onRefresh}
      />
    );
  }

  if (!isLoading && jobs.length === 0) {
    return (
      <PostingSurfaceState
        mode="empty"
        scope="list"
        title="공고 없음"
        message={emptyMessage}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    );
  }

  return (
    <View className="flex-1 bg-surface-page dark:bg-surface">
      {error && jobs.length > 0 ? (
        <PostingSurfaceState
          mode="partial"
          scope="list"
          title="일부 정보만 표시 중입니다"
          message="최신 공고 상태를 모두 불러오지 못했습니다. 아래 목록은 계속 확인할 수 있습니다."
        />
      ) : null}

      <AppFlashList
        data={jobs}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        estimatedItemSize={160}
        contentContainerStyle={
          contentBottomPadding === undefined
            ? LIST_CONTAINER_STYLES.padding16
            : { ...LIST_CONTAINER_STYLES.padding16, paddingBottom: contentBottomPadding }
        }
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} {...PTR_REFRESH_PROPS} />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
      />
    </View>
  );
}
