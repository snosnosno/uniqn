/**
 * UNIQN Mobile - 구인공고 상세 컴포넌트
 *
 * @description 공고 상세 정보 표시 (v4.0 - 연속 날짜 그룹화 지원)
 * @version 4.0.0
 */

import React, { useMemo } from 'react';
import { View, Text, Linking, Pressable } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { PostingTypeBadge } from './PostingTypeBadge';
import { DateRequirementDisplay } from './DateRequirementDisplay';
import { FixedScheduleDisplay } from './FixedScheduleDisplay';
import { RoleSalaryDisplay } from './RoleSalaryDisplay';
import { useJobSchedule } from '@/hooks';
import { groupRequirementsToDateRanges, formatDateRangeWithCount } from '@/utils/dateRangeUtils';
import type { JobPosting, PostingType } from '@/types';
import type { DateSpecificRequirement } from '@/types/jobPosting/dateRequirement';
import { getAllowanceItems } from '@/utils/allowanceUtils';
import { formatDateKoreanWithDay } from '@/utils/dateUtils';
import { getRoleDisplayName } from '@/types/unified';
import { STATUS } from '@/constants';

// ============================================================================
// Types
// ============================================================================

interface JobDetailProps {
  job: JobPosting;
}

// ============================================================================
// Sub Components
// ============================================================================

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | React.ReactNode;
  icon: string;
}) {
  return (
    <View className="flex-row items-start py-3 border-b border-gray-100 dark:border-surface-overlay">
      <Text className="text-lg mr-3">{icon}</Text>
      <View className="flex-1">
        <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</Text>
        {typeof value === 'string' ? (
          <Text className="text-sm text-gray-900 dark:text-white">{value}</Text>
        ) : (
          value
        )}
      </View>
    </View>
  );
}

/**
 * 날짜 요구사항 그룹화 표시 컴포넌트 (v4.0)
 * - 대회 공고: 연속 날짜 그룹화
 * - 일반/긴급 공고: 개별 표시
 */
function DateRequirementsGroupedDisplay({
  dateRequirements,
  postingType,
}: {
  dateRequirements: DateSpecificRequirement[];
  postingType?: PostingType;
}) {
  const isTournament = postingType === 'tournament';

  // 대회 공고: 연속 날짜 그룹화
  const dateGroups = useMemo(() => {
    if (isTournament) {
      return groupRequirementsToDateRanges(dateRequirements);
    }
    return null;
  }, [isTournament, dateRequirements]);

  if (isTournament && dateGroups) {
    return (
      <View className="py-3 border-b border-gray-100 dark:border-surface-overlay">
        <View className="flex-row items-start">
          <Text className="text-lg mr-3">📅</Text>
          <View className="flex-1">
            <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">근무 일정</Text>
            {dateGroups.map((group, groupIdx) => (
              <View
                key={group.id || groupIdx}
                className="mb-3 p-3 bg-gray-50 dark:bg-surface rounded-lg"
              >
                {/* 날짜 범위 */}
                <Text className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  {formatDateRangeWithCount(group.startDate, group.endDate)}
                </Text>

                {/* 시간대별 */}
                {group.timeSlots.map((slot, slotIdx) => {
                  const displayTime = slot.isTimeToBeAnnounced
                    ? '시간 미정'
                    : slot.startTime || '-';

                  return (
                    <View key={slot.id || slotIdx} className="ml-2 mb-2">
                      <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {displayTime}
                      </Text>
                      <View className="flex-row flex-wrap">
                        {slot.roles.map((role, roleIdx) => {
                          const roleName = getRoleDisplayName(role.role ?? '', role.customRole);
                          const headcount = role.headcount ?? 0;
                          const filled = role.filled ?? 0;
                          const isFilled = filled >= headcount && headcount > 0;

                          return (
                            <View
                              key={role.id || roleIdx}
                              className={`mr-2 mb-1 px-2 py-1 rounded-md ${
                                isFilled
                                  ? 'bg-gray-200 dark:bg-surface'
                                  : 'bg-primary-100 dark:bg-primary-900/30'
                              }`}
                            >
                              <Text
                                className={`text-xs ${
                                  isFilled
                                    ? 'text-gray-500 dark:text-gray-400 line-through'
                                    : 'text-primary-700 dark:text-primary-300'
                                }`}
                              >
                                {roleName} {headcount}명 ({filled}/{headcount})
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  // 일반/긴급 공고: 개별 표시
  return (
    <View className="py-3 border-b border-gray-100 dark:border-surface-overlay">
      <View className="flex-row items-start">
        <Text className="text-lg mr-3">📅</Text>
        <View className="flex-1">
          <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">근무 일정</Text>
          {dateRequirements.map((req, idx) => (
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
  );
}

// ============================================================================
// Component
// ============================================================================

export function JobDetail({ job }: JobDetailProps) {
  // v3.0: 통합 타입 Hook 사용
  const { isFixed, isDated, fixedSchedule } = useJobSchedule(job);

  const handleCall = () => {
    if (job.contactPhone) {
      Linking.openURL(`tel:${job.contactPhone}`);
    }
  };

  // 수당 정보 (v2.0)
  const allowanceItems = useMemo(
    () => getAllowanceItems(job.allowances, { includeEmoji: true }),
    [job.allowances]
  );

  // 안전한 값 추출
  const safeTitle = String(job.title || '제목 없음');
  const safeTimeSlot = String(job.timeSlot || '미정');
  const safeContactPhone = String(job.contactPhone || '');
  const safeDescription = String(job.description || '');
  const safeWorkDate = formatDateKoreanWithDay(job.workDate) || '날짜 미정';

  // v3.0: isDated로 dateRequirements 유무 확인 (레거시 폴백 포함)
  const hasDateRequirements = isDated && (job.dateSpecificRequirements?.length ?? 0) > 0;

  // location 안전하게 처리
  const getLocationValue = (): string => {
    if (!job.location) return '정보 없음';
    const locationName = typeof job.location === 'string' ? job.location : job.location?.name || '';
    const address = job.detailedAddress ? ` ${job.detailedAddress}` : '';
    const result = `${locationName}${address}`.trim();
    return result || '정보 없음';
  };

  return (
    <View className="bg-white dark:bg-surface-dark">
      {/* 헤더 영역 */}
      <View className="p-4 bg-gray-50 dark:bg-surface">
        {/* 뱃지 영역 */}
        <View className="flex-row items-center flex-wrap mb-2">
          {/* 공고 타입 뱃지 (regular 제외) */}
          {job.postingType && job.postingType !== 'regular' && (
            <PostingTypeBadge type={job.postingType as PostingType} size="sm" className="mr-2" />
          )}
          {job.isUrgent === true && !job.postingType && (
            <Badge variant="error" size="sm" className="mr-2">
              긴급
            </Badge>
          )}
          <Badge variant={job.status === STATUS.JOB_POSTING.ACTIVE ? 'success' : 'default'} size="sm">
            {job.status === STATUS.JOB_POSTING.ACTIVE ? '모집중' : '마감'}
          </Badge>
        </View>

        <Text className="text-xl font-bold text-gray-900 dark:text-white mb-3">{safeTitle}</Text>

        {/* 급여 (v2.0: 역할별 급여 지원) */}
        <RoleSalaryDisplay
          roles={job.roles}
          useSameSalary={job.useSameSalary}
          defaultSalary={job.defaultSalary}
        />
      </View>

      {/* 상세 설명 */}
      {safeDescription.length > 0 && (
        <View className="p-4">
          <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            상세 설명
          </Text>
          <Text className="text-sm text-gray-600 dark:text-gray-300 leading-6">
            {safeDescription}
          </Text>
        </View>
      )}

      {/* 근무 정보 */}
      <View className="p-4 border-t border-gray-100 dark:border-surface-overlay">
        <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">
          근무 정보
        </Text>

        <InfoRow icon="📍" label="근무지" value={getLocationValue()} />

        {/* 날짜별 요구사항 (v3.0) 또는 고정공고 일정 */}
        {isFixed && fixedSchedule ? (
          // 고정공고: FixedScheduleDisplay 사용 (v3.0: fixedSchedule에서 데이터 추출)
          <View className="py-3 border-b border-gray-100 dark:border-surface-overlay">
            <View className="flex-row items-start">
              <Text className="text-lg mr-3">📅</Text>
              <View className="flex-1">
                <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">근무 일정</Text>
                <FixedScheduleDisplay
                  daysPerWeek={fixedSchedule.daysPerWeek}
                  startTime={fixedSchedule.startTime ?? undefined}
                  isStartTimeNegotiable={fixedSchedule.isStartTimeNegotiable}
                  roles={fixedSchedule.roles.map((r) => ({
                    role: r.roleId,
                    name: r.displayName,
                    count: r.requiredCount,
                    filled: r.filledCount,
                  }))}
                  showRoles={true}
                  showFilledCount={true}
                />
              </View>
            </View>
          </View>
        ) : hasDateRequirements ? (
          <DateRequirementsGroupedDisplay
            dateRequirements={job.dateSpecificRequirements!}
            postingType={job.postingType}
          />
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
          <View className="py-3 border-b border-gray-100 dark:border-surface-overlay">
            <View className="flex-row items-start">
              <Text className="text-lg mr-3">💰</Text>
              <View className="flex-1">
                <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">추가 수당</Text>
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
        <View className="p-4 border-t border-gray-100 dark:border-surface-overlay">
          <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            📝 사전질문 ({job.preQuestions.length}개)
          </Text>
          <View className="bg-gray-50 dark:bg-surface rounded-lg p-3">
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

      {/* 통계 */}
      {(typeof job.viewCount === 'number' || typeof job.applicationCount === 'number') && (
        <View className="p-4 border-t border-gray-100 dark:border-surface-overlay">
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
