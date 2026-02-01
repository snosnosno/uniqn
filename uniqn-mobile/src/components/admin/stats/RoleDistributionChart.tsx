/**
 * UNIQN Mobile - 역할별 분포 차트 컴포넌트
 *
 * @description 사용자 역할별 분포를 원형 차트로 시각화
 */

import { useMemo, useCallback } from 'react';
import { View, Text, Dimensions } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import { useThemeStore } from '@/stores/themeStore';

const screenWidth = Dimensions.get('window').width;

interface RoleData {
  admin: number;
  employer: number;
  staff: number;
}

interface RoleDistributionChartProps {
  data: RoleData;
  title?: string;
}

export function RoleDistributionChart({
  data,
  title = '역할별 사용자 분포',
}: RoleDistributionChartProps) {
  const { isDarkMode } = useThemeStore();

  const total = data.admin + data.employer + data.staff;

  // 퍼센트 계산
  const getPercent = useCallback(
    (value: number) => {
      if (total === 0) return 0;
      return Math.round((value / total) * 100);
    },
    [total]
  );

  const chartData = useMemo(() => {
    const legendColor = isDarkMode ? '#9ca3af' : '#6b7280';
    return [
      {
        name: '관리자',
        population: data.admin,
        color: '#dc2626',
        legendFontColor: legendColor,
        legendFontSize: 12,
      },
      {
        name: '구인자',
        population: data.employer,
        color: '#9333EA',
        legendFontColor: legendColor,
        legendFontSize: 12,
      },
      {
        name: '스태프',
        population: data.staff,
        color: '#16a34a',
        legendFontColor: legendColor,
        legendFontSize: 12,
      },
    ];
  }, [data.admin, data.employer, data.staff, isDarkMode]);

  const chartConfig = useMemo(
    () => ({
      color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    }),
    []
  );

  return (
    <View className="bg-white dark:bg-surface rounded-xl p-4 border border-gray-100 dark:border-surface-overlay">
      <Text className="text-base font-semibold text-gray-900 dark:text-white mb-4">{title}</Text>

      {total === 0 ? (
        <View className="h-[200px] items-center justify-center">
          <Text className="text-gray-500 dark:text-gray-400">데이터가 없습니다</Text>
        </View>
      ) : (
        <>
          <PieChart
            data={chartData}
            width={screenWidth - 64}
            height={180}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute={false}
          />

          {/* 상세 통계 */}
          <View className="flex-row justify-between mt-4 pt-4 border-t border-gray-100 dark:border-surface-overlay">
            <View className="items-center flex-1">
              <View className="flex-row items-center mb-1">
                <View className="w-3 h-3 rounded-full bg-red-600 mr-2" />
                <Text className="text-sm text-gray-500 dark:text-gray-400">관리자</Text>
              </View>
              <Text className="text-lg font-bold text-gray-900 dark:text-white">
                {data.admin.toLocaleString()}
              </Text>
              <Text className="text-xs text-gray-400">{getPercent(data.admin)}%</Text>
            </View>

            <View className="items-center flex-1">
              <View className="flex-row items-center mb-1">
                <View className="w-3 h-3 rounded-full bg-primary-600 mr-2" />
                <Text className="text-sm text-gray-500 dark:text-gray-400">구인자</Text>
              </View>
              <Text className="text-lg font-bold text-gray-900 dark:text-white">
                {data.employer.toLocaleString()}
              </Text>
              <Text className="text-xs text-gray-400">{getPercent(data.employer)}%</Text>
            </View>

            <View className="items-center flex-1">
              <View className="flex-row items-center mb-1">
                <View className="w-3 h-3 rounded-full bg-green-600 mr-2" />
                <Text className="text-sm text-gray-500 dark:text-gray-400">스태프</Text>
              </View>
              <Text className="text-lg font-bold text-gray-900 dark:text-white">
                {data.staff.toLocaleString()}
              </Text>
              <Text className="text-xs text-gray-400">{getPercent(data.staff)}%</Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

export default RoleDistributionChart;
