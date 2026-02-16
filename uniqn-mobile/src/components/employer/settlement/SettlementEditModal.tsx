/**
 * UNIQN Mobile - 정산 금액 수정 모달
 *
 * @description 개별 정산 금액(급여, 수당, 세금) 수정
 * @version 1.0.0
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { SheetModal } from '../../ui/SheetModal';
import { Avatar } from '../../ui/Avatar';
import { ChevronDownIcon, ChevronUpIcon } from '../../icons';
import { formatDate } from '@/utils/date';
import { logger } from '@/utils/logger';
import { useUserProfile } from '@/hooks/useUserProfile';
import {
  type SalaryInfo,
  type Allowances,
  parseTimestamp,
  calculateSettlementFromWorkLog,
  formatCurrency,
  formatDuration,
} from '@/utils/settlement';
import { SalaryTypeSelector } from './SalaryTypeSelector';
import { AllowanceEditor } from './AllowanceEditor';
import { TaxSettingsEditor, type TaxSettings } from './TaxSettingsEditor';
import { getRoleDisplayName } from '@/types/unified';
import type { WorkLog } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface SettlementEditModalProps {
  visible: boolean;
  onClose: () => void;
  workLog: WorkLog | null;
  /** 현재 급여 정보 */
  salaryInfo: SalaryInfo;
  /** 현재 수당 정보 */
  allowances?: Allowances;
  /** 현재 세금 설정 */
  taxSettings?: TaxSettings;
  /** 저장 콜백 */
  onSave: (data: SettlementEditData) => Promise<void>;
}

export interface SettlementEditData {
  salaryInfo: SalaryInfo;
  allowances: Allowances;
  taxSettings: TaxSettings;
  reason?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TAX_SETTINGS: TaxSettings = {
  type: 'none',
  value: 0,
};

// ============================================================================
// Sub-components
// ============================================================================

interface AccordionSectionProps {
  title: string;
  icon?: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function AccordionSection({ title, icon, expanded, onToggle, children }: AccordionSectionProps) {
  return (
    <View className="border-b border-gray-100 dark:border-surface-overlay">
      <Pressable
        onPress={onToggle}
        className="flex-row items-center justify-between px-4 py-4 active:bg-gray-50 dark:active:bg-gray-800"
      >
        <View className="flex-row items-center">
          {icon}
          <Text className="ml-2 text-base font-semibold text-gray-900 dark:text-white">
            {title}
          </Text>
        </View>
        {expanded ? (
          <ChevronUpIcon size={20} color="#6B7280" />
        ) : (
          <ChevronDownIcon size={20} color="#6B7280" />
        )}
      </Pressable>
      {expanded && <View className="px-4 pb-4">{children}</View>}
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SettlementEditModal({
  visible,
  onClose,
  workLog,
  salaryInfo: initialSalaryInfo,
  allowances: initialAllowances,
  taxSettings: initialTaxSettings,
  onSave,
}: SettlementEditModalProps) {
  // 사용자 프로필 조회
  const { displayName, profilePhotoURL } = useUserProfile({
    userId: workLog?.staffId,
    enabled: visible,
    fallbackName: (workLog as WorkLog & { staffName?: string })?.staffName,
    fallbackNickname: (workLog as WorkLog & { staffNickname?: string })?.staffNickname,
  });

  // 로컬 상태
  const [salaryInfo, setSalaryInfo] = useState<SalaryInfo>(initialSalaryInfo);
  const [allowances, setAllowances] = useState<Allowances>(initialAllowances || {});
  const [taxSettings, setTaxSettings] = useState<TaxSettings>(
    initialTaxSettings || DEFAULT_TAX_SETTINGS
  );
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 아코디언 상태
  const [expandedSections, setExpandedSections] = useState({
    salary: true,
    allowances: false,
    tax: false,
  });

  // 초기값 동기화
  useEffect(() => {
    if (visible) {
      setSalaryInfo(initialSalaryInfo);
      setAllowances(initialAllowances || {});
      setTaxSettings(initialTaxSettings || DEFAULT_TAX_SETTINGS);
      setReason('');
      setExpandedSections({ salary: true, allowances: false, tax: false });
    }
  }, [visible, initialSalaryInfo, initialAllowances, initialTaxSettings]);

  const workDate = useMemo(() => (workLog ? parseTimestamp(workLog.date) : null), [workLog]);

  // 정산 계산 (taxSettings 포함하여 세금도 함께 계산)
  const settlement = useMemo(
    () =>
      workLog ? calculateSettlementFromWorkLog(workLog, salaryInfo, allowances, taxSettings) : null,
    [workLog, salaryInfo, allowances, taxSettings]
  );

  // 세금 및 세후 금액 (settlement에서 가져옴 - taxableItems 적용됨)
  const taxAmount = useMemo(() => settlement?.taxAmount ?? 0, [settlement]);
  const afterTaxAmount = useMemo(() => settlement?.afterTaxPay ?? 0, [settlement]);

  // 핸들러
  const toggleSection = useCallback((section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!workLog || isSaving) return;

    setIsSaving(true);
    try {
      await onSave({
        salaryInfo,
        allowances,
        taxSettings,
        reason: reason.trim() || undefined,
      });
      onClose();
    } catch (error) {
      // 에러 처리는 상위 컴포넌트에서
      logger.error('정산 금액 수정 실패', error instanceof Error ? error : undefined, {
        component: 'SettlementEditModal',
      });
    } finally {
      setIsSaving(false);
    }
  }, [workLog, salaryInfo, allowances, taxSettings, reason, isSaving, onSave, onClose]);

  if (!workLog) return null;

  // Footer 버튼
  const footerContent = (
    <View className="flex-row gap-3">
      <Pressable
        onPress={onClose}
        disabled={isSaving}
        className={`flex-1 py-3.5 rounded-xl bg-gray-100 dark:bg-surface ${
          isSaving ? 'opacity-50' : 'active:opacity-70'
        }`}
      >
        <Text className="text-base font-medium text-gray-700 dark:text-gray-300 text-center">
          취소
        </Text>
      </Pressable>
      <Pressable
        onPress={handleSave}
        disabled={isSaving}
        className={`flex-1 py-3.5 rounded-xl bg-primary-500 ${
          isSaving ? 'opacity-50' : 'active:opacity-70'
        }`}
      >
        <Text className="text-base font-semibold text-white text-center">
          {isSaving ? '저장 중...' : '저장'}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="정산 금액 수정"
      footer={footerContent}
      isLoading={isSaving}
    >
      <View>
        {/* 프로필 헤더 */}
        <View className="flex-row items-center p-4 bg-gray-50 dark:bg-surface -mx-5 -mt-5">
          <Avatar source={profilePhotoURL} name={displayName} size="md" className="mr-3" />
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-900 dark:text-white">
              {displayName}
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              {workLog.role
                ? getRoleDisplayName(
                    workLog.role,
                    (workLog as WorkLog & { customRole?: string }).customRole
                  )
                : '역할 없음'}{' '}
              • {workDate ? formatDate(workDate) : '날짜 없음'}
            </Text>
          </View>
        </View>

        {/* 급여 설정 섹션 */}
        <AccordionSection
          title="급여 설정"
          expanded={expandedSections.salary}
          onToggle={() => toggleSection('salary')}
        >
          <SalaryTypeSelector
            salaryInfo={salaryInfo}
            onChange={setSalaryInfo}
            hoursWorked={settlement?.hoursWorked}
            showLabel={false}
          />
        </AccordionSection>

        {/* 수당 설정 섹션 */}
        <AccordionSection
          title="수당 설정"
          expanded={expandedSections.allowances}
          onToggle={() => toggleSection('allowances')}
        >
          <AllowanceEditor allowances={allowances} onChange={setAllowances} showLabel={false} />
        </AccordionSection>

        {/* 세금 설정 섹션 */}
        <AccordionSection
          title="세금 설정"
          expanded={expandedSections.tax}
          onToggle={() => toggleSection('tax')}
        >
          <TaxSettingsEditor
            taxSettings={taxSettings}
            onChange={setTaxSettings}
            totalAmount={settlement?.totalPay}
            showLabel={false}
            showPreview={false}
          />
        </AccordionSection>

        {/* 정산 금액 요약 */}
        {settlement && (
          <View className="px-4 py-4 bg-gray-50 dark:bg-surface">
            <Text className="text-base font-semibold text-gray-900 dark:text-white mb-3">
              정산 금액 요약
            </Text>

            <View className="bg-white dark:bg-surface-dark rounded-lg p-4 flex-col gap-2">
              {/* 기본 급여 */}
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-gray-600 dark:text-gray-400">
                  기본급
                  {settlement.hoursWorked > 0 && (
                    <Text className="text-xs"> ({formatDuration(settlement.hoursWorked)})</Text>
                  )}
                </Text>
                <Text className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatCurrency(settlement.basePay)}
                </Text>
              </View>

              {/* 수당 */}
              {settlement.allowancePay > 0 && (
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-gray-600 dark:text-gray-400">수당</Text>
                  <Text className="text-sm font-medium text-green-600 dark:text-green-400">
                    +{formatCurrency(settlement.allowancePay)}
                  </Text>
                </View>
              )}

              {/* 세금 */}
              {taxSettings.type !== 'none' && taxAmount > 0 && (
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-gray-600 dark:text-gray-400">
                    세금
                    {taxSettings.type === 'rate' && (
                      <Text className="text-xs"> ({taxSettings.value}%)</Text>
                    )}
                  </Text>
                  <Text className="text-sm font-medium text-red-500 dark:text-red-400">
                    -{formatCurrency(taxAmount)}
                  </Text>
                </View>
              )}

              {/* 구분선 */}
              <View className="h-px bg-gray-200 dark:bg-surface my-2" />

              {/* 세후 금액 */}
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-semibold text-gray-900 dark:text-white">
                  {taxSettings.type !== 'none' ? '세후 금액' : '총 정산 금액'}
                </Text>
                <Text className="text-xl font-bold text-primary-600 dark:text-primary-400">
                  {formatCurrency(afterTaxAmount)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* 수정 사유 입력 */}
        <View className="px-4 py-4">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            수정 사유 (선택)
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="예: 역할 변경으로 인한 조정"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={2}
            className="bg-white dark:bg-surface border border-gray-300 dark:border-surface-overlay rounded-lg px-4 py-3 text-base text-gray-900 dark:text-white"
            accessibilityLabel="수정 사유"
          />
        </View>

        <View className="h-4" />
      </View>
    </SheetModal>
  );
}

export default SettlementEditModal;
