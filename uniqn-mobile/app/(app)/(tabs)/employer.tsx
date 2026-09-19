import { SECONDARY_PALETTE, SURFACE_COLORS, TEXT_COLORS } from '@/constants/colors';
import { PTR_REFRESH_PROPS } from '@/constants/ptr';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { AppFlashList } from '@/components/ui/AppFlashList';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ConfirmModal, PostingSurfaceState } from '@/components';
import { JobPostingCard, NonEmployerView } from '@/components/employer';
import { TabHeader } from '@/components/headers';
import { WorkspaceContextBar } from '@/components/workspace';
import { BriefcaseIcon, ChevronRightIcon, PlusIcon, UserPlusIcon } from '@/components/icons';
import {
  BulkShareActionBar,
  BULK_SHARE_ACTION_BAR_HEIGHT,
} from '@/components/share/BulkShareActionBar';
import { useBulkShare } from '@/hooks/share/useBulkShare';
import { useBulkShareSelection } from '@/hooks/share/useBulkShareSelection';
import { buildPostingFacts, POSTING_STATUS_ACTION_TEXT } from '@/domains/job-posting';
import type { TodayAttentionTarget } from '@/domains/staff';
import { EmployerMoreMenu } from '@/features/employer/tab/EmployerMoreMenu';
import {
  EmployerTabSegment,
  type EmployerTabSegmentValue,
} from '@/features/employer/tab/EmployerTabSegment';
import { TodayAttentionLine } from '@/features/employer/tab/TodayAttentionLine';
import {
  WorkScheduleView,
  type WorkScheduleFocusRequest,
} from '@/features/employer/workSchedule/WorkScheduleView';
import { useTodayAttention } from '@/hooks/employer/useTodayAttention';
import {
  useCloseJobPosting,
  useMyJobPostings,
  useReopenJobPosting,
} from '@/hooks/useJobManagement';
import { useSharedJobPostings } from '@/hooks/job-posting/useSharedJobPostings';
import { useManualRefresh } from '@/hooks/useManualRefresh';
import { usePostingFilledCounts } from '@/hooks/usePostingFilledCounts';
import { useSubmitGate } from '@/hooks/useSubmitGate';
import { useTabBarBottomPadding } from '@/hooks/useTabBarBottomPadding';
import { useWorkScheduleEnabled } from '@/hooks/useWorkScheduleEnabled';
import { useHasRole } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { getTodayString } from '@/utils/date';
import type { JobPosting } from '@/types';
import type { SharedJobPosting } from '@/types/jobPostingCollaborator';
import {
  countPostingsByFilter,
  postingMatchesFilter,
  type PostingFilterStatus,
} from '@/utils/employerPostingFilter';
import { loadFailed } from '@/constants/messages';

type FilterStatus = PostingFilterStatus;

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
    <View className="flex-1 flex-row rounded-lg bg-secondary-100 p-1 dark:bg-surface">
      {FILTER_OPTIONS.map((option) => {
        const isSelected = selected === option.value;
        const count = counts[option.value] || 0;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            className="flex-1 items-center justify-center rounded-md py-2"
            style={{
              backgroundColor: isSelected
                ? isDarkMode
                  ? SURFACE_COLORS.overlay
                  : '#FFFFFF'
                : 'transparent',
            }}
            accessibilityLabel={`${option.label} 공고 ${count}건`}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
          >
            <Text
              className="text-sm font-sans-medium"
              style={{
                color: isSelected
                  ? isDarkMode
                    ? '#D4AF37'
                    : '#8A7228'
                  : isDarkMode
                    ? SECONDARY_PALETTE[400]
                    : SECONDARY_PALETTE[600],
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
  const bottomPadding = useTabBarBottomPadding();
  const { data: postings, isLoading, error, refetch } = useMyJobPostings();
  // 오늘 한 줄 — '나'(owner) 기준 내 공고 전체. 0건이면 렌더하지 않는다(구인자 IA S3).
  const attention = useTodayAttention();
  const { refetch: refetchAttention } = attention;
  // 당겨서 새로고침은 목록과 오늘 한 줄을 **둘 다 기다린다** — 스피너가 목록만 보고 멈추면
  // 그 뒤에 오늘 한 줄 숫자가 늦게 바뀌어 한동안 서로 어긋나 보인다.
  const refetchAll = useCallback(
    () => Promise.all([refetchAttention(), refetch()]),
    [refetch, refetchAttention]
  );
  // 스피너는 사용자가 당겼을 때만 — isRefetching 을 물리면 탭에 들어올 때마다 뜬다
  // (배경 재조회는 조용해야 한다. useManualRefresh 주석 참고).
  const { refreshing, onRefresh } = useManualRefresh(refetchAll);
  const closeMutation = useCloseJobPosting();
  const reopenMutation = useReopenJobPosting();
  // 근무표 세그먼트 — 플래그 ON 일 때만 노출(무회귀). OFF 면 항상 [공고].
  const { enabled: workScheduleEnabled } = useWorkScheduleEnabled();
  const [segmentState, setSegmentState] = useState<EmployerTabSegmentValue>('postings');
  const segment: EmployerTabSegmentValue = workScheduleEnabled ? segmentState : 'postings';
  const [focusRequest, setFocusRequest] = useState<WorkScheduleFocusRequest | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [closeTargetId, setCloseTargetId] = useState<string | null>(null);
  const [reopenTargetId, setReopenTargetId] = useState<string | null>(null);
  const selection = useBulkShareSelection();
  const { shareJobs, isSharing: isBulkSharing } = useBulkShare();

  const filteredPostings = useMemo(() => {
    if (!postings) {
      return [];
    }

    const today = getTodayString();
    const filtered =
      filter === 'all'
        ? postings
        : postings.filter((posting) => postingMatchesFilter(posting.status, filter));

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

  // 확정 인원(filled/total) hydrate — 내 공고 카드도 구인구직·공고상세와 동일한 실측 카운트를 쓰도록 배선.
  // (SP3 이후 role.filled 는 소스에서 0 고정 → 표시 시점 hydrate 가 없으면 항상 0/N 으로 나온다)
  const filledCountIds = useMemo(
    () => filteredPostings.map((posting) => posting.id),
    [filteredPostings]
  );
  const filledCountsQuery = usePostingFilledCounts(filledCountIds);

  const filterCounts = useMemo(() => {
    if (!postings) {
      return {};
    }

    return countPostingsByFilter(postings);
  }, [postings]);

  const handlePostingPress = useCallback((posting: JobPosting) => {
    router.push(`/(employer)/my-postings/${posting.id}`);
  }, []);

  // QR 은 모달이 아니라 공고 상세의 전용 화면으로 간다 — 헤더 QR 버튼과 도착지가 같다.
  const handleShowQR = useCallback((posting: JobPosting) => {
    router.push(`/(employer)/my-postings/${posting.id}/qr`);
  }, []);

  const handleClosePosting = useCallback((postingId: string) => {
    setCloseTargetId(postingId);
  }, []);

  // 마감 (ORDER-3 허브) — 필터 전환을 onSettled 에 걸면 **실패해도** 실행된다.
  // 마감에 실패했는데 '마감' 탭으로 넘어가면 사용자는 방금 그 공고를 찾지 못한 채
  // 처리가 된 줄 안다. 성공에서만 전환한다.
  const closeGate = useSubmitGate<[string]>({
    action: (postingId) => closeMutation.mutateAsync(postingId),
    onSuccess: async () => {
      await refetch();
      setFilter('closed');
    },
    errorMessage: '공고 마감 실패',
  });

  const handleCloseConfirm = useCallback(() => {
    if (!closeTargetId) {
      return;
    }
    void closeGate.submit(closeTargetId);
    setCloseTargetId(null);
  }, [closeGate, closeTargetId]);

  const handleReopenPosting = useCallback((postingId: string) => {
    setReopenTargetId(postingId);
  }, []);

  // 재오픈 (ORDER-3 허브) — 마감과 같은 이유로 성공에서만 전환한다.
  const reopenGate = useSubmitGate<[string]>({
    action: (postingId) => reopenMutation.mutateAsync(postingId),
    onSuccess: async () => {
      await refetch();
      setFilter('active');
    },
    errorMessage: '공고 재오픈 실패',
  });

  const handleReopenConfirm = useCallback(() => {
    if (!reopenTargetId) {
      return;
    }
    void reopenGate.submit(reopenTargetId);
    setReopenTargetId(null);
  }, [reopenGate, reopenTargetId]);

  const handleCreatePosting = useCallback(() => {
    router.push('/(employer)/my-postings/create');
  }, []);

  // 묶음 공유 — 지금 필터에 보이는 공고가 전체선택 대상이다(안 보이는 공고가 딸려가면 놀란다).
  // 상한(10건)에서 잘린 것도 "전부"로 친다 — 안 그러면 11건일 때 영원히 "전체 해제" 로 안 바뀐다.
  const shareableCount = useMemo(
    () => filteredPostings.filter((posting) => selection.canSelect(posting)).length,
    [filteredPostings, selection]
  );
  const isAllSelected =
    selection.selectedCount > 0 &&
    selection.selectedCount >= Math.min(shareableCount, selection.maxCount);

  const handleSelectAll = useCallback(() => {
    if (isAllSelected) {
      selection.clear();
      return;
    }
    selection.selectAll(filteredPostings);
  }, [filteredPostings, isAllSelected, selection]);

  const handleBulkShare = useCallback(async () => {
    const result = await shareJobs(Array.from(selection.selectedIds), 'employer');
    if (result.success) {
      selection.exitSelectionMode();
    }
  }, [selection, shareJobs]);

  // 묶음 공유는 ⋯ 안에 둔다(구인자 IA S3). 조건은 종전과 같다 — [공고]에서 공고가 2건 이상.
  const canBulkShare =
    segment === 'postings' && !selection.isSelectionMode && filteredPostings.length > 1;

  const handleSegmentChange = useCallback(
    (next: EmployerTabSegmentValue) => {
      // 선택 모드의 하단 액션 바가 근무표 위에 남지 않게 한다.
      if (next === 'schedule' && selection.isSelectionMode) {
        selection.exitSelectionMode();
      }
      setSegmentState(next);
    },
    [selection]
  );

  // 오늘 한 줄 → 공고 하나면 그 [근무], 여러 공고면 근무표의 그 날짜.
  const handleAttentionPress = useCallback(
    (target: TodayAttentionTarget) => {
      if (target.kind === 'posting') {
        router.push(`/(employer)/my-postings/${target.jobPostingId}/settlements`);
        return;
      }
      if (selection.isSelectionMode) {
        selection.exitSelectionMode();
      }
      setSegmentState('schedule');
      setFocusRequest({ date: target.date, requestedAt: Date.now() });
    },
    [selection]
  );
  // 근무표가 꺼져 있으면 여러 공고에 걸친 신호는 갈 곳이 없다 — 누를 수 없는 줄로 그린다.
  const attentionOnPress =
    attention.summary.target?.kind === 'schedule' && !workScheduleEnabled
      ? undefined
      : handleAttentionPress;

  // 공유받은 공고 (collaborator 본인 시점)
  const { sharedPostings } = useSharedJobPostings();
  const handleSharedPostingPress = useCallback((shared: SharedJobPosting) => {
    router.push(`/(employer)/my-postings/${shared.jobPostingId}`);
  }, []);

  // 공고 목록의 로딩·실패는 [공고] 본문만의 상태다. 화면 전체를 조기 반환하면 무관한 조회 하나가
  // 세그먼트(근무표 도달)와 오늘 한 줄까지 지운다 — 그래서 본문 자리에서만 분기한다.
  const renderPostingsBody = () => {
    if (isLoading) {
      return (
        <PostingSurfaceState mode="loading" scope="list" message="공고 목록을 불러오는 중..." />
      );
    }

    if (error) {
      return (
        <PostingSurfaceState
          mode="error"
          scope="detail"
          title={loadFailed('공고 목록')}
          error={error}
          onRetry={refetch}
        />
      );
    }

    return (
      <>
        <View className="px-4 py-3">
          <Button
            variant="primary"
            onPress={handleCreatePosting}
            icon={<PlusIcon size={20} color={TEXT_COLORS.onGold} />}
          >
            <Text className="ml-2 font-sans-semibold text-content-onGold">새 공고 작성</Text>
          </Button>
        </View>

        <View className="mx-4 mb-2 flex-row items-center">
          <FilterTabs selected={filter} onChange={setFilter} counts={filterCounts} />
        </View>

        {sharedPostings.length > 0 ? (
          <View className="mx-4 mb-3">
            <View className="mb-2 flex-row items-center">
              <UserPlusIcon size={16} color="#2563EB" />
              <Text className="ml-1.5 text-xs font-sans-semibold uppercase text-content-secondary">
                공유받은 공고 ({sharedPostings.length})
              </Text>
            </View>
            {sharedPostings.map((shared) => (
              <Pressable
                key={shared.jobPostingId}
                onPress={() => handleSharedPostingPress(shared)}
                className="mb-2 flex-row items-center rounded-lg border border-info-100 bg-info-50 px-3 py-2 active:opacity-70 dark:border-info-500/30 dark:bg-info-50"
                accessibilityRole="button"
                accessibilityLabel={`공유받은 공고 ${shared.jobPostingTitle}`}
              >
                <View className="flex-1 min-w-0">
                  <Text
                    className="text-sm font-sans-semibold text-content-primary dark:text-off-white"
                    numberOfLines={1}
                  >
                    {shared.jobPostingTitle}
                  </Text>
                  <Text className="mt-0.5 text-xs text-content-secondary" numberOfLines={1}>
                    {shared.workspaceName} 팀
                  </Text>
                </View>
                <ChevronRightIcon size={16} color={SECONDARY_PALETTE[400]} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {filteredPostings.length === 0 ? (
          <PostingSurfaceState
            mode="empty"
            scope="detail"
            icon={<BriefcaseIcon size={48} color={SECONDARY_PALETTE[400]} />}
            title={
              filter === 'all'
                ? '등록된 공고가 없습니다'
                : `${FILTER_OPTIONS.find((option) => option.value === filter)?.label} 공고가 없습니다`
            }
            message="새 공고를 작성해 보세요."
          />
        ) : (
          <AppFlashList
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
                filledCounts={filledCountsQuery.data}
                selectionMode={selection.isSelectionMode}
                selected={selection.selectedIds.has(item.id)}
                selectable={selection.canSelect(item)}
                onToggleSelect={selection.toggle}
              />
            )}
            keyExtractor={(item) => item.id}
            estimatedItemSize={200}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                {...PTR_REFRESH_PROPS}
              />
            }
            showsVerticalScrollIndicator={false}
            // 선택 모드에서는 하단 액션 바 높이만큼 더 비워 마지막 카드가 가리지 않게 한다.
            contentContainerStyle={{
              paddingBottom:
                bottomPadding + (selection.isSelectionMode ? BULK_SHARE_ACTION_BAR_HEIGHT + 16 : 0),
            }}
          />
        )}
      </>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
      <TabHeader
        title="내 공고"
        rightAction={
          <EmployerMoreMenu onBulkShare={canBulkShare ? selection.enterSelectionMode : undefined} />
        }
      />
      <WorkspaceContextBar />

      <TodayAttentionLine
        summary={attention.summary}
        isError={attention.isError}
        onPress={attentionOnPress}
        onRetry={refetchAttention}
      />

      {/* 근무표는 헤더 아이콘이 아니라 이름표가 붙은 세그먼트로 둔다 — 아이콘만으로는 기능의 존재
          자체가 발견되지 않는다(#488 헤더 이동을 되돌린 이유). */}
      {workScheduleEnabled ? (
        <View className="mx-4 mt-3">
          <EmployerTabSegment value={segment} onChange={handleSegmentChange} />
        </View>
      ) : null}

      {segment === 'schedule' ? (
        // 탭 안이라 하단 탭바가 본문을 덮는다 — 스택 화면용 기본 여백 대신 탭바 여백을 넘긴다.
        <WorkScheduleView focusRequest={focusRequest} contentBottomPadding={bottomPadding} />
      ) : (
        renderPostingsBody()
      )}

      {segment === 'postings' && selection.isSelectionMode ? (
        <BulkShareActionBar
          selectedCount={selection.selectedCount}
          maxCount={selection.maxCount}
          onSelectAll={handleSelectAll}
          isAllSelected={isAllSelected}
          onShare={handleBulkShare}
          onCancel={selection.exitSelectionMode}
          isSharing={isBulkSharing}
          bottomOffset={bottomPadding}
        />
      ) : null}

      <ConfirmModal
        visible={Boolean(closeTargetId)}
        onClose={() => setCloseTargetId(null)}
        onConfirm={handleCloseConfirm}
        confirmTestID="employer-close-posting-confirm"
        cancelTestID="employer-close-posting-cancel"
        title={POSTING_STATUS_ACTION_TEXT.close.confirmTitle}
        message={POSTING_STATUS_ACTION_TEXT.close.confirmMessage}
        confirmText={POSTING_STATUS_ACTION_TEXT.close.confirmText}
        cancelText="취소"
        isDestructive
      />

      <ConfirmModal
        visible={Boolean(reopenTargetId)}
        onClose={() => setReopenTargetId(null)}
        onConfirm={handleReopenConfirm}
        title={POSTING_STATUS_ACTION_TEXT.reopen.confirmTitle}
        message={POSTING_STATUS_ACTION_TEXT.reopen.confirmMessage}
        confirmText={POSTING_STATUS_ACTION_TEXT.reopen.confirmText}
        cancelText="취소"
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
