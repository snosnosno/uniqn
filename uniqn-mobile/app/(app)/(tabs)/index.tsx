/**
 * UNIQN Mobile - Jobs Screen
 * 구인구직 메인 화면 (탭 홈)
 */

import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Card, Badge, Button, EmptyState } from '@/components/ui';
import { BellIcon, MapPinIcon, CalendarIcon, CurrencyDollarIcon } from '@/components/icons';
import { useState, useCallback } from 'react';
import { Pressable } from 'react-native';

// 임시 데이터
const MOCK_JOBS = [
  {
    id: '1',
    title: '강남 홀덤펍 딜러 모집',
    location: '강남구',
    date: '2024-12-20',
    salary: 150000,
    type: 'urgent',
  },
  {
    id: '2',
    title: '홍대 토너먼트 스태프',
    location: '마포구',
    date: '2024-12-22',
    salary: 130000,
    type: 'normal',
  },
  {
    id: '3',
    title: '판교 프라이빗 이벤트',
    location: '성남시',
    date: '2024-12-25',
    salary: 180000,
    type: 'fixed',
  },
];

export default function JobsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState(MOCK_JOBS);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // TODO: 실제 데이터 fetch
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['top']}>
      {/* 헤더 */}
      <View className="flex-row items-center justify-between bg-white px-4 py-3 dark:bg-gray-800">
        <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">구인구직</Text>
        <Pressable
          onPress={() => router.push('/(app)/notifications')}
          className="p-2"
          hitSlop={8}
        >
          <BellIcon size={24} color="#6B7280" />
          {/* 알림 배지 */}
          <View className="absolute right-1 top-1 h-2 w-2 rounded-full bg-error-500" />
        </Pressable>
      </View>

      {/* 공고 목록 */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {jobs.length === 0 ? (
          <EmptyState
            title="등록된 공고가 없습니다"
            description="새로운 공고가 등록되면 알려드릴게요"
            variant="content"
          />
        ) : (
          jobs.map((job) => (
            <Card
              key={job.id}
              onPress={() => console.log('Job detail:', job.id)}
              className="mb-3"
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <View className="mb-1 flex-row items-center">
                    {job.type === 'urgent' && (
                      <Badge variant="error" size="sm" className="mr-2">
                        긴급
                      </Badge>
                    )}
                    {job.type === 'fixed' && (
                      <Badge variant="primary" size="sm" className="mr-2">
                        고정
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
                        {job.date}
                      </Text>
                    </View>

                    <View className="flex-row items-center">
                      <CurrencyDollarIcon size={14} color="#6B7280" />
                      <Text className="ml-1.5 text-sm font-medium text-primary-600 dark:text-primary-400">
                        {formatCurrency(job.salary)}/일
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
