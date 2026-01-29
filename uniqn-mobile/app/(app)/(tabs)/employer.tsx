/**
 * UNIQN Mobile - 내 공고 탭 화면
 * 구인자: 공고 목록 표시 / 일반 사용자: 안내 화면
 */

import React, { useState, useCallback, useMemo, memo } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Timestamp } from '@/lib/firebase';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useMyJobPostings, useCloseJobPosting, useReopenJobPosting } from '@/hooks/useJobManagement';
import { Card, Badge, Button, Loading, EmptyState, ErrorState, ConfirmModal } from '@/components';
import { PostingTypeBadge } from '@/components/jobs/PostingTypeBadge';
import { TournamentStatusBadge } from '@/components/jobs/TournamentStatusBadge';
import { FixedScheduleDisplay } from '@/components/jobs/FixedScheduleDisplay';
import { EventQRModal } from '@/components/employer/EventQRModal';
import { TabHeader } from '@/components/headers';
import {
  PlusIcon,
  UsersIcon,
  BriefcaseIcon,
  QrCodeIcon,
} from '@/components/icons';
import {
  groupRequirementsToDateRanges,
  formatDateRangeWithCount,
} from '@/utils/dateRangeUtils';
import type { DateSpecificRequirement } from '@/types/jobPosting/dateRequirement';
import type { JobPosting, PostingType, Allowances, TournamentApprovalStatus } from '@/types';

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
  onClose: (postingId: string) => void;
  onReopen: (postingId: string) => void;
  onShowQR: (posting: JobPosting) => void;
  isClosing: boolean;
  isReopening: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

const formatDate = (dateStr: string): string => {
  if (!dateStr) { return '-'; }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) { return dateStr; }
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${month}/${day}(${dayOfWeek})`;
};

const getRoleLabel = (role: string, customRole?: string): string => {
  if (role === 'other' && customRole) {
    return customRole;
  }
  const labels: Record<string, string> = {
    dealer: '딜러',
    manager: '매니저',
    chiprunner: '칩러너',
    admin: '관리자',
    floor: '플로어',
    serving: '서빙',
    staff: '직원',
    other: '기타',
  };
  return labels[role] || role;
};

/** "제공" 상태를 나타내는 특별 값 */
const PROVIDED_FLAG = -1;

const formatSalary = (type: string, amount: number): string => {
  if (type === 'other') return '협의';
  const formattedAmount = amount.toLocaleString('ko-KR');
  switch (type) {
    case 'hourly':
      return `시급 ${formattedAmount}원`;
    case 'daily':
      return `일급 ${formattedAmount}원`;
    case 'monthly':
      return `월급 ${formattedAmount}원`;
    default:
      return `${formattedAmount}원`;
  }
};

const getAllowanceItems = (allowances?: Allowances): string[] => {
  if (!allowances) return [];
  const items: string[] = [];

  // 보장시간
  if (allowances.guaranteedHours && allowances.guaranteedHours > 0) {
    items.push(`⏰ 보장 ${allowances.guaranteedHours}시간`);
  }

  // 식비
  if (allowances.meal === PROVIDED_FLAG) {
    items.push('🍱 식사제공');
  } else if (allowances.meal && allowances.meal > 0) {
    items.push(`🍱 식비 ${allowances.meal.toLocaleString()}원`);
  }

  // 교통비
  if (allowances.transportation === PROVIDED_FLAG) {
    items.push('🚗 교통비제공');
  } else if (allowances.transportation && allowances.transportation > 0) {
    items.push(`🚗 교통비 ${allowances.transportation.toLocaleString()}원`);
  }

  // 숙박비
  if (allowances.accommodation === PROVIDED_FLAG) {
    items.push('🏨 숙박제공');
  } else if (allowances.accommodation && allowances.accommodation > 0) {
    items.push(`🏨 숙박비 ${allowances.accommodation.toLocaleString()}원`);
  }

  return items;
};

const getDateString = (dateInput: string | Timestamp | { seconds: number }): string => {
  if (typeof dateInput === 'string') { return dateInput; }
  if (dateInput instanceof Timestamp) {
    return dateInput.toDate().toISOString().split('T')[0] ?? '';
  }
  if (dateInput && 'seconds' in dateInput) {
    return new Date(dateInput.seconds * 1000).toISOString().split('T')[0] ?? '';
  }
  return '';
};

/**
 * 시작/종료 날짜 사이의 모든 날짜 반환
 */
const getDatesBetween = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return [startDate];
  }

  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]!);
    current.setDate(current.getDate() + 1);
  }

  return dates;
};

// ============================================================================
// Sub-component: RoleLine
// ============================================================================

interface RoleData {
  role?: string;
  name?: string;
  customRole?: string;
  headcount?: number;
  count?: number;
  filled?: number;
}

const RoleLine = memo(function RoleLine({
  role,
  showTime,
  time,
}: {
  role: RoleData;
  showTime: boolean;
  time: string;
}) {
  const roleName = role.role || role.name || '';
  const count = role.headcount || role.count || 0;
  const filled = role.filled ?? 0;

  return (
    <Text className="text-sm text-gray-900 dark:text-gray-100">
      {showTime ? `${time} ` : '       '}
      {getRoleLabel(roleName, role.customRole)} {count}명 ({filled}/{count})
    </Text>
  );
});

// ============================================================================
// JobPostingCard Component
// ============================================================================

const JobPostingCard = memo(function JobPostingCard({
  posting,
  onPress,
  onClose,
  onReopen,
  onShowQR,
  isClosing,
  isReopening,
}: JobPostingCardProps) {
  const statusConfig = {
    active: { label: '모집중', variant: 'success' as const },
    closed: { label: '마감', variant: 'default' as const },
    cancelled: { label: '취소됨', variant: 'error' as const },
  };

  const status = statusConfig[posting.status] || statusConfig.active;
  const allowanceItems = getAllowanceItems(posting.allowances);

  // dateSpecificRequirements를 그룹화된 형태로 변환
  const groupedDateRequirements = useMemo(() => {
    const reqs = posting.dateSpecificRequirements ?? [];
    if (reqs.length === 0) return [];

    // DateSpecificRequirement 형태로 변환
    const converted: DateSpecificRequirement[] = reqs.map((req) => ({
      date: getDateString(req.date),
      isGrouped: req.isGrouped,
      timeSlots: (req.timeSlots ?? []).map((ts) => ({
        startTime: (ts as { startTime?: string; time?: string }).startTime ||
                   (ts as { startTime?: string; time?: string }).time || '',
        isTimeToBeAnnounced: (ts as { isTimeToBeAnnounced?: boolean }).isTimeToBeAnnounced ?? false,
        roles: ts.roles ?? [],
      })),
    }));

    // 그룹화
    const groups = groupRequirementsToDateRanges(converted);

    // 각 그룹에 추가 정보 계산
    return groups.map((group) => {
      const firstTimeSlot = group.timeSlots[0];
      const displayTime = firstTimeSlot?.isTimeToBeAnnounced
        ? '미정'
        : firstTimeSlot?.startTime || '-';

      // 날짜 수 계산
      const groupDates = getDatesBetween(group.startDate, group.endDate);

      return {
        ...group,
        displayTime,
        dayCount: groupDates.length,
      };
    });
  }, [posting.dateSpecificRequirements]);

  return (
    <Card variant="elevated" padding="md" onPress={() => onPress(posting)} className="mx-4 mb-3">
      {/* 상단: 공고타입 + 긴급 + 제목 + 상태 */}
      <View className="mb-2 flex-row items-start justify-between">
        <View className="flex-1 flex-row items-center flex-wrap">
          {posting.postingType && posting.postingType !== 'regular' && (
            <PostingTypeBadge
              type={posting.postingType as PostingType}
              size="sm"
              className="mr-2"
            />
          )}
          {posting.isUrgent && (
            <Badge variant="error" size="sm" className="mr-2">
              긴급
            </Badge>
          )}
          <Text
            className="text-base font-semibold text-gray-900 dark:text-white flex-1"
            numberOfLines={1}
          >
            {posting.title}
          </Text>
        </View>
        {/* QR 버튼 */}
        <Pressable
          onPress={() => onShowQR(posting)}
          className="p-1.5 ml-2 active:opacity-70"
          accessibilityLabel="현장 QR 표시"
          onStartShouldSetResponder={() => true}
        >
          <QrCodeIcon size={18} color="#2563EB" />
        </Pressable>
      </View>

      {/* 장소 */}
      <Text className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        📍 {posting.location.name}
      </Text>

      {/* 일정 + 급여/수당 그리드 */}
      <View className="flex-row">
        {/* 왼쪽: 일정 */}
        <View className="flex-1 pr-3">
          {posting.postingType === 'fixed' ? (
            // 고정공고: FixedScheduleDisplay 사용
            <FixedScheduleDisplay
              daysPerWeek={posting.daysPerWeek}
              startTime={posting.timeSlot?.split(/[-~]/)[0]?.trim()}
              compact={true}
            />
          ) : groupedDateRequirements.length > 0 ? (
            groupedDateRequirements.map((group, groupIdx) => {
              const isSingleDay = group.dayCount === 1;
              const dateDisplay = isSingleDay
                ? formatDate(group.startDate)
                : formatDateRangeWithCount(group.startDate, group.endDate);

              return (
                <View key={group.id || groupIdx} className="mb-2">
                  {/* 날짜 범위 */}
                  <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    📅 {dateDisplay}
                  </Text>

                  {/* 시간 + 역할 (첫 번째 timeSlot 기준) */}
                  <View className="ml-5 mt-1">
                    {group.timeSlots[0]?.roles.map((role: RoleData, roleIdx: number) => (
                      <RoleLine
                        key={roleIdx}
                        role={role}
                        showTime={roleIdx === 0}
                        time={group.displayTime}
                      />
                    ))}
                  </View>
                </View>
              );
            })
          ) : (
            // 레거시 폴백
            <View className="mb-2">
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                📅 {formatDate(posting.workDate)}
              </Text>
              <Text className="text-sm text-gray-900 dark:text-gray-100 ml-5 mt-1">
                🕐 {posting.timeSlot || '-'}
              </Text>
            </View>
          )}
        </View>

        {/* 오른쪽: 급여 + 수당 */}
        <View className="flex-1 pl-3 border-l border-gray-100 dark:border-gray-700">
          {/* 급여 - v2.0: roles[].salary 구조 */}
          {!posting.useSameSalary &&
          posting.roles?.some((r) => r.salary) ? (
            // 역할별 급여 표시
            posting.roles
              .filter((r) => r.salary)
              .map((r, idx) => (
                <Text
                  key={idx}
                  className="text-sm text-gray-900 dark:text-white"
                >
                  💰 {getRoleLabel(r.role, (r as { customRole?: string }).customRole)}: {r.salary?.type === 'other' ? '협의' : formatSalary(r.salary?.type || 'hourly', r.salary?.amount || 0)}
                </Text>
              ))
          ) : (
            // 단일 급여 표시 (useSameSalary 또는 defaultSalary)
            <Text className="text-sm font-medium text-gray-900 dark:text-white">
              💰 {formatSalary(
                posting.defaultSalary?.type || posting.roles?.[0]?.salary?.type || 'hourly',
                posting.defaultSalary?.amount || posting.roles?.[0]?.salary?.amount || 0
              )}
            </Text>
          )}

          {/* 수당 */}
          {allowanceItems.length > 0 && (
            <View className="mt-1">
              {allowanceItems.map((item, idx) => (
                <Text key={idx} className="text-sm text-gray-500 dark:text-gray-400">
                  {item}
                </Text>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* 하단: 지원자 수 + 상태뱃지 + 마감/재오픈 버튼 */}
      <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
        <View className="flex-row items-center">
          <UsersIcon size={14} color="#2563EB" />
          <Text className="ml-1 text-xs text-gray-600 dark:text-gray-400">
            지원 {posting.applicationCount || 0}
          </Text>
        </View>

        {/* 상태 뱃지 + 마감/재오픈 버튼 */}
        <View onStartShouldSetResponder={() => true} className="flex-row items-center gap-2">
          {posting.postingType === 'tournament' && posting.tournamentConfig?.approvalStatus && (
            <TournamentStatusBadge
              status={posting.tournamentConfig.approvalStatus as TournamentApprovalStatus}
              rejectionReason={posting.tournamentConfig.rejectionReason}
              postingId={posting.id}
              size="sm"
            />
          )}
          <Badge variant={status.variant} size="sm">
            {status.label}
          </Badge>
          {posting.status === 'active' && (
            <Pressable
              onPress={() => onClose(posting.id)}
              disabled={isClosing}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-md active:opacity-70"
            >
              <Text className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {isClosing ? '처리중...' : '마감하기'}
              </Text>
            </Pressable>
          )}
          {posting.status === 'closed' && (
            <Pressable
              onPress={() => onReopen(posting.id)}
              disabled={isReopening}
              className="px-3 py-1.5 bg-primary-50 dark:bg-primary-900/30 rounded-md active:opacity-70"
            >
              <Text className="text-xs font-medium text-primary-600 dark:text-primary-400">
                {isReopening ? '처리중...' : '재오픈'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Card>
  );
});

// ============================================================================
// Non-Employer View
// ============================================================================

function NonEmployerView() {
  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['top']}>
      <TabHeader title="내 공고" />
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

    // 공고별 가장 빠른 미래 날짜+시간 계산
    const getEarliestDateTime = (posting: JobPosting): string => {
      const reqs = posting.dateSpecificRequirements ?? [];
      if (reqs.length > 0) {
        const futureDateTimes: string[] = [];
        const pastDateTimes: string[] = [];

        for (const req of reqs) {
          const dateStr = getDateString(req.date);
          const times = (req.timeSlots ?? [])
            .filter((ts) => !(ts as { isTimeToBeAnnounced?: boolean }).isTimeToBeAnnounced)
            .map((ts) => (ts as { startTime?: string; time?: string }).startTime ||
                         (ts as { startTime?: string; time?: string }).time || '99:99')
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
    };

    // 필터링
    const filtered = filter === 'all'
      ? postings
      : postings.filter((p: JobPosting) => p.status === filter);

    // 정렬: 오늘 이후 날짜 먼저 (가까운 순), 그 다음 과거 날짜 (최근 순)
    return [...filtered].sort((a, b) => {
      const dateTimeA = getEarliestDateTime(a);
      const dateTimeB = getEarliestDateTime(b);

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
    [handlePostingPress, handleClosePosting, handleReopenPosting, handleShowQR, closeMutation.isPending, reopenMutation.isPending]
  );

  const keyExtractor = useCallback((item: JobPosting) => item.id, []);

  // 로딩 상태
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['top']}>
        <TabHeader title="내 공고" />
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
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['top']}>
      <TabHeader title="내 공고" />

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
  const { profile } = useAuth();
  const hasEmployerRole = profile?.role === 'employer' || profile?.role === 'admin';

  if (!hasEmployerRole) {
    return <NonEmployerView />;
  }

  return <EmployerView />;
}
