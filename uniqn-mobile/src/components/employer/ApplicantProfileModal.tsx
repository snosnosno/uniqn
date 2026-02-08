/**
 * UNIQN Mobile - 지원자 프로필 상세보기 모달
 *
 * @description 지원자의 상세 프로필 정보를 표시하는 모달
 * @version 1.1.0 - 사용자 프로필 정보 연동
 */

import React, { useMemo } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { SheetModal } from '../ui/SheetModal';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import {
  PhoneIcon,
  MailIcon,
  CalendarIcon,
  ClockIcon,
  BriefcaseIcon,
  MessageIcon,
  DocumentIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserIcon,
  MapPinIcon,
  StarIcon,
} from '../icons';
import { APPLICATION_STATUS_LABELS, getAssignmentRoles } from '@/types';
import { getRoleDisplayName } from '@/types/unified';
import { formatRelativeTime } from '@/utils/dateUtils';
import { useUserProfile } from '@/hooks/useUserProfile';
import type { ApplicantWithDetails } from '@/services';
import type { ApplicationStatus, Assignment } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface ApplicantProfileModalProps {
  visible: boolean;
  onClose: () => void;
  applicant: ApplicantWithDetails | null;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_BADGE_VARIANT: Record<
  ApplicationStatus,
  'default' | 'primary' | 'success' | 'warning' | 'error'
> = {
  applied: 'primary',
  pending: 'warning',
  confirmed: 'success',
  rejected: 'error',
  cancelled: 'default',
  completed: 'success',
  cancellation_pending: 'warning',
};

const GENDER_LABELS: Record<string, string> = {
  male: '남성',
  female: '여성',
  other: '기타',
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${year}.${month}.${day}(${dayOfWeek})`;
};

// ============================================================================
// Sub-components
// ============================================================================

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <View className="flex-row items-start py-3 border-b border-gray-100 dark:border-surface-overlay">
      <View className="w-6 mt-0.5">{icon}</View>
      <View className="flex-1 ml-2">
        <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</Text>
        <Text className="text-sm text-gray-900 dark:text-white">{value}</Text>
      </View>
    </View>
  );
}

interface GridInfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function GridInfoItem({ icon, label, value }: GridInfoItemProps) {
  return (
    <View className="flex-row items-center p-3 bg-gray-50 dark:bg-surface rounded-lg">
      <View className="w-8 h-8 rounded-full bg-gray-100 dark:bg-surface items-center justify-center mr-2">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-xs text-gray-500 dark:text-gray-400">{label}</Text>
        <Text className="text-sm font-medium text-gray-900 dark:text-white">{value}</Text>
      </View>
    </View>
  );
}

interface AssignmentDisplayProps {
  assignments: Assignment[];
}

function AssignmentDisplay({ assignments }: AssignmentDisplayProps) {
  const groupedByDate = useMemo(() => {
    const grouped: Record<string, { timeSlot: string; roles: string[] }[]> = {};

    for (const assignment of assignments) {
      const roles = getAssignmentRoles(assignment).map((r) => getRoleDisplayName(r, undefined));

      for (const date of assignment.dates) {
        if (!grouped[date]) {
          grouped[date] = [];
        }
        grouped[date].push({
          timeSlot: assignment.timeSlot,
          roles,
        });
      }
    }

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, slots]) => ({
        date,
        formattedDate: formatDate(date),
        slots,
      }));
  }, [assignments]);

  if (groupedByDate.length === 0) return null;

  return (
    <View className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-3">
      <Text className="text-sm font-medium text-gray-900 dark:text-white mb-2">지원 일정</Text>
      {groupedByDate.map((item, idx) => (
        <View key={idx} className="mb-2 last:mb-0">
          <View className="flex-row items-center mb-1">
            <CalendarIcon size={14} color="#9333EA" />
            <Text className="ml-2 text-sm font-medium text-primary-700 dark:text-primary-300">
              {item.formattedDate}
            </Text>
          </View>
          {item.slots.map((slot, slotIdx) => (
            <View key={slotIdx} className="ml-6 flex-row items-center mb-1">
              <ClockIcon size={12} color="#6B7280" />
              <Text className="ml-1 text-sm text-gray-600 dark:text-gray-400">{slot.timeSlot}</Text>
              <View className="ml-2">
                <BriefcaseIcon size={12} color="#6B7280" />
              </View>
              <Text className="ml-1 text-sm text-gray-600 dark:text-gray-400">
                {slot.roles.join(', ')}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ApplicantProfileModal({ visible, onClose, applicant }: ApplicantProfileModalProps) {
  // 사용자 프로필 조회 (모달이 열려있고 applicant가 있을 때만)
  const { userProfile, isLoading: isProfileLoading, displayName, profilePhotoURL } = useUserProfile({
    userId: applicant?.applicantId,
    enabled: visible,
    fallbackName: applicant?.applicantName,
  });

  const appliedTimeAgo = useMemo(() => {
    if (!applicant?.createdAt) return '';

    const date =
      typeof applicant.createdAt === 'string'
        ? new Date(applicant.createdAt)
        : applicant.createdAt instanceof Date
          ? applicant.createdAt
          : applicant.createdAt.toDate();

    return formatRelativeTime(date);
  }, [applicant?.createdAt]);

  if (!applicant) return null;

  return (
    <SheetModal visible={visible} onClose={onClose} title="지원자 프로필">
      <View>
        {/* 프로필 헤더 */}
        <View className="items-center py-4 bg-gray-50 dark:bg-surface">
          {isProfileLoading ? (
            <View className="h-16 w-16 rounded-full bg-gray-200 dark:bg-surface items-center justify-center mb-2">
              <ActivityIndicator size="small" color="#6B7280" />
            </View>
          ) : (
            <Avatar source={profilePhotoURL} name={displayName} size="xl" className="mb-2" />
          )}
          {/* 이름 + 상태 뱃지 (같은 행) */}
          <View className="flex-row items-center gap-2 mb-1">
            <Text className="text-xl font-bold text-gray-900 dark:text-white">{displayName}</Text>
            <Badge variant={STATUS_BADGE_VARIANT[applicant.status]} size="sm" dot>
              {APPLICATION_STATUS_LABELS[applicant.status]}
            </Badge>
          </View>
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            {getRoleDisplayName(
              applicant.assignments[0]?.roleIds?.[0] || 'other',
              applicant.customRole
            )}{' '}
            지원 · {appliedTimeAgo}
          </Text>
        </View>

        {/* 프로필 정보 (사용자가 설정한 정보) */}
        {userProfile && (
          <View className="px-4 py-4 border-b border-gray-100 dark:border-surface-overlay">
            <Text className="text-base font-semibold text-gray-900 dark:text-white mb-3">
              프로필 정보
            </Text>

            {/* 2x2 그리드 레이아웃 */}
            <View className="flex-row flex-wrap gap-2 mb-3">
              {userProfile.gender && (
                <View className="w-[48%]">
                  <GridInfoItem
                    icon={<UserIcon size={16} color="#6B7280" />}
                    label="성별"
                    value={GENDER_LABELS[userProfile.gender] || userProfile.gender}
                  />
                </View>
              )}

              {userProfile.birthYear && (
                <View className="w-[48%]">
                  <GridInfoItem
                    icon={<CalendarIcon size={16} color="#6B7280" />}
                    label="출생년도"
                    value={`${userProfile.birthYear}년`}
                  />
                </View>
              )}

              {userProfile.region && (
                <View className="w-[48%]">
                  <GridInfoItem
                    icon={<MapPinIcon size={16} color="#6B7280" />}
                    label="활동 지역"
                    value={userProfile.region}
                  />
                </View>
              )}

              {userProfile.experienceYears !== undefined && userProfile.experienceYears > 0 && (
                <View className="w-[48%]">
                  <GridInfoItem
                    icon={<StarIcon size={16} color="#6B7280" />}
                    label="경력"
                    value={`${userProfile.experienceYears}년`}
                  />
                </View>
              )}
            </View>

            {/* 경력 상세 및 자기소개는 전체 너비 */}
            {userProfile.career && (
              <InfoRow
                icon={<BriefcaseIcon size={16} color="#6B7280" />}
                label="경력 상세"
                value={userProfile.career}
              />
            )}

            {userProfile.note && (
              <InfoRow
                icon={<DocumentIcon size={16} color="#6B7280" />}
                label="자기소개"
                value={userProfile.note}
              />
            )}
          </View>
        )}

        {/* 연락처 정보 */}
        <View className="px-4 py-4">
          <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            연락처 정보
          </Text>

          {(userProfile?.phone || applicant.applicantPhone) && (
            <InfoRow
              icon={<PhoneIcon size={16} color="#6B7280" />}
              label="전화번호"
              value={userProfile?.phone || applicant.applicantPhone || ''}
            />
          )}

          {(userProfile?.email || applicant.applicantEmail) && (
            <InfoRow
              icon={<MailIcon size={16} color="#6B7280" />}
              label="이메일"
              value={userProfile?.email || applicant.applicantEmail || ''}
            />
          )}
        </View>

        {/* 지원 일정 (Assignments) */}
        {applicant.assignments && applicant.assignments.length > 0 && (
          <View className="px-4 pb-4">
            <AssignmentDisplay assignments={applicant.assignments} />
          </View>
        )}

        {/* 지원 메시지 */}
        {applicant.message && (
          <View className="px-4 pb-4">
            <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">
              지원 메시지
            </Text>
            <View className="bg-gray-50 dark:bg-surface rounded-lg p-3">
              <View className="flex-row items-start">
                <MessageIcon size={16} color="#6B7280" />
                <Text className="ml-2 text-sm text-gray-700 dark:text-gray-300 flex-1">
                  {applicant.message}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* 사전질문 답변 */}
        {applicant.preQuestionAnswers && applicant.preQuestionAnswers.length > 0 && (
          <View className="px-4 pb-4">
            <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">
              사전질문 답변
            </Text>
            <View className="bg-gray-50 dark:bg-surface rounded-lg p-3">
              {applicant.preQuestionAnswers.map((answer, idx) => (
                <View key={idx} className="mb-3 last:mb-0">
                  <View className="flex-row items-start mb-1">
                    <DocumentIcon size={14} color="#6B7280" />
                    <Text className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                      Q{idx + 1}. {answer.question}
                    </Text>
                  </View>
                  <Text className="ml-6 text-sm text-gray-700 dark:text-gray-300">
                    {answer.answer}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 상태별 추가 정보 */}
        {applicant.status === 'rejected' && applicant.rejectionReason && (
          <View className="px-4 pb-4">
            <View className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 flex-row items-start">
              <XCircleIcon size={16} color="#EF4444" />
              <View className="ml-2 flex-1">
                <Text className="text-xs text-red-500 dark:text-red-400 mb-1">거절 사유</Text>
                <Text className="text-sm text-red-700 dark:text-red-300">
                  {applicant.rejectionReason}
                </Text>
              </View>
            </View>
          </View>
        )}

        {applicant.status === 'confirmed' && (
          <View className="px-4 pb-4">
            <View className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 flex-row items-center">
              <CheckCircleIcon size={16} color="#10B981" />
              <Text className="ml-2 text-sm text-green-700 dark:text-green-300">
                확정된 지원자입니다
              </Text>
            </View>
          </View>
        )}

        {/* 확정 이력 */}
        {applicant.confirmationHistory && applicant.confirmationHistory.length > 0 && (
          <View className="px-4 pb-4">
            <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">
              확정 이력
            </Text>
            <View className="bg-gray-50 dark:bg-surface rounded-lg p-3">
              {applicant.confirmationHistory.map((entry, idx) => {
                const isCancelled = !!entry.cancelledAt;
                const timestamp = isCancelled
                  ? entry.cancelledAt?.toDate?.()?.toISOString?.()?.split('T')[0]
                  : entry.confirmedAt?.toDate?.()?.toISOString?.()?.split('T')[0];

                return (
                  <View key={idx} className="flex-row items-center mb-2 last:mb-0">
                    <View
                      className={`w-2 h-2 rounded-full mr-2 ${
                        isCancelled ? 'bg-red-500' : 'bg-green-500'
                      }`}
                    />
                    <Text className="text-sm text-gray-700 dark:text-gray-300">
                      {isCancelled ? '취소' : '확정'} - {formatDate(timestamp)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View className="h-8" />
      </View>
    </SheetModal>
  );
}

export default ApplicantProfileModal;
