/**
 * UNIQN Mobile - 관리자 통계 페이지
 *
 * @description 서비스 이용 현황 및 분석 통계
 */

import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import {
  TrendChart,
  RoleDistributionChart,
  StatsSummaryCard,
  SystemStatusCard,
} from '@/components/admin/stats';

export default function AdminStatsPage() {
  const { stats, metrics, isLoading, isRefreshing, refresh, error } = useAdminDashboard();

  return (
    <>
      <Stack.Screen
        options={{
          title: '통계',
          headerBackTitle: '뒤로',
        }}
      />

      <ScrollView
        className="flex-1 bg-gray-50 dark:bg-surface-dark"
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} />
        }
      >
        <View className="p-4">
          {/* Header */}
          <View className="mb-6">
            <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              서비스 통계
            </Text>
            <Text className="text-gray-500 dark:text-gray-400">
              UNIQN 서비스 이용 현황 및 분석
            </Text>
          </View>

          {/* Error Message */}
          {error && (
            <View className="bg-red-50 dark:bg-red-900/30 rounded-xl p-4 mb-4">
              <Text className="text-red-600 dark:text-red-400">
                데이터를 불러오는데 실패했습니다. 새로고침 해주세요.
              </Text>
            </View>
          )}

          {/* Loading State */}
          {isLoading && !stats && (
            <View className="items-center justify-center py-20">
              <ActivityIndicator size="large" />
              <Text className="text-gray-500 dark:text-gray-400 mt-4">
                통계 데이터를 불러오는 중...
              </Text>
            </View>
          )}

          {/* Stats Content */}
          {stats && (
            <>
              {/* Summary Stats - Row 1 */}
              <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                주요 지표
              </Text>
              <View className="flex-row gap-3 mb-3">
                <View className="flex-1">
                  <StatsSummaryCard
                    label="총 사용자"
                    value={stats.totalUsers}
                    isLoading={isLoading}
                    icon="people"
                    iconColor="#9333EA"
                    iconBgColor="bg-primary-100 dark:bg-primary-900/30"
                    suffix="명"
                  />
                </View>
                <View className="flex-1">
                  <StatsSummaryCard
                    label="오늘 신규"
                    value={stats.newUsersToday}
                    isLoading={isLoading}
                    icon="person-add"
                    iconColor="#16a34a"
                    iconBgColor="bg-green-100 dark:bg-green-900/30"
                    valueColor="text-green-600"
                    suffix="명"
                  />
                </View>
              </View>

              {/* Summary Stats - Row 2 */}
              <View className="flex-row gap-3 mb-3">
                <View className="flex-1">
                  <StatsSummaryCard
                    label="활성 공고"
                    value={stats.activeJobPostings}
                    isLoading={isLoading}
                    icon="briefcase"
                    iconColor="#9333EA"
                    iconBgColor="bg-primary-100 dark:bg-primary-900/30"
                    valueColor="text-primary-600"
                    suffix="건"
                  />
                </View>
                <View className="flex-1">
                  <StatsSummaryCard
                    label="오늘 지원"
                    value={stats.applicationsToday}
                    isLoading={isLoading}
                    icon="document-text"
                    iconColor="#9333ea"
                    iconBgColor="bg-purple-100 dark:bg-purple-900/30"
                    valueColor="text-purple-600"
                    suffix="건"
                  />
                </View>
              </View>

              {/* Summary Stats - Row 3 */}
              <View className="flex-row gap-3 mb-6">
                <View className="flex-1">
                  <StatsSummaryCard
                    label="미처리 신고"
                    value={stats.pendingReports}
                    isLoading={isLoading}
                    icon="flag"
                    iconColor="#dc2626"
                    iconBgColor="bg-red-100 dark:bg-red-900/30"
                    valueColor="text-red-600"
                    suffix="건"
                  />
                </View>
                <View className="flex-1">
                  <SystemStatusCard
                    status={metrics?.systemStatus}
                    isLoading={isLoading}
                  />
                </View>
              </View>

              {/* Role Distribution Chart */}
              <View className="mb-6">
                <RoleDistributionChart data={stats.usersByRole} />
              </View>

              {/* Trend Charts */}
              {metrics && (
                <>
                  <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    7일 트렌드
                  </Text>

                  {/* Daily Signups Chart */}
                  <View className="mb-4">
                    <TrendChart
                      title="일별 신규 가입"
                      data={metrics.dailySignups}
                      type="line"
                      color="#16a34a"
                      suffix="명"
                    />
                  </View>

                  {/* Daily Applications Chart */}
                  <View className="mb-4">
                    <TrendChart
                      title="일별 지원 수"
                      data={metrics.dailyApplications}
                      type="bar"
                      color="#9333ea"
                      suffix="건"
                    />
                  </View>

                  {/* Daily Active Users Chart (if available) */}
                  {metrics.dailyActiveUsers && metrics.dailyActiveUsers.length > 0 && (
                    <View className="mb-4">
                      <TrendChart
                        title="일별 활성 사용자"
                        data={metrics.dailyActiveUsers}
                        type="line"
                        color="#9333EA"
                        suffix="명"
                      />
                    </View>
                  )}
                </>
              )}

              {/* Recent Users */}
              {stats.recentUsers && stats.recentUsers.length > 0 && (
                <>
                  <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    최근 가입자
                  </Text>
                  <View className="bg-white dark:bg-surface rounded-xl border border-gray-100 dark:border-surface-overlay overflow-hidden mb-6">
                    {stats.recentUsers.map((user, index) => (
                      <View
                        key={user.id}
                        className={`p-4 flex-row items-center justify-between ${
                          index < stats.recentUsers.length - 1
                            ? 'border-b border-gray-100 dark:border-surface-overlay'
                            : ''
                        }`}
                      >
                        <View className="flex-1">
                          <Text className="text-base font-medium text-gray-900 dark:text-white">
                            {user.name}
                          </Text>
                          <Text className="text-sm text-gray-500 dark:text-gray-400">
                            {user.email}
                          </Text>
                        </View>
                        <View
                          className={`px-2 py-1 rounded ${
                            user.role === 'admin'
                              ? 'bg-red-100 dark:bg-red-900/30'
                              : user.role === 'employer'
                              ? 'bg-primary-100 dark:bg-primary-900/30'
                              : 'bg-green-100 dark:bg-green-900/30'
                          }`}
                        >
                          <Text
                            className={`text-xs font-medium ${
                              user.role === 'admin'
                                ? 'text-red-700 dark:text-red-300'
                                : user.role === 'employer'
                                ? 'text-primary-700 dark:text-primary-300'
                                : 'text-green-700 dark:text-green-300'
                            }`}
                          >
                            {user.role === 'admin'
                              ? '관리자'
                              : user.role === 'employer'
                              ? '구인자'
                              : '스태프'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* Fetch Time */}
              <View className="items-center pb-4">
                <Text className="text-xs text-gray-400 dark:text-gray-500">
                  마지막 업데이트:{' '}
                  {stats.fetchedAt instanceof Date
                    ? stats.fetchedAt.toLocaleString('ko-KR')
                    : new Date(stats.fetchedAt).toLocaleString('ko-KR')}
                </Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </>
  );
}
