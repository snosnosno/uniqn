/**
 * UNIQN Mobile - 트렌드 차트 컴포넌트
 *
 * @description 7일 트렌드 데이터를 라인/바 차트로 시각화
 */

import { useMemo } from 'react';
import { View, Text, Dimensions } from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { useThemeStore } from '@/stores/themeStore';

/**
 * HEX 색상을 RGBA 색상 함수로 변환
 */
function hexToRgba(hex: string, opacity: number): string {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

const screenWidth = Dimensions.get('window').width;

interface TrendData {
  date: string;
  count: number;
}

interface TrendChartProps {
  title: string;
  data: TrendData[];
  type?: 'line' | 'bar';
  color?: string;
  suffix?: string;
}

export function TrendChart({
  title,
  data,
  type = 'line',
  color = '#9333EA',
  suffix = '',
}: TrendChartProps) {
  const { isDarkMode } = useThemeStore();

  // 색상 함수 메모이제이션 (hooks는 항상 동일한 순서로 호출되어야 함)
  const colorFn = useMemo(
    () =>
      (opacity: number = 1) =>
        hexToRgba(color, opacity),
    [color]
  );

  // 차트 데이터 변환 (빈 배열 안전 처리)
  const { labels, values, total } = useMemo(() => {
    if (!data || data.length === 0) {
      return { labels: [], values: [], total: 0 };
    }
    const lbls = data.map((d) => {
      // "2024-01-15" -> "01/15"
      const parts = d.date.split('-');
      return `${parts[1]}/${parts[2]}`;
    });
    const vals = data.map((d) => d.count);
    const sum = vals.reduce((acc, v) => acc + v, 0);
    return { labels: lbls, values: vals, total: sum };
  }, [data]);

  const chartConfig = useMemo(
    () => ({
      backgroundColor: isDarkMode ? '#1A1625' : '#ffffff',
      backgroundGradientFrom: isDarkMode ? '#1A1625' : '#ffffff',
      backgroundGradientTo: isDarkMode ? '#1A1625' : '#ffffff',
      decimalPlaces: 0,
      color: colorFn,
      labelColor: () => (isDarkMode ? '#9ca3af' : '#6b7280'),
      style: {
        borderRadius: 16,
      },
      propsForDots: {
        r: '4',
        strokeWidth: '2',
        stroke: color,
      },
      propsForBackgroundLines: {
        strokeDasharray: '',
        stroke: isDarkMode ? '#3D3350' : '#e5e7eb',
        strokeWidth: 1,
      },
    }),
    [isDarkMode, color, colorFn]
  );

  const chartData = useMemo(
    () => ({
      labels,
      datasets: [
        {
          data: values.length > 0 ? values : [0],
          color: colorFn,
          strokeWidth: 2,
        },
      ],
    }),
    [labels, values, colorFn]
  );

  // 데이터가 없거나 빈 경우 (hooks 호출 이후에 early return)
  if (!data || data.length === 0) {
    return (
      <View className="bg-white dark:bg-surface rounded-xl p-4 border border-gray-100 dark:border-surface-overlay">
        <Text className="text-base font-semibold text-gray-900 dark:text-white mb-4">{title}</Text>
        <View className="h-[180px] items-center justify-center">
          <Text className="text-gray-500 dark:text-gray-400">데이터가 없습니다</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="bg-white dark:bg-surface rounded-xl p-4 border border-gray-100 dark:border-surface-overlay">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-base font-semibold text-gray-900 dark:text-white">{title}</Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          총 {total.toLocaleString()}
          {suffix}
        </Text>
      </View>

      {type === 'line' ? (
        <LineChart
          data={chartData}
          width={screenWidth - 64}
          height={180}
          chartConfig={chartConfig}
          bezier
          style={{
            marginLeft: -16,
            borderRadius: 8,
          }}
          withInnerLines
          withOuterLines={false}
          withVerticalLabels
          withHorizontalLabels
          fromZero
        />
      ) : (
        <BarChart
          data={chartData}
          width={screenWidth - 64}
          height={180}
          chartConfig={chartConfig}
          style={{
            marginLeft: -16,
            borderRadius: 8,
          }}
          withInnerLines
          fromZero
          showValuesOnTopOfBars
          yAxisLabel=""
          yAxisSuffix=""
        />
      )}
    </View>
  );
}

export default TrendChart;
