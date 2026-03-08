/**
 * UNIQN Mobile - 공고 카드 컴포넌트
 *
 * @description employer 탭에서 공고 목록에 표시되는 카드
 * @version 1.0.0
 */

import React, { useMemo, memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PostingTypeBadge } from '@/components/jobs/PostingTypeBadge';
import { TournamentStatusBadge } from '@/components/jobs/TournamentStatusBadge';
import { FixedScheduleDisplay } from '@/components/jobs/FixedScheduleDisplay';
import { UsersIcon, QrCodeIcon } from '@/components/icons';
import { getRoleDisplayName } from '@/types/unified/role';
import { getDateString } from '@/types/jobPosting/dateRequirement';
import { formatSalary } from '@/utils/formatters';
import { getAllowanceItems } from '@/utils/allowanceUtils';
import { formatDateShortWithDay } from '@/utils/date';
import { groupRequirementsToDateRanges, formatDateRangeWithCount } from '@/utils/date';
import { STATUS } from '@/constants';
import type { DateSpecificRequirement } from '@/types/jobPosting/dateRequirement';
import type { JobPosting, PostingType, TournamentApprovalStatus } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface JobPostingCardProps {
  posting: JobPosting;
  onPress: (posting: JobPosting) => void;
  onClose: (postingId: string) => void;
  onReopen: (postingId: string) => void;
  onShowQR: (posting: JobPosting) => void;
  isClosing: boolean;
  isReopening: boolean;
}

interface RoleData {
  role?: string;
  name?: string;
  customRole?: string;
  headcount?: number;
  count?: number;
  filled?: number;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * 시작/종료 날짜 사이의 날짜 수를 반환
 */
function getDayCount(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 1;
  }

  const diffTime = end.getTime() - start.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

// ============================================================================
// Sub-components
// ============================================================================

const RoleLine = memo(function RoleLine({
  role,
  showTime,
  time,
}: {
  role: RoleData;
  showTime: boolean;
  time: string;
}) {
  const roleName = role.role || role.name || '';
  const count = role.headcount || role.count || 0;
  const filled = role.filled ?? 0;

  return (
    <Text className="text-sm text-gray-900 dark:text-gray-100">
      {showTime ? `${time} ` : '       '}
      {getRoleDisplayName(roleName, role.customRole)} {count}명 ({filled}/{count})
    </Text>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export const JobPostingCard = memo(function JobPostingCard({
  posting,
  onPress,
  onClose,
  onReopen,
  onShowQR,
  isClosing,
  isReopening,
}: JobPostingCardProps) {
  const statusConfig = {
    active: { label: '모집중', variant: 'success' as const },
    closed: { label: '마감', variant: 'default' as const },
    cancelled: { label: '취소됨', variant: 'error' as const },
  };

  const status = statusConfig[posting.status] || statusConfig.active;
  const allowanceItems = getAllowanceItems(posting.allowances, { includeEmoji: true });

  // dateSpecificRequirements를 그룹화된 형태로 변환
  const groupedDateRequirements = useMemo(() => {
    const reqs = posting.dateSpecificRequirements ?? [];
    if (reqs.length === 0) return [];

    // DateSpecificRequirement 형태로 변환
    const converted: DateSpecificRequirement[] = reqs.map((req) => ({
      date: getDateString(req.date),
      isGrouped: req.isGrouped,
      timeSlots: (req.timeSlots ?? []).map((ts) => ({
        startTime:
          (ts as { startTime?: string; time?: string }).startTime ||
          (ts as { startTime?: string; time?: string }).time ||
          '',
        isTimeToBeAnnounced: (ts as { isTimeToBeAnnounced?: boolean }).isTimeToBeAnnounced ?? false,
        roles: ts.roles ?? [],
      })),
    }));

    // 그룹화
    const groups = groupRequirementsToDateRanges(converted);

    // 각 그룹에 추가 정보 계산
    return groups.map((group) => {
      const firstTimeSlot = group.timeSlots[0];
      const displayTime = firstTimeSlot?.isTimeToBeAnnounced
        ? '미정'
        : firstTimeSlot?.startTime || '-';

      return {
        ...group,
        displayTime,
        dayCount: getDayCount(group.startDate, group.endDate),
      };
    });
  }, [posting.dateSpecificRequirements]);

  return (
    <Card variant="elevated" padding="md" className="mx-4 mb-3">
      {/* 클릭 가능한 상단 영역 (제목, 위치, 일정, 급여) */}
      <Pressable
        onPress={() => onPress(posting)}
        accessibilityLabel={`${posting.title} 공고 상세보기`}
        accessibilityRole="button"
      >
        {/* 상단: 공고타입 + 긴급 + 제목 */}
        <View className="mb-2 flex-row items-start justify-between">
          <View className="flex-1 flex-row items-center flex-wrap">
            {posting.postingType && posting.postingType !== 'regular' && (
              <PostingTypeBadge
                type={posting.postingType as PostingType}
                size="sm"
                className="mr-2"
              />
            )}
            {posting.isUrgent && (
              <Badge variant="error" size="sm" className="mr-2">
                긴급
              </Badge>
            )}
            <Text
              className="text-base font-semibold text-gray-900 dark:text-white flex-1"
              numberOfLines={1}
            >
              {posting.title}
            </Text>
          </View>
        </View>

        {/* 장소 */}
        <Text className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          📍 {posting.location.name}
        </Text>

        {/* 일정 + 급여/수당 그리드 */}
        <View className="flex-row">
          {/* 왼쪽: 일정 */}
          <View className="flex-1 pr-3">
            {posting.postingType === 'fixed' ? (
              // 고정공고: FixedScheduleDisplay 사용
              <FixedScheduleDisplay
                daysPerWeek={posting.daysPerWeek}
                startTime={posting.timeSlot?.split(/[-~]/)[0]?.trim()}
                compact={true}
              />
            ) : groupedDateRequirements.length > 0 ? (
              groupedDateRequirements.map((group, groupIdx) => {
                const isSingleDay = group.dayCount === 1;
                const dateDisplay = isSingleDay
                  ? formatDateShortWithDay(group.startDate)
                  : formatDateRangeWithCount(group.startDate, group.endDate);

                return (
                  <View key={group.id || groupIdx} className="mb-2">
                    {/* 날짜 범위 */}
                    <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      📅 {dateDisplay}
                    </Text>

                    {/* 시간 + 역할 (첫 번째 timeSlot 기준) */}
                    <View className="ml-5 mt-1">
                      {group.timeSlots[0]?.roles.map((role: RoleData, roleIdx: number) => (
                        <RoleLine
                          key={roleIdx}
                          role={role}
                          showTime={roleIdx === 0}
                          time={group.displayTime}
                        />
                      ))}
                    </View>
                  </View>
                );
              })
            ) : (
              // 레거시 폴백
              <View className="mb-2">
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  📅 {formatDateShortWithDay(posting.workDate)}
                </Text>
                <Text className="text-sm text-gray-900 dark:text-gray-100 ml-5 mt-1">
                  🕐 {posting.timeSlot || '-'}
                </Text>
              </View>
            )}
          </View>

          {/* 오른쪽: 급여 + 수당 */}
          <View className="flex-1 pl-3 border-l border-gray-100 dark:border-surface-overlay">
            {/* 급여 - v2.0: roles[].salary 구조 */}
            {!posting.useSameSalary && posting.roles?.some((r) => r.salary) ? (
              // 역할별 급여 표시
              posting.roles
                .filter((r) => r.salary)
                .map((r, idx) => (
                  <Text key={idx} className="text-sm text-gray-900 dark:text-white">
                    💰 {getRoleDisplayName(r.role, (r as { customRole?: string }).customRole)}:{' '}
                    {r.salary?.type === 'other'
                      ? '협의'
                      : formatSalary(r.salary?.type || 'hourly', r.salary?.amount || 0)}
                  </Text>
                ))
            ) : (
              // 단일 급여 표시 (useSameSalary 또는 defaultSalary)
              <Text className="text-sm font-medium text-gray-900 dark:text-white">
                💰{' '}
                {formatSalary(
                  posting.defaultSalary?.type || posting.roles?.[0]?.salary?.type || 'hourly',
                  posting.defaultSalary?.amount || posting.roles?.[0]?.salary?.amount || 0
                )}
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
      </Pressable>

      {/* 하단: 지원자 수 + QR/상태/액션 버튼 (별도 영역으로 분리) */}
      <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-surface-overlay">
        <View className="flex-row items-center">
          <UsersIcon size={14} color="#9333EA" />
          <Text className="ml-1 text-xs text-gray-600 dark:text-gray-400">
            지원 {posting.applicationCount || 0}
          </Text>
        </View>

        {/* QR + 상태 뱃지 + 마감/재오픈 버튼 */}
        <View className="flex-row items-center gap-2">
          {/* QR 버튼 */}
          <Pressable
            onPress={() => onShowQR(posting)}
            className="p-1.5 active:opacity-70"
            accessibilityLabel="현장 QR 표시"
            accessibilityRole="button"
          >
            <QrCodeIcon size={18} color="#9333EA" />
          </Pressable>
          {posting.postingType === 'tournament' && posting.tournamentConfig?.approvalStatus && (
            <TournamentStatusBadge
              status={posting.tournamentConfig.approvalStatus as TournamentApprovalStatus}
              rejectionReason={posting.tournamentConfig.rejectionReason}
              postingId={posting.id}
              size="sm"
            />
          )}
          <Badge variant={status.variant} size="sm">
            {status.label}
          </Badge>
          {posting.status === STATUS.JOB_POSTING.ACTIVE && (
            <Pressable
              onPress={() => onClose(posting.id)}
              disabled={isClosing}
              className="px-3 py-1.5 bg-gray-100 dark:bg-surface rounded-md active:opacity-70"
              accessibilityLabel={`${posting.title} 공고 마감하기`}
              accessibilityRole="button"
              accessibilityState={{ disabled: isClosing }}
            >
              <Text className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {isClosing ? '처리중...' : '마감하기'}
              </Text>
            </Pressable>
          )}
          {posting.status === STATUS.JOB_POSTING.CLOSED && (
            <Pressable
              onPress={() => onReopen(posting.id)}
              disabled={isReopening}
              className="px-3 py-1.5 bg-primary-50 dark:bg-primary-900/30 rounded-md active:opacity-70"
              accessibilityLabel={`${posting.title} 공고 재오픈하기`}
              accessibilityRole="button"
              accessibilityState={{ disabled: isReopening }}
            >
              <Text className="text-xs font-medium text-primary-600 dark:text-primary-400">
                {isReopening ? '처리중...' : '재오픈'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Card>
  );
});
