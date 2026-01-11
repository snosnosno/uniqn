/**
 * UNIQN Mobile - 내 공고 탭 화면
 * 구인자: 공고 목록 표시 / 일반 사용자: 안내 화면
 */

import React, { useState, useCallback, useMemo, memo } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Timestamp } from 'firebase/firestore';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useMyJobPostings } from '@/hooks/useJobManagement';
import { useUnreadCountRealtime } from '@/hooks/useNotifications';
import { Card, Badge, Button, Loading, EmptyState, ErrorState } from '@/components';
import { PostingTypeBadge } from '@/components/jobs/PostingTypeBadge';
import {
  PlusIcon,
  UsersIcon,
  BriefcaseIcon,
  QrCodeIcon,
  BellIcon,
} from '@/components/icons';
import type { JobPosting, PostingType, Allowances } from '@/types';

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

const getRoleLabel = (role: string): string => {
  const labels: Record<string, string> = {
    dealer: '딜러',
    manager: '매니저',
    chiprunner: '칩러너',
    admin: '관리자',
    floor: '플로어',
    serving: '서빙',
    staff: '직원',
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

// ============================================================================
// Sub-component: RoleLine
// ============================================================================

interface RoleData {
  role?: string;
  name?: string;
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
      {getRoleLabel(roleName)} {count}명 ({filled}/{count})
    </Text>
  );
});

// ============================================================================
// JobPostingCard Component
// ============================================================================

const JobPostingCard = memo(function JobPostingCard({ posting, onPress }: JobPostingCardProps) {
  const statusConfig = {
    active: { label: '모집중', variant: 'success' as const },
    closed: { label: '마감', variant: 'default' as const },
    draft: { label: '임시저장', variant: 'warning' as const },
    cancelled: { label: '취소됨', variant: 'error' as const },
  };

  const status = statusConfig[posting.status] || statusConfig.active;
  const allowanceItems = getAllowanceItems(posting.allowances);

  // dateSpecificRequirements를 정렬된 형태로 변환 (오늘 기준)
  const dateRequirements = useMemo(() => {
    const reqs = posting.dateSpecificRequirements ?? [];
    const today = new Date().toISOString().split('T')[0] ?? '';

    return reqs
      .map((req) => ({
        date: getDateString(req.date),
        timeSlots: (req.timeSlots ?? [])
          .map((ts) => ({
            startTime: (ts as { startTime?: string; time?: string }).startTime ||
                       (ts as { startTime?: string; time?: string }).time || '',
            isTimeToBeAnnounced: (ts as { isTimeToBeAnnounced?: boolean }).isTimeToBeAnnounced ?? false,
            roles: ts.roles ?? [],
          }))
          // 시간대 정렬: 시간 미정 → 맨 뒤, 그 외 시간 순
          .sort((a, b) => {
            if (a.isTimeToBeAnnounced && !b.isTimeToBeAnnounced) return 1;
            if (!a.isTimeToBeAnnounced && b.isTimeToBeAnnounced) return -1;
            return a.startTime.localeCompare(b.startTime);
          }),
      }))
      // 날짜 정렬: 오늘 이후 먼저 (가까운 순), 과거는 뒤로 (최근 순)
      .sort((a, b) => {
        const aIsFuture = a.date >= today;
        const bIsFuture = b.date >= today;

        if (aIsFuture && !bIsFuture) return -1;
        if (!aIsFuture && bIsFuture) return 1;

        if (aIsFuture && bIsFuture) {
          return a.date.localeCompare(b.date);
        }
        return b.date.localeCompare(a.date);
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
        <Badge variant={status.variant} size="sm" className="ml-2">
          {status.label}
        </Badge>
      </View>

      {/* 장소 */}
      <Text className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        📍 {posting.location.name}
      </Text>

      {/* 일정 + 급여/수당 그리드 */}
      <View className="flex-row">
        {/* 왼쪽: 일정 */}
        <View className="flex-1 pr-3">
          {dateRequirements.length > 0 ? (
            dateRequirements.map((dateReq, dateIdx) => (
              <View key={dateIdx} className="mb-2">
                {/* 날짜 */}
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  📅 {formatDate(dateReq.date)}
                </Text>

                {/* 시간대별 */}
                {dateReq.timeSlots.map((slot, slotIdx) => {
                  // 시간 미정 여부 확인
                  const displayTime = slot.isTimeToBeAnnounced
                    ? '시간 미정'
                    : slot.startTime || '-';

                  return (
                    <View key={slotIdx} className="ml-5 mt-1">
                      {slot.roles.map((role, roleIdx) => (
                        <RoleLine
                          key={roleIdx}
                          role={role}
                          showTime={roleIdx === 0}
                          time={displayTime}
                        />
                      ))}
                    </View>
                  );
                })}
              </View>
            ))
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
        <View className="w-32 pl-3 border-l border-gray-100 dark:border-gray-700">
          {/* 급여 */}
          {posting.roleSalaries &&
          Object.keys(posting.roleSalaries).length > 0 &&
          !posting.useSameSalary ? (
            // 역할별 급여 표시
            Object.entries(posting.roleSalaries).map(([role, salary], idx) => (
              <Text
                key={idx}
                className="text-sm text-gray-900 dark:text-white"
                numberOfLines={1}
              >
                💰 {role}: {salary.type === 'other' ? '협의' : formatSalary(salary.type, salary.amount)}
              </Text>
            ))
          ) : (
            // 단일 급여 표시
            <Text className="text-sm font-medium text-gray-900 dark:text-white">
              💰 {formatSalary(posting.salary.type, posting.salary.amount)}
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

      {/* 하단: 지원자 수 */}
      <View className="flex-row items-center justify-end mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
        <UsersIcon size={14} color="#2563EB" />
        <Text className="ml-1 text-xs text-gray-600 dark:text-gray-400">
          지원 {posting.applicationCount || 0}
        </Text>
      </View>
    </Card>
  );
});

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
