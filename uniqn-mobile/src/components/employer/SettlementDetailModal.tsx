/**
 * UNIQN Mobile - 정산 상세 모달
 *
 * @description 근무 기록 상세 정보 및 정산 관리 모달
 * @version 1.1.0
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
import {
  type SalaryType,
  type SalaryInfo,
  type TaxSettings,
  parseTimestamp,
  calculateSettlementFromWorkLog,
  formatCurrency,
  formatDuration,
  SALARY_TYPE_LABELS,
} from '@/utils/settlement';
import type { UserProfile } from '@/services';
import type { WorkLog, PayrollStatus, Allowances } from '@/types';
import { ROLE_LABELS } from '@/constants';

// Re-export types for backward compatibility
export type { SalaryType, SalaryInfo };

// ============================================================================
// Types
// ============================================================================

export interface SettlementDetailModalProps {
  visible: boolean;
  onClose: () => void;
  workLog: WorkLog | null;
  salaryInfo: SalaryInfo;
  allowances?: Allowances;
  /** 세금 설정 */
  taxSettings?: TaxSettings;
  onEditTime?: (workLog: WorkLog) => void;
  onEditAmount?: (workLog: WorkLog) => void;
  onSettle?: (workLog: WorkLog) => void;
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

const PROVIDED_FLAG = -1;

// ============================================================================
// Helpers
// ============================================================================

function getRoleLabel(role: string | undefined, customRole?: string): string {
  if (!role) return '역할 없음';
  // 커스텀 역할이면 customRole 사용
  if (role === 'other' && customRole) {
    return customRole;
  }
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
  salaryInfo,
  allowances,
  taxSettings,
  onEditTime,
  onEditAmount,
  onSettle,
}: SettlementDetailModalProps) {
  // 사용자 프로필 조회
  const { data: userProfile } = useQuery<UserProfile | null>({
    queryKey: ['userProfile', workLog?.staffId],
    queryFn: () => getUserProfile(workLog!.staffId),
    enabled: visible && !!workLog?.staffId,
    staleTime: 5 * 60 * 1000,
  });

  // 수정 이력 접기/펼치기 상태 (기본: 접힘)
  const [isTimeHistoryExpanded, setIsTimeHistoryExpanded] = useState(false);
  const [isAmountHistoryExpanded, setIsAmountHistoryExpanded] = useState(false);

  // 계산된 값들
  const startTime = useMemo(() => workLog ? parseTimestamp(workLog.actualStartTime) : null, [workLog]);
  const endTime = useMemo(() => workLog ? parseTimestamp(workLog.actualEndTime) : null, [workLog]);
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
              {getRoleLabel(workLog.role, (workLog as WorkLog & { customRole?: string }).customRole)} • {workDate ? formatDate(workDate) : '날짜 없음'}
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
                    {settlement ? formatDuration(settlement.hoursWorked) : '-'}
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

              <View className="flex-col gap-1">
                {/* 급여 타입에 따른 계산 내역 */}
                {salaryInfo.type === 'hourly' ? (
                  <InfoRow
                    label={`${SALARY_TYPE_LABELS[salaryInfo.type]} ${formatCurrency(salaryInfo.amount)} × ${formatDuration(settlement.hoursWorked)}`}
                    value={formatCurrency(settlement.basePay)}
                  />
                ) : (
                  <InfoRow
                    label={`${SALARY_TYPE_LABELS[salaryInfo.type]}`}
                    value={formatCurrency(settlement.basePay)}
                  />
                )}

                {/* 수당 금액 (금액이 있는 경우만 표시) */}
                {settlement.allowancePay > 0 && (
                  <InfoRow
                    label="수당"
                    value={`+${formatCurrency(settlement.allowancePay)}`}
                    valueColor="text-green-600 dark:text-green-400"
                  />
                )}

                {/* 수당 정보 뱃지 (제공 항목 포함) */}
                {allowanceItems.length > 0 && (
                  <View className="flex-row flex-wrap py-2">
                    {allowanceItems.map((item, idx) => (
                      <Badge key={idx} variant="default" size="sm" className="mr-2 mb-1">
                        {item}
                      </Badge>
                    ))}
                  </View>
                )}

                {/* 세금 공제 (세금이 있는 경우만 표시) */}
                {settlement.taxAmount > 0 && (
                  <InfoRow
                    label="세금 공제"
                    value={`-${formatCurrency(settlement.taxAmount)}`}
                    valueColor="text-red-600 dark:text-red-400"
                  />
                )}

                <View className="h-px bg-gray-200 dark:bg-gray-700 my-2" />

                <InfoRow
                  label="총 정산 금액"
                  value={formatCurrency(settlement.taxAmount > 0 ? settlement.afterTaxPay : settlement.totalPay)}
                  highlight
                />
              </View>
            </View>
          )}

          {/* 시간 수정 이력 섹션 (접기/펼치기) */}
          {workLog.modificationHistory && workLog.modificationHistory.length > 0 && (
            <View className="px-4 py-4 border-b border-gray-100 dark:border-gray-700">
              <Pressable
                onPress={() => setIsTimeHistoryExpanded(!isTimeHistoryExpanded)}
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
                {isTimeHistoryExpanded ? (
                  <ChevronUpIcon size={20} color="#6B7280" />
                ) : (
                  <ChevronDownIcon size={20} color="#6B7280" />
                )}
              </Pressable>

              {isTimeHistoryExpanded && (
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

          {/* 금액 수정 이력 섹션 (접기/펼치기) */}
          {workLog.settlementModificationHistory && workLog.settlementModificationHistory.length > 0 && (
            <View className="px-4 py-4 border-b border-gray-100 dark:border-gray-700">
              <Pressable
                onPress={() => setIsAmountHistoryExpanded(!isAmountHistoryExpanded)}
                className="flex-row items-center justify-between active:opacity-70"
              >
                <View className="flex-row items-center">
                  <BanknotesIcon size={18} color="#6B7280" />
                  <Text className="ml-2 text-base font-semibold text-gray-900 dark:text-white">
                    금액 수정 이력
                  </Text>
                  <View className="ml-2 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-full">
                    <Text className="text-xs text-indigo-700 dark:text-indigo-300">
                      {workLog.settlementModificationHistory.length}회
                    </Text>
                  </View>
                </View>
                {isAmountHistoryExpanded ? (
                  <ChevronUpIcon size={20} color="#6B7280" />
                ) : (
                  <ChevronDownIcon size={20} color="#6B7280" />
                )}
              </Pressable>

              {isAmountHistoryExpanded && (
                <View className="mt-3 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  {workLog.settlementModificationHistory.map((mod, idx) => {
                    const modifiedAt = parseTimestamp(mod.modifiedAt);
                    return (
                      <View
                        key={idx}
                        className="flex-row items-start py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      >
                        <View className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 items-center justify-center mr-2">
                          <Text className="text-xs text-indigo-600 dark:text-indigo-400">{idx + 1}</Text>
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm text-gray-900 dark:text-white">
                            {mod.reason || '금액 수정'}
                          </Text>
                          {modifiedAt && (
                            <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {formatDate(modifiedAt)} {formatTime(modifiedAt)}
                            </Text>
                          )}
                          {/* 변경 내용 표시 */}
                          <View className="mt-1.5 bg-gray-100 dark:bg-gray-700 rounded px-2 py-1.5">
                            {mod.newSalaryInfo && (
                              <Text className="text-xs text-gray-600 dark:text-gray-300">
                                • 급여: {mod.previousSalaryInfo?.amount?.toLocaleString() || '-'}원 → {mod.newSalaryInfo.amount.toLocaleString()}원
                              </Text>
                            )}
                            {mod.newAllowances && (
                              <Text className="text-xs text-gray-600 dark:text-gray-300">
                                • 수당 변경
                              </Text>
                            )}
                            {mod.newTaxSettings && (
                              <Text className="text-xs text-gray-600 dark:text-gray-300">
                                • 세금: {mod.previousTaxSettings?.type || 'none'} → {mod.newTaxSettings.type}
                              </Text>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })}
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
              {/* 첫 번째 줄: 시간 수정, 금액 수정 */}
              <View className="flex-row gap-3 mb-3">
                {onEditTime && (
                  <Pressable
                    onPress={handleEditTime}
                    className="flex-1 flex-row items-center justify-center py-3 rounded-lg bg-gray-100 dark:bg-gray-700 active:opacity-70"
                  >
                    <ClockIcon size={18} color="#6B7280" />
                    <Text className="ml-2 text-base font-medium text-gray-700 dark:text-gray-300">
                      시간 수정
                    </Text>
                  </Pressable>
                )}

                {onEditAmount && (
                  <Pressable
                    onPress={handleEditAmount}
                    className="flex-1 flex-row items-center justify-center py-3 rounded-lg bg-gray-100 dark:bg-gray-700 active:opacity-70"
                  >
                    <EditIcon size={18} color="#6B7280" />
                    <Text className="ml-2 text-base font-medium text-gray-700 dark:text-gray-300">
                      금액 수정
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* 두 번째 줄: 정산하기 버튼 */}
              {onSettle && (
                <Pressable
                  onPress={handleSettle}
                  className="flex-row items-center justify-center py-3.5 rounded-lg bg-primary-500 active:opacity-70"
                >
                  <BanknotesIcon size={18} color="#fff" />
                  <Text className="ml-2 text-base font-semibold text-white">
                    정산하기
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          <View className="h-8" />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default SettlementDetailModal;
