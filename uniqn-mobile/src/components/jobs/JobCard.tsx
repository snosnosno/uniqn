/**
 * UNIQN Mobile - 구인공고 카드 컴포넌트
 *
 * @description 공고 목록에서 사용하는 간략한 정보 카드
 * @version 2.0.0 - dateRequirements 지원
 */

import React, { memo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { PostingTypeBadge } from './PostingTypeBadge';
import { FixedScheduleDisplay } from './FixedScheduleDisplay';
import type {
  JobPostingCard,
  PostingType,
  Allowances,
  CardRole,
} from '@/types';

// ============================================================================
// Types
// ============================================================================

interface JobCardProps {
  job: JobPostingCard;
  onPress: (jobId: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

/** "제공" 상태를 나타내는 특별 값 */
const PROVIDED_FLAG = -1;

// ============================================================================
// Helpers
// ============================================================================

const formatSalary = (type: string, amount: number): string => {
  if (type === 'other') return '협의';
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
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${month}/${day}(${dayOfWeek})`;
};

const getRoleLabel = (role: string): string => {
  const labels: Record<string, string> = {
    dealer: '딜러',
    manager: '매니저',
    chiprunner: '칩러너',
    admin: '관리자',
    floor: '플로어',
    serving: '서빙',
    staff: '직원',
  };
  return labels[role] || role;
};

const getAllowanceItems = (allowances?: Allowances): string[] => {
  if (!allowances) {
    return [];
  }
  const items: string[] = [];

  // 보장시간
  if (allowances.guaranteedHours && allowances.guaranteedHours > 0) {
    items.push(`⏰ 보장 ${allowances.guaranteedHours}시간`);
  }

  // 식비
  if (allowances.meal === PROVIDED_FLAG) {
    items.push('🍱 식사제공');
  } else if (allowances.meal && allowances.meal > 0) {
    items.push(`🍱 식비 ${allowances.meal.toLocaleString()}원`);
  }

  // 교통비
  if (allowances.transportation === PROVIDED_FLAG) {
    items.push('🚗 교통비제공');
  } else if (allowances.transportation && allowances.transportation > 0) {
    items.push(`🚗 교통비 ${allowances.transportation.toLocaleString()}원`);
  }

  // 숙박비
  if (allowances.accommodation === PROVIDED_FLAG) {
    items.push('🏨 숙박제공');
  } else if (allowances.accommodation && allowances.accommodation > 0) {
    items.push(`🏨 숙박비 ${allowances.accommodation.toLocaleString()}원`);
  }

  return items;
};

// ============================================================================
// Sub Components
// ============================================================================

/**
 * 역할 라인 컴포넌트
 */
const RoleLine = memo(function RoleLine({
  role,
  showTime,
  time,
}: {
  role: CardRole;
  showTime: boolean;
  time: string;
}) {
  const isFilled = role.filled >= role.count && role.count > 0;

  return (
    <Text
      className={`text-sm ${
        isFilled
          ? 'text-gray-400 dark:text-gray-500 line-through'
          : 'text-gray-900 dark:text-gray-100'
      }`}
    >
      {showTime ? `${time} ` : '       '}
      {getRoleLabel(role.role)} {role.count}명 ({role.filled}/{role.count})
    </Text>
  );
});

// ============================================================================
// Component
// ============================================================================

/**
 * 구인공고 카드 컴포넌트
 *
 * FlashList 최적화를 위해 React.memo 적용
 */
export const JobCard = memo(function JobCard({ job, onPress }: JobCardProps) {
  const handlePress = useCallback(() => {
    onPress(job.id);
  }, [job.id, onPress]);

  // 접근성을 위한 설명 텍스트 생성
  const accessibilityLabel = `${job.title}, ${job.location}, ${formatDate(job.workDate)}, ${formatSalary(job.salary.type, job.salary.amount)}`;

  const allowanceItems = getAllowanceItems(job.allowances);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="탭하면 공고 상세 페이지로 이동합니다"
      className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-3 border border-gray-100 dark:border-gray-700 active:opacity-80"
    >
      {/* 상단: 공고타입 + 긴급 + 제목 */}
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1 flex-row items-center flex-wrap">
          {/* 공고 타입 뱃지 (regular는 표시 안 함) */}
          {job.postingType && job.postingType !== 'regular' && (
            <PostingTypeBadge
              type={job.postingType as PostingType}
              size="sm"
              className="mr-2"
            />
          )}
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

      {/* 장소 */}
      <Text className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        📍 {job.location}
      </Text>

      {/* 일정 + 급여/수당 그리드 */}
      <View className="flex-row">
        {/* 왼쪽: 일정 */}
        <View className="flex-1 pr-3">
          {job.postingType === 'fixed' ? (
            // 고정공고: FixedScheduleDisplay 사용
            <FixedScheduleDisplay
              daysPerWeek={job.daysPerWeek}
              workDays={job.workDays}
              startTime={job.startTime || job.timeSlot?.split(/[-~]/)[0]?.trim()}
              compact={true}
            />
          ) : job.dateRequirements && job.dateRequirements.length > 0 ? (
            job.dateRequirements.map((dateReq, dateIdx) => (
              <View key={dateIdx} className="mb-2">
                {/* 날짜 */}
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  📅 {formatDate(dateReq.date)}
                </Text>

                {/* 시간대별 */}
                {dateReq.timeSlots.map((slot, slotIdx) => {
                  // 시간 미정 여부 확인
                  const displayTime = slot.isTimeToBeAnnounced
                    ? '시간 미정'
                    : slot.startTime || '-';

                  return (
                    <View key={slotIdx} className="ml-5 mt-1">
                      {slot.roles.map((role, roleIdx) => (
                        <RoleLine
                          key={roleIdx}
                          role={role}
                          showTime={roleIdx === 0}
                          time={displayTime}
                        />
                      ))}
                    </View>
                  );
                })}
              </View>
            ))
          ) : (
            // 레거시 폴백
            <View className="mb-2">
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                📅 {formatDate(job.workDate)}
              </Text>
              <Text className="text-sm text-gray-900 dark:text-gray-100 ml-5 mt-1">
                🕐 {job.timeSlot || '-'}
              </Text>
            </View>
          )}
        </View>

        {/* 오른쪽: 급여 + 수당 */}
        <View className="flex-1 pl-3 border-l border-gray-100 dark:border-gray-700">
          {/* 급여 */}
          {job.roleSalaries &&
          Object.keys(job.roleSalaries).length > 0 &&
          !job.useSameSalary ? (
            // 역할별 급여 표시
            Object.entries(job.roleSalaries).map(([role, salary], idx) => (
              <Text
                key={idx}
                className="text-sm text-gray-900 dark:text-white"
              >
                💰 {role}: {salary.type === 'other' ? '협의' : formatSalary(salary.type, salary.amount)}
              </Text>
            ))
          ) : (
            // 단일 급여 표시
            <Text className="text-sm font-medium text-gray-900 dark:text-white">
              💰 {formatSalary(job.salary.type, job.salary.amount)}
            </Text>
          )}

          {/* 수당 */}
          {allowanceItems.length > 0 && (
            <View className="mt-1">
              {allowanceItems.map((item, idx) => (
                <Text key={idx} className="text-sm text-gray-500 dark:text-gray-400">
                  {item}
                </Text>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* 하단: 구인자 이름 */}
      {job.ownerName && (
        <View className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            구인자: {job.ownerName}
          </Text>
        </View>
      )}
    </Pressable>
  );
});

export default JobCard;
