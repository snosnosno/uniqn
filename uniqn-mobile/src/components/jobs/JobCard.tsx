/**
 * UNIQN Mobile - 구인공고 카드 컴포넌트
 *
 * @description 공고 목록에서 사용하는 간략한 정보 카드
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import type { JobPostingCard } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface JobCardProps {
  job: JobPostingCard;
  onPress: (jobId: string) => void;
}

// ============================================================================
// Helpers
// ============================================================================

const formatSalary = (type: string, amount: number): string => {
  const formattedAmount = amount.toLocaleString('ko-KR');
  switch (type) {
    case 'hourly':
      return `시급 ${formattedAmount}원`;
    case 'daily':
      return `일급 ${formattedAmount}원`;
    case 'monthly':
      return `월급 ${formattedAmount}원`;
    default:
      return `${formattedAmount}원`;
  }
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${month}/${day}(${dayOfWeek})`;
};

const getRoleBadgeColor = (role: string): 'primary' | 'success' | 'warning' | 'error' | 'default' => {
  switch (role) {
    case 'dealer':
      return 'primary';
    case 'manager':
      return 'warning';
    case 'chiprunner':
      return 'success';
    case 'admin':
      return 'error';
    default:
      return 'default';
  }
};

const getRoleLabel = (role: string): string => {
  switch (role) {
    case 'dealer':
      return '딜러';
    case 'manager':
      return '매니저';
    case 'chiprunner':
      return '칩러너';
    case 'admin':
      return '관리자';
    default:
      return role;
  }
};

// ============================================================================
// Component
// ============================================================================

export function JobCard({ job, onPress }: JobCardProps) {
  return (
    <Pressable
      onPress={() => onPress(job.id)}
      className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-3 border border-gray-100 dark:border-gray-700 active:opacity-80"
    >
      {/* 상단: 긴급 + 제목 */}
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1 flex-row items-center">
          {job.isUrgent && (
            <Badge variant="error" size="sm" className="mr-2">
              긴급
            </Badge>
          )}
          <Text
            className="text-base font-semibold text-gray-900 dark:text-white flex-1"
            numberOfLines={1}
          >
            {job.title}
          </Text>
        </View>
      </View>

      {/* 역할 태그 */}
      <View className="flex-row flex-wrap gap-1 mb-3">
        {job.roles.slice(0, 3).map((role, index) => (
          <Badge
            key={index}
            variant={getRoleBadgeColor(role)}
            size="sm"
          >
            {getRoleLabel(role)}
          </Badge>
        ))}
        {job.roles.length > 3 && (
          <Badge variant="default" size="sm">
            +{job.roles.length - 3}
          </Badge>
        )}
      </View>

      {/* 중간: 위치 + 날짜 */}
      <View className="flex-row items-center mb-2">
        <Text className="text-sm text-gray-500 dark:text-gray-400 mr-3">
          📍 {job.location}
        </Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          📅 {formatDate(job.workDate)}
        </Text>
      </View>

      {/* 하단: 시간 + 급여 */}
      <View className="flex-row items-center justify-between">
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          🕐 {job.timeSlot}
        </Text>
        <Text className="text-base font-bold text-primary-600 dark:text-primary-400">
          {formatSalary(job.salary.type, job.salary.amount)}
        </Text>
      </View>

      {/* 지원자 수 */}
      {job.applicationCount !== undefined && job.applicationCount > 0 && (
        <View className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          <Text className="text-xs text-gray-400 dark:text-gray-500">
            👤 {job.applicationCount}명 지원
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export default JobCard;
