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

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { memo, useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, LayoutAnimation } from 'react-native';
import { Avatar, CardStripe, Checkbox, NumericText } from '@/components/ui';
import { PAYROLL_STATUS_CONFIG as PAYROLL_STATUS_SHARED } from './helpers/settlementConfig';
import {
  CalendarIcon,
  BanknotesIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
} from '@/components/icons';
import {
  formatDateDisplay,
  formatGroupRolesDisplay,
  getSettlableWorkLogIds,
} from '@/utils/settlementGrouping';
import { formatCurrency } from '@/utils/settlement';
import { getRoleDisplayName } from '@/types/unified';
import { useUserProfile } from '@/hooks/useUserProfile';
import type { GroupedSettlement, DateSettlementStatus } from '@/types/settlement';
import type { WorkLog } from '@/types';
import { STATUS } from '@/constants';
import { PAYROLL_STATUS_LABELS, toSettlementDisplayStatus } from '@/shared/status';
import type { SettlementDisplayStatus } from '@/shared/status';

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

// 날짜 행 전용 색 조합(700/300). statusConfig 의 PAYROLL_STATUS 는 600/400 이라 값이 다르다 —
// 이 행은 카드 안에 촘촘히 쌓여서 한 단계 진한 대비를 쓴다. 라벨만 SSOT 를 공유한다.
// ⚠️ 정산 라벨 맵이 아직 4곳에 흩어져 있다(여기 · settlementConfig · SettlementDetailModal/constants
//    · constants/statusConfig). 라벨은 PAYROLL_STATUS_LABELS 한 곳으로 모았지만 색/variant 는
//    화면마다 달라 통합하지 않았다 — 합치려면 배지 음영이 바뀌므로 시각 확인이 필요하다.
const PAYROLL_STATUS_CONFIG: Record<
  SettlementDisplayStatus,
  { label: string; bgColor: string; textColor: string }
> = {
  pending: {
    label: PAYROLL_STATUS_LABELS.pending,
    bgColor: 'bg-warning-100 dark:bg-warning-900/30',
    textColor: 'text-warning-700 dark:text-warning-300',
  },
  completed: {
    label: PAYROLL_STATUS_LABELS.completed,
    bgColor: 'bg-success-50 dark:bg-success-900/30',
    textColor: 'text-success-700 dark:text-success-300',
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
  const payrollConfig = PAYROLL_STATUS_CONFIG[toSettlementDisplayStatus(status.payrollStatus)];
  const roleDisplay = getRoleDisplayName(status.role, status.customRole);
  // 정산 버튼 게이트는 서버 게이트와 같은 축을 봐야 한다 — 시각만 보면 status 미승격 레거시 행에서
  // "누르면 항상 실패하는 버튼" 이 된다. 개별 카드(SettlementCard)와 같은 술어를 쓴다.
  const canSettle =
    status.hasValidTimes &&
    status.isSettlableStatus &&
    status.payrollStatus !== STATUS.PAYROLL.COMPLETED;

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
        !isLast ? 'border-b border-secondary-100 dark:border-surface-overlay/50' : ''
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
        <Text className="text-sm font-sans-medium text-secondary-800 dark:text-secondary-200">
          {status.formattedDate}
        </Text>
        <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
          {roleDisplay}
        </Text>
      </View>

      {/* 금액 */}
      <Text className="text-sm font-sans-semibold text-content-secondary mr-3">
        {status.hasValidTimes ? formatCurrency(status.amount) : '-'}
      </Text>

      {/* 상태 뱃지 또는 정산 버튼 */}
      {canSettle && onSettle && !selectionMode ? (
        <Pressable
          onPress={handleSettle}
          className="px-2.5 py-1 bg-primary-500 rounded-lg active:opacity-70"
          accessibilityLabel="지급 완료로 표시"
        >
          <Text className="text-xs font-sans-medium text-content-onGold">지급 완료</Text>
        </Pressable>
      ) : (
        <View className={`px-2 py-0.5 rounded-sm ${payrollConfig.bgColor}`}>
          <Text className={`text-xs font-sans-medium ${payrollConfig.textColor}`}>
            {/* 시각은 있는데 status 미승격인 행은 '정산 대기' 로만 보이면 왜 버튼이 없는지 알 수 없다.
                차단 사유를 배지에 드러낸다(개별 카드의 안내 배너와 같은 목적). */}
            {!status.hasValidTimes
              ? '출퇴근 미완료'
              : !status.isSettlableStatus && status.payrollStatus !== STATUS.PAYROLL.COMPLETED
                ? '출퇴근 미확정'
                : payrollConfig.label}
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
  const { displayName, profilePhotoURL, profilePhotoURLBlurhash } = useUserProfile({
    userId: group.staffId,
    fallbackName: group.staffProfile.name,
    fallbackNickname: group.staffProfile.nickname,
    fallbackPhotoURL: group.staffProfile.photoURL,
    fallbackPhotoURLBlurhash: group.staffProfile.photoURLBlurhash,
  });

  // 역할 표시 텍스트
  const rolesDisplay = useMemo(() => {
    return formatGroupRolesDisplay(group);
  }, [group]);

  // 날짜 표시 텍스트
  const dateDisplay = useMemo(() => {
    return formatDateDisplay(group.dateRange.dates);
  }, [group.dateRange.dates]);

  // 정산 가능 WorkLog 목록 — 판정은 getSettlableWorkLogIds 하나만 쓴다.
  // 예전엔 같은 조건을 여기서 다시 썼고, 그 복제본에만 status 축이 빠져 있었다.
  const settlableWorkLogs = useMemo(() => {
    const settlableIds = new Set(getSettlableWorkLogIds(group));
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

  // 그룹 대표 상태 → stripe tone. 한 건이라도 미정산이면 미정산으로 본다.
  // 예전엔 그 사이에 'processing' 우선순위 분기가 있었지만 DB enum 에 없는 값이라
  // `some(s => s.payrollStatus === 'processing')` 이 참이 될 수 없었다 — 죽은 분기였다.
  const groupDisplayStatus: SettlementDisplayStatus = useMemo(
    () => (group.summary.pendingCount > 0 ? 'pending' : 'completed'),
    [group.summary.pendingCount]
  );

  const stripeTone = PAYROLL_STATUS_SHARED[groupDisplayStatus].stripeTone;

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
    <CardStripe tone={stripeTone} style={{ marginBottom: 12 }}>
      <View className="bg-surface-card dark:bg-surface-elevated rounded-md pl-4 p-3">
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
            <Avatar
              source={profilePhotoURL}
              name={displayName}
              size="md"
              className="mr-3"
              blurhash={profilePhotoURLBlurhash}
            />

            {/* 이름 + 역할 */}
            <View className="flex-1">
              <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
                {displayName}
              </Text>
              <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                {rolesDisplay}
              </Text>
            </View>

            {/* 금액/건수 */}
            <View className="items-end">
              <NumericText
                className="text-base font-sans-bold text-primary-600 dark:text-primary-400"
                style={{
                  letterSpacing: -0.3,
                  textAlign: 'right',
                }}
              >
                {formatCurrency(group.summary.totalAmount)}
              </NumericText>
              <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                {group.summary.totalCount}건
              </Text>
            </View>
          </View>
        </Pressable>

        {/* 날짜 범위 */}
        <View className="flex-row items-center mt-3">
          <CalendarIcon size={14} color={SECONDARY_PALETTE[500]} />
          <Text className="ml-1.5 text-sm text-content-muted dark:text-secondary-400 font-sans">
            {dateDisplay}
          </Text>
        </View>

        {/* 정산 요약 (미정산/완료 건수) */}
        <View className="flex-row items-center mt-2 flex-wrap gap-2">
          {group.summary.pendingCount > 0 && (
            <View className="flex-row items-center px-2 py-1 bg-warning-50 dark:bg-warning-900/20 rounded-lg">
              <ClockIcon size={12} color="#D4A017" />
              <Text className="ml-1 text-xs text-warning-700 dark:text-warning-300 font-sans">
                미정산 {group.summary.pendingCount}건 ({formatCurrency(group.summary.pendingAmount)}
                )
              </Text>
            </View>
          )}
          {group.summary.completedCount > 0 && (
            <View className="flex-row items-center px-2 py-1 bg-success-50 dark:bg-success-900/20 rounded-lg">
              <CheckCircleIcon size={12} color="#22C55E" />
              <Text className="ml-1 text-xs text-success-700 dark:text-success-300 font-sans">
                완료 {group.summary.completedCount}건 (
                {formatCurrency(group.summary.completedAmount)})
              </Text>
            </View>
          )}
          {group.summary.settlableCount < group.summary.pendingCount && (
            <View className="flex-row items-center px-2 py-1 bg-surface-page dark:bg-surface rounded-lg">
              <ExclamationCircleIcon size={12} color={SECONDARY_PALETTE[500]} />
              <Text className="ml-1 text-xs text-content-muted dark:text-secondary-400 font-sans">
                출퇴근 미완료 {group.summary.pendingCount - group.summary.settlableCount}건
              </Text>
            </View>
          )}
        </View>

        {/* 펼침/접힘 버튼 */}
        <Pressable
          onPress={toggleExpanded}
          className="flex-row items-center justify-center mt-3 py-2 border-t border-divider"
          accessibilityLabel={isExpanded ? '날짜별 상세 접기' : '날짜별 상세 펼치기'}
        >
          <Text className="text-sm text-secondary-500 dark:text-secondary-400 mr-1 font-sans">
            날짜별 상세
          </Text>
          {isExpanded ? (
            <ChevronUpIcon size={16} color={SECONDARY_PALETTE[500]} />
          ) : (
            <ChevronDownIcon size={16} color={SECONDARY_PALETTE[500]} />
          )}
        </Pressable>

        {/* 펼침 상태: 날짜별 정산 상태 */}
        {isExpanded && (
          <View className="mt-2 pt-2 border-t border-secondary-100 dark:border-surface-overlay">
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
          <View className="mt-3 pt-3 border-t border-divider">
            <Pressable
              onPress={handleBulkSettle}
              className="flex-row items-center justify-center py-3 bg-primary-500 rounded-lg active:opacity-70"
              accessibilityLabel={`${settlableWorkLogs.length}건 일괄 정산`}
            >
              <BanknotesIcon size={18} color="#fff" />
              <Text className="ml-2 text-sm font-sans-semibold text-content-onGold">
                {settlableWorkLogs.length}건 일괄 정산
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </CardStripe>
  );
});
