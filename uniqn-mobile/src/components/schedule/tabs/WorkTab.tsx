/**
 * UNIQN Mobile - 스케줄 상세 모달 근무 탭
 *
 * @description 역할, 출퇴근 시간, QR 스캔 버튼 표시
 * @version 1.0.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { memo, useCallback, useMemo } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { Button, Badge } from '@/components/ui';
import { BriefcaseIcon, ClockIcon, QrCodeIcon, PhoneIcon } from '@/components/icons';
import { getRoleDisplayName } from '@/types/unified';
import { useCurrentWorkStatus } from '@/hooks/useWorkLogs';
import { STATUS } from '@/constants';
import { ATTENDANCE_STATUS } from '@/constants/statusConfig';
import { APPLICATION_STATUS_LABELS } from '@/shared/status';
import { WorkTimeDisplay } from '@/shared/time';
import type { ScheduleEvent } from '@/types';
import { useThemeStore } from '@/stores/themeStore';
import { formatPhoneNumber } from '@/utils/phone';

// ============================================================================
// Types
// ============================================================================

export interface WorkTabProps {
  schedule: ScheduleEvent;
  onQRScan?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

// ATTENDANCE_STATUS: '@/constants/statusConfig'에서 import

// ============================================================================
// Helpers
// ============================================================================

// ============================================================================
// Sub Components
// ============================================================================

interface TimeBoxProps {
  label: string;
  value: string;
  isHighlight?: boolean;
}

function TimeBox({ label, value, isHighlight }: TimeBoxProps) {
  return (
    <View className="flex-1 items-center py-3 bg-surface-page dark:bg-surface/50 rounded-lg">
      <Text className="text-xs text-secondary-500 dark:text-secondary-400 mb-1 font-sans">
        {label}
      </Text>
      <Text
        className={`text-base font-sans-semibold ${
          isHighlight ? 'text-primary-600 dark:text-primary-400' : 'text-content-primary'
        }`}
      >
        {value}
      </Text>
    </View>
  );
}

// ============================================================================
// Component
// ============================================================================

export const WorkTab = memo(function WorkTab({ schedule, onQRScan }: WorkTabProps) {
  const { isWorking } = useCurrentWorkStatus();
  const { isDarkMode } = useThemeStore();
  const attendance = ATTENDANCE_STATUS[schedule.status];
  const hasPendingCancellation = Boolean(schedule.isCancellationPending);

  const handleQRScan = useCallback(() => {
    onQRScan?.();
  }, [onQRScan]);

  // 통합 시간 표시 (실제 > timeSlot 파싱 > '미정')
  const timeInfo = useMemo(() => {
    return WorkTimeDisplay.getDisplayInfo(schedule);
  }, [schedule]);

  // QR 버튼 표시 조건: 확정 상태 + workLogId 있음
  const canShowQRButton =
    schedule.type === STATUS.SCHEDULE.CONFIRMED && schedule.workLogId && onQRScan;

  // 지원중 상태면 안내 메시지 표시
  if (schedule.type === STATUS.SCHEDULE.APPLIED) {
    return (
      <View className="py-6 items-center">
        <View className="bg-warning-50 dark:bg-warning-900/20 rounded-md p-4 w-full">
          <Text className="text-sm text-warning-700 dark:text-warning-300 text-center font-sans">
            지원이 확정되면 근무 정보를 확인할 수 있습니다.
          </Text>
        </View>
      </View>
    );
  }

  // 취소 상태면 안내 메시지 표시
  if (schedule.type === STATUS.SCHEDULE.CANCELLED) {
    return (
      <View className="py-6 items-center">
        <View className="bg-error-50 dark:bg-error-900/20 rounded-md p-4 w-full">
          <Text className="text-sm text-error-600 dark:text-error-400 text-center font-sans">
            취소된 스케줄입니다.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="py-2">
      {hasPendingCancellation && (
        <View className="mb-5 rounded-md bg-warning-50 p-4 dark:bg-warning-900/20">
          <View className="mb-2">
            <Badge variant="warning">{APPLICATION_STATUS_LABELS.cancellation_pending}</Badge>
          </View>
          <Text className="text-sm text-warning-700 dark:text-warning-400 font-sans">
            검토 결과가 나오기 전까지 현재 일정 상태가 유지됩니다.
          </Text>
          {/* 검토 중에는 남는 액션이 '신고' 뿐이라 막다른 길이었다. 급하면 직접 연락할
              경로를 남긴다 — 확정 상태에서 이미 쓰고 있는 것과 같은 CTA. */}
          {schedule.ownerPhone && (
            <Pressable
              onPress={() => Linking.openURL(`tel:${schedule.ownerPhone}`)}
              accessibilityRole="button"
              accessibilityLabel="구인자에게 전화하기"
              className="mt-3 flex-row items-center justify-center rounded-lg bg-warning-100 py-2 active:bg-warning-200 dark:bg-warning-900/40 dark:active:bg-warning-900/60"
            >
              <PhoneIcon size={16} color="#D4A017" />
              <Text className="ml-1.5 text-sm font-sans-semibold text-warning-700 dark:text-warning-300">
                구인자에게 전화
              </Text>
            </Pressable>
          )}
        </View>
      )}
      {/* 역할 */}
      <View className="mb-5">
        <View className="flex-row items-center mb-2">
          <BriefcaseIcon size={18} color={SECONDARY_PALETTE[500]} />
          <Text className="ml-2 text-sm font-sans-semibold text-content-secondary">역할</Text>
        </View>
        <View className="ml-6">
          <Text className="text-base text-content-primary dark:text-off-white font-sans-medium">
            {getRoleDisplayName(schedule.role, schedule.customRole)}
          </Text>
        </View>
      </View>

      {/* 구인자 연락처 (확정 상태에서만) */}
      {schedule.type === STATUS.SCHEDULE.CONFIRMED && schedule.ownerPhone && (
        <View className="mb-5">
          <View className="flex-row items-center mb-2">
            <PhoneIcon size={18} color={SECONDARY_PALETTE[500]} />
            <Text className="ml-2 text-sm font-sans-semibold text-content-secondary">
              구인자 연락처
            </Text>
          </View>
          <Pressable
            onPress={() => Linking.openURL(`tel:${schedule.ownerPhone}`)}
            className="ml-6 flex-row items-center py-2 px-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg active:bg-primary-100 dark:active:bg-primary-900/30"
          >
            <Text className="text-base text-primary-600 dark:text-primary-400 font-sans-medium">
              {formatPhoneNumber(schedule.ownerPhone)}
            </Text>
            <View className="ml-auto flex-row items-center">
              <PhoneIcon size={16} color="#B8962E" />
              <Text className="ml-1 text-sm text-primary-600 dark:text-primary-400 font-sans">
                전화하기
              </Text>
            </View>
          </Pressable>
        </View>
      )}

      {/* 출퇴근 기록 */}
      <View className="mb-5">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <ClockIcon size={18} color={SECONDARY_PALETTE[500]} />
            <Text className="ml-2 text-sm font-sans-semibold text-content-secondary">
              출퇴근 기록
            </Text>
          </View>
          <Badge variant={attendance.variant} size="sm">
            {attendance.label}
          </Badge>
        </View>

        <View className="flex-row gap-2">
          <TimeBox
            label={timeInfo.isEffectiveStartActual ? '출근' : '예정'}
            value={
              !timeInfo.isEffectiveStartActual && timeInfo.effectiveStart === '미정'
                ? '시간 협의'
                : timeInfo.effectiveStart
            }
          />
          <TimeBox
            label={timeInfo.isEffectiveEndActual ? '퇴근' : '예정'}
            value={
              !timeInfo.isEffectiveEndActual && timeInfo.effectiveEnd === '미정'
                ? '시간 협의'
                : timeInfo.effectiveEnd
            }
          />
          {timeInfo.duration !== '-' && (
            <TimeBox
              label="근무시간"
              value={timeInfo.duration}
              isHighlight={timeInfo.hasActualTime}
            />
          )}
        </View>
      </View>

      {/* QR 스캔 버튼 */}
      {canShowQRButton && (
        <Button
          variant={isWorking ? 'secondary' : 'primary'}
          onPress={handleQRScan}
          className="flex-row items-center justify-center mt-2"
        >
          <QrCodeIcon
            size={20}
            color={
              isWorking ? (isDarkMode ? SECONDARY_PALETTE[200] : SECONDARY_PALETTE[700]) : '#FFFFFF'
            }
          />
          <Text
            className={`ml-2 font-sans-semibold ${isWorking ? 'text-secondary-900 dark:text-secondary-100' : 'text-content-onGold'}`}
          >
            QR 코드로 {isWorking ? '퇴근' : '출근'}하기
          </Text>
        </Button>
      )}
    </View>
  );
});
