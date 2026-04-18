import { SECONDARY_PALETTE } from '@/constants/colors';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CardStripe, type CardStripeTone, EmptyState, Loading, NumericText } from '@/components/ui';
import { StackHeader } from '@/components/headers';
import { PeopleOutlineIcon } from '@/components/icons';
import { queryKeys } from '@/lib/queryClient';
import { listEmployerApplications } from '@/services/admin';
import type { EmployerApplication } from '@/repositories';
import { toDate } from '@/utils/date';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';

// ============================================================================
// Types
// ============================================================================

type AdminApplicationFilter = 'pending' | 'approved' | 'rejected' | 'all';

const STATUS_OPTIONS: { value: AdminApplicationFilter; label: string }[] = [
  { value: 'pending', label: '대기 중' },
  { value: 'approved', label: '승인됨' },
  { value: 'rejected', label: '거부됨' },
  { value: 'all', label: '전체' },
];

// ============================================================================
// Helpers
// ============================================================================

function isOverdue(submittedAt: string): boolean {
  const submitted = toDate(submittedAt);
  if (!submitted) return false;
  return Date.now() - submitted.getTime() > 24 * 60 * 60 * 1000;
}

const STATUS_CLASSNAMES = {
  approved: 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300',
  rejected: 'bg-secondary-100 text-content-muted dark:bg-surface-elevated dark:text-secondary-300',
  pending: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
} as const;

function getStatusClassName(status: EmployerApplication['status']): string {
  if (status === 'approved') return STATUS_CLASSNAMES.approved;
  if (status === 'rejected') return STATUS_CLASSNAMES.rejected;
  return STATUS_CLASSNAMES.pending;
}

function getStatusLabel(status: EmployerApplication['status']): string {
  switch (status) {
    case 'approved':
      return '승인됨';
    case 'rejected':
      return '거부됨';
    default:
      return '대기 중';
  }
}

/**
 * 구인자 신청 상태 → CardStripe tone
 *  - pending(대기): gold (신규 접수)
 *  - approved(승인): muted (완료)
 *  - rejected(거부): warning (반려)
 */
function getStripeTone(status: EmployerApplication['status']): CardStripeTone {
  switch (status) {
    case 'approved':
      return 'muted';
    case 'rejected':
      return 'warning';
    default:
      return 'gold';
  }
}

// ============================================================================
// Hook
// ============================================================================

function useAdminEmployerApplications(filter: AdminApplicationFilter) {
  const status = filter === 'all' ? undefined : filter;
  return useQuery({
    queryKey: queryKeys.employerApplications.adminList(filter),
    // Service 경유로 requireAdminUser() guard 일관 적용
    queryFn: () => listEmployerApplications({ status, pageSize: 50 }),
    staleTime: 30 * 1000,
  });
}

// ============================================================================
// ApplicationCard
// ============================================================================

function ApplicationCard({ app }: { app: EmployerApplication }) {
  const submittedDate = toDate(app.submittedAt);
  const formattedDate = submittedDate
    ? format(submittedDate, 'yyyy.MM.dd HH:mm', { locale: ko })
    : '';
  const showOverdue = app.status === 'pending' && isOverdue(app.submittedAt);
  const stripeTone = getStripeTone(app.status);

  return (
    <Pressable
      onPress={() => router.push(`/(admin)/employer-applications/${app.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`구인자 신청 상세, ${getStatusLabel(app.status)}`}
      className="mb-3 rounded-md bg-surface-card dark:bg-surface-elevated border border-divider active:opacity-80"
    >
      <CardStripe tone={stripeTone}>
        <View className="pl-4 pr-4 py-4">
          <View className="mb-2 flex-row items-center justify-between gap-3">
            <View className="flex-1 flex-row flex-wrap items-center gap-2">
              <View className={`rounded-sm px-2.5 py-1 ${getStatusClassName(app.status)}`}>
                <Text className="text-xs font-sans-medium">{getStatusLabel(app.status)}</Text>
              </View>
              {showOverdue ? (
                <View className="rounded-sm bg-error-50 px-2.5 py-1 dark:bg-error-900/30">
                  <Text className="text-xs font-sans-medium text-error-700 dark:text-error-300">
                    ⏰ 24h 경과
                  </Text>
                </View>
              ) : null}
            </View>
            <NumericText className="text-xs text-content-placeholder font-sans">
              {formattedDate}
            </NumericText>
          </View>

          <Text className="mb-1 text-base font-sans-semibold text-content-primary dark:text-off-white">
            신청자 ID: {app.userId.slice(0, 8)}...
          </Text>

          {app.status === 'rejected' && app.rejectionCategory ? (
            <Text className="mt-1 text-sm text-content-muted dark:text-secondary-400 font-sans">
              거부 사유: {app.rejectionCategory}
            </Text>
          ) : null}
        </View>
      </CardStripe>
    </Pressable>
  );
}

// ============================================================================
// Page
// ============================================================================

export default function AdminEmployerApplicationsPage() {
  const [filter, setFilter] = useState<AdminApplicationFilter>('pending');
  const { data, isLoading, isRefetching, error, refetch } = useAdminEmployerApplications(filter);

  const applications = data?.items ?? [];

  if (isLoading && !data) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page" edges={['top', 'bottom']}>
        <StackHeader title="구인자 신청" fallbackHref="/(admin)" />
        <View className="flex-1 items-center justify-center bg-surface-page">
          <Loading size="large" message="구인자 신청을 불러오는 중..." />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page" edges={['top', 'bottom']}>
        <StackHeader title="구인자 신청" fallbackHref="/(admin)" />
        <View className="flex-1 bg-surface-page">
          <EmptyState
            title="구인자 신청을 불러오지 못했습니다"
            description="잠시 후 다시 시도해 주세요."
            icon="error"
            actionLabel="다시 시도"
            onAction={() => refetch()}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface-page">
      <StackHeader title="구인자 신청" fallbackHref="/(admin)" />
      <View className="border-b border-secondary-200 bg-white dark:border-surface-overlay dark:bg-surface">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-4 py-2"
          contentContainerStyle={{ gap: 8, alignItems: 'center' }}
        >
          {STATUS_OPTIONS.map((option) => {
            const isSelected = option.value === filter;

            return (
              <Pressable
                key={option.value}
                onPress={() => setFilter(option.value)}
                className={`rounded-sm px-4 py-2 ${
                  isSelected ? 'bg-primary-600' : 'bg-secondary-200 dark:bg-surface-elevated'
                }`}
              >
                <Text
                  className={`text-sm font-sans-medium ${
                    isSelected ? 'text-surface-dark' : 'text-secondary-700 dark:text-secondary-300'
                  }`}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
      >
        <Text className="mb-3 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
          총 {applications.length}건
        </Text>

        {applications.length === 0 ? (
          <View className="py-20">
            <EmptyState
              title="신청이 없습니다"
              description="현재 조건에 맞는 신청이 없습니다."
              icon={<PeopleOutlineIcon size={40} color={SECONDARY_PALETTE[400]} />}
            />
          </View>
        ) : (
          applications.map((app) => <ApplicationCard key={app.id} app={app} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
