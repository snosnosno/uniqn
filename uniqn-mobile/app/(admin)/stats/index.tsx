import { useMemo } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CalendarIcon,
  DocumentTextOutlineIcon,
  FlagOutlineIcon,
  PeopleOutlineIcon,
  RefreshIcon,
} from '@/components/icons';
import {
  RoleDistributionChart,
  StatsSummaryCard,
  SystemStatusCard,
  TrendChart,
} from '@/components/admin/stats';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { getLayoutColor } from '@/constants/colors';
import { useAdminDashboard } from '@/hooks';
import { useThemeStore } from '@/stores';

function formatDateTime(date: Date | string | undefined): string {
  if (!date) {
    return '--';
  }

  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) {
    return '--';
  }

  return value.toLocaleString('ko-KR', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminStatsScreen() {
  const isDark = useThemeStore((state) => state.isDarkMode);
  const { stats, metrics, isLoading, isRefreshing, error, refresh } = useAdminDashboard();

  const lastUpdatedAt = useMemo(
    () => formatDateTime(metrics?.fetchedAt ?? stats?.fetchedAt),
    [metrics?.fetchedAt, stats?.fetchedAt]
  );

  if (isLoading && !stats && !metrics) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface-dark" edges={['bottom']}>
        <Stack.Screen options={{ title: '서비스 통계' }} />
        <Loading variant="layout" message="통계 데이터를 불러오는 중..." />
      </SafeAreaView>
    );
  }

  if (error && !stats && !metrics) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface-dark" edges={['bottom']}>
        <Stack.Screen options={{ title: '서비스 통계' }} />
        <ErrorState
          error={error}
          title="서비스 통계"
          message="통계 데이터를 불러오지 못했습니다."
          onRetry={refresh}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface-dark" edges={['bottom']}>
      <Stack.Screen options={{ title: '서비스 통계' }} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={getLayoutColor(isDark, 'refreshTint')}
          />
        }
      >
        <View className="mb-6 flex-row items-start justify-between">
          <View className="flex-1 pr-4">
            <Text className="text-2xl font-display text-content-primary dark:text-off-white">
              서비스 통계
            </Text>
            <Text className="mt-1 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
              운영 상태와 최근 7일 추이를 한 화면에서 확인합니다.
            </Text>
          </View>
          <Button onPress={refresh} variant="outline" size="sm">
            새로고침
          </Button>
        </View>

        {error ? (
          <View className="mb-4 rounded-md border border-amber-200 bg-warning-50 px-4 py-3 dark:border-amber-800 dark:bg-warning-900/20">
            <Text className="text-sm font-sans-medium text-warning-800 dark:text-warning-300">
              일부 통계만 표시 중입니다
            </Text>
            <Text className="mt-1 text-xs text-warning-700 dark:text-warning-400 font-sans">
              최신 데이터를 모두 불러오지 못했지만 확인 가능한 항목은 유지했습니다.
            </Text>
          </View>
        ) : null}

        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-lg font-display-semibold text-content-primary dark:text-off-white">
            주요 지표
          </Text>
          <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
            마지막 업데이트: {lastUpdatedAt}
          </Text>
        </View>

        <View className="mb-6 flex-row flex-wrap gap-3">
          <View className="w-[48%]">
            <StatsSummaryCard
              label="총 사용자"
              value={stats?.totalUsers}
              isLoading={isLoading && !stats}
              icon={PeopleOutlineIcon}
              iconColor="#2563eb"
              iconBgColor="bg-info-100 dark:bg-info-900/20"
            />
          </View>
          <View className="w-[48%]">
            <StatsSummaryCard
              label="오늘 신규"
              value={stats?.newUsersToday}
              isLoading={isLoading && !stats}
              icon={CalendarIcon}
              iconColor="#16a34a"
              iconBgColor="bg-success-50 dark:bg-success-900/20"
            />
          </View>
          <View className="w-[48%]">
            <StatsSummaryCard
              label="활성 공고"
              value={stats?.activeJobPostings}
              isLoading={isLoading && !stats}
              icon={DocumentTextOutlineIcon}
              iconColor="#9333ea"
              iconBgColor="bg-primary-100 dark:bg-primary-900/20"
            />
          </View>
          <View className="w-[48%]">
            <StatsSummaryCard
              label="오늘 지원"
              value={stats?.applicationsToday}
              isLoading={isLoading && !stats}
              icon={RefreshIcon}
              iconColor="#0891b2"
              iconBgColor="bg-cyan-100 dark:bg-cyan-900/20"
            />
          </View>
          <View className="w-[48%]">
            <StatsSummaryCard
              label="미처리 신고"
              value={stats?.pendingReports}
              isLoading={isLoading && !stats}
              icon={FlagOutlineIcon}
              iconColor="#dc2626"
              iconBgColor="bg-error-50 dark:bg-error-900/20"
            />
          </View>
          <View className="w-[48%]">
            <SystemStatusCard status={metrics?.systemStatus} isLoading={isLoading && !metrics} />
          </View>
        </View>

        <View className="mb-6">
          <RoleDistributionChart data={stats?.usersByRole ?? { admin: 0, employer: 0, staff: 0 }} />
        </View>

        <Text className="mb-3 text-lg font-display-semibold text-content-primary dark:text-off-white">
          7일 트렌드
        </Text>
        <View className="mb-4">
          <TrendChart title="일별 가입자 수" data={metrics?.dailySignups ?? []} suffix="명" />
        </View>
        <View className="mb-6">
          <TrendChart title="일별 지원 수" data={metrics?.dailyApplications ?? []} suffix="건" />
        </View>

        <View className="rounded-md border border-secondary-100 bg-white p-4 dark:border-surface-overlay dark:bg-surface">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-lg font-display-semibold text-content-primary dark:text-off-white">
              최근 가입자
            </Text>
            <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
              최대 {stats?.recentUsers.length ?? 0}명
            </Text>
          </View>

          {stats?.recentUsers.length ? (
            <View className="gap-3">
              {stats.recentUsers.map((user) => (
                <View
                  key={user.uid}
                  className="flex-row items-center justify-between rounded-lg bg-surface-page px-3 py-3 dark:bg-surface-elevated"
                >
                  <View className="flex-1 pr-3">
                    <Text className="text-sm font-sans-semibold text-content-primary dark:text-off-white">
                      {user.name}
                    </Text>
                    <Text className="mt-1 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                      {user.email}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-xs font-sans-medium uppercase text-primary-600 dark:text-primary-300">
                      {user.role}
                    </Text>
                    <Text className="mt-1 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                      {formatDateTime(user.createdAt)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
              최근 가입자 데이터가 없습니다.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
