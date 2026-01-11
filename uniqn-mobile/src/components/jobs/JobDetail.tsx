/**
 * UNIQN Mobile - 구인공고 상세 컴포넌트
 *
 * @description 공고 상세 정보 표시 (v2.0 - dateSpecificRequirements, roleSalaries 지원)
 * @version 2.0.0
 */

import React, { useMemo } from 'react';
import { View, Text, Linking, Pressable } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { PostingTypeBadge } from './PostingTypeBadge';
import { DateRequirementDisplay } from './DateRequirementDisplay';
import { FixedScheduleDisplay } from './FixedScheduleDisplay';
import { RoleSalaryDisplay } from './RoleSalaryDisplay';
import type { JobPosting, PostingType, Allowances } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface JobDetailProps {
  job: JobPosting;
}

// ============================================================================
// Constants
// ============================================================================

/** "제공" 상태를 나타내는 특별 값 */
const PROVIDED_FLAG = -1;

// ============================================================================
// Helpers
// ============================================================================

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${year}년 ${month}월 ${day}일 (${dayOfWeek})`;
};

const getRoleLabel = (role: string | undefined): string => {
  if (!role) return '역할';
  const labels: Record<string, string> = {
    dealer: '딜러',
    floor: '플로어',
    manager: '매니저',
    chiprunner: '칩러너',
    admin: '관리자',
  };
  return labels[role] || role;
};

const getRoleDisplayName = (roleReq: { role?: string; name?: string; count: number; filled?: number }): string => {
  if (roleReq.name) return roleReq.name;
  return getRoleLabel(roleReq.role);
};

/**
 * 수당 정보 문자열 배열 생성 (v2.0)
 */
const getAllowanceItems = (allowances?: Allowances): string[] => {
  if (!allowances) return [];
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

function InfoRow({ label, value, icon }: { label: string; value: string | React.ReactNode; icon: string }) {
  return (
    <View className="flex-row items-start py-3 border-b border-gray-100 dark:border-gray-700">
      <Text className="text-lg mr-3">{icon}</Text>
      <View className="flex-1">
        <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">
          {label}
        </Text>
        {typeof value === 'string' ? (
          <Text className="text-sm text-gray-900 dark:text-white">
            {value}
          </Text>
        ) : (
          value
        )}
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

  // 수당 정보 (v2.0)
  const allowanceItems = useMemo(() => getAllowanceItems(job.allowances), [job.allowances]);

  // 안전한 값 추출
  const safeTitle = String(job.title || '제목 없음');
  const safeTimeSlot = String(job.timeSlot || '시간 미정');
  const safeContactPhone = String(job.contactPhone || '');
  const safeDescription = String(job.description || '');
  const safeWorkDate = formatDate(job.workDate) || '날짜 미정';

  // dateSpecificRequirements 유무 확인
  const hasDateRequirements = job.dateSpecificRequirements && job.dateSpecificRequirements.length > 0;

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

  return (
    <View className="bg-white dark:bg-gray-900">
      {/* 헤더 영역 */}
      <View className="p-4 bg-gray-50 dark:bg-gray-800">
        {/* 뱃지 영역 */}
        <View className="flex-row items-center flex-wrap mb-2">
          {/* 공고 타입 뱃지 (regular 제외) */}
          {job.postingType && job.postingType !== 'regular' && (
            <PostingTypeBadge
              type={job.postingType as PostingType}
              size="sm"
              className="mr-2"
            />
          )}
          {job.isUrgent === true && !job.postingType && (
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

        {/* 역할 태그 (레거시 - dateSpecificRequirements 없을 때만) */}
        {!hasDateRequirements && Array.isArray(job.roles) && job.roles.length > 0 && (
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

        {/* 급여 (v2.0: 역할별 급여 지원) */}
        <RoleSalaryDisplay
          roleSalaries={job.roleSalaries}
          useSameSalary={job.useSameSalary}
          salary={job.salary}
        />
      </View>

      {/* 상세 정보 */}
      <View className="p-4">
        <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">
          근무 정보
        </Text>

        <InfoRow icon="📍" label="근무지" value={getLocationValue()} />

        {/* 날짜별 요구사항 (v2.0) 또는 고정공고 일정 */}
        {job.postingType === 'fixed' ? (
          // 고정공고: FixedScheduleDisplay 사용
          <View className="py-3 border-b border-gray-100 dark:border-gray-700">
            <View className="flex-row items-start">
              <Text className="text-lg mr-3">📅</Text>
              <View className="flex-1">
                <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  근무 일정
                </Text>
                <FixedScheduleDisplay
                  daysPerWeek={job.daysPerWeek}
                  workDays={job.workDays}
                  startTime={job.workSchedule?.timeSlots?.[0] || job.timeSlot?.split(/[-~]/)[0]?.trim()}
                  roles={job.requiredRolesWithCount?.map((r) => ({
                    role: r.role,
                    count: r.count,
                  }))}
                  showRoles={true}
                  showFilledCount={true}
                />
              </View>
            </View>
          </View>
        ) : hasDateRequirements ? (
          <View className="py-3 border-b border-gray-100 dark:border-gray-700">
            <View className="flex-row items-start">
              <Text className="text-lg mr-3">📅</Text>
              <View className="flex-1">
                <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  근무 일정
                </Text>
                {job.dateSpecificRequirements!.map((req, idx) => (
                  <DateRequirementDisplay
                    key={idx}
                    requirement={req}
                    index={idx}
                    showFilledCount={true}
                  />
                ))}
              </View>
            </View>
          </View>
        ) : (
          <>
            <InfoRow icon="📅" label="근무일" value={safeWorkDate} />
            <InfoRow icon="🕐" label="근무시간" value={safeTimeSlot} />
          </>
        )}

        {safeContactPhone.length > 0 && (
          <Pressable onPress={handleCall}>
            <InfoRow icon="📞" label="연락처" value={safeContactPhone} />
          </Pressable>
        )}

        {/* 수당 (v2.0: 개선된 표시) */}
        {allowanceItems.length > 0 && (
          <View className="py-3 border-b border-gray-100 dark:border-gray-700">
            <View className="flex-row items-start">
              <Text className="text-lg mr-3">💰</Text>
              <View className="flex-1">
                <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  추가 수당
                </Text>
                <View className="flex-row flex-wrap">
                  {allowanceItems.map((item, idx) => (
                    <Text key={idx} className="text-sm text-gray-900 dark:text-white mr-3 mb-1">
                      {item}
                    </Text>
                  ))}
                </View>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* 사전질문 미리보기 (v2.0) */}
      {job.usesPreQuestions && job.preQuestions && job.preQuestions.length > 0 && (
        <View className="p-4 border-t border-gray-100 dark:border-gray-700">
          <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            📝 사전질문 ({job.preQuestions.length}개)
          </Text>
          <View className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            {job.preQuestions.slice(0, 3).map((q, idx) => (
              <View key={idx} className="mb-2">
                <Text className="text-sm text-gray-700 dark:text-gray-300">
                  {idx + 1}. {q.question}
                  {q.required && <Text className="text-red-500"> *</Text>}
                </Text>
              </View>
            ))}
            {job.preQuestions.length > 3 && (
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                외 {job.preQuestions.length - 3}개 질문
              </Text>
            )}
          </View>
        </View>
      )}

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
