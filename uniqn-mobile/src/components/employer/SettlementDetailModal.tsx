/**
 * UNIQN Mobile - 정산 상세 모달
 *
 * @description 근무 기록 상세 정보 및 정산 관리 모달
 * @version 1.0.0
 */

import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import {
  XMarkIcon,
  ClockIcon,
  BanknotesIcon,
  EditIcon,
  CheckCircleIcon,
  DocumentIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '../icons';
import { formatTime, formatDate } from '@/utils/dateUtils';
import { getUserProfile } from '@/services';
import type { UserProfile } from '@/services';
import type { WorkLog, PayrollStatus, Allowances } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface SettlementDetailModalProps {
  visible: boolean;
  onClose: () => void;
  workLog: WorkLog | null;
  hourlyRate: number;
  allowances?: Allowances;
  onEditTime?: (workLog: WorkLog) => void;
  onSettle?: (workLog: WorkLog) => void;
}

interface SettlementCalculation {
  regularHours: number;
  overtimeHours: number;
  regularPay: number;
  overtimePay: number;
  totalPay: number;
}

// ============================================================================
// Constants
// ============================================================================

const PAYROLL_STATUS_CONFIG: Record<PayrollStatus, {
  label: string;
  variant: 'default' | 'primary' | 'success' | 'warning' | 'error';
}> = {
  pending: { label: '미정산', variant: 'warning' },
  processing: { label: '처리중', variant: 'primary' },
  completed: { label: '정산완료', variant: 'success' },
};

const REGULAR_HOURS = 8;
const OVERTIME_RATE = 1.5;
const PROVIDED_FLAG = -1;

const ROLE_LABELS: Record<string, string> = {
  dealer: '딜러',
  floor: '플로어',
  manager: '매니저',
  chiprunner: '칩러너',
  admin: '관리자',
};

// ============================================================================
// Helpers
// ============================================================================

function parseTimestamp(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

function calculateSettlement(workLog: WorkLog, hourlyRate: number): SettlementCalculation {
  const startTime = parseTimestamp(workLog.actualStartTime);
  const endTime = parseTimestamp(workLog.actualEndTime);

  if (!startTime || !endTime) {
    return {
      regularHours: 0,
      overtimeHours: 0,
      regularPay: 0,
      overtimePay: 0,
      totalPay: 0,
    };
  }

  const totalMinutes = Math.max(0, (endTime.getTime() - startTime.getTime()) / (1000 * 60));
  const totalHours = totalMinutes / 60;

  const regularHours = Math.min(totalHours, REGULAR_HOURS);
  const overtimeHours = Math.max(0, totalHours - REGULAR_HOURS);

  const regularPay = Math.round(regularHours * hourlyRate);
  const overtimePay = Math.round(overtimeHours * hourlyRate * OVERTIME_RATE);

  return {
    regularHours: Math.round(regularHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    regularPay,
    overtimePay,
    totalPay: regularPay + overtimePay,
  };
}

function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);

  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

function getRoleLabel(role: string | undefined): string {
  if (!role) return '역할 없음';
  return ROLE_LABELS[role] || role;
}

function getAllowanceItems(allowances?: Allowances): string[] {
  if (!allowances) return [];
  const items: string[] = [];

  if (allowances.guaranteedHours && allowances.guaranteedHours > 0) {
    items.push(`보장 ${allowances.guaranteedHours}시간`);
  }

  if (allowances.meal === PROVIDED_FLAG) {
    items.push('식사제공');
  } else if (allowances.meal && allowances.meal > 0) {
    items.push(`식비 ${allowances.meal.toLocaleString()}원`);
  }

  if (allowances.transportation === PROVIDED_FLAG) {
    items.push('교통비제공');
  } else if (allowances.transportation && allowances.transportation > 0) {
    items.push(`교통비 ${allowances.transportation.toLocaleString()}원`);
  }

  if (allowances.accommodation === PROVIDED_FLAG) {
    items.push('숙박제공');
  } else if (allowances.accommodation && allowances.accommodation > 0) {
    items.push(`숙박비 ${allowances.accommodation.toLocaleString()}원`);
  }

  return items;
}

// ============================================================================
// Sub-components
// ============================================================================

interface InfoRowProps {
  label: string;
  value: string;
  highlight?: boolean;
  valueColor?: string;
}

function InfoRow({ label, value, highlight, valueColor }: InfoRowProps) {
  return (
    <View className="flex-row items-center justify-between py-2">
      <Text className="text-sm text-gray-600 dark:text-gray-400">
        {label}
      </Text>
      <Text className={`text-sm font-medium ${
        highlight
          ? 'text-lg font-bold text-primary-600 dark:text-primary-400'
          : valueColor || 'text-gray-900 dark:text-white'
      }`}>
        {value}
      </Text>
    </View>
  );
}

interface ModificationHistoryItemProps {
  modification: {
    modifiedAt?: unknown;
    reason?: string;
    modifiedBy?: string;
    previousStartTime?: unknown;
    previousEndTime?: unknown;
    newStartTime?: unknown;
    newEndTime?: unknown;
  };
  index: number;
}

/**
 * 시간 변경 내용 포맷팅
 * @returns "출근시간 미정 → 11:00" 형식의 문자열 또는 null
 */
function formatTimeChange(
  prevValue: unknown,
  newValue: unknown,
  label: string
): string | null {
  // 둘 다 undefined면 변경 없음
  if (prevValue === undefined && newValue === undefined) {
    return null;
  }

  const prevTime = parseTimestamp(prevValue);
  const newTime = parseTimestamp(newValue);

  const prevStr = prevTime ? formatTime(prevTime) : '미정';
  const newStr = newTime ? formatTime(newTime) : '미정';

  // 같은 값이면 표시 안 함
  if (prevStr === newStr) {
    return null;
  }

  return `${label} ${prevStr} → ${newStr}`;
}

function ModificationHistoryItem({ modification, index }: ModificationHistoryItemProps) {
  const modifiedAt = parseTimestamp(modification.modifiedAt);

  // 상세 변경 내용
  const startTimeChange = formatTimeChange(
    modification.previousStartTime,
    modification.newStartTime,
    '출근시간'
  );
  const endTimeChange = formatTimeChange(
    modification.previousEndTime,
    modification.newEndTime,
    '퇴근시간'
  );

  return (
    <View className="flex-row items-start py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
      <View className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 items-center justify-center mr-2">
        <Text className="text-xs text-gray-500 dark:text-gray-400">{index + 1}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-sm text-gray-900 dark:text-white">
          {modification.reason || '시간 수정'}
        </Text>
        {modifiedAt && (
          <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {formatDate(modifiedAt)} {formatTime(modifiedAt)}
          </Text>
        )}
        {/* 상세 변경 내용 표시 */}
        {(startTimeChange || endTimeChange) && (
          <View className="mt-1.5 bg-gray-100 dark:bg-gray-700 rounded px-2 py-1.5">
            {startTimeChange && (
              <Text className="text-xs text-gray-600 dark:text-gray-300">
                • {startTimeChange}
              </Text>
            )}
            {endTimeChange && (
              <Text className="text-xs text-gray-600 dark:text-gray-300">
                • {endTimeChange}
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SettlementDetailModal({
  visible,
  onClose,
  workLog,
  hourlyRate,
  allowances,
  onEditTime,
  onSettle,
}: SettlementDetailModalProps) {
  // 사용자 프로필 조회
  const { data: userProfile } = useQuery<UserProfile | null>({
    queryKey: ['userProfile', workLog?.staffId],
    queryFn: () => getUserProfile(workLog!.staffId),
    enabled: visible && !!workLog?.staffId,
    staleTime: 5 * 60 * 1000,
  });

  // 시간 수정 이력 접기/펼치기 상태 (기본: 접힘)
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  // 계산된 값들
  const startTime = useMemo(() => workLog ? parseTimestamp(workLog.actualStartTime) : null, [workLog?.actualStartTime]);
  const endTime = useMemo(() => workLog ? parseTimestamp(workLog.actualEndTime) : null, [workLog?.actualEndTime]);
  const workDate = useMemo(() => workLog ? parseTimestamp(workLog.date) : null, [workLog?.date]);

  const settlement = useMemo(() =>
    workLog ? calculateSettlement(workLog, hourlyRate) : null,
    [workLog, hourlyRate]
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
  }, [baseName, userProfile?.nickname, workLog?.staffId]);

  const payrollStatus = (workLog?.payrollStatus || 'pending') as PayrollStatus;
  const statusConfig = PAYROLL_STATUS_CONFIG[payrollStatus];
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
          <Pressable onPress={onClose} hitSlop={8}>
            <XMarkIcon size={24} color="#6B7280" />
          </Pressable>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* 프로필 헤더 */}
          <View className="items-center py-6 bg-gray-50 dark:bg-gray-800">
            <Avatar
              source={profilePhotoURL}
              name={displayName}
              size="xl"
              className="mb-3"
            />
            <View className="flex-row items-center gap-2 mb-1">
              <Text className="text-xl font-bold text-gray-900 dark:text-white">
                {displayName}
              </Text>
              <Badge variant={statusConfig.variant} size="sm" dot>
                {statusConfig.label}
              </Badge>
            </View>
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              {getRoleLabel(workLog.role)} • {workDate ? formatDate(workDate) : '날짜 없음'}
            </Text>
          </View>

          {/* 근무 시간 섹션 */}
          <View className="px-4 py-4 border-b border-gray-100 dark:border-gray-700">
            <View className="flex-row items-center mb-3">
              <ClockIcon size={18} color="#6B7280" />
              <Text className="ml-2 text-base font-semibold text-gray-900 dark:text-white">
                근무 시간
              </Text>
            </View>

            {hasValidTimes ? (
              <View className="flex-row items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <View className="items-center">
                  <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">출근</Text>
                  <Text className="text-lg font-semibold text-green-600 dark:text-green-400">
                    {formatTime(startTime)}
                  </Text>
                </View>
                <View className="h-0.5 flex-1 mx-4 bg-gray-200 dark:bg-gray-700" />
                <View className="items-center">
                  <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">퇴근</Text>
                  <Text className="text-lg font-semibold text-red-600 dark:text-red-400">
                    {formatTime(endTime)}
                  </Text>
                </View>
                <View className="h-0.5 flex-1 mx-4 bg-gray-200 dark:bg-gray-700" />
                <View className="items-center">
                  <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">근무</Text>
                  <Text className="text-lg font-semibold text-primary-600 dark:text-primary-400">
                    {settlement ? formatDuration(settlement.regularHours + settlement.overtimeHours) : '-'}
                  </Text>
                </View>
              </View>
            ) : (
              <View className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <Text className="text-sm text-yellow-700 dark:text-yellow-300 text-center">
                  출퇴근 기록이 완료되지 않았습니다
                </Text>
              </View>
            )}
          </View>

          {/* 정산 금액 섹션 */}
          {hasValidTimes && settlement && (
            <View className="px-4 py-4 border-b border-gray-100 dark:border-gray-700">
              <View className="flex-row items-center mb-3">
                <BanknotesIcon size={18} color="#6B7280" />
                <Text className="ml-2 text-base font-semibold text-gray-900 dark:text-white">
                  정산 금액
                </Text>
              </View>

              <View className="space-y-1">
                <InfoRow
                  label={`기본 근무 (${formatDuration(settlement.regularHours)})`}
                  value={formatCurrency(settlement.regularPay)}
                />

                {settlement.overtimeHours > 0 && (
                  <InfoRow
                    label={`초과 근무 (${formatDuration(settlement.overtimeHours)}) × 1.5`}
                    value={`+${formatCurrency(settlement.overtimePay)}`}
                    valueColor="text-orange-600 dark:text-orange-400"
                  />
                )}

                {/* 수당 정보 */}
                {allowanceItems.length > 0 && (
                  <View className="flex-row flex-wrap py-2">
                    {allowanceItems.map((item, idx) => (
                      <Badge key={idx} variant="default" size="sm" className="mr-2 mb-1">
                        {item}
                      </Badge>
                    ))}
                  </View>
                )}

                <View className="h-px bg-gray-200 dark:bg-gray-700 my-2" />

                <InfoRow
                  label="총 정산 금액"
                  value={formatCurrency(settlement.totalPay)}
                  highlight
                />
              </View>
            </View>
          )}

          {/* 시간 수정 이력 섹션 (접기/펼치기) */}
          {workLog.modificationHistory && workLog.modificationHistory.length > 0 && (
            <View className="px-4 py-4 border-b border-gray-100 dark:border-gray-700">
              <Pressable
                onPress={() => setIsHistoryExpanded(!isHistoryExpanded)}
                className="flex-row items-center justify-between active:opacity-70"
              >
                <View className="flex-row items-center">
                  <DocumentIcon size={18} color="#6B7280" />
                  <Text className="ml-2 text-base font-semibold text-gray-900 dark:text-white">
                    시간 수정 이력
                  </Text>
                  <View className="ml-2 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                    <Text className="text-xs text-yellow-700 dark:text-yellow-300">
                      {workLog.modificationHistory.length}회
                    </Text>
                  </View>
                </View>
                {isHistoryExpanded ? (
                  <ChevronUpIcon size={20} color="#6B7280" />
                ) : (
                  <ChevronDownIcon size={20} color="#6B7280" />
                )}
              </Pressable>

              {isHistoryExpanded && (
                <View className="mt-3 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  {workLog.modificationHistory.map((mod, idx) => (
                    <ModificationHistoryItem
                      key={idx}
                      modification={mod}
                      index={idx}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* 정산 완료 표시 */}
          {payrollStatus === 'completed' && (
            <View className="px-4 py-4">
              <View className="flex-row items-center justify-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <CheckCircleIcon size={20} color="#10B981" />
                <Text className="ml-2 text-base font-medium text-green-600 dark:text-green-400">
                  {workLog.payrollDate
                    ? `${formatDate(parseTimestamp(workLog.payrollDate)!)} 정산 완료`
                    : '정산 완료'}
                </Text>
              </View>
            </View>
          )}

          {/* 액션 버튼 (미정산일 때만) */}
          {payrollStatus === 'pending' && hasValidTimes && (
            <View className="px-4 py-4">
              <View className="flex-row gap-3">
                {onEditTime && (
                  <Pressable
                    onPress={handleEditTime}
                    className="flex-1 flex-row items-center justify-center py-3 rounded-lg bg-gray-100 dark:bg-gray-700 active:opacity-70"
                  >
                    <EditIcon size={18} color="#6B7280" />
                    <Text className="ml-2 text-base font-medium text-gray-700 dark:text-gray-300">
                      시간 수정
                    </Text>
                  </Pressable>
                )}

                {onSettle && (
                  <Pressable
                    onPress={handleSettle}
                    className="flex-1 flex-row items-center justify-center py-3 rounded-lg bg-primary-500 active:opacity-70"
                  >
                    <BanknotesIcon size={18} color="#fff" />
                    <Text className="ml-2 text-base font-medium text-white">
                      정산하기
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          <View className="h-8" />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default SettlementDetailModal;
