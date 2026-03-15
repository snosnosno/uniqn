/**
 * UNIQN Mobile - 구인공고 카드 컴포넌트
 *
 * @description 공고 목록에서 사용하는 간략한 정보 카드
 * @version 3.0.0 - 연속 날짜 그룹화 지원
 */

import React, { memo, useCallback, useMemo } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { HeartFilledIcon, HeartOutlineIcon } from '@/components/icons';
import { PostingTypeBadge } from './PostingTypeBadge';
import { FixedScheduleDisplay } from './FixedScheduleDisplay';
import {
  groupRequirementsToDateRanges,
  formatDateRangeWithCount,
  formatDateShortWithDay,
} from '@/utils/date';
import type { JobPostingCard, PostingType, CardRole, SalaryInfo } from '@/types';
import type { DateSpecificRequirement } from '@/types/jobPosting/dateRequirement';
import { getRoleDisplayName } from '@/types/unified';
import { useBookmarks } from '@/hooks/useBookmarks';
import { HIT_SLOP } from '@/constants';
import { SCHEDULE_STATUS } from '@/constants/statusConfig';

// ============================================================================
// Types
// ============================================================================

/** 지원 상태 타입 (스케줄 탭에서 사용) */
export type ApplicationStatusType = 'applied' | 'confirmed' | 'completed' | 'cancelled';

interface JobCardProps {
  job: JobPostingCard;
  onPress: (jobId: string) => void;
  /** 지원 상태 (스케줄 탭에서만 전달, 구인구직 탭에서는 미사용) */
  applicationStatus?: ApplicationStatusType;
}

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

const getDateGroupKey = (startDate: string, endDate: string, index: number): string =>
  `${startDate}-${endDate}-${index}`;

const getDateRequirementKey = (date: string, index: number): string => `${date}-${index}`;

const getTimeSlotKey = (parentKey: string, startTime: string | undefined, index: number): string =>
  `${parentKey}-${startTime || 'tba'}-${index}`;

const getRoleKey = (
  parentKey: string,
  role: string | undefined,
  customRole: string | undefined,
  count: number,
  index: number
): string => `${parentKey}-${role || 'role'}-${customRole || ''}-${count}-${index}`;

// ============================================================================
// Sub Components
// ============================================================================

/**
 * 날짜 요구사항 표시 컴포넌트 (연속 날짜 그룹화 지원)
 * CardDateRequirement[]와 DateSpecificRequirement[] 모두 지원
 */
const DateRequirementsDisplay = memo(function DateRequirementsDisplay({
  dateRequirements,
  postingType,
}: {
  dateRequirements: JobPostingCard['dateRequirements'];
  postingType?: PostingType;
}) {
  // 대회 공고인 경우 연속 날짜 그룹화
  const isTournament = postingType === 'tournament';
  const dateGroups = useMemo(() => {
    if (isTournament && dateRequirements) {
      // CardDateRequirement를 DateSpecificRequirement로 변환
      const normalized = dateRequirements.map((req) => ({
        date: req.date,
        isGrouped: req.isGrouped,
        timeSlots: req.timeSlots.map((slot) => ({
          ...slot,
          roles: slot.roles.map((r) => ({
            role: r.role,
            customRole: r.customRole,
            headcount: r.count,
            filled: r.filled,
          })),
        })),
      })) as DateSpecificRequirement[];
      return groupRequirementsToDateRanges(normalized);
    }
    return null;
  }, [isTournament, dateRequirements]);

  // 대회 공고: 그룹화된 날짜 표시
  if (isTournament && dateGroups) {
    return (
      <>
        {dateGroups.map((group, groupIdx) => {
          const groupKey = getDateGroupKey(group.startDate, group.endDate, groupIdx);

          return (
            <View key={groupKey} className="mb-2">
              {/* 날짜 범위 표시 */}
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                📅 {formatDateRangeWithCount(group.startDate, group.endDate)}
              </Text>

              {/* 시간대별 */}
              {group.timeSlots.map((slot, slotIdx) => {
                const displayTime = slot.isTimeToBeAnnounced ? '미정' : slot.startTime || '-';

                return (
                  <View
                    key={getTimeSlotKey(groupKey, slot.startTime, slotIdx)}
                    className="ml-5 mt-1"
                  >
                    {slot.roles.map((role, roleIdx) => {
                      // RoleRequirement → CardRole-like 변환
                      const cardRole: CardRole = {
                        role: role.role ?? '',
                        customRole: role.customRole,
                        count: role.headcount ?? 0,
                        filled: role.filled ?? 0,
                      };
                      return (
                        <RoleLine
                          key={getRoleKey(
                            getTimeSlotKey(groupKey, slot.startTime, slotIdx),
                            cardRole.role,
                            cardRole.customRole,
                            cardRole.count,
                            roleIdx
                          )}
                          role={cardRole}
                          showTime={roleIdx === 0}
                          time={displayTime}
                        />
                      );
                    })}
                  </View>
                );
              })}
            </View>
          );
        })}
      </>
    );
  }

  // 일반/긴급 공고: 개별 날짜 표시
  return (
    <>
      {dateRequirements?.map((dateReq, dateIdx) => (
        <View
          key={getDateRequirementKey(typeof dateReq.date === 'string' ? dateReq.date : '', dateIdx)}
          className="mb-2"
        >
          {/* 날짜 */}
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
            📅 {formatDateShortWithDay(typeof dateReq.date === 'string' ? dateReq.date : '')}
          </Text>

          {/* 시간대별 */}
          {dateReq.timeSlots.map((slot, slotIdx) => {
            const displayTime = slot.isTimeToBeAnnounced ? '미정' : slot.startTime || '-';

            return (
              <View
                key={getTimeSlotKey(
                  getDateRequirementKey(
                    typeof dateReq.date === 'string' ? dateReq.date : '',
                    dateIdx
                  ),
                  slot.startTime,
                  slotIdx
                )}
                className="ml-5 mt-1"
              >
                {slot.roles.map((role, roleIdx) => (
                  <RoleLine
                    key={getRoleKey(
                      getTimeSlotKey(
                        getDateRequirementKey(
                          typeof dateReq.date === 'string' ? dateReq.date : '',
                          dateIdx
                        ),
                        slot.startTime,
                        slotIdx
                      ),
                      role.role,
                      role.customRole,
                      role.count,
                      roleIdx
                    )}
                    role={role}
                    showTime={roleIdx === 0}
                    time={displayTime}
                  />
                ))}
              </View>
            );
          })}
        </View>
      ))}
    </>
  );
});

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
      {getRoleDisplayName(role.role, role.customRole)} {role.count}명 ({role.filled}/{role.count})
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
export const JobCard = memo(function JobCard({ job, onPress, applicationStatus }: JobCardProps) {
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const bookmarked = isBookmarked(job.id);

  const handlePress = useCallback(() => {
    onPress(job.id);
  }, [job.id, onPress]);

  const handleBookmarkPress = useCallback(() => {
    toggleBookmark({
      id: job.id,
      title: job.title,
      location: job.fullLocation || job.location,
      workDate: job.workDate,
    });
  }, [job.id, job.title, job.fullLocation, job.location, job.workDate, toggleBookmark]);

  // 역할에서 급여 정보 추출 (메모이제이션 적용)
  const rolesWithSalary = useMemo(() => {
    return job.salaryRows ?? [];
  }, [job.salaryRows]);

  // 표시할 급여 결정
  const displaySalary: SalaryInfo = job.defaultSalary ??
    rolesWithSalary[0]?.salary ?? { type: 'hourly', amount: 0 };

  // 접근성을 위한 설명 텍스트 생성
  const accessibilityLabel = `${job.title}, ${job.location}, ${formatDateShortWithDay(job.workDate)}, ${formatSalary(displaySalary.type, displaySalary.amount)}`;

  const allowanceItems = job.allowanceLabels ?? [];

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="탭하면 공고 상세 페이지로 이동합니다"
      className="bg-white dark:bg-surface rounded-xl p-4 mb-3 border border-gray-100 dark:border-surface-overlay active:opacity-80"
    >
      {/* 지원 상태 뱃지 (스케줄 탭에서만 표시) */}
      {applicationStatus && (
        <View className="mb-2">
          <Badge variant={SCHEDULE_STATUS[applicationStatus].variant} dot>
            {SCHEDULE_STATUS[applicationStatus].label}
          </Badge>
        </View>
      )}

      {/* 상단: 공고타입 + 승인상태 + 긴급 + 제목 + 북마크 */}
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1 flex-row items-center flex-wrap">
          {/* 공고 타입 뱃지 (regular는 표시 안 함) */}
          {job.postingType && job.postingType !== 'regular' && (
            <PostingTypeBadge type={job.postingType as PostingType} size="sm" className="mr-2" />
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
        {/* 북마크 버튼 - 웹에서 button 중첩 방지를 위해 View 사용 */}
        {Platform.OS === 'web' ? (
          <View
            // @ts-expect-error - React Native Web supports onClick on View
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              handleBookmarkPress();
            }}
            className="ml-2 p-1"
            style={{ cursor: 'pointer' }}
            accessibilityLabel={bookmarked ? '북마크 해제' : '북마크 추가'}
          >
            {bookmarked ? (
              <HeartFilledIcon size={22} color="#EF4444" />
            ) : (
              <HeartOutlineIcon size={22} />
            )}
          </View>
        ) : (
          <Pressable
            onPress={handleBookmarkPress}
            hitSlop={HIT_SLOP.medium}
            className="ml-2 p-1"
            accessibilityLabel={bookmarked ? '북마크 해제' : '북마크 추가'}
            accessibilityRole="button"
          >
            {bookmarked ? (
              <HeartFilledIcon size={22} color="#EF4444" />
            ) : (
              <HeartOutlineIcon size={22} />
            )}
          </Pressable>
        )}
      </View>

      {/* 장소 */}
      <Text className="text-sm text-gray-500 dark:text-gray-400 mb-2">📍 {job.location}</Text>

      {/* 일정 + 급여/수당 그리드 */}
      <View className="flex-row">
        {/* 왼쪽: 일정 */}
        <View className="flex-1 pr-3">
          {job.postingType === 'fixed' ? (
            // 고정공고: FixedScheduleDisplay 사용
            <FixedScheduleDisplay
              daysPerWeek={job.daysPerWeek}
              startTime={job.startTime || job.timeSlot?.split(/[-~]/)[0]?.trim()}
              compact={true}
            />
          ) : job.dateRequirements && job.dateRequirements.length > 0 ? (
            <DateRequirementsDisplay
              dateRequirements={job.dateRequirements}
              postingType={job.postingType}
            />
          ) : (
            // 레거시 폴백
            <View className="mb-2">
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                📅 {formatDateShortWithDay(job.workDate)}
              </Text>
              <Text className="text-sm text-gray-900 dark:text-gray-100 ml-5 mt-1">
                🕐 {job.timeSlot || '-'}
              </Text>
            </View>
          )}
        </View>

        {/* 오른쪽: 급여 + 수당 */}
        <View className="flex-1 pl-3 border-l border-gray-100 dark:border-surface-overlay">
          {/* 급여 */}
          {!job.useSameSalary && rolesWithSalary.length > 0 ? (
            // 역할별 급여 표시 (useSameSalary === false && 역할별 급여 존재)
            rolesWithSalary.map((roleData, idx) => {
              const roleLabel = roleData.roleLabel || getRoleDisplayName(roleData.role);
              return (
                <Text key={idx} className="text-sm text-gray-900 dark:text-white">
                  💰 {roleLabel}: {roleData.text}
                </Text>
              );
            })
          ) : (
            // 단일 급여 표시 (useSameSalary === true 또는 역할별 급여 없음)
            <Text className="text-sm font-medium text-gray-900 dark:text-white">
              💰{' '}
              {displaySalary.type === 'other'
                ? '협의'
                : formatSalary(displaySalary.type, displaySalary.amount)}
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

          {/* 세금 */}
          {job.taxLabel && (
            <Text className="text-xs text-gray-400 dark:text-gray-500 mt-1">💸 {job.taxLabel}</Text>
          )}

          {job.salaryOverflowCount > 0 && (
            <Text className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              +{job.salaryOverflowCount}개 역할 급여 더 있음
            </Text>
          )}
        </View>
      </View>

      {/* 하단: 구인자 이름 */}
      {job.ownerName && (
        <View className="mt-2 pt-2 border-t border-gray-100 dark:border-surface-overlay">
          <Text className="text-xs text-gray-500 dark:text-gray-400">구인자: {job.ownerName}</Text>
        </View>
      )}
    </Pressable>
  );
});

export default JobCard;
