/**
 * UNIQN Mobile - 지원자 카드 컴포넌트
 *
 * @description 구인자가 지원자 정보를 확인하는 카드 (v2.2 - 프로필 정보 연동)
 * @version 2.2.0
 */

import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import {
  PhoneIcon,
  MessageIcon,
  CheckIcon,
  XMarkIcon,
  UserPlusIcon,
  CalendarIcon,
  DocumentIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  BriefcaseIcon,
} from '../icons';
import { ConfirmationHistoryTimeline } from '../applicant/ConfirmationHistoryTimeline';
import { APPLICATION_STATUS_LABELS, getAssignmentRoles } from '@/types';
import { formatRelativeTime } from '@/utils/dateUtils';
import { getUserProfile } from '@/services';
import type { ApplicantWithDetails, UserProfile } from '@/services';
import type { ApplicationStatus, Assignment } from '@/types';

// Android LayoutAnimation 활성화
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ============================================================================
// Types
// ============================================================================

export interface ApplicantCardProps {
  applicant: ApplicantWithDetails;
  onPress?: (applicant: ApplicantWithDetails) => void;
  onConfirm?: (applicant: ApplicantWithDetails) => void;
  onReject?: (applicant: ApplicantWithDetails) => void;
  onWaitlist?: (applicant: ApplicantWithDetails) => void;
  /** 확정 취소 (confirmed 상태에서만 사용) */
  onCancelConfirmation?: (applicant: ApplicantWithDetails) => void;
  /** 스태프로 변환 (confirmed 상태에서만 사용) */
  onConvertToStaff?: (applicant: ApplicantWithDetails) => void;
  /** 프로필 상세보기 */
  onViewProfile?: (applicant: ApplicantWithDetails) => void;
  showActions?: boolean;
  /** 확정 이력 표시 여부 */
  showConfirmationHistory?: boolean;
  isSelected?: boolean;
  selectionMode?: boolean;
  onSelect?: (applicant: ApplicantWithDetails) => void;
  /** 초기 펼침 상태 */
  initialExpanded?: boolean;
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

const ROLE_LABELS: Record<string, string> = {
  dealer: '딜러',
  floor: '플로어',
  manager: '매니저',
  chiprunner: '칩러너',
  admin: '관리자',
};

/**
 * 역할 라벨 가져오기 (커스텀 역할 지원)
 */
const getRoleLabel = (role: string, customRole?: string): string => {
  if (role === 'other' && customRole) {
    return customRole;
  }
  return ROLE_LABELS[role] || role;
};

/**
 * 지원 날짜 포맷 (M/D 형식)
 */
const formatAppliedDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${month}/${day}(${dayOfWeek})`;
};

/**
 * Assignment 정보를 그룹화하여 표시용 형태로 변환
 */
interface AssignmentDisplay {
  date: string;
  formattedDate: string;
  timeSlot: string;
  roles: string[];
  roleLabels: string[];
}

const formatAssignments = (assignments?: Assignment[]): AssignmentDisplay[] => {
  if (!assignments || assignments.length === 0) return [];

  const grouped: Map<string, AssignmentDisplay> = new Map();

  for (const assignment of assignments) {
    const roles = getAssignmentRoles(assignment);
    const roleLabels = roles.map((r) => getRoleLabel(r, undefined));

    for (const date of assignment.dates) {
      const key = `${date}_${assignment.timeSlot}`;
      const existing = grouped.get(key);

      if (existing) {
        // 같은 날짜/시간대에 다른 역할 추가
        for (let i = 0; i < roles.length; i++) {
          if (!existing.roles.includes(roles[i] ?? '')) {
            existing.roles.push(roles[i] ?? '');
            existing.roleLabels.push(roleLabels[i] ?? '');
          }
        }
      } else {
        grouped.set(key, {
          date,
          formattedDate: formatAppliedDate(date),
          timeSlot: assignment.timeSlot,
          roles: [...roles],
          roleLabels: [...roleLabels],
        });
      }
    }
  }

  // 날짜순 정렬
  return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date));
};

// ============================================================================
// Component
// ============================================================================

export const ApplicantCard = React.memo(function ApplicantCard({
  applicant,
  onPress,
  onConfirm,
  onReject,
  onWaitlist,
  onCancelConfirmation,
  onConvertToStaff,
  onViewProfile,
  showActions = true,
  showConfirmationHistory = true,
  isSelected = false,
  selectionMode = false,
  onSelect,
  initialExpanded = false,
}: ApplicantCardProps) {
  // 펼침/접힘 상태
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  // 사용자 프로필 조회
  const { data: userProfile } = useQuery<UserProfile | null>({
    queryKey: ['userProfile', applicant.applicantId],
    queryFn: () => getUserProfile(applicant.applicantId),
    enabled: !!applicant.applicantId,
    staleTime: 5 * 60 * 1000, // 5분
  });

  // 프로필 사진 URL
  const profilePhotoURL = userProfile?.photoURL;
  // 표시 이름: Firestore 프로필 우선, Firebase Auth displayName 폴백
  const baseName = userProfile?.name || applicant.applicantName;
  // 닉네임이 있고 이름과 다르면 "이름(닉네임)" 형식
  const displayName = userProfile?.nickname && userProfile.nickname !== baseName
    ? `${baseName}(${userProfile.nickname})`
    : baseName;

  // 지원일 계산
  const appliedTimeAgo = useMemo(() => {
    if (!applicant.createdAt) return '';

    const date = typeof applicant.createdAt === 'string'
      ? new Date(applicant.createdAt)
      : applicant.createdAt instanceof Date
        ? applicant.createdAt
        : applicant.createdAt.toDate();

    return formatRelativeTime(date);
  }, [applicant.createdAt]);

  // Assignments 정보 포맷
  const assignmentDisplays = useMemo(
    () => formatAssignments(applicant.assignments),
    [applicant.assignments]
  );

  // 펼침/접힘 토글
  const toggleExpand = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded((prev) => !prev);
  }, []);

  // 카드 클릭 핸들러
  const handlePress = useCallback(() => {
    if (selectionMode && onSelect) {
      onSelect(applicant);
    } else if (onPress) {
      onPress(applicant);
    }
  }, [applicant, onPress, onSelect, selectionMode]);

  // 프로필 보기 핸들러
  const handleViewProfile = useCallback(() => {
    onViewProfile?.(applicant);
  }, [applicant, onViewProfile]);

  // 확정 핸들러
  const handleConfirm = useCallback(() => {
    onConfirm?.(applicant);
  }, [applicant, onConfirm]);

  // 거절 핸들러
  const handleReject = useCallback(() => {
    onReject?.(applicant);
  }, [applicant, onReject]);

  // 대기열 핸들러
  const handleWaitlist = useCallback(() => {
    onWaitlist?.(applicant);
  }, [applicant, onWaitlist]);

  // 확정 취소 핸들러
  const handleCancelConfirmation = useCallback(() => {
    onCancelConfirmation?.(applicant);
  }, [applicant, onCancelConfirmation]);

  // 스태프 변환 핸들러
  const handleConvertToStaff = useCallback(() => {
    onConvertToStaff?.(applicant);
  }, [applicant, onConvertToStaff]);

  // 확정 상태 액션 표시 여부
  const canShowConfirmedActions = showActions &&
    applicant.status === 'confirmed' &&
    (onCancelConfirmation || onConvertToStaff);

  // 액션 버튼 표시 여부
  const canShowActions = showActions &&
    (applicant.status === 'applied' || applicant.status === 'pending');

  return (
    <Card
      variant={isSelected ? 'outlined' : 'elevated'}
      padding="md"
      className={isSelected ? 'border-primary-500' : ''}
    >
      {/* 선택 모드 체크박스 */}
      {selectionMode && (
        <Pressable onPress={handlePress} className="absolute right-3 top-3 z-10">
          <View className={`
            h-5 w-5 rounded-full border-2 items-center justify-center
            ${isSelected
              ? 'bg-primary-500 border-primary-500'
              : 'border-gray-300 dark:border-gray-600'}
          `}>
            {isSelected && <CheckIcon size={12} color="#fff" />}
          </View>
        </Pressable>
      )}

      {/* 헤더: 접기/열기 토글 영역 */}
      <Pressable onPress={toggleExpand} className="active:opacity-80">
        <View className="flex-row items-center">
          {/* 아바타 - 프로필 보기 */}
          <Pressable onPress={handleViewProfile} disabled={!onViewProfile}>
            <Avatar
              source={profilePhotoURL}
              name={displayName}
              size="md"
              className="mr-3"
            />
          </Pressable>
          <View className="flex-1">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <Text className="text-base font-semibold text-gray-900 dark:text-white">
                  {displayName}
                </Text>
                {!applicant.isRead && (
                  <View className="ml-2 h-2 w-2 rounded-full bg-primary-500" />
                )}
              </View>
              <Badge
                variant={STATUS_BADGE_VARIANT[applicant.status]}
                size="sm"
                dot
              >
                {APPLICATION_STATUS_LABELS[applicant.status]}
              </Badge>
            </View>
            {/* 지원 역할 & 시간 요약 (항상 표시) */}
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              {getRoleLabel(applicant.appliedRole, applicant.customRole)} 지원 · {appliedTimeAgo}
            </Text>
          </View>
          {/* 펼침/접힘 아이콘 */}
          <View className="ml-2">
            {isExpanded ? (
              <ChevronUpIcon size={20} color="#9CA3AF" />
            ) : (
              <ChevronDownIcon size={20} color="#9CA3AF" />
            )}
          </View>
        </View>

        {/* 선택한 날짜/시간/역할 요약 (접힌 상태에서도 표시) */}
        {assignmentDisplays.length > 0 && (
          <View className="mt-2 flex-row flex-wrap gap-1">
            {assignmentDisplays.slice(0, isExpanded ? assignmentDisplays.length : 2).map((display, idx) => (
              <View
                key={idx}
                className="flex-row items-center bg-blue-50 dark:bg-blue-900/20 rounded-md px-2 py-1"
              >
                <CalendarIcon size={12} color="#2563EB" />
                <Text className="ml-1 text-xs text-blue-700 dark:text-blue-300">
                  {display.formattedDate} {display.timeSlot}
                </Text>
                <View className="ml-1">
                  <BriefcaseIcon size={12} color="#2563EB" />
                </View>
                <Text className="ml-1 text-xs text-blue-700 dark:text-blue-300">
                  {display.roleLabels.join(', ')}
                </Text>
              </View>
            ))}
            {!isExpanded && assignmentDisplays.length > 2 && (
              <View className="bg-gray-100 dark:bg-gray-700 rounded-md px-2 py-1">
                <Text className="text-xs text-gray-600 dark:text-gray-400">
                  +{assignmentDisplays.length - 2}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* 레거시 지원 날짜/시간대 (assignments가 없을 때) */}
        {assignmentDisplays.length === 0 && (applicant.appliedDate || applicant.appliedTimeSlot) && (
          <View className="mt-2 flex-row items-center bg-blue-50 dark:bg-blue-900/20 rounded-md px-2 py-1 self-start">
            <CalendarIcon size={12} color="#2563EB" />
            <Text className="ml-1 text-xs text-blue-700 dark:text-blue-300">
              {formatAppliedDate(applicant.appliedDate)}
              {applicant.appliedTimeSlot && ` ${applicant.appliedTimeSlot}`}
            </Text>
          </View>
        )}
      </Pressable>

      {/* === 펼침 영역 === */}
      {isExpanded && (
        <View className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          {/* 연락처 */}
          {(userProfile?.phone || applicant.applicantPhone) && (
            <View className="flex-row items-center mb-2">
              <PhoneIcon size={14} color="#9CA3AF" />
              <Text className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                {userProfile?.phone || applicant.applicantPhone}
              </Text>
            </View>
          )}

          {/* 지원 메시지 */}
          {applicant.message && (
            <View className="flex-row items-start mb-2">
              <MessageIcon size={14} color="#9CA3AF" />
              <Text
                className="ml-2 text-sm text-gray-600 dark:text-gray-400 flex-1"
                numberOfLines={3}
              >
                {applicant.message}
              </Text>
            </View>
          )}

          {/* 사전질문 답변 (v2.0) */}
          {applicant.preQuestionAnswers && applicant.preQuestionAnswers.length > 0 && (
            <View className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-2">
              <View className="flex-row items-center mb-2">
                <DocumentIcon size={14} color="#6B7280" />
                <Text className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  사전질문 답변
                </Text>
              </View>
              {applicant.preQuestionAnswers.map((answer, idx) => (
                <View key={idx} className="mb-2">
                  <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Q{idx + 1}. {answer.question}
                  </Text>
                  <Text className="text-sm text-gray-700 dark:text-gray-300">
                    {answer.answer}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* 대기자 순번 */}
          {applicant.status === 'waitlisted' && applicant.waitlistOrder && (
            <View className="bg-purple-50 dark:bg-purple-900/20 rounded-lg px-3 py-2 mb-2">
              <Text className="text-sm text-purple-700 dark:text-purple-300">
                대기 순번: {applicant.waitlistOrder}번
              </Text>
            </View>
          )}

          {/* 거절 사유 */}
          {applicant.status === 'rejected' && applicant.rejectionReason && (
            <View className="bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 mb-2">
              <Text className="text-sm text-red-700 dark:text-red-300">
                거절 사유: {applicant.rejectionReason}
              </Text>
            </View>
          )}

          {/* 확정 이력 타임라인 (confirmed 상태일 때만) */}
          {showConfirmationHistory &&
            applicant.status === 'confirmed' &&
            applicant.confirmationHistory &&
            applicant.confirmationHistory.length > 0 && (
              <View className="mb-2">
                <ConfirmationHistoryTimeline
                  history={applicant.confirmationHistory}
                  compact
                />
              </View>
            )}

          {/* 프로필 보기 버튼 */}
          {onViewProfile && (
            <Pressable
              onPress={handleViewProfile}
              className="flex-row items-center justify-center py-2 mb-2 rounded-lg bg-gray-100 dark:bg-gray-700 active:opacity-70"
            >
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                프로필 상세보기
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* 확정 상태 액션 버튼 */}
      {canShowConfirmedActions && !selectionMode && (
        <View className="flex-row mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          {/* 확정 취소 버튼 */}
          {onCancelConfirmation && (
            <Pressable
              onPress={handleCancelConfirmation}
              className="flex-1 flex-row items-center justify-center py-2 mr-2 rounded-lg bg-gray-100 dark:bg-gray-700 active:opacity-70"
            >
              <XMarkIcon size={16} color="#EF4444" />
              <Text className="ml-1 text-sm font-medium text-error-600 dark:text-error-400">
                확정 취소
              </Text>
            </Pressable>
          )}

          {/* 스태프 변환 버튼 */}
          {onConvertToStaff && (
            <Pressable
              onPress={handleConvertToStaff}
              className="flex-1 flex-row items-center justify-center py-2 rounded-lg bg-primary-500 active:opacity-70"
            >
              <UserPlusIcon size={16} color="#fff" />
              <Text className="ml-1 text-sm font-medium text-white">
                스태프 변환
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* 액션 버튼 */}
      {canShowActions && !selectionMode && (
        <View className="flex-row mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          {/* 거절 버튼 */}
          <Pressable
            onPress={handleReject}
            className="flex-1 flex-row items-center justify-center py-2 mr-2 rounded-lg bg-gray-100 dark:bg-gray-700 active:opacity-70"
          >
            <XMarkIcon size={16} color="#EF4444" />
            <Text className="ml-1 text-sm font-medium text-error-600 dark:text-error-400">
              거절
            </Text>
          </Pressable>

          {/* 대기열 버튼 */}
          {onWaitlist && (
            <Pressable
              onPress={handleWaitlist}
              className="flex-1 flex-row items-center justify-center py-2 mr-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 active:opacity-70"
            >
              <Text className="text-sm font-medium text-purple-600 dark:text-purple-400">
                대기열
              </Text>
            </Pressable>
          )}

          {/* 확정 버튼 */}
          <Pressable
            onPress={handleConfirm}
            className="flex-1 flex-row items-center justify-center py-2 rounded-lg bg-primary-500 active:opacity-70"
          >
            <CheckIcon size={16} color="#fff" />
            <Text className="ml-1 text-sm font-medium text-white">
              확정
            </Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
});

export default ApplicantCard;
