/**
 * UNIQN Mobile - 역할별 분포 통계 컴포넌트
 *
 * @description 사용자 역할별 분포를 텍스트/숫자 형태로 표시
 * @version 2.0.0 - 차트 라이브러리 제거, 경량화
 */

import { useMemo, useCallback } from 'react';
import { View, Text } from 'react-native';
import { PRIMARY_COLORS, STATUS_COLORS } from '@/constants/colors';

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
    color: STATUS_COLORS.error,
    bgColor: 'bg-error-600',
    lightBg: 'bg-error-50 dark:bg-error-900/20',
    textColor: 'text-error-700 dark:text-error-300',
  },
  {
    key: 'employer' as const,
    label: '구인자',
    color: PRIMARY_COLORS[600],
    bgColor: 'bg-primary-600',
    lightBg: 'bg-primary-50 dark:bg-primary-900/20',
    textColor: 'text-primary-700 dark:text-primary-300',
  },
  {
    key: 'staff' as const,
    label: '스태프',
    color: STATUS_COLORS.success,
    bgColor: 'bg-success-600',
    lightBg: 'bg-success-50 dark:bg-success-900/20',
    textColor: 'text-success-700 dark:text-success-300',
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
      <View className="bg-white dark:bg-surface rounded-md p-4 border border-secondary-100 dark:border-surface-overlay">
        <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white mb-4">
          {title}
        </Text>
        <View className="h-[120px] items-center justify-center">
          <Text className="text-secondary-500 dark:text-secondary-400 font-sans">
            데이터가 없습니다
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="bg-white dark:bg-surface rounded-md p-4 border border-secondary-100 dark:border-surface-overlay">
      {/* 헤더 */}
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
          {title}
        </Text>
        <View className="px-2.5 py-1 rounded-sm bg-surface-card">
          <Text className="text-sm font-sans-bold text-content-secondary">
            총 {total.toLocaleString()}명
          </Text>
        </View>
      </View>

      {/* 가로 막대형 분포 표시 */}
      <View className="h-6 flex-row rounded-sm overflow-hidden mb-4">
        {sortedRoles.map((role) =>
          role.count > 0 ? (
            <View key={role.key} className={role.bgColor} style={{ flex: role.count }} />
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
              <View className={`w-3 h-3 rounded-sm ${role.bgColor} mr-3`} />
              <Text className={`text-sm font-sans-medium ${role.textColor}`}>{role.label}</Text>
            </View>
            <View className="flex-row items-center">
              <Text className={`text-lg font-display ${role.textColor} mr-2`}>
                {role.count.toLocaleString()}명
              </Text>
              <View className="bg-white/60 dark:bg-black/40 px-2 py-0.5 rounded">
                <Text className="text-xs font-sans-medium text-content-muted dark:text-secondary-400">
                  {role.percent}%
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* 비율 요약 (하단) */}
      <View className="flex-row justify-center mt-4 pt-3 border-t border-secondary-100 dark:border-surface-overlay">
        {ROLE_CONFIG.map((role, index) => (
          <View key={role.key} className="flex-row items-center">
            {index > 0 && (
              <Text className="text-secondary-300 dark:text-secondary-600 mx-2 font-sans">·</Text>
            )}
            <View className={`w-2 h-2 rounded-sm ${role.bgColor} mr-1`} />
            <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
              {role.label} {getPercent(data[role.key])}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default RoleDistributionChart;
