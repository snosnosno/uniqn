/**
 * UNIQN Mobile - 내 공고 목록 (구인자용)
 *
 * @description 구인자가 자신의 공고 목록을 확인하고 관리하는 페이지
 * @version 1.0.0
 */

import { useState, useCallback, useMemo, memo } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMyJobPostings } from '@/hooks/useJobManagement';
import { PostingTypeBadge } from '@/components/jobs/PostingTypeBadge';
import { TournamentStatusBadge } from '@/components/jobs/TournamentStatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { groupRequirementsToDateRanges, formatDateRangeWithCount } from '@/utils/date';
import { STATUS } from '@/constants';
import type { JobPosting, PostingType, TournamentApprovalStatus } from '@/types';
import type { DateSpecificRequirement } from '@/types/jobPosting/dateRequirement';
import { useThemeStore } from '@/stores/themeStore';

// ============================================================================
// Types
// ============================================================================

type FilterStatus = 'all' | 'active' | 'closed' | 'tournament';

interface FilterTabProps {
  status: FilterStatus;
  label: string;
  count?: number;
  isSelected: boolean;
  onPress: () => void;
  isDarkMode: boolean;
}

interface PostingCardProps {
  posting: JobPosting;
  onPress: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const FILTER_TABS: { status: FilterStatus; label: string }[] = [
  { status: 'all', label: '전체' },
  { status: 'active', label: '진행중' },
  { status: 'closed', label: '마감' },
  { status: 'tournament', label: '대회' },
];

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'default' | 'error' }> = {
  active: { label: '진행중', variant: 'success' },
  closed: { label: '마감', variant: 'default' },
  cancelled: { label: '취소', variant: 'error' },
};

// ============================================================================
// Sub Components
// ============================================================================

const FilterTab = memo(function FilterTab({
  label,
  count,
  isSelected,
  onPress,
  isDarkMode,
}: FilterTabProps) {
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

const PostingCard = memo(function PostingCard({ posting, onPress }: PostingCardProps) {
  const statusConfig = STATUS_CONFIG[posting.status] || STATUS_CONFIG.active;
  const isTournament = posting.postingType === 'tournament';
  const tournamentStatus = posting.tournamentConfig?.approvalStatus;

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

  // 날짜 범위 표시 (대회 공고: 그룹화)
  const getDateRange = useMemo(() => {
    const requirements = posting.dateSpecificRequirements;
    if (!requirements || requirements.length === 0) {
      return posting.workDate ? formatDate(posting.workDate) : '-';
    }

    // 대회 공고: 연속 날짜 그룹화
    if (isTournament) {
      const groups = groupRequirementsToDateRanges(requirements as DateSpecificRequirement[]);
      if (groups.length === 1) {
        return formatDateRangeWithCount(groups[0].startDate, groups[0].endDate);
      }
      // 여러 그룹이면 전체 기간 표시
      const allDates = requirements.map((d) => d.date as string).sort();
      return `${formatDate(allDates[0])} ~ ${formatDate(
        allDates[allDates.length - 1]
      )} (${groups.length}개 일정, ${requirements.length}일)`;
    }

    // 일반/긴급 공고: 단일 날짜 표시
    return formatDate(requirements[0].date as string);
  }, [posting.dateSpecificRequirements, posting.workDate, isTournament]);

  return (
    <Pressable
      onPress={onPress}
      className="bg-white dark:bg-surface rounded-xl mb-3 p-4 border border-gray-100 dark:border-surface-overlay active:opacity-80"
      accessibilityRole="button"
      accessibilityLabel={`${posting.title} 상세 보기`}
    >
      {/* 상단: 배지들 */}
      <View className="flex-row items-center flex-wrap mb-2">
        {posting.postingType && posting.postingType !== 'regular' && (
          <PostingTypeBadge type={posting.postingType as PostingType} size="sm" className="mr-2" />
        )}
        {isTournament && tournamentStatus && (
          <TournamentStatusBadge
            status={tournamentStatus as TournamentApprovalStatus}
            rejectionReason={posting.tournamentConfig?.rejectionReason}
            size="sm"
            className="mr-2"
          />
        )}
        <Badge variant={statusConfig.variant} size="sm">
          {statusConfig.label}
        </Badge>
      </View>

      {/* 제목 */}
      <Text
        className="text-base font-semibold text-gray-900 dark:text-white mb-2"
        numberOfLines={2}
      >
        {posting.title}
      </Text>

      {/* 장소 */}
      <View className="flex-row items-center mb-1">
        <Ionicons name="location-outline" size={14} color="#9CA3AF" />
        <Text className="text-sm text-gray-500 dark:text-gray-400 ml-1">
          {posting.location?.name || '-'}
        </Text>
      </View>

      {/* 일정 */}
      <View className="flex-row items-center mb-1">
        <Ionicons name="calendar-outline" size={14} color="#9CA3AF" />
        <Text className="text-sm text-gray-500 dark:text-gray-400 ml-1">{getDateRange}</Text>
      </View>

      {/* 모집 현황 */}
      <View className="flex-row items-center">
        <Ionicons name="people-outline" size={14} color="#9CA3AF" />
        <Text className="text-sm text-gray-500 dark:text-gray-400 ml-1">
          {posting.filledPositions ?? 0}/{posting.totalPositions ?? 0}명 충원
        </Text>
      </View>

      {/* 지원자 수 */}
      {(posting.applicationCount ?? 0) > 0 && (
        <View className="mt-2 pt-2 border-t border-gray-100 dark:border-surface-overlay">
          <Text className="text-xs text-primary-600 dark:text-primary-400">
            지원자 {posting.applicationCount}명
          </Text>
        </View>
      )}
    </Pressable>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export default function MyPostingsPage() {
  const { isDarkMode } = useThemeStore();
  const [selectedFilter, setSelectedFilter] = useState<FilterStatus>('all');
  const { data: postings, isLoading, isRefetching, refetch, error } = useMyJobPostings();

  const handleFilterChange = useCallback((filter: FilterStatus) => {
    setSelectedFilter(filter);
  }, []);

  const handlePostingPress = useCallback((postingId: string) => {
    router.push(`/(employer)/my-postings/${postingId}`);
  }, []);

  const handleCreatePress = useCallback(() => {
    router.push('/(employer)/my-postings/create');
  }, []);

  // 필터링된 공고 목록
  const filteredPostings = useMemo(() => {
    if (!postings) return [];

    switch (selectedFilter) {
      case 'active':
        return postings.filter((p) => p.status === STATUS.JOB_POSTING.ACTIVE);
      case 'closed':
        return postings.filter(
          (p) => p.status === STATUS.JOB_POSTING.CLOSED || p.status === STATUS.JOB_POSTING.CANCELLED
        );
      case 'tournament':
        return postings.filter((p) => p.postingType === 'tournament');
      default:
        return postings;
    }
  }, [postings, selectedFilter]);

  // 필터별 개수
  const filterCounts = useMemo(() => {
    if (!postings) return { all: 0, active: 0, closed: 0, tournament: 0 };

    return {
      all: postings.length,
      active: postings.filter((p) => p.status === STATUS.JOB_POSTING.ACTIVE).length,
      closed: postings.filter(
        (p) => p.status === STATUS.JOB_POSTING.CLOSED || p.status === STATUS.JOB_POSTING.CANCELLED
      ).length,
      tournament: postings.filter((p) => p.postingType === 'tournament').length,
    };
  }, [postings]);

  // 로딩 상태
  if (isLoading && !postings) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-surface-dark items-center justify-center">
        <ActivityIndicator size="large" color="#A855F7" />
        <Text className="mt-4 text-gray-500 dark:text-gray-400">공고 목록을 불러오는 중...</Text>
      </View>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-surface-dark">
        <EmptyState
          title="오류 발생"
          description="공고 목록을 불러오는 데 실패했습니다."
          icon="❌"
          actionLabel="다시 시도"
          onAction={() => refetch()}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 dark:bg-surface-dark">
      {/* 헤더 */}
      <View className="px-4 py-3 bg-white dark:bg-surface border-b border-gray-200 dark:border-surface-overlay">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-xl font-bold text-gray-900 dark:text-white">내 공고 관리</Text>
          <Pressable
            onPress={handleCreatePress}
            className="bg-primary-600 dark:bg-primary-500 px-4 py-2 rounded-lg flex-row items-center"
            accessibilityRole="button"
            accessibilityLabel="새 공고 작성"
          >
            <Ionicons name="add" size={18} color="white" />
            <Text className="text-white font-medium ml-1">새 공고</Text>
          </Pressable>
        </View>
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          총 {postings?.length ?? 0}개의 공고
        </Text>
      </View>

      {/* 필터 탭 */}
      <View className="px-4 py-3 bg-white dark:bg-surface border-b border-gray-200 dark:border-surface-overlay">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FILTER_TABS.map((tab) => (
            <FilterTab
              key={tab.status}
              status={tab.status}
              label={tab.label}
              count={filterCounts[tab.status]}
              isSelected={selectedFilter === tab.status}
              onPress={() => handleFilterChange(tab.status)}
              isDarkMode={isDarkMode}
            />
          ))}
        </ScrollView>
      </View>

      {/* 결과 개수 */}
      <View className="px-4 py-2">
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          {filteredPostings.length}개의 공고
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
        {filteredPostings.length === 0 ? (
          <EmptyState
            title={
              selectedFilter === 'all'
                ? '등록된 공고가 없습니다'
                : selectedFilter === 'active'
                  ? '진행중인 공고가 없습니다'
                  : selectedFilter === 'closed'
                    ? '마감된 공고가 없습니다'
                    : '대회 공고가 없습니다'
            }
            description={
              selectedFilter === 'all'
                ? '새 공고를 작성해보세요'
                : '다른 탭에서 공고를 확인해보세요'
            }
            icon={selectedFilter === 'all' ? '📝' : '📋'}
            actionLabel={selectedFilter === 'all' ? '새 공고 작성' : undefined}
            onAction={selectedFilter === 'all' ? handleCreatePress : undefined}
          />
        ) : (
          filteredPostings.map((posting) => (
            <PostingCard
              key={posting.id}
              posting={posting}
              onPress={() => handlePostingPress(posting.id)}
            />
          ))
        )}
        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
