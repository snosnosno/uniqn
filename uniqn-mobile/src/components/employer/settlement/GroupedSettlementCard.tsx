/**
 * UNIQN Mobile - GroupedSettlementCard 컴포넌트
 *
 * @description 같은 스태프의 여러 정산 기록을 통합 표시하는 카드
 * - 기본 상태: 접힘 (총 금액, 건수만 표시)
 * - 펼침 상태: 개별 날짜별 정산 상태 표시
 * - 다중 역할 통합 지원
 *
 * @version 1.0.0
 */

import React, { memo, useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, LayoutAnimation } from 'react-native';
import { Card, Avatar, Checkbox } from '@/components/ui';
import {
  CalendarIcon,
  BanknotesIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
} from '@/components/icons';
import { formatDateDisplay, formatGroupRolesDisplay } from '@/utils/settlementGrouping';
import { formatCurrency } from '@/utils/settlement';
import { getRoleDisplayName } from '@/types/unified';
import { useUserProfile } from '@/hooks/useUserProfile';
import type { GroupedSettlement, DateSettlementStatus } from '@/types/settlement';
import type { WorkLog, PayrollStatus } from '@/types';
import { STATUS } from '@/constants';

// ============================================================================
// Types
// ============================================================================

export interface GroupedSettlementCardProps {
  /** 그룹화된 정산 정보 */
  group: GroupedSettlement;
  /** 카드 클릭 핸들러 (첫 번째 WorkLog 상세) - 그룹 정보 포함 */
  onPress?: (workLog: WorkLog, group: GroupedSettlement) => void;
  /** 개별 날짜 클릭 핸들러 - 그룹 정보 포함 */
  onDatePress?: (workLog: WorkLog, group: GroupedSettlement) => void;
  /** 그룹 일괄 정산 핸들러 */
  onBulkSettle?: (workLogs: WorkLog[]) => void;
  /** 개별 정산 핸들러 */
  onSettle?: (workLog: WorkLog) => void;
  /** 기본 펼침 상태 (기본: false) */
  defaultExpanded?: boolean;
  /** 선택 모드 활성화 */
  selectionMode?: boolean;
  /** 선택된 WorkLog ID 집합 */
  selectedIds?: Set<string>;
  /** 선택 토글 핸들러 */
  onToggleSelect?: (workLog: WorkLog) => void;
}

// ============================================================================
// Constants
// ============================================================================

const PAYROLL_STATUS_CONFIG: Record<
  PayrollStatus,
  { label: string; bgColor: string; textColor: string }
> = {
  pending: {
    label: '미정산',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    textColor: 'text-yellow-700 dark:text-yellow-300',
  },
  processing: {
    label: '처리중',
    bgColor: 'bg-primary-100 dark:bg-primary-900/30',
    textColor: 'text-primary-700 dark:text-primary-300',
  },
  completed: {
    label: '정산완료',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-700 dark:text-green-300',
  },
};

// ============================================================================
// Sub-components
// ============================================================================

/** 날짜별 정산 상태 행 */
const DateStatusRow = memo(function DateStatusRow({
  status,
  workLog,
  group,
  isLast,
  selectionMode,
  isSelected,
  onToggleSelect,
  onPress,
  onSettle,
}: {
  status: DateSettlementStatus;
  workLog: WorkLog;
  group: GroupedSettlement;
  isLast: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (workLog: WorkLog) => void;
  onPress?: (workLog: WorkLog, group: GroupedSettlement) => void;
  onSettle?: (workLog: WorkLog) => void;
}) {
  const payrollConfig = PAYROLL_STATUS_CONFIG[status.payrollStatus];
  const roleDisplay = getRoleDisplayName(status.role, status.customRole);
  const canSettle = status.hasValidTimes && status.payrollStatus !== STATUS.PAYROLL.COMPLETED;

  const handlePress = useCallback(() => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(workLog);
    } else {
      onPress?.(workLog, group);
    }
  }, [selectionMode, onToggleSelect, onPress, workLog, group]);

  const handleSettle = useCallback(() => {
    onSettle?.(workLog);
  }, [onSettle, workLog]);

  return (
    <Pressable
      onPress={handlePress}
      className={`flex-row items-center py-2.5 ${
        !isLast ? 'border-b border-gray-100 dark:border-surface-overlay/50' : ''
      }`}
      accessibilityLabel={`${status.formattedDate} ${roleDisplay} ${payrollConfig.label}`}
    >
      {/* 선택 모드: 체크박스 */}
      {selectionMode && (
        <View className="mr-2">
          <Checkbox
            checked={isSelected ?? false}
            onChange={() => onToggleSelect?.(workLog)}
            size="sm"
          />
        </View>
      )}

      {/* 날짜 */}
      <View className="flex-1">
        <Text className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {status.formattedDate}
        </Text>
        <Text className="text-xs text-gray-500 dark:text-gray-400">{roleDisplay}</Text>
      </View>

      {/* 금액 */}
      <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mr-3">
        {status.hasValidTimes ? formatCurrency(status.amount) : '-'}
      </Text>

      {/* 상태 뱃지 또는 정산 버튼 */}
      {canSettle && onSettle && !selectionMode ? (
        <Pressable
          onPress={handleSettle}
          className="px-2.5 py-1 bg-primary-500 rounded-lg active:opacity-70"
          accessibilityLabel="정산하기"
        >
          <Text className="text-xs font-medium text-white">정산</Text>
        </Pressable>
      ) : (
        <View className={`px-2 py-0.5 rounded-full ${payrollConfig.bgColor}`}>
          <Text className={`text-xs font-medium ${payrollConfig.textColor}`}>
            {status.hasValidTimes ? payrollConfig.label : '출퇴근 미완료'}
          </Text>
        </View>
      )}
    </Pressable>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export const GroupedSettlementCard = memo(function GroupedSettlementCard({
  group,
  onPress,
  onDatePress,
  onBulkSettle,
  onSettle,
  defaultExpanded = false,
  selectionMode = false,
  selectedIds,
  onToggleSelect,
}: GroupedSettlementCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // 사용자 프로필 조회 (프로필 사진, 닉네임)
  const { displayName, profilePhotoURL } = useUserProfile({
    userId: group.staffId,
    fallbackName: group.staffProfile.name,
    fallbackNickname: group.staffProfile.nickname,
    fallbackPhotoURL: group.staffProfile.photoURL,
  });

  // 역할 표시 텍스트
  const rolesDisplay = useMemo(() => {
    return formatGroupRolesDisplay(group);
  }, [group]);

  // 날짜 표시 텍스트
  const dateDisplay = useMemo(() => {
    return formatDateDisplay(group.dateRange.dates);
  }, [group.dateRange.dates]);

  // 정산 가능 WorkLog 목록
  const settlableWorkLogs = useMemo(() => {
    const settlableIds = new Set(
      group.dateStatuses
        .filter((s) => s.hasValidTimes && s.payrollStatus !== STATUS.PAYROLL.COMPLETED)
        .map((s) => s.workLogId)
    );
    return group.originalWorkLogs.filter((wl) => settlableIds.has(wl.id));
  }, [group]);

  // WorkLog ID → WorkLog 맵
  const workLogMap = useMemo(() => {
    return new Map(group.originalWorkLogs.map((wl) => [wl.id, wl]));
  }, [group.originalWorkLogs]);

  // 선택된 항목 수
  const selectedCount = useMemo(() => {
    if (!selectedIds) return 0;
    return group.originalWorkLogs.filter((wl) => selectedIds.has(wl.id)).length;
  }, [selectedIds, group.originalWorkLogs]);

  // 전체 선택 여부
  const isAllSelected = selectedCount === group.originalWorkLogs.length;

  // 펼침/접힘 토글
  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded((prev) => !prev);
  }, []);

  // 카드 클릭
  const handlePress = useCallback(() => {
    if (group.originalWorkLogs.length > 0) {
      onPress?.(group.originalWorkLogs[0], group);
    }
  }, [onPress, group]);

  // 그룹 일괄 정산
  const handleBulkSettle = useCallback(() => {
    if (settlableWorkLogs.length > 0) {
      onBulkSettle?.(settlableWorkLogs);
    }
  }, [onBulkSettle, settlableWorkLogs]);

  // 그룹 전체 선택/해제
  const handleToggleAllSelect = useCallback(() => {
    if (!onToggleSelect) return;

    // 전체 선택 상태면 전체 해제, 아니면 전체 선택
    for (const workLog of group.originalWorkLogs) {
      if (isAllSelected) {
        // 선택되어 있으면 해제
        if (selectedIds?.has(workLog.id)) {
          onToggleSelect(workLog);
        }
      } else {
        // 선택되어 있지 않으면 선택
        if (!selectedIds?.has(workLog.id)) {
          onToggleSelect(workLog);
        }
      }
    }
  }, [onToggleSelect, group.originalWorkLogs, isAllSelected, selectedIds]);

  return (
    <Card className="mb-3" variant="elevated" padding="md">
      {/* 상단: 프로필 + 상태/금액 */}
      <Pressable
        onPress={selectionMode ? handleToggleAllSelect : handlePress}
        className="active:opacity-80"
        accessibilityLabel={`${displayName} 정산 상세 보기`}
      >
        <View className="flex-row items-center">
          {/* 선택 모드: 체크박스 */}
          {selectionMode && (
            <View className="mr-3">
              <Checkbox
                checked={isAllSelected || (selectedCount > 0 && !isAllSelected)}
                onChange={handleToggleAllSelect}
              />
            </View>
          )}

          {/* 아바타 */}
          <Avatar source={profilePhotoURL} name={displayName} size="md" className="mr-3" />

          {/* 이름 + 역할 */}
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-900 dark:text-white">
              {displayName}
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400">{rolesDisplay}</Text>
          </View>

          {/* 금액/건수 */}
          <View className="items-end">
            <Text className="text-base font-bold text-primary-600 dark:text-primary-400">
              {formatCurrency(group.summary.totalAmount)}
            </Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              {group.summary.totalCount}건
            </Text>
          </View>
        </View>
      </Pressable>

      {/* 날짜 범위 */}
      <View className="flex-row items-center mt-3">
        <CalendarIcon size={14} color="#6B7280" />
        <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-400">{dateDisplay}</Text>
      </View>

      {/* 정산 요약 (미정산/완료 건수) */}
      <View className="flex-row items-center mt-2 flex-wrap gap-2">
        {group.summary.pendingCount > 0 && (
          <View className="flex-row items-center px-2 py-1 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <ClockIcon size={12} color="#D97706" />
            <Text className="ml-1 text-xs text-yellow-700 dark:text-yellow-300">
              미정산 {group.summary.pendingCount}건 ({formatCurrency(group.summary.pendingAmount)})
            </Text>
          </View>
        )}
        {group.summary.completedCount > 0 && (
          <View className="flex-row items-center px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <CheckCircleIcon size={12} color="#059669" />
            <Text className="ml-1 text-xs text-green-700 dark:text-green-300">
              완료 {group.summary.completedCount}건 ({formatCurrency(group.summary.completedAmount)}
              )
            </Text>
          </View>
        )}
        {group.summary.settlableCount < group.summary.pendingCount && (
          <View className="flex-row items-center px-2 py-1 bg-gray-50 dark:bg-surface rounded-lg">
            <ExclamationCircleIcon size={12} color="#6B7280" />
            <Text className="ml-1 text-xs text-gray-600 dark:text-gray-400">
              출퇴근 미완료 {group.summary.pendingCount - group.summary.settlableCount}건
            </Text>
          </View>
        )}
      </View>

      {/* 펼침/접힘 버튼 */}
      <Pressable
        onPress={toggleExpanded}
        className="flex-row items-center justify-center mt-3 py-2 border-t border-gray-200 dark:border-surface-overlay"
        accessibilityLabel={isExpanded ? '날짜별 상세 접기' : '날짜별 상세 펼치기'}
      >
        <Text className="text-sm text-gray-500 dark:text-gray-400 mr-1">날짜별 상세</Text>
        {isExpanded ? (
          <ChevronUpIcon size={16} color="#6B7280" />
        ) : (
          <ChevronDownIcon size={16} color="#6B7280" />
        )}
      </Pressable>

      {/* 펼침 상태: 날짜별 정산 상태 */}
      {isExpanded && (
        <View className="mt-2 pt-2 border-t border-gray-100 dark:border-surface-overlay">
          {group.dateStatuses.map((status, index) => {
            const workLog = workLogMap.get(status.workLogId);
            if (!workLog) return null;

            return (
              <DateStatusRow
                key={status.workLogId}
                status={status}
                workLog={workLog}
                group={group}
                isLast={index === group.dateStatuses.length - 1}
                selectionMode={selectionMode}
                isSelected={selectedIds?.has(status.workLogId)}
                onToggleSelect={onToggleSelect}
                onPress={onDatePress}
                onSettle={onSettle}
              />
            );
          })}
        </View>
      )}

      {/* 일괄 정산 버튼 (미정산 + 출퇴근 완료가 있을 때) */}
      {!selectionMode && settlableWorkLogs.length > 0 && onBulkSettle && (
        <View className="mt-3 pt-3 border-t border-gray-200 dark:border-surface-overlay">
          <Pressable
            onPress={handleBulkSettle}
            className="flex-row items-center justify-center py-3 bg-primary-500 rounded-lg active:opacity-70"
            accessibilityLabel={`${settlableWorkLogs.length}건 일괄 정산`}
          >
            <BanknotesIcon size={18} color="#fff" />
            <Text className="ml-2 text-sm font-semibold text-white">
              {settlableWorkLogs.length}건 일괄 정산
            </Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
});

export default GroupedSettlementCard;
