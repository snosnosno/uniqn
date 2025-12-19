/**
 * UNIQN Mobile - 구인공고 상세 컴포넌트
 *
 * @description 공고 상세 정보 표시
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, Linking, Pressable } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import type { JobPosting } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface JobDetailProps {
  job: JobPosting;
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
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${year}년 ${month}월 ${day}일 (${dayOfWeek})`;
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
// Sub Components
// ============================================================================

function InfoRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View className="flex-row items-start py-3 border-b border-gray-100 dark:border-gray-700">
      <Text className="text-lg mr-3">{icon}</Text>
      <View className="flex-1">
        <Text className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
          {label}
        </Text>
        <Text className="text-sm text-gray-900 dark:text-white">
          {value}
        </Text>
      </View>
    </View>
  );
}

// ============================================================================
// Component
// ============================================================================

export function JobDetail({ job }: JobDetailProps) {
  const handleCall = () => {
    if (job.contactPhone) {
      Linking.openURL(`tel:${job.contactPhone}`);
    }
  };

  const allowanceItems = [];
  if (job.allowances?.meal) {
    allowanceItems.push(`식대 ${job.allowances.meal.toLocaleString()}원`);
  }
  if (job.allowances?.transportation) {
    allowanceItems.push(`교통비 ${job.allowances.transportation.toLocaleString()}원`);
  }
  if (job.allowances?.accommodation) {
    allowanceItems.push(`숙박비 ${job.allowances.accommodation.toLocaleString()}원`);
  }

  return (
    <View className="bg-white dark:bg-gray-900">
      {/* 헤더 영역 */}
      <View className="p-4 bg-gray-50 dark:bg-gray-800">
        <View className="flex-row items-center mb-2">
          {job.isUrgent && (
            <Badge variant="error" size="sm" className="mr-2">
              긴급
            </Badge>
          )}
          <Badge
            variant={job.status === 'active' ? 'success' : 'default'}
            size="sm"
          >
            {job.status === 'active' ? '모집중' : '마감'}
          </Badge>
        </View>
        <Text className="text-xl font-bold text-gray-900 dark:text-white mb-3">
          {job.title}
        </Text>

        {/* 역할 태그 */}
        <View className="flex-row flex-wrap gap-2 mb-3">
          {job.roles.map((roleReq, index) => (
            <Badge key={index} variant="primary" size="md">
              {getRoleLabel(roleReq.role)} ({roleReq.filled}/{roleReq.count}명)
            </Badge>
          ))}
        </View>

        {/* 급여 */}
        <Text className="text-2xl font-bold text-primary-600 dark:text-primary-400">
          {formatSalary(job.salary.type, job.salary.amount)}
        </Text>
      </View>

      {/* 상세 정보 */}
      <View className="p-4">
        <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">
          근무 정보
        </Text>

        <InfoRow
          icon="📍"
          label="근무지"
          value={`${job.location.name}${job.detailedAddress ? ` ${job.detailedAddress}` : ''}`}
        />
        <InfoRow icon="📅" label="근무일" value={formatDate(job.workDate)} />
        <InfoRow icon="🕐" label="근무시간" value={job.timeSlot} />
        {job.contactPhone && (
          <Pressable onPress={handleCall}>
            <InfoRow icon="📞" label="연락처" value={job.contactPhone} />
          </Pressable>
        )}
        {allowanceItems.length > 0 && (
          <InfoRow icon="💰" label="수당" value={allowanceItems.join(' / ')} />
        )}
      </View>

      {/* 상세 설명 */}
      {job.description && (
        <View className="p-4 border-t border-gray-100 dark:border-gray-700">
          <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            상세 설명
          </Text>
          <Text className="text-sm text-gray-600 dark:text-gray-300 leading-6">
            {job.description}
          </Text>
        </View>
      )}

      {/* 통계 */}
      <View className="p-4 border-t border-gray-100 dark:border-gray-700">
        <View className="flex-row">
          {job.viewCount !== undefined && (
            <Text className="text-xs text-gray-400 dark:text-gray-500 mr-4">
              👁 조회 {job.viewCount}
            </Text>
          )}
          {job.applicationCount !== undefined && (
            <Text className="text-xs text-gray-400 dark:text-gray-500">
              👤 지원 {job.applicationCount}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

export default JobDetail;
