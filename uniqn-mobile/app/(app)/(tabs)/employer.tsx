import { SECONDARY_PALETTE, SURFACE_COLORS, TEXT_COLORS } from '@/constants/colors';
import { PTR_REFRESH_PROPS } from '@/constants/ptr';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { AppFlashList } from '@/components/ui/AppFlashList';
import { ActionSheet, type ActionSheetOption } from '@/components/ui';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ConfirmModal, PostingSurfaceState } from '@/components';
import { JobPostingCard, NonEmployerView } from '@/components/employer';
import { TabHeader } from '@/components/headers';
import { WorkspaceContextBar } from '@/components/workspace';
import {
  BriefcaseIcon,
  CalendarDaysIcon,
  ChevronRightIcon,
  EllipsisHorizontalIcon,
  PlusIcon,
  ShareIcon,
  UserPlusIcon,
} from '@/components/icons';
import {
  BulkShareActionBar,
  BULK_SHARE_ACTION_BAR_HEIGHT,
} from '@/components/share/BulkShareActionBar';
import { useBulkShare } from '@/hooks/share/useBulkShare';
import { useBulkShareSelection } from '@/hooks/share/useBulkShareSelection';
import { getIconColor } from '@/constants';
import { buildPostingFacts } from '@/domains/job-posting';
import {
  useCloseJobPosting,
  useMyJobPostings,
  useReopenJobPosting,
} from '@/hooks/useJobManagement';
import { useSharedJobPostings } from '@/hooks/job-posting/useSharedJobPostings';
import { usePostingFilledCounts } from '@/hooks/usePostingFilledCounts';
import { useTabBarBottomPadding } from '@/hooks/useTabBarBottomPadding';
import { useWeeklyGridEnabled } from '@/hooks';
import { useReceivedWorkspaceInvitations } from '@/hooks/workspace';
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

// 워크스페이스 진입 통일 — ⋯ 더보기 메뉴로 '워크스페이스'·'받은 초대' 진입점을 한곳에 모은다.
// 받은 초대가 있으면 빨간 dot 배지로 발견성 확보.
// (테스트 격리를 위해 named export — 파일 내부에서도 함께 사용된다)
export function WorkspaceHeaderAction() {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const { invitations: pendingInvitations } = useReceivedWorkspaceInvitations();
  const pendingCount = pendingInvitations.length;
  const [menuVisible, setMenuVisible] = useState(false);

  const options = useMemo<ActionSheetOption[]>(
    () => [
      { label: '팀', value: 'workspace' },
      {
        label: pendingCount > 0 ? `받은 초대 (${pendingCount}건)` : '받은 초대',
        value: 'invitations',
      },
    ],
    [pendingCount]
  );

  const handleSelect = useCallback((value: string) => {
    setMenuVisible(false);
    if (value === 'workspace') {
      router.push('/(employer)/workspace');
    } else if (value === 'invitations') {
      router.push('/(employer)/workspace/invitations');
    }
  }, []);

  return (
    <>
      <Pressable
        onPress={() => setMenuVisible(true)}
        className="relative rounded-sm p-2"
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`더보기${pendingCount > 0 ? ', 대기 중인 초대 있음' : ''}`}
      >
        <EllipsisHorizontalIcon size={24} color={getIconColor(isDarkMode, 'primary')} />
        {pendingCount > 0 ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border border-white bg-error-500 dark:border-surface"
          />
        ) : null}
      </Pressable>
      <ActionSheet
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        options={options}
        onSelect={handleSelect}
      />
    </>
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
  const { data: postings, isLoading, error, refetch, isRefetching } = useMyJobPostings();
  const closeMutation = useCloseJobPosting();
  const reopenMutation = useReopenJobPosting();
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  // 주간 배치 그리드(holdem 펍 운영 그리드) 진입점 — 플래그 ON 일 때만 노출(무회귀)
  const { enabled: weeklyGridEnabled } = useWeeklyGridEnabled();
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

  // 묶음 공유 — 지금 필터에 보이는 공고가 전체선택 대상이다(안 보이는 공고가 딸려가면 놀란다).
  const handleSelectAll = useCallback(
    () => selection.selectAll(filteredPostings),
    [filteredPostings, selection]
  );

  const handleBulkShare = useCallback(async () => {
    const result = await shareJobs(Array.from(selection.selectedIds), 'employer');
    if (result.success) {
      selection.exitSelectionMode();
    }
  }, [selection, shareJobs]);

  const handleWeeklyGrid = useCallback(() => {
    router.push('/(employer)/weekly-grid');
  }, []);

  // 공유받은 공고 (collaborator 본인 시점)
  const { sharedPostings } = useSharedJobPostings();
  const handleSharedPostingPress = useCallback((shared: SharedJobPosting) => {
    router.push(`/(employer)/my-postings/${shared.jobPostingId}`);
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
        <TabHeader title="내 공고" rightAction={<WorkspaceHeaderAction />} />
        <PostingSurfaceState mode="loading" scope="list" message="공고 목록을 불러오는 중..." />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
        <TabHeader title="내 공고" rightAction={<WorkspaceHeaderAction />} />
        <PostingSurfaceState
          mode="error"
          scope="detail"
          title="공고 목록을 불러올 수 없습니다"
          error={error}
          onRetry={refetch}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
      <TabHeader title="내 공고" rightAction={<WorkspaceHeaderAction />} />
      <WorkspaceContextBar />

      <View className="px-4 py-3">
        <Button
          variant="primary"
          onPress={handleCreatePosting}
          icon={<PlusIcon size={20} color={TEXT_COLORS.onGold} />}
        >
          <Text className="ml-2 font-sans-semibold text-content-onGold">새 공고 작성</Text>
        </Button>
        {weeklyGridEnabled ? (
          <Button
            variant="outline"
            onPress={handleWeeklyGrid}
            icon={<CalendarDaysIcon size={20} color={getIconColor(isDarkMode, 'primary')} />}
            className="mt-2"
            accessibilityLabel="근무표 열기"
          >
            <Text className="ml-2 font-sans-semibold text-content-primary">근무표</Text>
          </Button>
        ) : null}
      </View>

      <FilterTabs selected={filter} onChange={setFilter} counts={filterCounts} />

      {!selection.isSelectionMode && filteredPostings.length > 1 ? (
        <View className="flex-row justify-end px-4 pb-1">
          <Pressable
            onPress={selection.enterSelectionMode}
            hitSlop={8}
            className="min-h-[44px] flex-row items-center gap-1.5 active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="여러 공고 묶어서 공유하기"
          >
            <ShareIcon size={16} />
            <Text className="text-sm font-sans-medium text-content-secondary">묶음 공유</Text>
          </Pressable>
        </View>
      ) : null}

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
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} {...PTR_REFRESH_PROPS} />
          }
          showsVerticalScrollIndicator={false}
          // 선택 모드에서는 하단 액션 바 높이만큼 더 비워 마지막 카드가 가리지 않게 한다.
          contentContainerStyle={{
            paddingBottom:
              bottomPadding + (selection.isSelectionMode ? BULK_SHARE_ACTION_BAR_HEIGHT + 16 : 0),
          }}
        />
      )}

      {selection.isSelectionMode ? (
        <BulkShareActionBar
          selectedCount={selection.selectedCount}
          maxCount={selection.maxCount}
          onSelectAll={handleSelectAll}
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
