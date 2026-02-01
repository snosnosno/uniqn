/**
 * UNIQN Mobile - 통계 요약 카드 컴포넌트
 *
 * @description 개별 통계 수치를 카드 형태로 표시
 */

import { View, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

interface StatsSummaryCardProps {
  label: string;
  value: number | undefined;
  isLoading?: boolean;
  icon?: IoniconsName;
  iconColor?: string;
  iconBgColor?: string;
  valueColor?: string;
  suffix?: string;
  description?: string;
}

export function StatsSummaryCard({
  label,
  value,
  isLoading = false,
  icon,
  iconColor = '#6b7280',
  iconBgColor = 'bg-gray-100 dark:bg-surface',
  valueColor = 'text-gray-900 dark:text-white',
  suffix = '',
  description,
}: StatsSummaryCardProps) {
  return (
    <View className="bg-white dark:bg-surface rounded-xl p-4 border border-gray-100 dark:border-surface-overlay">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {label}
          </Text>
          {isLoading ? (
            <ActivityIndicator size="small" className="mt-2 self-start" />
          ) : (
            <View className="flex-row items-baseline">
              <Text className={`text-2xl font-bold ${valueColor}`}>
                {value?.toLocaleString() ?? '--'}
              </Text>
              {suffix && (
                <Text className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                  {suffix}
                </Text>
              )}
            </View>
          )}
          {description && (
            <Text className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {description}
            </Text>
          )}
        </View>
        {icon && (
          <View className={`w-10 h-10 rounded-lg items-center justify-center ${iconBgColor}`}>
            <Ionicons name={icon} size={20} color={iconColor} />
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * 시스템 상태 표시 카드
 */
interface SystemStatusCardProps {
  status: 'healthy' | 'degraded' | 'down' | undefined;
  isLoading?: boolean;
}

export function SystemStatusCard({ status, isLoading }: SystemStatusCardProps) {
  const statusConfig = {
    healthy: {
      label: '정상',
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      iconColor: '#16a34a',
    },
    degraded: {
      label: '저하',
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: '#d97706',
    },
    down: {
      label: '장애',
      color: 'text-red-600',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      iconColor: '#dc2626',
    },
  };

  const config = status ? statusConfig[status] : statusConfig.healthy;

  return (
    <View className="bg-white dark:bg-surface rounded-xl p-4 border border-gray-100 dark:border-surface-overlay">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            시스템 상태
          </Text>
          {isLoading ? (
            <ActivityIndicator size="small" className="mt-2 self-start" />
          ) : (
            <Text className={`text-xl font-bold ${config.color}`}>
              {config.label}
            </Text>
          )}
        </View>
        <View className={`w-10 h-10 rounded-full items-center justify-center ${config.bgColor}`}>
          <Ionicons
            name={status === 'healthy' ? 'checkmark-circle' : status === 'degraded' ? 'warning' : 'close-circle'}
            size={24}
            color={config.iconColor}
          />
        </View>
      </View>
    </View>
  );
}

export default StatsSummaryCard;
