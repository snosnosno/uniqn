/**
 * UNIQN Mobile - 정산 상세 모달
 *
 * @description 근무 기록 상세 정보 및 정산 관리 모달
 * @version 2.0.0 - 서브컴포넌트 분리 (모듈화)
 */

import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { useSettlementDateNavigation } from '@/hooks';
import { XMarkIcon } from '../../icons';
import { useThemeStore } from '@/stores/themeStore';
import { getUserProfile } from '@/services';
import { parseTimestamp, calculateSettlementFromWorkLog } from '@/utils/settlement';
import { getAllowanceItems } from '@/utils/allowanceUtils';

// Sub-components
import { DateNavigationHeader } from './DateNavigationHeader';
import { StaffProfileHeader } from './StaffProfileHeader';
import { WorkTimeSection } from './WorkTimeSection';
import { SettlementAmountSection } from './SettlementAmountSection';
import { TimeModificationHistory } from './TimeModificationHistory';
import { AmountModificationHistory } from './AmountModificationHistory';
import { SettlementActionButtons } from './SettlementActionButtons';
import { SettlementCompletedBanner } from './SettlementCompletedBanner';

// Types
import type { UserProfile } from '@/services';
import type { WorkLog, PayrollStatus } from '@/types';
import type { SettlementDetailModalProps } from './types';

// Re-export types for backward compatibility
export type { SalaryType, SalaryInfo } from '@/utils/settlement';
export type { SettlementDetailModalProps } from './types';

// ============================================================================
// Main Component
// ============================================================================

export function SettlementDetailModal({
  visible,
  onClose,
  workLog,
  salaryInfo,
  allowances,
  taxSettings,
  onEditTime,
  onEditAmount,
  onSettle,
  groupedSettlement,
  onDateChange,
}: SettlementDetailModalProps) {
  // 다크모드 감지
  const { isDarkMode: isDark } = useThemeStore();

  // 사용자 프로필 조회
  const { data: userProfile } = useQuery<UserProfile | null>({
    queryKey: queryKeys.user.profile(workLog?.staffId ?? ''),
    queryFn: () => getUserProfile(workLog!.staffId),
    enabled: visible && !!workLog?.staffId,
    staleTime: 5 * 60 * 1000,
  });

  // 수정 이력 접기/펼치기 상태 (기본: 접힘)
  const [isTimeHistoryExpanded, setIsTimeHistoryExpanded] = useState(false);
  const [isAmountHistoryExpanded, setIsAmountHistoryExpanded] = useState(false);

  // ============================================================================
  // 날짜 네비게이션 로직 (훅 사용)
  // ============================================================================
  const {
    isGroupMode,
    currentDateIndex,
    totalDays,
    canGoPrev,
    canGoNext,
    handlePrevDate,
    handleNextDate,
  } = useSettlementDateNavigation(workLog, groupedSettlement, onDateChange);

  // 계산된 값들
  const startTime = useMemo(() => workLog ? parseTimestamp(workLog.checkInTime) : null, [workLog]);
  const endTime = useMemo(() => workLog ? parseTimestamp(workLog.checkOutTime) : null, [workLog]);
  const workDate = useMemo(() => workLog ? parseTimestamp(workLog.date) : null, [workLog]);

  const settlement = useMemo(() =>
    workLog ? calculateSettlementFromWorkLog(workLog, salaryInfo, allowances, taxSettings) : null,
    [workLog, salaryInfo, allowances, taxSettings]
  );

  const allowanceItems = useMemo(() => getAllowanceItems(allowances), [allowances]);

  // 프로필 정보
  const profilePhotoURL = userProfile?.photoURL;
  const baseName = userProfile?.name || (workLog as WorkLog & { staffName?: string })?.staffName;
  const displayName = useMemo(() => {
    if (!baseName) return workLog ? `스태프 ${workLog.staffId?.slice(-4) || '알 수 없음'}` : '';
    const nickname = userProfile?.nickname || (workLog as WorkLog & { staffNickname?: string })?.staffNickname;
    return nickname && nickname !== baseName
      ? `${baseName}(${nickname})`
      : baseName;
  }, [baseName, userProfile?.nickname, workLog]);

  const payrollStatus = (workLog?.payrollStatus || 'pending') as PayrollStatus;
  const hasValidTimes = startTime && endTime;

  // 핸들러
  const handleEditTime = useCallback(() => {
    if (workLog && onEditTime) {
      onEditTime(workLog);
    }
  }, [workLog, onEditTime]);

  const handleSettle = useCallback(() => {
    if (workLog && onSettle) {
      onSettle(workLog);
    }
  }, [workLog, onSettle]);

  const handleEditAmount = useCallback(() => {
    if (workLog && onEditAmount) {
      onEditAmount(workLog);
    }
  }, [workLog, onEditAmount]);

  if (!workLog) return null;

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
            정산 상세
          </Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="닫기">
            <XMarkIcon size={24} color="#6B7280" />
          </Pressable>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* 날짜 네비게이션 (그룹 모드일 때만) */}
          {isGroupMode && workLog.date && (
            <DateNavigationHeader
              workLogDate={workLog.date}
              currentDateIndex={currentDateIndex}
              totalDays={totalDays}
              canGoPrev={canGoPrev}
              canGoNext={canGoNext}
              onPrevDate={handlePrevDate}
              onNextDate={handleNextDate}
              isDark={isDark}
            />
          )}

          {/* 프로필 헤더 */}
          <StaffProfileHeader
            profilePhotoURL={profilePhotoURL}
            displayName={displayName}
            payrollStatus={payrollStatus}
            role={workLog.role}
            customRole={(workLog as WorkLog & { customRole?: string }).customRole}
            workDate={workDate}
          />

          {/* 근무 시간 섹션 */}
          <WorkTimeSection
            startTime={startTime}
            endTime={endTime}
            hoursWorked={settlement?.hoursWorked}
          />

          {/* 정산 금액 섹션 */}
          {hasValidTimes && settlement && (
            <SettlementAmountSection
              salaryInfo={salaryInfo}
              settlement={settlement}
              allowanceItems={allowanceItems}
            />
          )}

          {/* 시간 수정 이력 섹션 */}
          <TimeModificationHistory
            modificationHistory={workLog.modificationHistory || []}
            isExpanded={isTimeHistoryExpanded}
            onToggle={() => setIsTimeHistoryExpanded(!isTimeHistoryExpanded)}
          />

          {/* 금액 수정 이력 섹션 */}
          <AmountModificationHistory
            settlementModificationHistory={workLog.settlementModificationHistory || []}
            isExpanded={isAmountHistoryExpanded}
            onToggle={() => setIsAmountHistoryExpanded(!isAmountHistoryExpanded)}
          />

          {/* 정산 완료 표시 */}
          {payrollStatus === 'completed' && (
            <SettlementCompletedBanner payrollDate={workLog.payrollDate} />
          )}

          {/* 액션 버튼 (미정산일 때만) */}
          {payrollStatus === 'pending' && hasValidTimes && (
            <SettlementActionButtons
              onEditTime={onEditTime ? handleEditTime : undefined}
              onEditAmount={onEditAmount ? handleEditAmount : undefined}
              onSettle={onSettle ? handleSettle : undefined}
            />
          )}

          <View className="h-8" />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default SettlementDetailModal;
