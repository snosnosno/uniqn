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
  BriefcaseIcon,
  ChevronUpIcon,
  ChevronDownIcon,
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
  /** 확정 콜백 - selectedAssignments가 전달되면 해당 일정만 확정 */
  onConfirm?: (applicant: ApplicantWithDetails, selectedAssignments?: Assignment[]) => void;
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
  initialExpanded = true,
}: ApplicantCardProps) {
  // 펼침/접힘 상태
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  // 일정 선택 상태 (key: "date_timeSlot")
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => {
    // 초기값: 모든 일정 선택
    const keys = new Set<string>();
    if (applicant.assignments) {
      for (const assignment of applicant.assignments) {
        for (const date of assignment.dates) {
          keys.add(`${date}_${assignment.timeSlot}`);
        }
      }
    }
    return keys;
  });

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

  // 모든 일정 키 목록
  const allAssignmentKeys = useMemo(() => {
    const keys: string[] = [];
    for (const display of assignmentDisplays) {
      keys.push(`${display.date}_${display.timeSlot}`);
    }
    return keys;
  }, [assignmentDisplays]);

  // 선택된 일정 개수
  const selectedCount = selectedKeys.size;
  const totalCount = allAssignmentKeys.length;
  const isAllSelected = selectedCount === totalCount && totalCount > 0;

  // 일정 토글
  const toggleAssignment = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // 전체 선택
  const selectAll = useCallback(() => {
    setSelectedKeys(new Set(allAssignmentKeys));
  }, [allAssignmentKeys]);

  // 전체 해제
  const deselectAll = useCallback(() => {
    setSelectedKeys(new Set());
  }, []);

  // 선택된 일정으로 Assignment 배열 생성
  const getSelectedAssignments = useCallback((): Assignment[] => {
    if (!applicant.assignments) return [];

    const result: Assignment[] = [];
    for (const assignment of applicant.assignments) {
      const selectedDates = assignment.dates.filter((date) =>
        selectedKeys.has(`${date}_${assignment.timeSlot}`)
      );
      if (selectedDates.length > 0) {
        result.push({
          ...assignment,
          dates: selectedDates,
        });
      }
    }
    return result;
  }, [applicant.assignments, selectedKeys]);

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
    const selectedAssignments = getSelectedAssignments();
    // 선택된 일정이 있으면 해당 일정만, 없거나 레거시면 전체 확정
    if (selectedAssignments.length > 0) {
      onConfirm?.(applicant, selectedAssignments);
    } else {
      onConfirm?.(applicant);
    }
  }, [applicant, onConfirm, getSelectedAssignments]);

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

      {/* 헤더: 카드 클릭 시 프로필 모달 열기 */}
      <View className="flex-row items-center">
        {/* 메인 영역 - 프로필 모달 열기 */}
        <Pressable
          onPress={handleViewProfile}
          disabled={!onViewProfile}
          className="flex-1 flex-row items-center active:opacity-80"
        >
          <Avatar
            source={profilePhotoURL}
            name={displayName}
            size="md"
            className="mr-3"
          />
          <View className="flex-1">
            <View className="flex-row items-center">
              <Text className="text-base font-semibold text-gray-900 dark:text-white">
                {displayName}
              </Text>
              {!applicant.isRead && (
                <View className="ml-2 h-2 w-2 rounded-full bg-primary-500" />
              )}
            </View>
          </View>
          <Badge
            variant={STATUS_BADGE_VARIANT[applicant.status]}
            size="sm"
            dot
          >
            {APPLICATION_STATUS_LABELS[applicant.status]}
          </Badge>
        </Pressable>

        {/* 펼침/접힘 버튼 */}
        <Pressable
          onPress={toggleExpand}
          className="ml-2 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 active:opacity-60 flex-row items-center"
          hitSlop={8}
        >
          <Text className="text-xs font-medium text-gray-600 dark:text-gray-300">
            {isExpanded ? '접기' : '열기'}
          </Text>
          {isExpanded ? (
            <ChevronUpIcon size={14} color="#6B7280" />
          ) : (
            <ChevronDownIcon size={14} color="#6B7280" />
          )}
        </Pressable>
      </View>

      {/* === 펼침 영역 === */}
      {isExpanded && (
        <View className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          {/* 지원 역할 & 시간 요약 */}
          <Text className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            {getRoleLabel(applicant.appliedRole, applicant.customRole)} 지원 · {appliedTimeAgo}
          </Text>

          {/* 선택한 날짜/시간/역할 - 체크박스 */}
          {assignmentDisplays.length > 0 && canShowActions && (
            <View className="mb-3">
              {/* 전체 선택/해제 버튼 */}
              <View className="flex-row items-center mb-2">
                <Pressable
                  onPress={isAllSelected ? deselectAll : selectAll}
                  className="flex-row items-center px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 active:opacity-70"
                >
                  <View className={`
                    h-4 w-4 rounded border items-center justify-center mr-1.5
                    ${isAllSelected
                      ? 'bg-primary-500 border-primary-500'
                      : 'border-gray-400 dark:border-gray-500'}
                  `}>
                    {isAllSelected && <CheckIcon size={10} color="#fff" />}
                  </View>
                  <Text className="text-xs text-gray-600 dark:text-gray-300">
                    {isAllSelected ? '전체 해제' : '전체 선택'}
                  </Text>
                </Pressable>
                <Text className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  {selectedCount}/{totalCount}개 선택
                </Text>
              </View>

              {/* 일정 목록 */}
              <View className="gap-1">
                {assignmentDisplays.map((display) => {
                  const key = `${display.date}_${display.timeSlot}`;
                  const isChecked = selectedKeys.has(key);
                  return (
                    <Pressable
                      key={key}
                      onPress={() => toggleAssignment(key)}
                      className={`
                        flex-row items-center rounded-md px-2 py-2 active:opacity-70
                        ${isChecked
                          ? 'bg-blue-50 dark:bg-blue-900/30'
                          : 'bg-gray-50 dark:bg-gray-800'}
                      `}
                    >
                      {/* 체크박스 */}
                      <View className={`
                        h-5 w-5 rounded border-2 items-center justify-center mr-2
                        ${isChecked
                          ? 'bg-primary-500 border-primary-500'
                          : 'border-gray-300 dark:border-gray-600'}
                      `}>
                        {isChecked && <CheckIcon size={12} color="#fff" />}
                      </View>

                      {/* 일정 정보 */}
                      <CalendarIcon size={14} color={isChecked ? '#2563EB' : '#9CA3AF'} />
                      <Text className={`ml-1 text-sm ${
                        isChecked
                          ? 'text-blue-700 dark:text-blue-300'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {display.formattedDate} {display.timeSlot}
                      </Text>
                      <View className="mx-1.5 h-3 w-px bg-gray-300 dark:bg-gray-600" />
                      <BriefcaseIcon size={14} color={isChecked ? '#2563EB' : '#9CA3AF'} />
                      <Text className={`ml-1 text-sm ${
                        isChecked
                          ? 'text-blue-700 dark:text-blue-300'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {display.roleLabels.join(', ')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* 확정된/거절된 상태에서는 체크박스 없이 표시 */}
          {assignmentDisplays.length > 0 && !canShowActions && (
            <View className="flex-row flex-wrap gap-1 mb-3">
              {assignmentDisplays.map((display, idx) => (
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
            </View>
          )}

          {/* 레거시 지원 날짜/시간대 (assignments가 없을 때) */}
          {assignmentDisplays.length === 0 && (applicant.appliedDate || applicant.appliedTimeSlot) && (
            <View className="flex-row items-center bg-blue-50 dark:bg-blue-900/20 rounded-md px-2 py-1 self-start mb-3">
              <CalendarIcon size={12} color="#2563EB" />
              <Text className="ml-1 text-xs text-blue-700 dark:text-blue-300">
                {formatAppliedDate(applicant.appliedDate)}
                {applicant.appliedTimeSlot && ` ${applicant.appliedTimeSlot}`}
              </Text>
            </View>
          )}

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
            disabled={totalCount > 0 && selectedCount === 0}
            className={`flex-1 flex-row items-center justify-center py-2 rounded-lg active:opacity-70 ${
              totalCount > 0 && selectedCount === 0
                ? 'bg-gray-300 dark:bg-gray-600'
                : 'bg-primary-500'
            }`}
          >
            <CheckIcon size={16} color="#fff" />
            <Text className="ml-1 text-sm font-medium text-white">
              {totalCount > 0 && selectedCount < totalCount
                ? `${selectedCount}개 확정`
                : '확정'}
            </Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
});

export default ApplicantCard;
