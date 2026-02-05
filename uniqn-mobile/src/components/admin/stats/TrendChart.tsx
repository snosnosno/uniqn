/**
 * UNIQN Mobile - 트렌드 통계 컴포넌트
 *
 * @description 7일 트렌드 데이터를 텍스트/숫자 형태로 표시
 * @version 2.0.0 - 차트 라이브러리 제거, 경량화
 */

import { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';

// ============================================================================
// Types
// ============================================================================

interface TrendData {
  date: string;
  count: number;
}

interface TrendChartProps {
  title: string;
  data: TrendData[];
  type?: 'line' | 'bar'; // 호환성 유지 (무시됨)
  color?: string;
  suffix?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * 날짜 포맷 변환 (YYYY-MM-DD → MM/DD)
 */
function formatDate(dateString: string): string {
  const parts = dateString.split('-');
  if (parts.length >= 3) {
    return `${parts[1]}/${parts[2]}`;
  }
  return dateString;
}

/**
 * 요일 반환 (타임존 안전)
 */
function getDayOfWeek(dateString: string): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day); // 로컬 타임존 사용
  return days[date.getDay()];
}

/**
 * 오늘 날짜인지 확인
 */
function isDateToday(dateString: string): boolean {
  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return dateString === todayString;
}

// ============================================================================
// Component
// ============================================================================

export function TrendChart({
  title,
  data,
  color = '#9333EA',
  suffix = '',
}: TrendChartProps) {
  const { isDarkMode } = useThemeStore();

  // 통계 계산
  const stats = useMemo(() => {
    if (!data || data.length === 0) {
      return { total: 0, average: 0, max: 0, maxDate: '', min: 0, minDate: '' };
    }

    const counts = data.map((d) => d.count);
    const total = counts.reduce((acc, v) => acc + v, 0);
    const average = Math.round(total / counts.length);
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    const maxItem = data.find((d) => d.count === max);
    const minItem = data.find((d) => d.count === min);

    return {
      total,
      average,
      max,
      maxDate: maxItem ? formatDate(maxItem.date) : '',
      min,
      minDate: minItem ? formatDate(minItem.date) : '',
    };
  }, [data]);

  // 데이터가 없는 경우
  if (!data || data.length === 0) {
    return (
      <View className="bg-white dark:bg-surface rounded-xl p-4 border border-gray-100 dark:border-surface-overlay">
        <Text className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          {title}
        </Text>
        <View className="h-[120px] items-center justify-center">
          <Text className="text-gray-500 dark:text-gray-400">데이터가 없습니다</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="bg-white dark:bg-surface rounded-xl p-4 border border-gray-100 dark:border-surface-overlay">
      {/* 헤더 */}
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-base font-semibold text-gray-900 dark:text-white">
          {title}
        </Text>
        <View
          className="px-2.5 py-1 rounded-full"
          style={{ backgroundColor: `${color}20` }}
        >
          <Text style={{ color }} className="text-sm font-bold">
            총 {stats.total.toLocaleString()}
            {suffix}
          </Text>
        </View>
      </View>

      {/* 요약 통계 */}
      <View className="flex-row mb-4 gap-2">
        <View className="flex-1 bg-gray-50 dark:bg-surface-elevated rounded-lg p-3">
          <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">일평균</Text>
          <Text className="text-lg font-bold text-gray-900 dark:text-white">
            {stats.average.toLocaleString()}
            {suffix}
          </Text>
        </View>
        <View className="flex-1 bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
          <Text className="text-xs text-green-600 dark:text-green-400 mb-1">
            최고 ({stats.maxDate})
          </Text>
          <Text className="text-lg font-bold text-green-700 dark:text-green-300">
            {stats.max.toLocaleString()}
            {suffix}
          </Text>
        </View>
        <View className="flex-1 bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
          <Text className="text-xs text-orange-600 dark:text-orange-400 mb-1">
            최저 ({stats.minDate})
          </Text>
          <Text className="text-lg font-bold text-orange-700 dark:text-orange-300">
            {stats.min.toLocaleString()}
            {suffix}
          </Text>
        </View>
      </View>

      {/* 일별 데이터 리스트 */}
      <View className="border-t border-gray-100 dark:border-surface-overlay pt-3">
        <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">일별 추이</Text>
        {data.map((item) => {
          const barWidth = stats.max > 0 ? (item.count / stats.max) * 100 : 0;
          const isToday = isDateToday(item.date);

          return (
            <View
              key={item.date}
              className={`flex-row items-center py-1.5 ${
                isToday ? 'bg-primary-50 dark:bg-primary-900/20 -mx-2 px-2 rounded' : ''
              }`}
            >
              {/* 날짜 */}
              <View className="w-16">
                <Text
                  className={`text-sm ${
                    isToday
                      ? 'font-semibold text-primary-700 dark:text-primary-300'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {formatDate(item.date)}
                </Text>
                <Text className="text-xs text-gray-400 dark:text-gray-500">
                  ({getDayOfWeek(item.date)})
                </Text>
              </View>

              {/* 바 그래프 */}
              <View className="flex-1 mx-3">
                <View className="h-2 bg-gray-100 dark:bg-surface-overlay rounded-full overflow-hidden">
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: isToday ? color : isDarkMode ? '#6b7280' : '#9ca3af',
                    }}
                  />
                </View>
              </View>

              {/* 숫자 */}
              <Text
                className={`text-sm font-medium w-16 text-right ${
                  isToday
                    ? 'text-primary-700 dark:text-primary-300'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {item.count.toLocaleString()}
                {suffix}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default TrendChart;
