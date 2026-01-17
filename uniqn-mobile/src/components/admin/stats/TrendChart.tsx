/**
 * UNIQN Mobile - 트렌드 차트 컴포넌트
 *
 * @description 7일 트렌드 데이터를 라인/바 차트로 시각화
 */

import { View, Text, Dimensions } from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { useThemeStore } from '@/stores/themeStore';

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
  color = '#2563eb',
  suffix = '',
}: TrendChartProps) {
  const { isDarkMode } = useThemeStore();

  // 데이터가 없거나 빈 경우
  if (!data || data.length === 0) {
    return (
      <View className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
        <Text className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          {title}
        </Text>
        <View className="h-[180px] items-center justify-center">
          <Text className="text-gray-500 dark:text-gray-400">
            데이터가 없습니다
          </Text>
        </View>
      </View>
    );
  }

  // 차트 데이터 변환
  const labels = data.map((d) => {
    // "2024-01-15" -> "01/15"
    const parts = d.date.split('-');
    return `${parts[1]}/${parts[2]}`;
  });
  const values = data.map((d) => d.count);

  // 합계 계산
  const total = values.reduce((sum, v) => sum + v, 0);

  const chartConfig = {
    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
    backgroundGradientFrom: isDarkMode ? '#1f2937' : '#ffffff',
    backgroundGradientTo: isDarkMode ? '#1f2937' : '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => {
      // color prop에서 RGB 추출
      const hex = color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    },
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
      stroke: isDarkMode ? '#374151' : '#e5e7eb',
      strokeWidth: 1,
    },
  };

  const chartData = {
    labels,
    datasets: [
      {
        data: values.length > 0 ? values : [0],
        color: (opacity = 1) => {
          const hex = color.replace('#', '');
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        },
        strokeWidth: 2,
      },
    ],
  };

  return (
    <View className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-base font-semibold text-gray-900 dark:text-white">
          {title}
        </Text>
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
