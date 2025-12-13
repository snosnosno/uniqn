/**
 * UNIQN Mobile - Schedule Screen
 * 내 스케줄 화면
 */

import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Badge, EmptyState } from '@/components/ui';
import { CalendarIcon, ClockIcon } from '@/components/icons';
import { useState, useCallback } from 'react';

// 임시 데이터
const MOCK_SCHEDULES = [
  {
    id: '1',
    jobTitle: '강남 홀덤펍 딜러',
    date: '2024-12-20',
    time: '18:00 - 02:00',
    status: 'confirmed' as const,
    salary: 150000,
  },
  {
    id: '2',
    jobTitle: '홍대 토너먼트 스태프',
    date: '2024-12-22',
    time: '14:00 - 22:00',
    status: 'applied' as const,
    salary: 130000,
  },
];

const statusConfig = {
  applied: { label: '지원', variant: 'warning' as const },
  confirmed: { label: '확정', variant: 'success' as const },
  completed: { label: '완료', variant: 'default' as const },
  cancelled: { label: '취소', variant: 'error' as const },
};

export default function ScheduleScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [schedules, setSchedules] = useState(MOCK_SCHEDULES);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
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
      <View className="bg-white px-4 py-3 dark:bg-gray-800">
        <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">내 스케줄</Text>
      </View>

      {/* 스케줄 목록 */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {schedules.length === 0 ? (
          <EmptyState
            title="예정된 스케줄이 없습니다"
            description="공고에 지원하면 스케줄이 여기에 표시됩니다"
            variant="content"
          />
        ) : (
          schedules.map((schedule) => {
            const status = statusConfig[schedule.status];
            return (
              <Card key={schedule.id} className="mb-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <View className="flex-row items-center">
                      <Badge variant={status.variant} dot>
                        {status.label}
                      </Badge>
                      <Text className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                        {schedule.jobTitle}
                      </Text>
                    </View>

                    <View className="mt-2 flex-row items-center">
                      <CalendarIcon size={14} color="#6B7280" />
                      <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-400">
                        {schedule.date}
                      </Text>
                      <View className="mx-2 h-3 w-px bg-gray-300 dark:bg-gray-600" />
                      <ClockIcon size={14} color="#6B7280" />
                      <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-400">
                        {schedule.time}
                      </Text>
                    </View>
                  </View>

                  <Text className="font-semibold text-primary-600 dark:text-primary-400">
                    {formatCurrency(schedule.salary)}
                  </Text>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
