/**
 * UNIQN Mobile - 정산 상세 모달
 *
 * @description 근무 기록 상세 정보 및 정산 관리 모달
 * @version 2.0.0 - 서브컴포넌트 분리 (모듈화)
 */

import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSettlementDateNavigation } from '@/hooks';
import { SheetModal } from '../../../ui/SheetModal';
import { useThemeStore } from '@/stores/themeStore';
import { useUserProfile } from '@/hooks/useUserProfile';
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
import type { WorkLog, PayrollStatus } from '@/types';
import { STATUS } from '@/constants';
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
  jobPostingTitle,
}: SettlementDetailModalProps) {
  // 다크모드 감지
  const { isDarkMode: isDark } = useThemeStore();

  // 사용자 프로필 조회
  const { displayName, profilePhotoURL } = useUserProfile({
    userId: workLog?.staffId,
    enabled: visible,
    fallbackName: (workLog as WorkLog & { staffName?: string })?.staffName,
    fallbackNickname: (workLog as WorkLog & { staffNickname?: string })?.staffNickname,
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
  const startTime = useMemo(
    () => (workLog ? parseTimestamp(workLog.checkInTime) : null),
    [workLog]
  );
  const endTime = useMemo(() => (workLog ? parseTimestamp(workLog.checkOutTime) : null), [workLog]);
  const workDate = useMemo(() => (workLog ? parseTimestamp(workLog.date) : null), [workLog]);

  const settlement = useMemo(
    () =>
      workLog ? calculateSettlementFromWorkLog(workLog, salaryInfo, allowances, taxSettings) : null,
    [workLog, salaryInfo, allowances, taxSettings]
  );

  const allowanceItems = useMemo(() => getAllowanceItems(allowances), [allowances]);

  const payrollStatus = (workLog?.payrollStatus || STATUS.PAYROLL.PENDING) as PayrollStatus;
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
    <SheetModal visible={visible} onClose={onClose} title="정산 상세">
      <View className="px-4">
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

        {/* 정산 완료 표시 + 평가 버튼 */}
        {payrollStatus === STATUS.PAYROLL.COMPLETED && (
          <>
            <SettlementCompletedBanner payrollDate={workLog.payrollDate} />
            <View className="px-4 pb-2">
              <Pressable
                onPress={() => {
                  onClose();
                  setTimeout(() => {
                    router.push({
                      pathname: '/(app)/reviews/write',
                      params: {
                        workLogId: workLog.id,
                        revieweeId: workLog.staffId,
                        revieweeName: displayName,
                        reviewerType: 'employer',
                        jobPostingId: workLog.jobPostingId,
                        jobPostingTitle: jobPostingTitle ?? '',
                        workDate: workLog.date,
                      },
                    });
                  }, 300);
                }}
                className="flex-row items-center justify-center rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 active:opacity-80 dark:border-primary-800 dark:bg-primary-900/20"
                accessibilityLabel="스태프 평가하기"
                accessibilityRole="button"
              >
                <Text className="text-sm font-medium text-primary-700 dark:text-primary-300">
                  📝 평가 남기기
                </Text>
              </Pressable>
            </View>
          </>
        )}

        {/* 액션 버튼 (미정산일 때만) */}
        {payrollStatus === STATUS.PAYROLL.PENDING && (
          <SettlementActionButtons
            onEditTime={onEditTime ? handleEditTime : undefined}
            onEditAmount={hasValidTimes && onEditAmount ? handleEditAmount : undefined}
            onSettle={hasValidTimes && onSettle ? handleSettle : undefined}
          />
        )}

        <View className="h-8" />
      </View>
    </SheetModal>
  );
}

export default SettlementDetailModal;
