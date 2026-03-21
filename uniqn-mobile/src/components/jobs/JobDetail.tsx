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
import BubbleScoreBadge from '@/components/review/BubbleScoreBadge';
import { useUserProfile } from '@/hooks/useUserProfile';
import {
  groupRequirementsToDateRanges,
  formatDateRangeWithCount,
  formatDateKoreanWithDay,
} from '@/utils/date';
import type { CardDateRequirement, JobPosting, PostingDetailViewModel, PostingType } from '@/types';
import type { DateSpecificRequirement } from '@/types/jobPosting/dateRequirement';
import { buildPostingFacts, projectPostingSurface } from '@/domains/job-posting';
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

const getDateGroupKey = (startDate: string, endDate: string, index: number): string =>
  `${startDate}-${endDate}-${index}`;

const getTimeSlotKey = (parentKey: string, startTime: string | undefined, index: number): string =>
  `${parentKey}-${startTime || 'tba'}-${index}`;

const getRoleChipKey = (
  parentKey: string,
  role: string | undefined,
  customRole: string | undefined,
  headcount: number,
  index: number
): string => `${parentKey}-${role || 'role'}-${customRole || ''}-${headcount}-${index}`;

/**
 * 날짜 요구사항 그룹화 표시 컴포넌트 (v4.0)
 * - 대회 공고: 연속 날짜 그룹화
 * - 일반/긴급 공고: 개별 표시
 */
function DateRequirementsGroupedDisplay({
  dateRequirements,
  postingType,
}: {
  dateRequirements: CardDateRequirement[];
  postingType?: PostingType;
}) {
  const isTournament = postingType === 'tournament';
  const normalizedRequirements = useMemo(
    () =>
      dateRequirements.map((req) => ({
        date: req.date,
        isGrouped: req.isGrouped,
        timeSlots: req.timeSlots.map((slot) => ({
          id: slot.id,
          startTime: slot.startTime,
          isTimeToBeAnnounced: slot.isTimeToBeAnnounced,
          tentativeDescription: slot.tentativeDescription,
          roles: slot.roles.map((role) => ({
            id: role.id,
            role: role.role,
            customRole: role.customRole,
            headcount: role.count,
            filled: role.filled,
          })),
        })),
      })),
    [dateRequirements]
  );

  // 대회 공고: 연속 날짜 그룹화
  const dateGroups = useMemo(() => {
    if (isTournament) {
      return groupRequirementsToDateRanges(
        normalizedRequirements as unknown as DateSpecificRequirement[]
      );
    }
    return null;
  }, [isTournament, normalizedRequirements]);

  if (isTournament && dateGroups) {
    return (
      <View className="py-3 border-b border-gray-100 dark:border-surface-overlay">
        <View className="flex-row items-start">
          <Text className="text-lg mr-3">📅</Text>
          <View className="flex-1">
            <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">근무 일정</Text>
            {dateGroups.map((group, groupIdx) => (
              <View
                key={getDateGroupKey(group.startDate, group.endDate, groupIdx)}
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
                    <View
                      key={getTimeSlotKey(
                        getDateGroupKey(group.startDate, group.endDate, groupIdx),
                        slot.startTime,
                        slotIdx
                      )}
                      className="ml-2 mb-2"
                    >
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
                              key={getRoleChipKey(
                                getTimeSlotKey(
                                  getDateGroupKey(group.startDate, group.endDate, groupIdx),
                                  slot.startTime,
                                  slotIdx
                                ),
                                role.role,
                                role.customRole,
                                headcount,
                                roleIdx
                              )}
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
          {normalizedRequirements.map((req, idx) => (
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
  const postingFacts = useMemo(() => buildPostingFacts(job), [job]);
  const detail = useMemo(
    () =>
      projectPostingSurface(postingFacts, {
        audience: 'public',
        surface: 'detail',
      }) as PostingDetailViewModel,
    [postingFacts]
  );

  // 구인자 프로필 (버블 점수 표시용)
  const { userProfile: ownerProfile } = useUserProfile({
    userId: detail.ownerId || '',
    enabled: !!detail.ownerId,
  });

  const handleCall = () => {
    if (detail.contactPhone) {
      Linking.openURL(`tel:${detail.contactPhone}`);
    }
  };

  // 안전한 값 추출
  const safeTitle = String(detail.title || '제목 없음');
  const safeTimeSlot = String(detail.timeSlot || '미정');
  const safeContactPhone = String(detail.contactPhone || '');
  const safeDescription = String(detail.description || '');
  const safeWorkDate = formatDateKoreanWithDay(detail.workDate) || '날짜 미정';
  const hasDateRequirements = detail.dateRequirements.length > 0;
  const allowanceItems = detail.allowanceLabels;
  const locationValue = detail.locationLabel || '정보 없음';
  const isFixed = job.schedule.kind === 'fixed';

  return (
    <View className="bg-white dark:bg-surface-dark">
      {/* 헤더 영역 */}
      <View className="p-4 bg-gray-50 dark:bg-surface">
        {/* 뱃지 영역 */}
        <View className="flex-row items-center flex-wrap mb-2">
          {/* 공고 타입 뱃지 (regular 제외) */}
          {detail.postingType && detail.postingType !== 'regular' && (
            <PostingTypeBadge type={detail.postingType as PostingType} size="sm" className="mr-2" />
          )}
          {detail.isUrgent && !detail.postingType && (
            <Badge variant="error" size="sm" className="mr-2">
              긴급
            </Badge>
          )}
          <Badge
            variant={detail.status === STATUS.JOB_POSTING.ACTIVE ? 'success' : 'default'}
            size="sm"
          >
            {detail.status === STATUS.JOB_POSTING.ACTIVE ? '모집중' : '마감'}
          </Badge>
        </View>

        <Text className="text-xl font-bold text-gray-900 dark:text-white mb-3">{safeTitle}</Text>

        {/* 급여 (v2.0: 역할별 급여 지원) */}
        <RoleSalaryDisplay
          roles={postingFacts.posting.roles}
          useSameSalary={detail.useSameSalary}
          defaultSalary={detail.defaultSalary}
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

        <InfoRow icon="📍" label="근무지" value={locationValue} />

        {/* 날짜별 요구사항 (v3.0) 또는 고정공고 일정 */}
        {isFixed ? (
          <View className="py-3 border-b border-gray-100 dark:border-surface-overlay">
            <View className="flex-row items-start">
              <Text className="text-lg mr-3">📅</Text>
              <View className="flex-1">
                <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">근무 일정</Text>
                <FixedScheduleDisplay
                  daysPerWeek={detail.daysPerWeek}
                  startTime={detail.startTime}
                  isStartTimeNegotiable={detail.isStartTimeNegotiable}
                  roles={detail.requiredRolesWithCount?.map((r) => ({
                    role: r.role,
                    name: r.name,
                    count: r.count,
                    filled: r.filled,
                  }))}
                  showRoles={true}
                  showFilledCount={true}
                />
              </View>
            </View>
          </View>
        ) : hasDateRequirements ? (
          <DateRequirementsGroupedDisplay
            dateRequirements={detail.dateRequirements}
            postingType={detail.postingType}
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

        {detail.taxLabel && <InfoRow icon="💸" label="세금" value={detail.taxLabel} />}
      </View>

      {/* 사전질문 미리보기 (v2.0) */}
      {detail.questions.length > 0 && (
        <View className="p-4 border-t border-gray-100 dark:border-surface-overlay">
          <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            📝 사전질문 ({detail.questions.length}개)
          </Text>
          <View className="bg-gray-50 dark:bg-surface rounded-lg p-3">
            {detail.questions.slice(0, 3).map((q, idx) => (
              <View key={idx} className="mb-2">
                <Text className="text-sm text-gray-700 dark:text-gray-300">
                  {idx + 1}. {q.question}
                  {q.required && <Text className="text-red-500"> *</Text>}
                </Text>
              </View>
            ))}
            {detail.questions.length > 3 && (
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                외 {detail.questions.length - 3}개 질문
              </Text>
            )}
          </View>
        </View>
      )}

      {/* 구인자 정보 + 버블 점수 */}
      {(detail.ownerName || ownerProfile?.bubbleScore) && (
        <View className="p-4 border-t border-gray-100 dark:border-surface-overlay">
          <View className="flex-row items-center">
            <Text className="text-lg mr-3">👤</Text>
            <View className="flex-1">
              <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">구인자</Text>
              <View className="flex-row items-center gap-2">
                <Text className="text-sm text-gray-900 dark:text-white">
                  {detail.ownerName ?? '구인자'}
                </Text>
                {ownerProfile?.bubbleScore && (
                  <BubbleScoreBadge score={ownerProfile.bubbleScore.score} size="sm" />
                )}
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 통계 */}
      {(typeof detail.viewCount === 'number' || typeof detail.applicationCount === 'number') && (
        <View className="p-4 border-t border-gray-100 dark:border-surface-overlay">
          <View className="flex-row">
            {typeof detail.viewCount === 'number' && (
              <Text className="text-xs text-gray-400 dark:text-gray-500 mr-4">
                {`👁 조회 ${detail.viewCount}`}
              </Text>
            )}
            {typeof detail.applicationCount === 'number' && (
              <Text className="text-xs text-gray-400 dark:text-gray-500">
                {`👤 지원 ${detail.applicationCount}`}
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

export default JobDetail;
