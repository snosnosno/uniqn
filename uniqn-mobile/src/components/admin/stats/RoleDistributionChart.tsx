/**
 * UNIQN Mobile - 역할별 분포 통계 컴포넌트
 *
 * @description 사용자 역할별 분포를 텍스트/숫자 형태로 표시
 * @version 2.0.0 - 차트 라이브러리 제거, 경량화
 */

import { useMemo, useCallback } from 'react';
import { View, Text } from 'react-native';

// ============================================================================
// Types
// ============================================================================

interface RoleData {
  admin: number;
  employer: number;
  staff: number;
}

interface RoleDistributionChartProps {
  data: RoleData;
  title?: string;
}

// ============================================================================
// Constants
// ============================================================================

const ROLE_CONFIG = [
  {
    key: 'admin' as const,
    label: '관리자',
    color: '#dc2626',
    bgColor: 'bg-red-600',
    lightBg: 'bg-red-50 dark:bg-red-900/20',
    textColor: 'text-red-700 dark:text-red-300',
  },
  {
    key: 'employer' as const,
    label: '구인자',
    color: '#9333EA',
    bgColor: 'bg-primary-600',
    lightBg: 'bg-primary-50 dark:bg-primary-900/20',
    textColor: 'text-primary-700 dark:text-primary-300',
  },
  {
    key: 'staff' as const,
    label: '스태프',
    color: '#16a34a',
    bgColor: 'bg-green-600',
    lightBg: 'bg-green-50 dark:bg-green-900/20',
    textColor: 'text-green-700 dark:text-green-300',
  },
];

// ============================================================================
// Component
// ============================================================================

export function RoleDistributionChart({
  data,
  title = '역할별 사용자 분포',
}: RoleDistributionChartProps) {
  const total = data.admin + data.employer + data.staff;

  // 퍼센트 계산
  const getPercent = useCallback(
    (value: number) => {
      if (total === 0) return 0;
      return Math.round((value / total) * 100);
    },
    [total]
  );

  // 역할별 데이터 정렬 (가장 많은 순)
  const sortedRoles = useMemo(() => {
    return ROLE_CONFIG.map((role) => ({
      ...role,
      count: data[role.key],
      percent: getPercent(data[role.key]),
    })).sort((a, b) => b.count - a.count);
  }, [data, getPercent]);

  // 데이터가 없는 경우
  if (total === 0) {
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
        <View className="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-surface-elevated">
          <Text className="text-sm font-bold text-gray-700 dark:text-gray-300">
            총 {total.toLocaleString()}명
          </Text>
        </View>
      </View>

      {/* 가로 막대형 분포 표시 */}
      <View className="h-6 flex-row rounded-full overflow-hidden mb-4">
        {sortedRoles.map((role) =>
          role.count > 0 ? (
            <View
              key={role.key}
              className={role.bgColor}
              style={{ flex: role.count }}
            />
          ) : null
        )}
      </View>

      {/* 역할별 상세 카드 */}
      <View className="gap-2">
        {sortedRoles.map((role) => (
          <View
            key={role.key}
            className={`flex-row items-center justify-between p-3 rounded-lg ${role.lightBg}`}
          >
            <View className="flex-row items-center">
              <View className={`w-3 h-3 rounded-full ${role.bgColor} mr-3`} />
              <Text className={`text-sm font-medium ${role.textColor}`}>
                {role.label}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Text className={`text-lg font-bold ${role.textColor} mr-2`}>
                {role.count.toLocaleString()}명
              </Text>
              <View className="bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded">
                <Text className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {role.percent}%
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* 비율 요약 (하단) */}
      <View className="flex-row justify-center mt-4 pt-3 border-t border-gray-100 dark:border-surface-overlay">
        {ROLE_CONFIG.map((role, index) => (
          <View key={role.key} className="flex-row items-center">
            {index > 0 && (
              <Text className="text-gray-300 dark:text-gray-600 mx-2">·</Text>
            )}
            <View className={`w-2 h-2 rounded-full ${role.bgColor} mr-1`} />
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              {role.label} {getPercent(data[role.key])}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default RoleDistributionChart;
