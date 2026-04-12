/**
 * UNIQN Mobile - ScheduleDetailSheet 컴포넌트
 *
 * @description 스케줄 상세 정보를 표시하는 BottomSheet
 * @version 1.0.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Modal, Button, Badge } from '@/components/ui';
import {
  CalendarIcon,
  ClockIcon,
  MapIcon,
  BriefcaseIcon,
  CurrencyDollarIcon,
  XMarkIcon,
  QrCodeIcon,
} from '@/components/icons';
import { useCurrentWorkStatus } from '@/hooks/useWorkLogs';
import { formatCurrency } from '@/utils/settlement';
import { getRoleDisplayName } from '@/types/unified';
import { TimeNormalizer, type TimeInput } from '@/shared/time';
import type { ScheduleEvent } from '@/types';
import { useThemeStore } from '@/stores/themeStore';
import { STATUS } from '@/constants';
import { SCHEDULE_STATUS, ATTENDANCE_STATUS } from '@/constants/statusConfig';
import { formatDateKoreanWithDay } from '@/utils/date';

// ============================================================================
// Types
// ============================================================================

interface ScheduleDetailSheetProps {
  schedule: ScheduleEvent | null;
  visible: boolean;
  onClose: () => void;
  onQRScan?: () => void;
  /** 지원 취소 콜백 (지원중 상태에서만 사용) */
  onCancelApplication?: (applicationId: string) => void;
  /** 취소 요청 콜백 (확정 상태에서 사용) */
  onRequestCancellation?: (applicationId: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

// SCHEDULE_STATUS, ATTENDANCE_STATUS: '@/constants/statusConfig'에서 import

// ============================================================================
// Helper Functions
// ============================================================================

function formatTime(value: TimeInput): string {
  const date = TimeNormalizer.parseTime(value);
  if (!date) return '--:--';
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDate(dateString: string): string {
  return formatDateKoreanWithDay(dateString) || dateString || '-';
}

// ============================================================================
// Sub Components
// ============================================================================

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function DetailRow({ icon, label, value }: DetailRowProps) {
  return (
    <View className="flex-row items-center py-3 border-b border-secondary-100 dark:border-surface-overlay">
      <View className="w-8">{icon}</View>
      <View className="flex-1 ml-2">
        <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
          {label}
        </Text>
        <Text className="text-sm text-content-primary dark:text-secondary-100 mt-0.5 font-sans">
          {value}
        </Text>
      </View>
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ScheduleDetailSheet({
  schedule,
  visible,
  onClose,
  onQRScan,
  onCancelApplication,
  onRequestCancellation,
}: ScheduleDetailSheetProps) {
  // 현재 근무 상태 확인
  const { isWorking } = useCurrentWorkStatus();
  const { isDarkMode } = useThemeStore();

  // QR 스캔 핸들러
  const handleQRScan = useCallback(() => {
    if (onQRScan) {
      onQRScan();
    }
  }, [onQRScan]);

  // 지원 취소 핸들러
  const handleCancelApplication = useCallback(() => {
    if (schedule?.applicationId && onCancelApplication) {
      onCancelApplication(schedule.applicationId);
      onClose();
    }
  }, [schedule?.applicationId, onCancelApplication, onClose]);

  // 취소 요청 핸들러
  const handleRequestCancellation = useCallback(() => {
    if (schedule?.applicationId && onRequestCancellation) {
      onRequestCancellation(schedule.applicationId);
      onClose();
    }
  }, [schedule?.applicationId, onRequestCancellation, onClose]);

  if (!schedule) return null;

  const status = SCHEDULE_STATUS[schedule.type];
  const attendance = ATTENDANCE_STATUS[schedule.status];
  const isConfirmed = schedule.type === STATUS.SCHEDULE.CONFIRMED;
  const canCheckInOut = isConfirmed && schedule.workLogId;

  return (
    <Modal visible={visible} onClose={onClose} position="bottom" showCloseButton={false}>
      {/* Handle Bar */}
      <View className="items-center mb-4">
        <View className="w-10 h-1 rounded-sm bg-secondary-300 dark:bg-surface-elevated" />
      </View>

      {/* Header */}
      <View className="flex-row items-start justify-between mb-4">
        <View className="flex-1">
          <View className="flex-row items-center gap-2 mb-2">
            <Badge variant={status.variant} dot>
              {status.label}
            </Badge>
            {isConfirmed && (
              <View className={`px-2 py-0.5 rounded-sm ${attendance.bgColor}`}>
                <Text className={`text-xs ${attendance.textColor} font-sans`}>
                  {attendance.label}
                </Text>
              </View>
            )}
          </View>
          <Text className="text-xl font-display text-content-primary dark:text-secondary-100">
            {schedule.jobPostingName}
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          className="w-8 h-8 items-center justify-center rounded-sm bg-surface-card dark:bg-surface"
          accessibilityLabel="닫기"
        >
          <XMarkIcon size={18} color={SECONDARY_PALETTE[400]} />
        </Pressable>
      </View>

      {/* Details */}
      <View className="mb-6">
        <DetailRow
          icon={<CalendarIcon size={18} color={SECONDARY_PALETTE[500]} />}
          label="날짜"
          value={formatDate(schedule.date)}
        />
        <DetailRow
          icon={<ClockIcon size={18} color={SECONDARY_PALETTE[500]} />}
          label="시간"
          value={`${formatTime(schedule.startTime)} - ${formatTime(schedule.endTime)}`}
        />
        {schedule.location && (
          <DetailRow
            icon={<MapIcon size={18} color={SECONDARY_PALETTE[500]} />}
            label="장소"
            value={schedule.detailedAddress || schedule.location}
          />
        )}
        <DetailRow
          icon={<BriefcaseIcon size={18} color={SECONDARY_PALETTE[500]} />}
          label="역할"
          value={getRoleDisplayName(schedule.role, schedule.customRole)}
        />
        {schedule.payrollAmount && schedule.payrollAmount > 0 && (
          <DetailRow
            icon={<CurrencyDollarIcon size={18} color={SECONDARY_PALETTE[500]} />}
            label="급여"
            value={formatCurrency(schedule.payrollAmount)}
          />
        )}
      </View>

      {/* 실제 출퇴근 시간 (근무 완료인 경우) */}
      {schedule.status === STATUS.WORK_LOG.CHECKED_OUT &&
        schedule.checkInTime &&
        schedule.checkOutTime && (
          <View className="bg-primary-50 dark:bg-primary-900/20 rounded-md p-4 mb-6">
            <Text className="text-sm font-sans-medium text-primary-800 dark:text-primary-200 mb-2">
              실제 근무 시간
            </Text>
            <Text className="text-sm text-primary-600 dark:text-primary-300 font-sans">
              {formatTime(schedule.checkInTime)} - {formatTime(schedule.checkOutTime)}
            </Text>
          </View>
        )}

      {/* 메모 */}
      {schedule.notes && (
        <View className="bg-surface-page dark:bg-surface/50 rounded-md p-4 mb-6">
          <Text className="text-sm font-sans-medium text-content-secondary mb-1">메모</Text>
          <Text className="text-sm text-content-muted dark:text-secondary-400 font-sans">
            {schedule.notes}
          </Text>
        </View>
      )}

      {/* QR 스캔 버튼 (출퇴근은 QR 스캔으로만 가능) */}
      {canCheckInOut && onQRScan && (
        <Button
          variant={isWorking ? 'secondary' : 'primary'}
          onPress={handleQRScan}
          className="flex-row items-center justify-center"
        >
          <QrCodeIcon
            size={20}
            color={
              isWorking ? (isDarkMode ? SECONDARY_PALETTE[200] : SECONDARY_PALETTE[700]) : '#FFFFFF'
            }
          />
          <Text
            className={`ml-2 font-sans-semibold ${isWorking ? 'text-secondary-900 dark:text-secondary-100' : 'text-surface-dark'}`}
          >
            QR 코드로 {isWorking ? '퇴근' : '출근'}하기
          </Text>
        </Button>
      )}

      {/* 취소된 스케줄 안내 */}
      {schedule.type === STATUS.SCHEDULE.CANCELLED && (
        <View className="bg-error-50 dark:bg-error-900/20 rounded-md p-4">
          <Text className="text-sm text-error-600 dark:text-error-300 text-center font-sans">
            이 스케줄은 취소되었습니다.
          </Text>
        </View>
      )}

      {/* 지원 중: 안내 + 취소 버튼 */}
      {schedule.type === STATUS.SCHEDULE.APPLIED && (
        <View>
          <View className="bg-warning-50 dark:bg-warning-900/20 rounded-md p-4 mb-4">
            <Text className="text-sm text-warning-700 dark:text-warning-300 text-center font-sans">
              지원이 확정되면 출퇴근 기능을 사용할 수 있습니다.
            </Text>
          </View>
          {onCancelApplication && schedule.applicationId && (
            <Button
              variant="outline"
              onPress={handleCancelApplication}
              className="border-error-300 dark:border-error-700"
            >
              <Text className="text-error-600 dark:text-error-400 font-sans-semibold">
                지원 취소
              </Text>
            </Button>
          )}
        </View>
      )}

      {/* 확정 상태: 취소 요청 버튼 */}
      {schedule.type === STATUS.SCHEDULE.CONFIRMED &&
        onRequestCancellation &&
        schedule.applicationId &&
        !canCheckInOut && (
          <Button
            variant="outline"
            onPress={handleRequestCancellation}
            className="border-orange-300 dark:border-orange-700"
          >
            <Text className="text-orange-600 dark:text-orange-400 font-sans-semibold">
              취소 요청
            </Text>
          </Button>
        )}
    </Modal>
  );
}

export default ScheduleDetailSheet;
