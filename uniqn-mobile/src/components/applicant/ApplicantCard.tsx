/**
 * UNIQN Mobile - 지원자 카드 컴포넌트
 *
 * @description 지원자 정보 + 확정/취소 이력 타임라인 통합 표시
 * @version 1.0.0
 */

import React, { memo, useCallback, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmationHistoryTimeline } from './ConfirmationHistoryTimeline';
import type { Application, ApplicationStatus, Assignment } from '@/types';
import { APPLICATION_STATUS_LABELS } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface ApplicantCardProps {
  /** 지원서 데이터 */
  application: Application;
  /** 카드 클릭 핸들러 */
  onPress?: (applicationId: string) => void;
  /** 확정 버튼 핸들러 */
  onConfirm?: (applicationId: string) => void;
  /** 거절 버튼 핸들러 */
  onReject?: (applicationId: string) => void;
  /** 버튼 로딩 상태 */
  isLoading?: boolean;
  /** 컴팩트 모드 (목록용) */
  compact?: boolean;
  /** 이력 표시 여부 */
  showHistory?: boolean;
  /** 액션 버튼 표시 여부 */
  showActions?: boolean;
  /** 추가 클래스 */
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

const getRoleLabel = (role: string, customRole?: string): string => {
  // 커스텀 역할이면 customRole 사용
  if (role === 'other' && customRole) {
    return customRole;
  }
  const roleMap: Record<string, string> = {
    dealer: '딜러',
    manager: '매니저',
    chiprunner: '칩러너',
    admin: '관리자',
  };
  return roleMap[role] ?? role;
};

const getRoleBadgeVariant = (
  role: string
): 'primary' | 'success' | 'warning' | 'error' | 'default' => {
  switch (role) {
    case 'dealer':
      return 'primary';
    case 'manager':
      return 'warning';
    case 'chiprunner':
      return 'success';
    case 'admin':
      return 'error';
    default:
      return 'default';
  }
};

const getStatusBadgeVariant = (
  status: ApplicationStatus
): 'primary' | 'success' | 'warning' | 'error' | 'default' => {
  switch (status) {
    case 'applied':
    case 'pending':
      return 'primary';
    case 'confirmed':
    case 'completed':
      return 'success';
    case 'rejected':
    case 'cancelled':
      return 'error';
    default:
      return 'default';
  }
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${month}/${day}(${dayOfWeek})`;
};

const getAssignmentsSummary = (assignments: Assignment[]): string => {
  if (!assignments?.length) return '';

  const uniqueDates = new Set<string>();
  assignments.forEach((a) => a.dates.forEach((d) => uniqueDates.add(d)));

  // v3.0: roleIds 사용
  const roles = [...new Set(assignments.map((a) => a.roleIds[0] ?? '').filter(Boolean))];
  const roleLabels = roles.map((r) => getRoleLabel(r)).join(', ');

  return `${roleLabels} / ${uniqueDates.size}일`;
};

const getUniqueRolesFromAssignments = (assignments: Assignment[]): string[] => {
  const roles = new Set<string>();
  // v3.0: roleIds 사용
  assignments.forEach((a) => {
    a.roleIds.forEach((r) => roles.add(r));
  });
  return [...roles];
};

// ============================================================================
// Sub Components
// ============================================================================

/**
 * 지원자 기본 정보 헤더
 */
const ApplicantHeader = memo(function ApplicantHeader({
  application,
  compact,
}: {
  application: Application;
  compact?: boolean;
}) {
  const roles =
    application.assignments.length > 0
      ? getUniqueRolesFromAssignments(application.assignments)
      : ['other'];

  return (
    <View className="flex-row items-start justify-between mb-2">
      <View className="flex-1">
        {/* 이름 + 상태 */}
        <View className="flex-row items-center mb-1">
          <Text
            className={`font-semibold text-gray-900 dark:text-white ${
              compact ? 'text-base' : 'text-lg'
            }`}
          >
            {application.applicantName}
          </Text>
          <Badge variant={getStatusBadgeVariant(application.status)} size="sm" className="ml-2">
            {APPLICATION_STATUS_LABELS[application.status]}
          </Badge>
        </View>

        {/* 역할 뱃지 */}
        <View className="flex-row flex-wrap gap-1">
          {roles.map((role, index) => (
            <Badge key={`${role}-${index}`} variant={getRoleBadgeVariant(role)} size="sm">
              {getRoleLabel(role)}
            </Badge>
          ))}
        </View>
      </View>

      {/* assignments 기반 v2.0 뱃지 (레거시 제거됨 - 모든 지원서가 v2.0) */}
    </View>
  );
});

/**
 * Assignment 요약 정보
 */
const AssignmentsSummary = memo(function AssignmentsSummary({
  assignments,
  compact,
}: {
  assignments: Assignment[];
  compact?: boolean;
}) {
  // 날짜별 그룹화 (Hooks는 조건부 반환 전에 호출해야 함)
  const dateGroups = useMemo(() => {
    if (!assignments?.length) return [];

    const groups = new Map<string, { roles: Set<string>; timeSlots: Set<string> }>();

    assignments.forEach((a) => {
      a.dates.forEach((date) => {
        if (!groups.has(date)) {
          groups.set(date, { roles: new Set(), timeSlots: new Set() });
        }
        const group = groups.get(date)!;
        // v3.0: roleIds 사용
        a.roleIds.forEach((r) => group.roles.add(r));
        if (a.timeSlot) group.timeSlots.add(a.timeSlot);
      });
    });

    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, compact ? 2 : 5);
  }, [assignments, compact]);

  // Early return after all hooks
  if (!assignments?.length) return null;

  if (compact) {
    return (
      <View className="mt-2">
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          📅 {getAssignmentsSummary(assignments)}
        </Text>
      </View>
    );
  }

  return (
    <View className="mt-3 bg-gray-50 dark:bg-surface rounded-lg p-3">
      <Text className="text-sm font-medium text-gray-900 dark:text-white mb-2">지원 일정</Text>
      {dateGroups.map(([date, { roles, timeSlots }]) => (
        <View key={date} className="flex-row items-center mb-1.5 last:mb-0">
          <Text className="text-sm text-gray-600 dark:text-gray-400 w-20">{formatDate(date)}</Text>
          <Text className="text-sm text-gray-500 dark:text-gray-400 flex-1">
            {[...roles].map((r) => getRoleLabel(r)).join(', ')}
          </Text>
          <Text className="text-xs text-gray-400 dark:text-gray-500">
            {[...timeSlots].join(', ')}
          </Text>
        </View>
      ))}
      {assignments.length > (compact ? 2 : 5) && (
        <Text className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          +{assignments.length - (compact ? 2 : 5)}개 더 있음
        </Text>
      )}
    </View>
  );
});

/**
 * 사전질문 답변 미리보기
 */
const PreQuestionPreview = memo(function PreQuestionPreview({
  answers,
  compact,
}: {
  answers: Application['preQuestionAnswers'];
  compact?: boolean;
}) {
  if (!answers?.length) return null;

  if (compact) {
    return (
      <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        📝 사전질문 {answers.length}개 답변
      </Text>
    );
  }

  return (
    <View className="mt-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg p-3">
      <Text className="text-sm font-medium text-primary-900 dark:text-primary-200 mb-2">
        사전질문 답변
      </Text>
      {answers.slice(0, 2).map((answer) => (
        <View key={answer.questionId} className="mb-1.5 last:mb-0">
          <Text className="text-xs text-primary-700 dark:text-primary-300" numberOfLines={2}>
            {answer.answer}
          </Text>
        </View>
      ))}
      {answers.length > 2 && (
        <Text className="text-xs text-primary-400 dark:text-primary-500 mt-1">
          +{answers.length - 2}개 답변 더 있음
        </Text>
      )}
    </View>
  );
});

/**
 * 액션 버튼 영역
 */
const ActionButtons = memo(function ActionButtons({
  status,
  onConfirm,
  onReject,
  isLoading,
}: {
  status: ApplicationStatus;
  onConfirm?: () => void;
  onReject?: () => void;
  isLoading?: boolean;
}) {
  // 처리 가능한 상태인지 확인
  const canProcess = status === 'applied' || status === 'pending';

  if (!canProcess) return null;

  return (
    <View className="flex-row gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-surface-overlay">
      {onConfirm && (
        <Button
          variant="primary"
          size="sm"
          onPress={onConfirm}
          loading={isLoading}
          className="flex-1"
        >
          확정
        </Button>
      )}
      {onReject && (
        <Button variant="ghost" size="sm" onPress={onReject} disabled={isLoading}>
          거절
        </Button>
      )}
    </View>
  );
});

// ============================================================================
// Main Component
// ============================================================================

/**
 * 지원자 카드 컴포넌트
 *
 * @description 지원자 정보와 확정/취소 이력을 함께 표시
 *
 * @example
 * // 목록용 컴팩트 모드
 * <ApplicantCard
 *   application={application}
 *   onPress={handlePress}
 *   compact
 * />
 *
 * @example
 * // 상세 모드 (이력 + 액션)
 * <ApplicantCard
 *   application={application}
 *   onConfirm={handleConfirm}
 *   onReject={handleReject}
 *   showHistory
 *   showActions
 * />
 */
export const ApplicantCard = memo(function ApplicantCard({
  application,
  onPress,
  onConfirm,
  onReject,
  isLoading = false,
  compact = false,
  showHistory = false,
  showActions = false,
  className = '',
}: ApplicantCardProps) {
  // 이벤트 핸들러
  const handlePress = useCallback(() => {
    onPress?.(application.id);
  }, [application.id, onPress]);

  const handleConfirm = useCallback(() => {
    onConfirm?.(application.id);
  }, [application.id, onConfirm]);

  const handleReject = useCallback(() => {
    onReject?.(application.id);
  }, [application.id, onReject]);

  // 히스토리 존재 여부
  const hasHistory = application.confirmationHistory?.length || application.originalApplication;

  // 접근성 라벨
  const accessibilityLabel = `${application.applicantName}, ${
    APPLICATION_STATUS_LABELS[application.status]
  }, ${getRoleLabel(application.assignments[0]?.roleIds?.[0] || 'other', application.customRole)}`;

  const CardContent = (
    <>
      {/* 헤더: 이름, 상태, 역할 */}
      <ApplicantHeader application={application} compact={compact} />

      {/* 연락처 (컴팩트 아닐 때만) */}
      {!compact && application.applicantPhone && (
        <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          📞 {application.applicantPhone}
        </Text>
      )}

      {/* v2.0 Assignment 요약 */}
      {application.assignments?.length ? (
        <AssignmentsSummary assignments={application.assignments} compact={compact} />
      ) : null}

      {/* 지원 메시지 */}
      {application.message && (
        <View className={`mt-2 ${compact ? '' : 'bg-gray-50 dark:bg-surface rounded-lg p-3'}`}>
          {!compact && (
            <Text className="text-sm font-medium text-gray-900 dark:text-white mb-1">
              지원 메시지
            </Text>
          )}
          <Text
            className={`text-gray-600 dark:text-gray-400 ${compact ? 'text-xs' : 'text-sm'}`}
            numberOfLines={compact ? 2 : undefined}
          >
            {application.message}
          </Text>
        </View>
      )}

      {/* 사전질문 답변 미리보기 */}
      {application.preQuestionAnswers?.length ? (
        <PreQuestionPreview answers={application.preQuestionAnswers} compact={compact} />
      ) : null}

      {/* 확정/취소 이력 타임라인 */}
      {showHistory && hasHistory && (
        <View className="mt-4">
          <ConfirmationHistoryTimeline
            history={application.confirmationHistory ?? []}
            originalApplication={application.originalApplication}
            compact={compact}
            maxDisplay={compact ? 2 : undefined}
          />
        </View>
      )}

      {/* 액션 버튼 */}
      {showActions && (
        <ActionButtons
          status={application.status}
          onConfirm={onConfirm ? handleConfirm : undefined}
          onReject={onReject ? handleReject : undefined}
          isLoading={isLoading}
        />
      )}
    </>
  );

  // Pressable 래퍼 (onPress 있을 때)
  if (onPress) {
    return (
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="탭하면 지원자 상세 정보를 볼 수 있습니다"
        className={`
          bg-white dark:bg-surface rounded-xl
          ${compact ? 'p-3' : 'p-4'}
          border border-gray-100 dark:border-surface-overlay
          active:opacity-80
          ${className}
        `}
      >
        {CardContent}
      </Pressable>
    );
  }

  // 일반 View (onPress 없을 때)
  return (
    <View
      className={`
        bg-white dark:bg-surface rounded-xl
        ${compact ? 'p-3' : 'p-4'}
        border border-gray-100 dark:border-surface-overlay
        ${className}
      `}
    >
      {CardContent}
    </View>
  );
});

export default ApplicantCard;
