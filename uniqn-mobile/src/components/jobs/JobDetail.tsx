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
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr; // 유효하지 않은 날짜면 원본 반환
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${year}년 ${month}월 ${day}일 (${dayOfWeek})`;
};

const getRoleLabel = (role: string | undefined): string => {
  if (!role) return '역할';
  switch (role) {
    case 'dealer':
      return '딜러';
    case 'floor':
      return '플로어';
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

/**
 * 역할 정보에서 표시할 이름 추출
 * RoleRequirement 또는 FormRoleWithCount 형식 모두 지원
 */
const getRoleDisplayName = (roleReq: { role?: string; name?: string; count: number; filled?: number }): string => {
  // name이 있으면 사용 (FormRoleWithCount)
  if (roleReq.name) return roleReq.name;
  // role이 있으면 변환 (RoleRequirement)
  return getRoleLabel(roleReq.role);
};

// ============================================================================
// Sub Components
// ============================================================================

function InfoRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View className="flex-row items-start py-3 border-b border-gray-100 dark:border-gray-700">
      <Text className="text-lg mr-3">{icon}</Text>
      <View className="flex-1">
        <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">
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

  // 수당 정보 안전하게 처리
  const allowanceItems: string[] = [];
  if (job.allowances?.meal && typeof job.allowances.meal === 'number') {
    allowanceItems.push(`식대 ${job.allowances.meal.toLocaleString()}원`);
  }
  if (job.allowances?.transportation && typeof job.allowances.transportation === 'number') {
    allowanceItems.push(`교통비 ${job.allowances.transportation.toLocaleString()}원`);
  }
  if (job.allowances?.accommodation && typeof job.allowances.accommodation === 'number') {
    allowanceItems.push(`숙박비 ${job.allowances.accommodation.toLocaleString()}원`);
  }

  // 안전한 값 추출
  const safeTitle = String(job.title || '제목 없음');
  const safeTimeSlot = String(job.timeSlot || '시간 미정');
  const safeContactPhone = String(job.contactPhone || '');
  const safeDescription = String(job.description || '');
  const safeWorkDate = formatDate(job.workDate) || '날짜 미정';

  // location 안전하게 처리
  const getLocationValue = (): string => {
    if (!job.location) return '정보 없음';
    const locationName = typeof job.location === 'string'
      ? job.location
      : (job.location?.name || '');
    const address = job.detailedAddress ? ` ${job.detailedAddress}` : '';
    const result = `${locationName}${address}`.trim();
    return result || '정보 없음';
  };

  // 급여 안전하게 처리
  const getSalaryText = (): string => {
    if (!job.salary) return '급여 정보 없음';
    const type = job.salary.type || 'hourly';
    const amount = typeof job.salary.amount === 'number' ? job.salary.amount : 0;
    return formatSalary(type, amount);
  };

  return (
    <View className="bg-white dark:bg-gray-900">
      {/* 헤더 영역 */}
      <View className="p-4 bg-gray-50 dark:bg-gray-800">
        <View className="flex-row items-center mb-2">
          {job.isUrgent === true && (
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
          {safeTitle}
        </Text>

        {/* 역할 태그 */}
        {Array.isArray(job.roles) && job.roles.length > 0 && (
          <View className="flex-row flex-wrap mb-3">
            {job.roles.map((roleReq, index) => {
              const displayName = getRoleDisplayName(roleReq);
              const filled = typeof roleReq.filled === 'number' ? roleReq.filled : 0;
              const count = typeof roleReq.count === 'number' ? roleReq.count : 0;
              return (
                <View key={index} className="mr-2 mb-2">
                  <Badge variant="primary" size="md">
                    {`${displayName} (${filled}/${count}명)`}
                  </Badge>
                </View>
              );
            })}
          </View>
        )}

        {/* 급여 */}
        <Text className="text-2xl font-bold text-primary-600 dark:text-primary-400">
          {getSalaryText()}
        </Text>
      </View>

      {/* 상세 정보 */}
      <View className="p-4">
        <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">
          근무 정보
        </Text>

        <InfoRow icon="📍" label="근무지" value={getLocationValue()} />
        <InfoRow icon="📅" label="근무일" value={safeWorkDate} />
        <InfoRow icon="🕐" label="근무시간" value={safeTimeSlot} />
        {safeContactPhone.length > 0 && (
          <Pressable onPress={handleCall}>
            <InfoRow icon="📞" label="연락처" value={safeContactPhone} />
          </Pressable>
        )}
        {allowanceItems.length > 0 && (
          <InfoRow icon="💰" label="수당" value={allowanceItems.join(' / ')} />
        )}
      </View>

      {/* 상세 설명 */}
      {safeDescription.length > 0 && (
        <View className="p-4 border-t border-gray-100 dark:border-gray-700">
          <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            상세 설명
          </Text>
          <Text className="text-sm text-gray-600 dark:text-gray-300 leading-6">
            {safeDescription}
          </Text>
        </View>
      )}

      {/* 통계 */}
      {(typeof job.viewCount === 'number' || typeof job.applicationCount === 'number') && (
        <View className="p-4 border-t border-gray-100 dark:border-gray-700">
          <View className="flex-row">
            {typeof job.viewCount === 'number' && (
              <Text className="text-xs text-gray-400 dark:text-gray-500 mr-4">
                {`👁 조회 ${job.viewCount}`}
              </Text>
            )}
            {typeof job.applicationCount === 'number' && (
              <Text className="text-xs text-gray-400 dark:text-gray-500">
                {`👤 지원 ${job.applicationCount}`}
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

export default JobDetail;
