/**
 * UNIQN Mobile - 스케줄 상세 모달 근무 탭
 *
 * @description 역할, 출퇴근 시간, QR 스캔 버튼 표시
 * @version 1.0.0
 */

import React, { memo, useCallback } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { Button, Badge } from '@/components/ui';
import { formatTime, calculateDuration } from '../helpers/timeHelpers';
import {
  BriefcaseIcon,
  ClockIcon,
  QrCodeIcon,
  PhoneIcon,
} from '@/components/icons';
import { getRoleDisplayName } from '@/types/unified';
import { useCurrentWorkStatus } from '@/hooks/useWorkLogs';
import type { ScheduleEvent, AttendanceStatus } from '@/types';

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

const attendanceConfig: Record<AttendanceStatus, { label: string; variant: 'default' | 'success' | 'primary' }> = {
  not_started: { label: '출근 전', variant: 'default' },
  checked_in: { label: '근무 중', variant: 'success' },
  checked_out: { label: '퇴근 완료', variant: 'primary' },
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * 전화번호 포맷팅 (010-1234-5678 형식)
 */
function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

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
    <View className="flex-1 items-center py-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</Text>
      <Text
        className={`text-base font-semibold ${
          isHighlight
            ? 'text-primary-600 dark:text-primary-400'
            : 'text-gray-900 dark:text-white'
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
  const attendance = attendanceConfig[schedule.status];

  const handleQRScan = useCallback(() => {
    onQRScan?.();
  }, [onQRScan]);

  // 실제 출퇴근 시간이 있는지 확인
  const hasActualTimes = schedule.checkInTime || schedule.checkOutTime;

  // QR 버튼 표시 조건: 확정 상태 + workLogId 있음
  const canShowQRButton = schedule.type === 'confirmed' && schedule.workLogId && onQRScan;

  // 지원중 상태면 안내 메시지 표시
  if (schedule.type === 'applied') {
    return (
      <View className="py-6 items-center">
        <View className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 w-full">
          <Text className="text-sm text-yellow-700 dark:text-yellow-300 text-center">
            지원이 확정되면 근무 정보를 확인할 수 있습니다.
          </Text>
        </View>
      </View>
    );
  }

  // 취소 상태면 안내 메시지 표시
  if (schedule.type === 'cancelled') {
    return (
      <View className="py-6 items-center">
        <View className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 w-full">
          <Text className="text-sm text-red-600 dark:text-red-400 text-center">
            취소된 스케줄입니다.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="py-2">
      {/* 역할 */}
      <View className="mb-5">
        <View className="flex-row items-center mb-2">
          <BriefcaseIcon size={18} color="#6B7280" />
          <Text className="ml-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            역할
          </Text>
        </View>
        <View className="ml-6">
          <Text className="text-base text-gray-900 dark:text-white font-medium">
            {getRoleDisplayName(schedule.role, schedule.customRole)}
          </Text>
        </View>
      </View>

      {/* 구인자 연락처 (확정 상태에서만) */}
      {schedule.type === 'confirmed' && schedule.ownerPhone && (
        <View className="mb-5">
          <View className="flex-row items-center mb-2">
            <PhoneIcon size={18} color="#6B7280" />
            <Text className="ml-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              구인자 연락처
            </Text>
          </View>
          <Pressable
            onPress={() => Linking.openURL(`tel:${schedule.ownerPhone}`)}
            className="ml-6 flex-row items-center py-2 px-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg active:bg-primary-100 dark:active:bg-primary-900/30"
          >
            <Text className="text-base text-primary-600 dark:text-primary-400 font-medium">
              {formatPhoneNumber(schedule.ownerPhone)}
            </Text>
            <View className="ml-auto flex-row items-center">
              <PhoneIcon size={16} color="#2563EB" />
              <Text className="ml-1 text-sm text-primary-600 dark:text-primary-400">
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
            <ClockIcon size={18} color="#6B7280" />
            <Text className="ml-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              출퇴근 기록
            </Text>
          </View>
          <Badge variant={attendance.variant} size="sm">
            {attendance.label}
          </Badge>
        </View>

        {hasActualTimes ? (
          <View className="flex-row gap-2">
            <TimeBox
              label="출근"
              value={formatTime(schedule.checkInTime)}
            />
            <TimeBox
              label="퇴근"
              value={formatTime(schedule.checkOutTime)}
            />
            <TimeBox
              label="근무시간"
              value={calculateDuration(schedule.checkInTime, schedule.checkOutTime)}
              isHighlight
            />
          </View>
        ) : (
          <View className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
            <Text className="text-sm text-gray-500 dark:text-gray-400 text-center">
              아직 출퇴근 기록이 없습니다
            </Text>
          </View>
        )}
      </View>

      {/* 예정 시간 (참고용) */}
      {(schedule.startTime || schedule.endTime) && (
        <View className="mb-5 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
          <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">예정 시간</Text>
          <Text className="text-sm text-gray-600 dark:text-gray-400">
            {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
            {' '}({calculateDuration(schedule.startTime, schedule.endTime)})
          </Text>
        </View>
      )}

      {/* QR 스캔 버튼 */}
      {canShowQRButton && (
        <Button
          variant={isWorking ? 'secondary' : 'primary'}
          onPress={handleQRScan}
          className="flex-row items-center justify-center mt-2"
        >
          <QrCodeIcon size={20} color={isWorking ? '#374151' : '#FFFFFF'} />
          <Text className={`ml-2 font-semibold ${isWorking ? 'text-gray-900 dark:text-gray-100' : 'text-white'}`}>
            QR 코드로 {isWorking ? '퇴근' : '출근'}하기
          </Text>
        </Button>
      )}
    </View>
  );
});

export default WorkTab;
