/**
 * UNIQN Mobile - Admin Tournament Approval
 *
 * @description 관리자 대회공고 승인 관리 페이지
 * @version 1.0.0
 */

import { useState, useCallback, memo, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTournamentApproval, useTournamentsByStatus } from '@/hooks/useTournamentApproval';
import { ApprovalModal } from '@/components/admin/ApprovalModal';
import { TournamentStatusBadge } from '@/components/jobs/TournamentStatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { STATUS } from '@/constants';
import type { JobPosting, TournamentApprovalStatus } from '@/types';
import { useThemeStore } from '@/stores/themeStore';

// ============================================================================
// Types
// ============================================================================

type TabStatus = TournamentApprovalStatus;

interface StatusTabProps {
  status: TabStatus;
  label: string;
  count?: number;
  isSelected: boolean;
  onPress: () => void;
  isDarkMode: boolean;
}

interface TournamentCardProps {
  posting: JobPosting;
  onApprove: () => void;
  onReject: () => void;
  onViewDetail: () => void;
  isProcessing: boolean;
}

// ============================================================================
// Sub Components
// ============================================================================

const StatusTab = memo(function StatusTab({
  label,
  count,
  isSelected,
  onPress,
  isDarkMode,
}: StatusTabProps) {
  return (
    <Pressable
      onPress={onPress}
      className="px-4 py-2 rounded-full mr-2 flex-row items-center"
      style={{
        backgroundColor: isSelected ? '#9333EA' : isDarkMode ? '#3D3350' : '#E5E7EB',
      }}
    >
      <Text
        className="text-sm font-medium"
        style={{
          color: isSelected ? '#FFFFFF' : isDarkMode ? '#D1D5DB' : '#374151',
        }}
      >
        {label}
      </Text>
      {typeof count === 'number' && count > 0 && (
        <View
          className="ml-1.5 px-1.5 py-0.5 rounded-full"
          style={{
            backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : '#9CA3AF',
          }}
        >
          <Text className="text-xs font-medium text-white">{count}</Text>
        </View>
      )}
    </Pressable>
  );
});

const TournamentCard = memo(function TournamentCard({
  posting,
  onApprove,
  onReject,
  onViewDetail,
  isProcessing,
}: TournamentCardProps) {
  const approvalStatus = posting.tournamentConfig?.approvalStatus ?? STATUS.TOURNAMENT.PENDING;
  const isPending = approvalStatus === STATUS.TOURNAMENT.PENDING;
  const isResubmitted = !!posting.tournamentConfig?.resubmittedAt;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return new Intl.DateTimeFormat('ko-KR', {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    }).format(date);
  };

  // 날짜 범위 표시 (메모이제이션)
  const dateRange = useMemo(() => {
    const dates = posting.dateSpecificRequirements?.map((d) => d.date as string) ?? [];
    if (dates.length === 0) return '-';
    if (dates.length === 1) return formatDate(dates[0]);

    const sortedDates = [...dates].sort();
    return `${formatDate(sortedDates[0])} ~ ${formatDate(
      sortedDates[sortedDates.length - 1]
    )} (${dates.length}일)`;
  }, [posting.dateSpecificRequirements]);

  return (
    <View className="bg-white dark:bg-surface rounded-xl mb-3 overflow-hidden border border-gray-100 dark:border-surface-overlay">
      {/* 헤더 */}
      <Pressable
        onPress={onViewDetail}
        className="p-4 active:opacity-80"
        accessibilityRole="button"
        accessibilityLabel={`${posting.title} 상세 보기`}
      >
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1 flex-row items-center flex-wrap">
            <Badge variant="secondary" size="sm" className="mr-2">
              대회
            </Badge>
            <TournamentStatusBadge
              status={approvalStatus}
              rejectionReason={posting.tournamentConfig?.rejectionReason}
              size="sm"
              className="mr-2"
            />
            {isResubmitted && (
              <Badge variant="warning" size="sm" className="mr-2">
                재제출
              </Badge>
            )}
          </View>
        </View>

        <Text
          className="text-base font-semibold text-gray-900 dark:text-white mb-2"
          numberOfLines={2}
        >
          {posting.title}
        </Text>

        <View className="flex-row items-center mb-1">
          <Ionicons name="location-outline" size={14} color="#9CA3AF" />
          <Text className="text-sm text-gray-500 dark:text-gray-400 ml-1">
            {posting.location.name}
          </Text>
        </View>

        <View className="flex-row items-center mb-1">
          <Ionicons name="calendar-outline" size={14} color="#9CA3AF" />
          <Text className="text-sm text-gray-500 dark:text-gray-400 ml-1">{dateRange}</Text>
        </View>

        <View className="flex-row items-center">
          <Ionicons name="person-outline" size={14} color="#9CA3AF" />
          <Text className="text-sm text-gray-500 dark:text-gray-400 ml-1">
            {posting.ownerName ?? '구인자'}
          </Text>
        </View>
      </Pressable>

      {/* 액션 버튼 (pending 상태에서만 표시) */}
      {isPending && (
        <View className="flex-row border-t border-gray-100 dark:border-surface-overlay">
          <Pressable
            onPress={onReject}
            disabled={isProcessing}
            className="flex-1 py-3 flex-row items-center justify-center border-r border-gray-100 dark:border-surface-overlay active:bg-gray-50 dark:active:bg-gray-700"
            accessibilityRole="button"
            accessibilityLabel="거부"
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                <Text className="text-red-500 font-medium ml-1">거부</Text>
              </>
            )}
          </Pressable>
          <Pressable
            onPress={onApprove}
            disabled={isProcessing}
            className="flex-1 py-3 flex-row items-center justify-center active:bg-gray-50 dark:active:bg-gray-700"
            accessibilityRole="button"
            accessibilityLabel="승인"
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#22C55E" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#22C55E" />
                <Text className="text-green-500 font-medium ml-1">승인</Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
});

// ============================================================================
// Constants
// ============================================================================

const STATUS_TABS: { status: TabStatus; label: string }[] = [
  { status: 'pending', label: '승인 대기' },
  { status: 'approved', label: '승인됨' },
  { status: 'rejected', label: '거부됨' },
];

// ============================================================================
// Main Component
// ============================================================================

export default function AdminTournamentsPage() {
  const { isDarkMode } = useThemeStore();
  const [selectedStatus, setSelectedStatus] = useState<TabStatus>('pending');
  const [modalState, setModalState] = useState<{
    visible: boolean;
    mode: 'approve' | 'reject';
    posting: JobPosting | null;
  }>({
    visible: false,
    mode: 'approve',
    posting: null,
  });

  const { approve, reject, isProcessing } = useTournamentApproval();

  const {
    data: postings,
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useTournamentsByStatus(selectedStatus);

  // 탭별 개수 조회 (pending만 실시간, 나머지는 필요 시 조회)
  const { data: pendingPostings } = useTournamentsByStatus('pending');
  const pendingCount = pendingPostings?.length ?? 0;

  const handleStatusChange = useCallback((status: TabStatus) => {
    setSelectedStatus(status);
  }, []);

  const handleViewDetail = useCallback((postingId: string) => {
    router.push(`/(app)/jobs/${postingId}`);
  }, []);

  const handleApprovePress = useCallback((posting: JobPosting) => {
    setModalState({ visible: true, mode: 'approve', posting });
  }, []);

  const handleRejectPress = useCallback((posting: JobPosting) => {
    setModalState({ visible: true, mode: 'reject', posting });
  }, []);

  const handleModalConfirm = useCallback(
    async (reason?: string) => {
      if (!modalState.posting) return;

      try {
        if (modalState.mode === 'approve') {
          await approve.mutateAsync({ postingId: modalState.posting.id });
        } else {
          if (!reason) return;
          await reject.mutateAsync({ postingId: modalState.posting.id, reason });
        }
        setModalState({ visible: false, mode: 'approve', posting: null });
      } catch {
        // 에러는 훅에서 처리
      }
    },
    [modalState, approve, reject]
  );

  const handleModalCancel = useCallback(() => {
    setModalState({ visible: false, mode: 'approve', posting: null });
  }, []);

  // 로딩 상태
  if (isLoading && !postings) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-surface-dark items-center justify-center">
        <ActivityIndicator size="large" color="#A855F7" />
        <Text className="mt-4 text-gray-500 dark:text-gray-400">
          대회공고 목록을 불러오는 중...
        </Text>
      </View>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-surface-dark">
        <EmptyState
          title="오류 발생"
          description="대회공고 목록을 불러오는 데 실패했습니다."
          icon="❌"
          actionLabel="다시 시도"
          onAction={() => refetch()}
        />
      </View>
    );
  }

  const displayPostings = postings ?? [];

  return (
    <View className="flex-1 bg-gray-50 dark:bg-surface-dark">
      {/* 헤더 */}
      <View className="px-4 py-3 bg-white dark:bg-surface border-b border-gray-200 dark:border-surface-overlay">
        <Text className="text-xl font-bold text-gray-900 dark:text-white mb-1">
          대회공고 승인 관리
        </Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          대회공고 승인 요청을 검토하고 처리합니다
        </Text>
      </View>

      {/* 상태 탭 */}
      <View className="px-4 py-3 bg-white dark:bg-surface border-b border-gray-200 dark:border-surface-overlay">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {STATUS_TABS.map((tab) => (
            <StatusTab
              key={tab.status}
              status={tab.status}
              label={tab.label}
              count={tab.status === 'pending' ? pendingCount : undefined}
              isSelected={selectedStatus === tab.status}
              onPress={() => handleStatusChange(tab.status)}
              isDarkMode={isDarkMode}
            />
          ))}
        </ScrollView>
      </View>

      {/* 결과 개수 */}
      <View className="px-4 py-2">
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          {displayPostings.length}개의 대회공고
        </Text>
      </View>

      {/* 목록 */}
      <ScrollView
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor="#A855F7"
          />
        }
      >
        {displayPostings.length === 0 ? (
          <EmptyState
            title={
              selectedStatus === STATUS.TOURNAMENT.PENDING
                ? '승인 대기 공고 없음'
                : selectedStatus === STATUS.TOURNAMENT.APPROVED
                  ? '승인된 공고 없음'
                  : '거부된 공고 없음'
            }
            description={
              selectedStatus === STATUS.TOURNAMENT.PENDING
                ? '현재 승인 대기 중인 대회공고가 없습니다'
                : selectedStatus === STATUS.TOURNAMENT.APPROVED
                  ? '아직 승인된 대회공고가 없습니다'
                  : '거부된 대회공고가 없습니다'
            }
            icon={selectedStatus === STATUS.TOURNAMENT.PENDING ? '📋' : selectedStatus === STATUS.TOURNAMENT.APPROVED ? '✅' : '❌'}
          />
        ) : (
          displayPostings.map((posting) => (
            <TournamentCard
              key={posting.id}
              posting={posting}
              onApprove={() => handleApprovePress(posting)}
              onReject={() => handleRejectPress(posting)}
              onViewDetail={() => handleViewDetail(posting.id)}
              isProcessing={isProcessing}
            />
          ))
        )}
        <View className="h-8" />
      </ScrollView>

      {/* 승인/거부 모달 */}
      <ApprovalModal
        visible={modalState.visible}
        mode={modalState.mode}
        postingTitle={modalState.posting?.title ?? ''}
        onConfirm={handleModalConfirm}
        onCancel={handleModalCancel}
        isProcessing={approve.isPending || reject.isPending}
      />
    </View>
  );
}
