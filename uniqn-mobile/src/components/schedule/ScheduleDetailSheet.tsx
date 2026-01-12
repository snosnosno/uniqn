/**
 * UNIQN Mobile - ScheduleDetailSheet 컴포넌트
 *
 * @description 스케줄 상세 정보를 표시하는 BottomSheet
 * @version 1.0.0
 */

import React, { useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Timestamp } from 'firebase/firestore';
import { Modal } from '@/components/ui';
import { Button } from '@/components/ui';
import { Badge } from '@/components/ui';
import {
  CalendarIcon,
  ClockIcon,
  MapIcon,
  BriefcaseIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  XMarkIcon,
  QrCodeIcon,
} from '@/components/icons';
import { useCheckIn, useCheckOut, useCurrentWorkStatus } from '@/hooks/useWorkLogs';
import { formatCurrency } from '@/utils/settlement';
import { getRoleDisplayName } from '@/types/unified';
import type { ScheduleEvent, ScheduleType, AttendanceStatus } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface ScheduleDetailSheetProps {
  schedule: ScheduleEvent | null;
  visible: boolean;
  onClose: () => void;
  onQRScan?: () => void;
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
  not_started: { label: '출근 전', color: 'text-gray-600', bgColor: 'bg-gray-100 dark:bg-gray-700' },
  checked_in: { label: '근무 중', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  checked_out: { label: '퇴근 완료', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatTime(timestamp: Timestamp | null): string {
  if (!timestamp) return '--:--';
  const date = timestamp.toDate();
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
    <View className="flex-row items-center py-3 border-b border-gray-100 dark:border-gray-700">
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
}: ScheduleDetailSheetProps) {
  // 출퇴근 훅
  const { currentWorkLog: _currentWorkLog, isWorking } = useCurrentWorkStatus();
  void _currentWorkLog; // TODO: 현재 근무 기록 표시 시 활용
  const { checkIn, isLoading: isCheckingIn } = useCheckIn({
    onSuccess: onClose,
  });
  const { checkOut, isLoading: isCheckingOut } = useCheckOut({
    onSuccess: onClose,
  });

  // 출퇴근 버튼 핸들러
  const handleAttendance = useCallback(() => {
    if (!schedule?.workLogId) return;

    if (isWorking) {
      checkOut({ workLogId: schedule.workLogId });
    } else {
      checkIn({ workLogId: schedule.workLogId });
    }
  }, [schedule, isWorking, checkIn, checkOut]);

  // QR 스캔 핸들러
  const handleQRScan = useCallback(() => {
    if (onQRScan) {
      onQRScan();
    }
  }, [onQRScan]);

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
        <View className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
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
            {schedule.eventName}
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          className="w-8 h-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700"
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
      {schedule.status === 'checked_out' && schedule.actualStartTime && schedule.actualEndTime && (
        <View className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-6">
          <Text className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
            실제 근무 시간
          </Text>
          <Text className="text-sm text-blue-600 dark:text-blue-300">
            {formatTime(schedule.actualStartTime as Timestamp)} - {formatTime(schedule.actualEndTime as Timestamp)}
          </Text>
        </View>
      )}

      {/* 메모 */}
      {schedule.notes && (
        <View className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-6">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            메모
          </Text>
          <Text className="text-sm text-gray-600 dark:text-gray-400">
            {schedule.notes}
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      {canCheckInOut && (
        <View className="gap-3">
          {/* QR 스캔 버튼 */}
          {onQRScan && (
            <Button
              variant="outline"
              onPress={handleQRScan}
              className="flex-row items-center justify-center"
            >
              <QrCodeIcon size={20} color="#3B82F6" />
              <Text className="ml-2 text-blue-600 dark:text-blue-400 font-medium">
                QR 코드로 {isWorking ? '퇴근' : '출근'}하기
              </Text>
            </Button>
          )}

          {/* 수동 출퇴근 버튼 */}
          <Button
            variant={isWorking ? 'secondary' : 'primary'}
            onPress={handleAttendance}
            loading={isCheckingIn || isCheckingOut}
          >
            <View className="flex-row items-center justify-center">
              {isWorking ? (
                <>
                  <CheckCircleIcon size={20} color="#374151" />
                  <Text className="ml-2 text-gray-900 dark:text-gray-100 font-semibold">퇴근하기</Text>
                </>
              ) : (
                <>
                  <CheckCircleIcon size={20} color="#FFFFFF" />
                  <Text className="ml-2 text-white font-semibold">출근하기</Text>
                </>
              )}
            </View>
          </Button>
        </View>
      )}

      {/* 취소된 스케줄 안내 */}
      {schedule.type === 'cancelled' && (
        <View className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
          <Text className="text-sm text-red-600 dark:text-red-300 text-center">
            이 스케줄은 취소되었습니다.
          </Text>
        </View>
      )}

      {/* 지원 중 안내 */}
      {schedule.type === 'applied' && (
        <View className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4">
          <Text className="text-sm text-yellow-700 dark:text-yellow-300 text-center">
            지원이 확정되면 출퇴근 기능을 사용할 수 있습니다.
          </Text>
        </View>
      )}
    </Modal>
  );
}

export default ScheduleDetailSheet;
