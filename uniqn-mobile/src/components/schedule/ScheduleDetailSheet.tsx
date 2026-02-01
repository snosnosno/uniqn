/**
 * UNIQN Mobile - ScheduleDetailSheet 컴포넌트
 *
 * @description 스케줄 상세 정보를 표시하는 BottomSheet
 * @version 1.0.0
 */

import React, { useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Modal } from '@/components/ui';
import { Button } from '@/components/ui';
import { Badge } from '@/components/ui';
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
import type { ScheduleEvent, ScheduleType, AttendanceStatus } from '@/types';
import { useThemeStore } from '@/stores/themeStore';

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

const statusConfig: Record<ScheduleType, { label: string; variant: 'warning' | 'success' | 'default' | 'error' }> = {
  applied: { label: '지원 중', variant: 'warning' },
  confirmed: { label: '확정', variant: 'success' },
  completed: { label: '완료', variant: 'default' },
  cancelled: { label: '취소', variant: 'error' },
};

const attendanceConfig: Record<AttendanceStatus, { label: string; color: string; bgColor: string }> = {
  not_started: { label: '출근 전', color: 'text-gray-600', bgColor: 'bg-gray-100 dark:bg-surface' },
  checked_in: { label: '근무 중', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  checked_out: { label: '퇴근 완료', color: 'text-primary-600', bgColor: 'bg-primary-100 dark:bg-primary-900/30' },
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatTime(value: TimeInput): string {
  const date = TimeNormalizer.parseTime(value);
  if (!date) return '--:--';
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  };
  return date.toLocaleDateString('ko-KR', options);
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
    <View className="flex-row items-center py-3 border-b border-gray-100 dark:border-surface-overlay">
      <View className="w-8">{icon}</View>
      <View className="flex-1 ml-2">
        <Text className="text-xs text-gray-500 dark:text-gray-400">{label}</Text>
        <Text className="text-sm text-gray-900 dark:text-gray-100 mt-0.5">{value}</Text>
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

  const status = statusConfig[schedule.type];
  const attendance = attendanceConfig[schedule.status];
  const isConfirmed = schedule.type === 'confirmed';
  const canCheckInOut = isConfirmed && schedule.workLogId;

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      position="bottom"
      showCloseButton={false}
    >
      {/* Handle Bar */}
      <View className="items-center mb-4">
        <View className="w-10 h-1 rounded-full bg-gray-300 dark:bg-surface-elevated" />
      </View>

      {/* Header */}
      <View className="flex-row items-start justify-between mb-4">
        <View className="flex-1">
          <View className="flex-row items-center gap-2 mb-2">
            <Badge variant={status.variant} dot>
              {status.label}
            </Badge>
            {isConfirmed && (
              <View className={`px-2 py-0.5 rounded-full ${attendance.bgColor}`}>
                <Text className={`text-xs ${attendance.color}`}>
                  {attendance.label}
                </Text>
              </View>
            )}
          </View>
          <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {schedule.jobPostingName}
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          className="w-8 h-8 items-center justify-center rounded-full bg-gray-100 dark:bg-surface"
          accessibilityLabel="닫기"
        >
          <XMarkIcon size={18} color="#9CA3AF" />
        </Pressable>
      </View>

      {/* Details */}
      <View className="mb-6">
        <DetailRow
          icon={<CalendarIcon size={18} color="#6B7280" />}
          label="날짜"
          value={formatDate(schedule.date)}
        />
        <DetailRow
          icon={<ClockIcon size={18} color="#6B7280" />}
          label="시간"
          value={`${formatTime(schedule.startTime)} - ${formatTime(schedule.endTime)}`}
        />
        {schedule.location && (
          <DetailRow
            icon={<MapIcon size={18} color="#6B7280" />}
            label="장소"
            value={schedule.detailedAddress || schedule.location}
          />
        )}
        <DetailRow
          icon={<BriefcaseIcon size={18} color="#6B7280" />}
          label="역할"
          value={getRoleDisplayName(schedule.role, schedule.customRole)}
        />
        {schedule.payrollAmount && schedule.payrollAmount > 0 && (
          <DetailRow
            icon={<CurrencyDollarIcon size={18} color="#6B7280" />}
            label="급여"
            value={formatCurrency(schedule.payrollAmount)}
          />
        )}
      </View>

      {/* 실제 출퇴근 시간 (근무 완료인 경우) */}
      {schedule.status === 'checked_out' && schedule.checkInTime && schedule.checkOutTime && (
        <View className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4 mb-6">
          <Text className="text-sm font-medium text-primary-800 dark:text-primary-200 mb-2">
            실제 근무 시간
          </Text>
          <Text className="text-sm text-primary-600 dark:text-primary-300">
            {formatTime(schedule.checkInTime)} - {formatTime(schedule.checkOutTime)}
          </Text>
        </View>
      )}

      {/* 메모 */}
      {schedule.notes && (
        <View className="bg-gray-50 dark:bg-surface/50 rounded-xl p-4 mb-6">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            메모
          </Text>
          <Text className="text-sm text-gray-600 dark:text-gray-400">
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
          <QrCodeIcon size={20} color={isWorking ? (isDarkMode ? '#D1D5DB' : '#374151') : '#FFFFFF'} />
          <Text className={`ml-2 font-semibold ${isWorking ? 'text-gray-900 dark:text-gray-100' : 'text-white'}`}>
            QR 코드로 {isWorking ? '퇴근' : '출근'}하기
          </Text>
        </Button>
      )}

      {/* 취소된 스케줄 안내 */}
      {schedule.type === 'cancelled' && (
        <View className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
          <Text className="text-sm text-red-600 dark:text-red-300 text-center">
            이 스케줄은 취소되었습니다.
          </Text>
        </View>
      )}

      {/* 지원 중: 안내 + 취소 버튼 */}
      {schedule.type === 'applied' && (
        <View>
          <View className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 mb-4">
            <Text className="text-sm text-yellow-700 dark:text-yellow-300 text-center">
              지원이 확정되면 출퇴근 기능을 사용할 수 있습니다.
            </Text>
          </View>
          {onCancelApplication && schedule.applicationId && (
            <Button
              variant="outline"
              onPress={handleCancelApplication}
              className="border-red-300 dark:border-red-700"
            >
              <Text className="text-red-600 dark:text-red-400 font-semibold">
                지원 취소
              </Text>
            </Button>
          )}
        </View>
      )}

      {/* 확정 상태: 취소 요청 버튼 */}
      {schedule.type === 'confirmed' && onRequestCancellation && schedule.applicationId && !canCheckInOut && (
        <Button
          variant="outline"
          onPress={handleRequestCancellation}
          className="border-orange-300 dark:border-orange-700"
        >
          <Text className="text-orange-600 dark:text-orange-400 font-semibold">
            취소 요청
          </Text>
        </Button>
      )}
    </Modal>
  );
}

export default ScheduleDetailSheet;
