/**
 * UNIQN Mobile - Jobs Screen
 * 구인구직 메인 화면 (탭 홈)
 */

import { View, Text, ScrollView, RefreshControl, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Card, Badge, EmptyState } from '@/components/ui';
import { BellIcon, QrCodeIcon, MapPinIcon, CalendarIcon, CurrencyDollarIcon } from '@/components/icons';
import { useJobPostings } from '@/hooks/useJobPostings';
import { useUnreadCountRealtime } from '@/hooks/useNotifications';

export default function JobsScreen() {
  // 구인공고 목록 훅
  const { jobs, isLoading, isRefreshing, refresh, loadMore, hasMore } = useJobPostings();

  // 읽지 않은 알림 수 (실시간)
  const unreadCount = useUnreadCountRealtime();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['top']}>
      {/* 헤더 */}
      <View className="flex-row items-center justify-between bg-white px-4 py-3 dark:bg-gray-800">
        <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">구인구직</Text>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => router.push('/(app)/(tabs)/qr')}
            className="p-2"
            hitSlop={8}
          >
            <QrCodeIcon size={24} color="#6B7280" />
          </Pressable>
          <Pressable
            onPress={() => router.push('/(app)/notifications')}
            className="p-2"
            hitSlop={8}
          >
            <BellIcon size={24} color="#6B7280" />
            {/* 알림 배지 (실시간) */}
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

      {/* 공고 목록 */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4"
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} />
        }
        onScrollEndDrag={() => {
          if (hasMore) {
            loadMore();
          }
        }}
      >
        {isLoading && jobs.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text className="mt-4 text-gray-500 dark:text-gray-400">
              공고를 불러오는 중...
            </Text>
          </View>
        ) : jobs.length === 0 ? (
          <EmptyState
            title="등록된 공고가 없습니다"
            description="새로운 공고가 등록되면 알려드릴게요"
            variant="content"
          />
        ) : (
          jobs.map((job) => (
            <Card
              key={job.id}
              onPress={() => router.push(`/(app)/jobs/${job.id}`)}
              className="mb-3"
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <View className="mb-1 flex-row items-center">
                    {job.isUrgent && (
                      <Badge variant="error" size="sm" className="mr-2">
                        긴급
                      </Badge>
                    )}
                    {job.postingType === 'fixed' && (
                      <Badge variant="primary" size="sm" className="mr-2">
                        고정
                      </Badge>
                    )}
                    {job.postingType === 'tournament' && (
                      <Badge variant="secondary" size="sm" className="mr-2">
                        대회
                      </Badge>
                    )}
                    <Text
                      className="flex-1 text-base font-semibold text-gray-900 dark:text-gray-100"
                      numberOfLines={1}
                    >
                      {job.title}
                    </Text>
                  </View>

                  <View className="mt-2 gap-1">
                    <View className="flex-row items-center">
                      <MapPinIcon size={14} color="#6B7280" />
                      <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-400">
                        {job.location}
                      </Text>
                    </View>

                    <View className="flex-row items-center">
                      <CalendarIcon size={14} color="#6B7280" />
                      <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-400">
                        {job.workDate}
                      </Text>
                    </View>

                    <View className="flex-row items-center">
                      <CurrencyDollarIcon size={14} color="#6B7280" />
                      <Text className="ml-1.5 text-sm font-medium text-primary-600 dark:text-primary-400">
                        {formatCurrency(job.salary.amount)}/{job.salary.type === 'hourly' ? '시간' : '일'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
