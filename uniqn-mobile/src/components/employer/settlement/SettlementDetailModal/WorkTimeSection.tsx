/**
 * UNIQN Mobile - 근무 시간 섹션 컴포넌트
 *
 * @description 출근/퇴근/근무 시간 표시
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React from 'react';
import { View, Text } from 'react-native';
import { ClockIcon } from '@/components/icons';
import { formatTime } from '@/utils/date';
import { formatDuration } from '@/utils/settlement';
import { WorkTimeDisplay } from '@/shared/time';
import {
  TIME_PROVENANCE_LABELS,
  TIME_PROVENANCE_A11Y_LABELS,
  type TimeProvenance,
} from '@/shared/time/timeProvenance';

export interface WorkTimeSectionProps {
  /** 실제 출근 시간 */
  startTime: Date | null;
  /** 실제 퇴근 시간 */
  endTime: Date | null;
  /** 예정 시작 시간 (실제 출근 기록이 없을 때 표시용 폴백) */
  scheduledStartTime?: Date | null;
  /** 예정 종료 시간 (실제 퇴근 기록이 없을 때 표시용 폴백) */
  scheduledEndTime?: Date | null;
  /** 근무 시간 (시간 단위, 실제 기록 기반) */
  hoursWorked?: number;
  /** 출근 시각 출처 — `resolveTimeProvenance({ axis: 'start', ... })` 결과 */
  startProvenance?: TimeProvenance;
  /** 퇴근 시각 출처 — `resolveTimeProvenance({ axis: 'end', ... })` 결과 */
  endProvenance?: TimeProvenance;
}

const MS_PER_HOUR = 1000 * 60 * 60;

/**
 * 실제 시각의 출처 배지.
 *
 * 정산 분쟁에서 "이 시각이 어디서 왔는가"가 근거가 된다. 근거가 없으면(`'unknown'`)
 * 아무것도 그리지 않는다 — 거짓 "QR 기록"이 표시 없음보다 훨씬 나쁘다.
 */
function ProvenanceBadge({ provenance }: { provenance: TimeProvenance | undefined }) {
  if (!provenance) return null;
  const label = TIME_PROVENANCE_LABELS[provenance];
  if (!label) return null;

  const isQr = provenance === 'qr';
  return (
    <Text
      className={
        isQr
          ? 'mt-0.5 text-micro font-sans-semibold text-success-600 dark:text-success-400'
          : 'mt-0.5 text-micro font-sans-semibold text-secondary-500 dark:text-secondary-400'
      }
      accessibilityLabel={TIME_PROVENANCE_A11Y_LABELS[provenance] ?? undefined}
    >
      {isQr ? `✓${label}` : label}
    </Text>
  );
}

/**
 * 근무 시간 섹션
 *
 * 실제 출퇴근 기록이 있으면 실제 시간을, 없으면 예정시간(timeSlot)을 "예정" 배지와
 * 함께 표시한다(카드/스케줄/시간수정 화면과 동일하게 동기화). 정산 금액/정산 버튼은
 * 부모에서 실제시간에만 의존하므로 예정시간으로 정산되지 않는다.
 *
 * @example
 * <WorkTimeSection
 *   startTime={new Date('2024-01-15T09:00:00')}
 *   endTime={new Date('2024-01-15T18:00:00')}
 *   hoursWorked={9}
 * />
 */
export function WorkTimeSection({
  startTime,
  endTime,
  scheduledStartTime = null,
  scheduledEndTime = null,
  hoursWorked,
  startProvenance,
  endProvenance,
}: WorkTimeSectionProps) {
  // 출근/퇴근 각각 실제 기록 여부를 개별 판단 (한쪽만 기록된 중간 상태 정확히 표시)
  const startIsActual = Boolean(startTime);
  const endIsActual = Boolean(endTime);
  const hasActualTimes = startIsActual && endIsActual;
  const effectiveStart = startTime ?? scheduledStartTime;
  const effectiveEnd = endTime ?? scheduledEndTime;
  const hasAnyTimes = Boolean(effectiveStart && effectiveEnd);
  // 실제 기록이 전혀 없이 예정시간만으로 표시 중인 경우(확정·출근 전)에만 "예정"으로 안내
  const isScheduledOnly = hasAnyTimes && !startIsActual && !endIsActual;
  // 익일(자정 넘김) 판정은 SSOT(WorkTimeDisplay)로 단일화 — 독립 재구현 제거.
  // 실제 출퇴근이 있으면 그 값을, 없으면 예정시간으로 폴백하는 규칙이 getDisplayInfo
  // 내부(effective = actual ?? scheduled)와 동일하므로 배지 결과는 기존과 완전히 일치한다.
  const isOvernight = WorkTimeDisplay.getDisplayInfo({
    checkInTime: startTime,
    checkOutTime: endTime,
    startTime: scheduledStartTime,
    endTime: scheduledEndTime,
  }).isEndNextDay;

  // 표시용 근무 시간: 양쪽 실제는 정산 기준(hoursWorked), 순수 예정은 예정시간 간격(표시 전용),
  // 한쪽만 기록된 중간 상태는 '-'(아직 확정 불가)
  const scheduledHours =
    isScheduledOnly && effectiveStart && effectiveEnd
      ? Math.max(0, (effectiveEnd.getTime() - effectiveStart.getTime()) / MS_PER_HOUR)
      : undefined;
  const durationToShow = hasActualTimes ? hoursWorked : scheduledHours;

  return (
    <View className="px-4 py-4 border-b border-secondary-100 dark:border-surface-overlay">
      <View className="flex-row items-center mb-3">
        <ClockIcon size={18} color={SECONDARY_PALETTE[500]} />
        <Text className="ml-2 text-base font-sans-semibold text-content-primary dark:text-off-white">
          근무 시간
        </Text>
        {isScheduledOnly ? (
          <View className="ml-2 rounded bg-info-100 px-1.5 py-0.5 dark:bg-info-900/30">
            <Text className="text-micro text-info-700 dark:text-info-300 font-sans-semibold">
              예정
            </Text>
          </View>
        ) : null}
      </View>

      {hasAnyTimes ? (
        <>
          <View className="flex-row items-center justify-between p-3 bg-surface-page dark:bg-surface rounded-lg">
            <View className="items-center">
              <Text className="text-xs text-secondary-500 dark:text-secondary-400 mb-1 font-sans">
                {startIsActual ? '출근' : '시작'}
              </Text>
              {startIsActual ? (
                <Text className="text-lg font-display-semibold text-success-600 dark:text-success-400">
                  {formatTime(effectiveStart)}
                </Text>
              ) : (
                <Text className="text-lg font-display-semibold text-content-primary dark:text-off-white">
                  {formatTime(effectiveStart)}
                </Text>
              )}
              {/* 예정시간에 출처를 붙이면 거짓말이 된다 — 실제 기록일 때만 */}
              {startIsActual ? <ProvenanceBadge provenance={startProvenance} /> : null}
            </View>
            <View className="h-0.5 flex-1 mx-4 bg-secondary-200 dark:bg-surface" />
            <View className="items-center">
              <View className="flex-row items-center mb-1 gap-1">
                <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                  {endIsActual ? '퇴근' : '종료'}
                </Text>
                {isOvernight ? (
                  <View className="rounded bg-info-100 px-1.5 py-0.5 dark:bg-info-900/30">
                    <Text className="text-micro text-info-700 dark:text-info-300 font-sans-semibold">
                      익일
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text className="text-lg font-display-semibold text-content-primary dark:text-off-white">
                {formatTime(effectiveEnd)}
              </Text>
              {endIsActual ? <ProvenanceBadge provenance={endProvenance} /> : null}
            </View>
            <View className="h-0.5 flex-1 mx-4 bg-secondary-200 dark:bg-surface" />
            <View className="items-center">
              <Text className="text-xs text-secondary-500 dark:text-secondary-400 mb-1 font-sans">
                근무
              </Text>
              <Text className="text-lg font-display-semibold text-primary-600 dark:text-primary-400">
                {durationToShow !== undefined ? formatDuration(durationToShow) : '-'}
              </Text>
            </View>
          </View>

          {isScheduledOnly ? (
            <Text className="mt-2 text-xs text-secondary-500 dark:text-secondary-400 text-center font-sans">
              아직 출퇴근 기록 전이에요. 시간 수정에서 기록하면 정산할 수 있어요.
            </Text>
          ) : null}

          {/* 퇴근에만 ✓QR 이 뜨고 출근엔 아무것도 없으면 "출근은 QR 이 아니었다" 로 읽힌다.
              실제로는 출근 시각의 출처를 기록하는 컬럼이 스키마에 없어 알 수 없는 것뿐이다.
              정산 분쟁 근거로 쓰이는 표시라 이 비대칭을 화면에서 밝힌다. */}
          {endProvenance === 'qr' && startProvenance === 'unknown' ? (
            <Text className="mt-2 text-xs text-secondary-500 dark:text-secondary-400 text-center font-sans">
              출근 시각은 출처가 기록되지 않아 QR 여부를 알 수 없어요.
            </Text>
          ) : null}
        </>
      ) : (
        <View className="p-3 bg-warning-50 dark:bg-warning-900/20 rounded-lg">
          <Text className="text-sm text-warning-700 dark:text-warning-300 text-center font-sans">
            근무 시간 정보가 없어요
          </Text>
        </View>
      )}
    </View>
  );
}
