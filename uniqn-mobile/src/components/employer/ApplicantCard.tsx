/**
 * UNIQN Mobile - 지원자 카드 컴포넌트
 *
 * @description 구인자가 지원자 정보를 확인하는 카드 (v2.3 - 고정공고 지원)
 * @version 2.3.0
 */

import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, Pressable, LayoutAnimation, Platform, UIManager, useColorScheme } from 'react-native';
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
import { FixedScheduleDisplay } from '../jobs/FixedScheduleDisplay';
import { APPLICATION_STATUS_LABELS, getAssignmentRoles } from '@/types';
import { formatRelativeTime } from '@/utils/dateUtils';
import { getUserProfile } from '@/services';
import type { ApplicantWithDetails, UserProfile } from '@/services';
import type { ApplicationStatus, Assignment, PostingType } from '@/types';
import { getRoleDisplayName } from '@/types/unified';

// Android LayoutAnimation 활성화
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ============================================================================
// Types
// ============================================================================

export interface ApplicantCardProps {
  applicant: ApplicantWithDetails;
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
  /** 초기 펼침 상태 */
  initialExpanded?: boolean;
  /** 공고 타입 (고정공고 여부 판단) */
  postingType?: PostingType;
  /** 고정공고: 주 출근일수 */
  daysPerWeek?: number;
  /** 고정공고: 출근 시간 */
  startTime?: string;
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

/**
 * 역할 라벨 가져오기 (v3.0: 통합 타입의 getRoleDisplayName 사용)
 */
const getRoleLabel = (role: string, customRole?: string): string => {
  return getRoleDisplayName(role, customRole);
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
 * 시간대 표시 포맷 (미정 시간 사유 포함)
 */
const formatTimeSlotDisplay = (
  timeSlot: string,
  isTimeToBeAnnounced?: boolean,
  tentativeDescription?: string
): string => {
  if (isTimeToBeAnnounced || !timeSlot || timeSlot.trim() === '') {
    return tentativeDescription ? `미정 (${tentativeDescription})` : '미정';
  }
  return timeSlot;
};

/**
 * Assignment 정보를 역할별로 분리하여 표시용 형태로 변환
 */
interface AssignmentDisplay {
  date: string;
  formattedDate: string;
  timeSlot: string;        // 원본 값 (key 생성용)
  timeSlotDisplay: string; // 표시용 ("미정" 포함)
  role: string;            // 단일 역할
  roleLabel: string;       // 단일 역할 라벨
}

const formatAssignments = (assignments?: Assignment[]): AssignmentDisplay[] => {
  if (!assignments || assignments.length === 0) return [];

  const result: AssignmentDisplay[] = [];
  const seen = new Set<string>(); // 중복 방지

  for (const assignment of assignments) {
    const roles = getAssignmentRoles(assignment);

    for (const date of assignment.dates) {
      for (const role of roles) {
        const key = `${date}_${assignment.timeSlot}_${role}`;
        if (seen.has(key)) continue; // 중복 스킵
        seen.add(key);

        result.push({
          date,
          formattedDate: formatAppliedDate(date),
          timeSlot: assignment.timeSlot,
          timeSlotDisplay: formatTimeSlotDisplay(
            assignment.timeSlot,
            assignment.isTimeToBeAnnounced,
            assignment.tentativeDescription
          ),
          role,
          roleLabel: getRoleLabel(role, undefined),
        });
      }
    }
  }

  // 날짜순 → 시간순 → 역할순 정렬 (미정은 맨 뒤로)
  return result.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    // 시간 미정은 맨 뒤로
    if (!a.timeSlot && b.timeSlot) return 1;
    if (a.timeSlot && !b.timeSlot) return -1;
    const timeCompare = a.timeSlot.localeCompare(b.timeSlot);
    if (timeCompare !== 0) return timeCompare;
    return a.role.localeCompare(b.role);
  });
};

// ============================================================================
// Component
// ============================================================================

export const ApplicantCard = React.memo(function ApplicantCard({
  applicant,
  onConfirm,
  onReject,
  onWaitlist,
  onCancelConfirmation,
  onConvertToStaff,
  onViewProfile,
  showActions = true,
  showConfirmationHistory = true,
  initialExpanded = true,
  postingType,
  daysPerWeek,
  startTime,
}: ApplicantCardProps) {
  // 고정공고 모드 판단
  const isFixedMode = postingType === 'fixed';
  // 다크모드 감지
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // 아이콘 색상 (다크모드 대응)
  const iconColors = useMemo(() => ({
    // 선택된 항목: 라이트-파란색, 다크-하늘색
    checked: isDark ? '#93C5FD' : '#1D4ED8',
    // 선택 안 된 항목: 라이트-회색, 다크-밝은회색
    unchecked: isDark ? '#D1D5DB' : '#374151',
  }), [isDark]);

  // 펼침/접힘 상태
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  // 일정 선택 상태 (key: "date_timeSlot")
  // 초기값: 빈 상태 (체크 안 됨)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

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

  // 모든 일정 키 목록 (역할별로 분리)
  const allAssignmentKeys = useMemo(() => {
    const keys: string[] = [];
    for (const display of assignmentDisplays) {
      keys.push(`${display.date}_${display.timeSlot}_${display.role}`);
    }
    return keys;
  }, [assignmentDisplays]);

  // 선택된 일정 개수
  const selectedCount = selectedKeys.size;
  const totalCount = allAssignmentKeys.length;

  // 일정 토글 (같은 날짜에는 하나만 선택 가능)
  const toggleAssignment = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        // 이미 선택된 항목 클릭 시 해제
        next.delete(key);
      } else {
        // 새로 선택 시, 같은 날짜의 다른 항목들 제거
        const selectedDate = key.split('_')[0]; // key 형식: "date_timeSlot_role"
        // 같은 날짜의 기존 선택 항목 제거
        for (const existingKey of prev) {
          const existingDate = existingKey.split('_')[0];
          if (existingDate === selectedDate) {
            next.delete(existingKey);
          }
        }
        next.add(key);
      }
      return next;
    });
  }, []);


  // 선택된 일정으로 Assignment 배열 생성 (역할별로 분리)
  const getSelectedAssignments = useCallback((): Assignment[] => {
    if (!applicant.assignments) return [];

    const result: Assignment[] = [];
    for (const assignment of applicant.assignments) {
      const roles = getAssignmentRoles(assignment);

      for (const role of roles) {
        const selectedDates = assignment.dates.filter((date) =>
          selectedKeys.has(`${date}_${assignment.timeSlot}_${role}`)
        );
        if (selectedDates.length > 0) {
          result.push({
            ...assignment,
            roleIds: [role], // v3.0: roleIds 배열로 설정
            dates: selectedDates,
          });
        }
      }
    }
    return result;
  }, [applicant.assignments, selectedKeys]);

  // 펼침/접힘 토글
  const toggleExpand = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded((prev) => !prev);
  }, []);

  // 프로필 보기 핸들러
  const handleViewProfile = useCallback(() => {
    onViewProfile?.(applicant);
  }, [applicant, onViewProfile]);

  // 확정 핸들러
  const handleConfirm = useCallback(() => {
    // 고정공고: 역할만 확정 (날짜 선택 없음)
    if (isFixedMode) {
      onConfirm?.(applicant);
      return;
    }

    const selectedAssignments = getSelectedAssignments();
    // 선택된 일정이 있으면 해당 일정만, 없거나 레거시면 전체 확정
    if (selectedAssignments.length > 0) {
      onConfirm?.(applicant, selectedAssignments);
    } else {
      onConfirm?.(applicant);
    }
  }, [applicant, onConfirm, getSelectedAssignments, isFixedMode]);

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
  const canShowActions = showActions && applicant.status === 'applied';

  return (
    <Card
      variant="elevated"
      padding="md"
    >
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

          {/* 고정공고: 근무 조건 표시 (날짜 선택 없음) */}
          {isFixedMode && (
            <View className={`mb-3 p-3 rounded-lg border ${
              isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
            }`}>
              <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                근무 조건
              </Text>
              <FixedScheduleDisplay
                daysPerWeek={daysPerWeek}
                startTime={startTime}
                compact={true}
              />
            </View>
          )}

          {/* 선택한 날짜/시간/역할 - 체크박스 (고정공고 제외) */}
          {!isFixedMode && assignmentDisplays.length > 0 && canShowActions && (
            <View className="mb-3">
              {/* 안내 문구 */}
              <View className="flex-row items-center mb-2">
                <Text className="text-xs text-gray-500 dark:text-gray-400">
                  같은 날짜에는 하나의 역할/시간만 선택 가능합니다
                </Text>
                <Text className="ml-auto text-xs text-primary-500 dark:text-primary-400 font-medium">
                  {selectedCount}개 선택
                </Text>
              </View>

              {/* 일정 목록 (역할별로 분리) */}
              <View className="gap-1.5">
                {assignmentDisplays.map((display) => {
                  const key = `${display.date}_${display.timeSlot}_${display.role}`;
                  const isChecked = selectedKeys.has(key);

                  // 배경색 (isDark와 isChecked 조합)
                  const bgClass = isChecked
                    ? (isDark ? 'bg-blue-900 border-blue-700' : 'bg-blue-100 border-blue-300')
                    : (isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200');

                  return (
                    <Pressable
                      key={key}
                      onPress={() => toggleAssignment(key)}
                      className={`flex-row items-center rounded-lg px-3 py-2.5 border active:opacity-70 ${bgClass}`}
                    >
                      {/* 체크박스 */}
                      <View className={`
                        h-5 w-5 rounded border-2 items-center justify-center mr-3
                        ${isChecked
                          ? 'bg-primary-500 border-primary-500'
                          : (isDark ? 'border-gray-500' : 'border-gray-400')}
                      `}>
                        {isChecked && <CheckIcon size={12} color="#fff" />}
                      </View>

                      {/* 일정 정보 */}
                      <CalendarIcon size={16} color={isChecked ? iconColors.checked : iconColors.unchecked} />
                      <Text className={`ml-1.5 text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {display.formattedDate} {display.timeSlotDisplay}
                      </Text>
                      <View className={`mx-2 h-4 w-px ${isDark ? 'bg-gray-500' : 'bg-gray-300'}`} />
                      <BriefcaseIcon size={16} color={isChecked ? iconColors.checked : iconColors.unchecked} />
                      <Text className={`ml-1.5 text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {display.roleLabel}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* 확정된/거절된 상태에서는 체크박스 없이 표시 (고정공고 제외) */}
          {!isFixedMode && assignmentDisplays.length > 0 && !canShowActions && (
            <View className="gap-1.5 mb-3">
              {assignmentDisplays.map((display) => {
                const key = `${display.date}_${display.timeSlot}_${display.role}`;
                return (
                  <View
                    key={key}
                    className={`flex-row items-center rounded-lg px-3 py-2 border ${
                      isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'
                    }`}
                  >
                    <CalendarIcon size={16} color={iconColors.unchecked} />
                    <Text className={`ml-1.5 text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {display.formattedDate} {display.timeSlotDisplay}
                    </Text>
                    <View className={`mx-2 h-4 w-px ${isDark ? 'bg-gray-500' : 'bg-gray-300'}`} />
                    <BriefcaseIcon size={16} color={iconColors.unchecked} />
                    <Text className={`ml-1.5 text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {display.roleLabel}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* 레거시 지원 날짜/시간대 (assignments가 없을 때, 고정공고 제외) */}
          {!isFixedMode && assignmentDisplays.length === 0 && (applicant.appliedDate || applicant.appliedTimeSlot) && (
            <View className={`flex-row items-center rounded-lg px-3 py-2 self-start mb-3 border ${
              isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'
            }`}>
              <CalendarIcon size={16} color={iconColors.unchecked} />
              <Text className={`ml-1.5 text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
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
            <>
              {applicant.preQuestionAnswers.map((answer, idx) => (
                <View key={idx} className="mb-2">
                  <View className="flex-row items-center">
                    <DocumentIcon size={14} color="#9CA3AF" />
                    <Text className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                      Q{idx + 1}. {answer.question}
                    </Text>
                  </View>
                  <View className="flex-row items-start ml-5">
                    <Text className="text-gray-400 dark:text-gray-500 mr-1">↳</Text>
                    <Text className="text-sm text-gray-600 dark:text-gray-400 flex-1">
                      {answer.answer}
                    </Text>
                  </View>
                </View>
              ))}
            </>
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
      {canShowConfirmedActions && (
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
      {canShowActions && (
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
            disabled={!isFixedMode && totalCount > 0 && selectedCount === 0}
            className={`flex-1 flex-row items-center justify-center py-2 rounded-lg active:opacity-70 ${
              !isFixedMode && totalCount > 0 && selectedCount === 0
                ? 'bg-gray-300 dark:bg-gray-600'
                : 'bg-primary-500'
            }`}
          >
            <CheckIcon size={16} color="#fff" />
            <Text className="ml-1 text-sm font-medium text-white">
              {isFixedMode
                ? '역할 확정'
                : totalCount > 0 && selectedCount < totalCount
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
