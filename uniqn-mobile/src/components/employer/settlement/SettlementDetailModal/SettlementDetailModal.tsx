/**
 * UNIQN Mobile - 계산 근거 모달
 *
 * @description 근무 한 건의 출근·퇴근·인정 근무·단가·합계와 변경 이력
 * @version 3.0.0 - 구인자 IA S2: 지급 완료 표시·지급 완료 취소·완료 배너 제거. 금액 계산·표시만 남긴다.
 */

import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSettlementDateNavigation } from '@/hooks/useSettlementDateNavigation';
import { SheetModal } from '@/components/ui/SheetModal';
import { useThemeStore } from '@/stores/themeStore';
import { useUserProfile } from '@/hooks/useUserProfile';
import { parseTimestamp, calculateSettlementFromWorkLog } from '@/utils/settlement';
import { parseTimeSlotToDate } from '@/utils/date';
import { getAllowanceItems } from '@/utils/allowanceUtils';

import { resolveTimeProvenance } from '@/shared/time/timeProvenance';

// Sub-components
import { DateNavigationHeader } from './DateNavigationHeader';
import { StaffProfileHeader } from './StaffProfileHeader';
import { WorkTimeSection } from './WorkTimeSection';
import { SettlementAmountSection } from './SettlementAmountSection';
import { TimeModificationHistory } from './TimeModificationHistory';
import { AmountModificationHistory } from './AmountModificationHistory';
import { SettlementActionButtons } from './SettlementActionButtons';

// Types
import type { WorkLog } from '@/types';
import { STATUS } from '@/constants';
import type { SettlementDetailModalProps } from './types';
import { getReviewTextFallback } from '@/types/review';
import { SHEET_DISMISS_ANIMATION_MS } from '@/constants/animation';

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
  groupedSettlement,
  onDateChange,
  jobPostingTitle,
}: SettlementDetailModalProps) {
  const { isDarkMode: isDark } = useThemeStore();

  const { displayName, profilePhotoURL, profilePhotoURLBlurhash } = useUserProfile({
    userId: workLog?.staffId,
    enabled: visible,
    fallbackName: workLog?.staffName,
    fallbackNickname: workLog?.staffNickname,
    fallbackPhotoURL: workLog?.staffPhotoURL,
    fallbackPhotoURLBlurhash: workLog?.staffPhotoURLBlurhash,
  });

  // 수정 이력 접기/펼치기 상태 (기본: 접힘)
  const [isTimeHistoryExpanded, setIsTimeHistoryExpanded] = useState(false);
  const [isAmountHistoryExpanded, setIsAmountHistoryExpanded] = useState(false);

  const {
    isGroupMode,
    currentDateIndex,
    totalDays,
    canGoPrev,
    canGoNext,
    handlePrevDate,
    handleNextDate,
  } = useSettlementDateNavigation(workLog, groupedSettlement, onDateChange);

  const startTime = useMemo(
    () => (workLog ? parseTimestamp(workLog.checkInTime) : null),
    [workLog]
  );
  const endTime = useMemo(() => (workLog ? parseTimestamp(workLog.checkOutTime) : null), [workLog]);
  const workDate = useMemo(() => (workLog ? parseTimestamp(workLog.date) : null), [workLog]);

  // 예정시간(timeSlot) — 실제 출퇴근 기록이 없을 때 표시용 폴백.
  // 금액은 실제시간(hasValidTimes)에만 의존하므로 계산 정확성에는 영향 없음.
  const scheduledTimes = useMemo(
    () => parseTimeSlotToDate(workLog?.timeSlot ?? null, workLog?.date ?? ''),
    [workLog?.timeSlot, workLog?.date]
  );

  const settlement = useMemo(
    () =>
      workLog ? calculateSettlementFromWorkLog(workLog, salaryInfo, allowances, taxSettings) : null,
    [workLog, salaryInfo, allowances, taxSettings]
  );

  const allowanceItems = useMemo(() => getAllowanceItems(allowances), [allowances]);

  const hasValidTimes = Boolean(startTime && endTime);

  // 🔴 과거에 `지급 완료` 로 처리된 근무는 그때 확정된 금액이 진실원이다(동결값 SSOT —
  //    `settlementGrouping.shouldUseFrozenPayrollAmount`). 지급 워크플로우는 없앴지만 그 금액까지
  //    다시 계산하면 이미 보낸 금액과 화면 금액이 달라진다. 그래서 금액 수정만 닫아 둔다.
  //    (서버 `protect_work_log_payroll_columns()` 도 이 행의 금액 컬럼을 잠근다.)
  const hasFrozenAmount = workLog?.payrollStatus === STATUS.PAYROLL.COMPLETED;

  // ⚠️ 그려질 버튼을 미리 세지 않으면 `SettlementActionButtons` 가 자식 없는 껍데기(px-4 py-4)만
  //    남긴다 — 확정 금액 행 + onEditTime 미배선 호출부에서 빈 여백이 된다.
  const showsEditTime = Boolean(onEditTime);
  const showsEditAmount = !hasFrozenAmount && hasValidTimes && Boolean(onEditAmount);
  const hasVisibleActions = showsEditTime || showsEditAmount;

  const handleEditTime = useCallback(() => {
    if (workLog && onEditTime) {
      onEditTime(workLog);
    }
  }, [workLog, onEditTime]);

  const handleEditAmount = useCallback(() => {
    if (workLog && onEditAmount) {
      onEditAmount(workLog);
    }
  }, [workLog, onEditAmount]);

  // 🔑 평가는 **끝난 근무**에 연다. 예전엔 `지급 완료` 에 묶여 있어서, 지급 완료 버튼을 없애면
  //    구인자 쪽 평가 진입점이 영영 안 뜨게 된다. 서버 `create_review` 는 지급 상태를 보지 않는다.
  const handleWriteReview = useCallback(() => {
    if (!workLog) return;
    onClose();
    setTimeout(() => {
      router.push({
        pathname: '/(app)/reviews/write',
        params: {
          workLogId: workLog.id,
          revieweeId: workLog.staffId,
          revieweeName: getReviewTextFallback(
            displayName,
            workLog.staffName,
            workLog.staffNickname,
            '스태프'
          ),
          reviewerType: 'employer',
          jobPostingId: workLog.jobPostingId,
          jobPostingTitle: getReviewTextFallback(
            jobPostingTitle,
            (workLog as WorkLog & { jobPostingName?: string }).jobPostingName,
            '공고'
          ),
          workDate: workLog.date || '',
        },
      });
      // 시트가 닫힌 뒤 넘어간다 — 두 화면 전환이 겹치지 않게(대기 값은 animation.ts SSOT).
    }, SHEET_DISMISS_ANIMATION_MS);
  }, [workLog, onClose, displayName, jobPostingTitle]);

  if (!workLog) return null;

  return (
    <SheetModal visible={visible} onClose={onClose} title="계산 근거">
      <View className="px-4">
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

        <StaffProfileHeader
          profilePhotoURL={profilePhotoURL}
          profilePhotoURLBlurhash={profilePhotoURLBlurhash}
          displayName={displayName}
          role={workLog.role}
          customRole={workLog.customRole}
          workDate={workDate}
        />

        <WorkTimeSection
          startTime={startTime}
          endTime={endTime}
          scheduledStartTime={scheduledTimes.startTime}
          scheduledEndTime={scheduledTimes.endTime}
          hoursWorked={settlement?.hoursWorked}
          startProvenance={resolveTimeProvenance({
            axis: 'start',
            modificationHistory: workLog.modificationHistory,
          })}
          endProvenance={resolveTimeProvenance({
            axis: 'end',
            endTimeSource: workLog.endTimeSource,
            modificationHistory: workLog.modificationHistory,
          })}
        />

        {hasValidTimes && settlement && (
          <SettlementAmountSection
            salaryInfo={salaryInfo}
            settlement={settlement}
            allowanceItems={allowanceItems}
          />
        )}

        {/* 퇴근 전 — 추정 금액을 만들지 않고, 무엇이 있어야 정해지는지 말한다. */}
        {!hasValidTimes && (
          <View className="mx-4 mb-3 rounded-lg bg-surface-page p-3 dark:bg-surface">
            <Text className="text-center text-sm text-content-muted dark:text-secondary-400 font-sans">
              퇴근을 찍어야 금액이 정해져요
            </Text>
          </View>
        )}

        {hasFrozenAmount && (
          <View
            testID="settlement-frozen-note"
            className="mx-4 mb-3 rounded-lg bg-primary-50 p-3 dark:bg-primary-900/20"
          >
            <Text className="text-sm text-primary-700 dark:text-primary-300 font-sans">
              예전에 확정된 금액이라 다시 계산하지 않아요.
            </Text>
          </View>
        )}

        <TimeModificationHistory
          modificationHistory={workLog.modificationHistory || []}
          isExpanded={isTimeHistoryExpanded}
          onToggle={() => setIsTimeHistoryExpanded(!isTimeHistoryExpanded)}
        />

        <AmountModificationHistory
          settlementModificationHistory={workLog.settlementModificationHistory || []}
          isExpanded={isAmountHistoryExpanded}
          onToggle={() => setIsAmountHistoryExpanded(!isAmountHistoryExpanded)}
        />

        {hasValidTimes && (
          <View className="px-4 pb-2">
            <Pressable
              onPress={handleWriteReview}
              className="flex-row items-center justify-center rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 active:opacity-80 dark:border-primary-800 dark:bg-primary-900/20"
              accessibilityLabel="스태프 평가하기"
              accessibilityRole="button"
            >
              <Text className="text-sm font-sans-medium text-primary-700 dark:text-primary-300">
                평가 남기기
              </Text>
            </Pressable>
          </View>
        )}

        {hasVisibleActions && (
          <SettlementActionButtons
            testID="settlement-actions"
            onEditTime={showsEditTime ? handleEditTime : undefined}
            onEditAmount={showsEditAmount ? handleEditAmount : undefined}
          />
        )}

        <View className="h-8" />
      </View>
    </SheetModal>
  );
}
