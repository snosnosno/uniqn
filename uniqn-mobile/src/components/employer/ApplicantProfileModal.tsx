/**
 * UNIQN Mobile - 지원자 프로필 상세보기 모달
 *
 * @description 지원자의 상세 프로필 정보를 표시하는 모달
 * @version 1.1.0 - 사용자 프로필 정보 연동
 */

import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import {
  XMarkIcon,
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
import { getUserProfile } from '@/services';
import type { ApplicantWithDetails, UserProfile } from '@/services';
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

const STATUS_BADGE_VARIANT: Record<ApplicationStatus, 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
  applied: 'primary',
  pending: 'warning',
  confirmed: 'success',
  rejected: 'error',
  cancelled: 'default',
  waitlisted: 'primary',
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
    <View className="flex-row items-start py-3 border-b border-gray-100 dark:border-gray-700">
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
    <View className="flex-row items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <View className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 items-center justify-center mr-2">
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
    <View className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
      <Text className="text-sm font-medium text-gray-900 dark:text-white mb-2">
        지원 일정
      </Text>
      {groupedByDate.map((item, idx) => (
        <View key={idx} className="mb-2 last:mb-0">
          <View className="flex-row items-center mb-1">
            <CalendarIcon size={14} color="#2563EB" />
            <Text className="ml-2 text-sm font-medium text-blue-700 dark:text-blue-300">
              {item.formattedDate}
            </Text>
          </View>
          {item.slots.map((slot, slotIdx) => (
            <View key={slotIdx} className="ml-6 flex-row items-center mb-1">
              <ClockIcon size={12} color="#6B7280" />
              <Text className="ml-1 text-sm text-gray-600 dark:text-gray-400">
                {slot.timeSlot}
              </Text>
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

export function ApplicantProfileModal({
  visible,
  onClose,
  applicant,
}: ApplicantProfileModalProps) {
  // 사용자 프로필 조회 (모달이 열려있고 applicant가 있을 때만)
  const { data: userProfile, isLoading: isProfileLoading } = useQuery<UserProfile | null>({
    queryKey: ['userProfile', applicant?.applicantId],
    queryFn: () => getUserProfile(applicant!.applicantId),
    enabled: visible && !!applicant?.applicantId,
    staleTime: 5 * 60 * 1000, // 5분
  });

  const appliedTimeAgo = useMemo(() => {
    if (!applicant?.createdAt) return '';

    const date = typeof applicant.createdAt === 'string'
      ? new Date(applicant.createdAt)
      : applicant.createdAt instanceof Date
        ? applicant.createdAt
        : applicant.createdAt.toDate();

    return formatRelativeTime(date);
  }, [applicant?.createdAt]);

  if (!applicant) return null;

  // 프로필 사진 URL (사용자 프로필에서 우선 사용)
  const profilePhotoURL = userProfile?.photoURL;
  // 표시 이름: Firestore 프로필 우선, Firebase Auth displayName 폴백
  const baseName = userProfile?.name || applicant.applicantName;
  // 닉네임이 있고 이름과 다르면 "이름(닉네임)" 형식
  const displayName = userProfile?.nickname && userProfile.nickname !== baseName
    ? `${baseName}(${userProfile.nickname})`
    : baseName;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
        {/* 헤더 */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <Text className="text-lg font-semibold text-gray-900 dark:text-white">
            지원자 프로필
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <XMarkIcon size={24} color="#6B7280" />
          </Pressable>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* 프로필 헤더 */}
          <View className="items-center py-4 bg-gray-50 dark:bg-gray-800">
            {isProfileLoading ? (
              <View className="h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-700 items-center justify-center mb-2">
                <ActivityIndicator size="small" color="#6B7280" />
              </View>
            ) : (
              <Avatar
                source={profilePhotoURL}
                name={displayName}
                size="xl"
                className="mb-2"
              />
            )}
            {/* 이름 + 상태 뱃지 (같은 행) */}
            <View className="flex-row items-center gap-2 mb-1">
              <Text className="text-xl font-bold text-gray-900 dark:text-white">
                {displayName}
              </Text>
              <Badge
                variant={STATUS_BADGE_VARIANT[applicant.status]}
                size="sm"
                dot
              >
                {APPLICATION_STATUS_LABELS[applicant.status]}
              </Badge>
            </View>
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              {getRoleDisplayName(applicant.appliedRole, applicant.customRole)} 지원 · {appliedTimeAgo}
            </Text>
          </View>

          {/* 프로필 정보 (사용자가 설정한 정보) */}
          {userProfile && (
            <View className="px-4 py-4 border-b border-gray-100 dark:border-gray-700">
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

          {/* 레거시 지원 정보 */}
          {(!applicant.assignments || applicant.assignments.length === 0) &&
            (applicant.appliedDate || applicant.appliedTimeSlot) && (
              <View className="px-4 pb-4">
                <View className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  <Text className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    지원 일정
                  </Text>
                  <View className="flex-row items-center">
                    <CalendarIcon size={14} color="#2563EB" />
                    <Text className="ml-2 text-sm text-blue-700 dark:text-blue-300">
                      {formatDate(applicant.appliedDate)}
                      {applicant.appliedTimeSlot && ` ${applicant.appliedTimeSlot}`}
                    </Text>
                  </View>
                </View>
              </View>
            )}

          {/* 지원 메시지 */}
          {applicant.message && (
            <View className="px-4 pb-4">
              <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                지원 메시지
              </Text>
              <View className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
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
              <View className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
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
          {applicant.status === 'waitlisted' && applicant.waitlistOrder && (
            <View className="px-4 pb-4">
              <View className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 flex-row items-center">
                <ClockIcon size={16} color="#7C3AED" />
                <Text className="ml-2 text-sm text-purple-700 dark:text-purple-300">
                  대기 순번: {applicant.waitlistOrder}번
                </Text>
              </View>
            </View>
          )}

          {applicant.status === 'rejected' && applicant.rejectionReason && (
            <View className="px-4 pb-4">
              <View className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 flex-row items-start">
                <XCircleIcon size={16} color="#EF4444" />
                <View className="ml-2 flex-1">
                  <Text className="text-xs text-red-500 dark:text-red-400 mb-1">
                    거절 사유
                  </Text>
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
              <View className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                {applicant.confirmationHistory.map((entry, idx) => {
                  const isCancelled = !!entry.cancelledAt;
                  const timestamp = isCancelled
                    ? entry.cancelledAt?.toDate?.()?.toISOString?.()?.split('T')[0]
                    : entry.confirmedAt?.toDate?.()?.toISOString?.()?.split('T')[0];

                  return (
                    <View key={idx} className="flex-row items-center mb-2 last:mb-0">
                      <View className={`w-2 h-2 rounded-full mr-2 ${
                        isCancelled ? 'bg-red-500' : 'bg-green-500'
                      }`} />
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
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default ApplicantProfileModal;
