/**
 * UNIQN Mobile - 정산 설정 모달
 *
 * @description 역할별 급여, 수당, 세금 일괄 설정
 * @version 2.0.0 - roles[].salary 구조 사용
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '../icons';
import {
  type SalaryInfo,
  type Allowances,
  DEFAULT_SALARY_INFO,
} from '@/utils/settlement';
import {
  SalaryTypeSelector,
} from './SalaryTypeSelector';
import {
  AllowanceEditor,
} from './AllowanceEditor';
import {
  TaxSettingsEditor,
  type TaxSettings,
} from './TaxSettingsEditor';
import { ROLE_LABELS } from '@/constants';

// ============================================================================
// Types
// ============================================================================

/** 역할 + 급여 정보 */
export interface RoleWithSalary {
  role?: string;
  name?: string;
  customRole?: string;
  salary?: SalaryInfo;
}

export interface SettlementSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  /** 역할 목록 (급여 포함) - v2.0 */
  roles: RoleWithSalary[];
  /** 현재 수당 설정 */
  allowances: Allowances;
  /** 현재 세금 설정 */
  taxSettings?: TaxSettings;
  /** 저장 콜백 */
  onSave: (data: SettlementSettingsData) => Promise<void>;
}

export interface SettlementSettingsData {
  /** 역할 목록 (급여 포함) - v2.0 */
  roles: RoleWithSalary[];
  allowances: Allowances;
  taxSettings: TaxSettings;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TAX_SETTINGS: TaxSettings = {
  type: 'none',
  value: 0,
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * 역할 키 추출 (customRole 우선)
 */
function getRoleKey(role: RoleWithSalary): string {
  const roleStr = (role.role || role.name) as string;
  if (roleStr === 'other' && role.customRole) {
    return role.customRole;
  }
  return roleStr || '';
}

/**
 * 역할 라벨 가져오기
 */
function getRoleLabel(roleKey: string): string {
  return ROLE_LABELS[roleKey] || roleKey;
}

// ============================================================================
// Sub-components
// ============================================================================

interface AccordionSectionProps {
  title: string;
  subtitle?: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function AccordionSection({
  title,
  subtitle,
  expanded,
  onToggle,
  children,
}: AccordionSectionProps) {
  return (
    <View className="border-b border-gray-100 dark:border-gray-700">
      <Pressable
        onPress={onToggle}
        className="flex-row items-center justify-between px-4 py-4 active:bg-gray-50 dark:active:bg-gray-800"
      >
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900 dark:text-white">
            {title}
          </Text>
          {subtitle && (
            <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {subtitle}
            </Text>
          )}
        </View>
        {expanded ? (
          <ChevronUpIcon size={20} color="#6B7280" />
        ) : (
          <ChevronDownIcon size={20} color="#6B7280" />
        )}
      </Pressable>
      {expanded && (
        <View className="px-4 pb-4">
          {children}
        </View>
      )}
    </View>
  );
}

interface RoleSalaryItemProps {
  role: string;
  salaryInfo: SalaryInfo;
  onChange: (salaryInfo: SalaryInfo) => void;
  onApplyToAll: () => void;
  showApplyButton?: boolean;
}

function RoleSalaryItem({
  role,
  salaryInfo,
  onChange,
  onApplyToAll,
  showApplyButton = true,
}: RoleSalaryItemProps) {
  return (
    <View className="mb-4 pb-4 border-b border-gray-100 dark:border-gray-700 last:border-b-0 last:mb-0 last:pb-0">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-sm font-semibold text-gray-900 dark:text-white">
          {getRoleLabel(role)}
        </Text>
        {showApplyButton && (
          <Pressable
            onPress={onApplyToAll}
            className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-full active:opacity-70"
          >
            <Text className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
              모든 역할에 적용
            </Text>
          </Pressable>
        )}
      </View>
      <SalaryTypeSelector
        salaryInfo={salaryInfo}
        onChange={onChange}
        showLabel={false}
        showPreview={false}
      />
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SettlementSettingsModal({
  visible,
  onClose,
  roles: initialRoles,
  allowances: initialAllowances,
  taxSettings: initialTaxSettings,
  onSave,
}: SettlementSettingsModalProps) {
  // 로컬 상태 - roles[] 구조 사용
  const [roles, setRoles] = useState<RoleWithSalary[]>(initialRoles);
  const [allowances, setAllowances] = useState<Allowances>(initialAllowances);
  const [taxSettings, setTaxSettings] = useState<TaxSettings>(
    initialTaxSettings || DEFAULT_TAX_SETTINGS
  );
  const [isSaving, setIsSaving] = useState(false);

  // 아코디언 상태 (모두 접힌 상태가 기본)
  const [expandedSections, setExpandedSections] = useState({
    roles: false,
    allowances: false,
    tax: false,
  });

  // 초기값 동기화
  useEffect(() => {
    if (visible) {
      setRoles(initialRoles);
      setAllowances(initialAllowances);
      setTaxSettings(initialTaxSettings || DEFAULT_TAX_SETTINGS);
      // 모든 섹션을 접힌 상태로 초기화
      setExpandedSections({ roles: false, allowances: false, tax: false });
    }
  }, [visible, initialRoles, initialAllowances, initialTaxSettings]);

  // 표시할 역할 목록 (v2.0 - 급여 포함)
  const displayRoles = useMemo<RoleWithSalary[]>(() => {
    // roles가 비어있으면 기본 역할 표시
    if (!roles || roles.length === 0) {
      return [
        { role: 'dealer', salary: DEFAULT_SALARY_INFO },
        { role: 'floor', salary: DEFAULT_SALARY_INFO },
      ];
    }
    return roles;
  }, [roles]);

  // 핸들러
  const toggleSection = useCallback((section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  // 역할별 급여 변경 핸들러 (v2.0 - roles[] 구조)
  const handleRoleSalaryChange = useCallback((roleIndex: number, salaryInfo: SalaryInfo) => {
    setRoles(prev => {
      const updated = [...prev];
      updated[roleIndex] = { ...updated[roleIndex], salary: salaryInfo };
      return updated;
    });
  }, []);

  // 모든 역할에 급여 적용 (v2.0)
  const handleApplyToAllRoles = useCallback((sourceSalaryInfo: SalaryInfo) => {
    setRoles(prev => prev.map(role => ({
      ...role,
      salary: { ...sourceSalaryInfo },
    })));
  }, []);

  const handleSave = useCallback(async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      await onSave({
        roles,
        allowances,
        taxSettings,
      });
      onClose();
    } catch (error) {
      console.error('정산 설정 저장 실패:', error);
    } finally {
      setIsSaving(false);
    }
  }, [roles, allowances, taxSettings, isSaving, onSave, onClose]);

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
            정산 설정
          </Text>
          <Pressable onPress={onClose} hitSlop={8} disabled={isSaving}>
            <XMarkIcon size={24} color="#6B7280" />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 역할별 급여 설정 섹션 */}
          <AccordionSection
            title="역할별 급여 설정"
            subtitle="역할에 따른 급여 유형과 금액을 설정합니다"
            expanded={expandedSections.roles}
            onToggle={() => toggleSection('roles')}
          >
            {displayRoles.map((roleData, index) => {
              const roleKey = getRoleKey(roleData);
              return (
                <RoleSalaryItem
                  key={`${roleKey}-${index}`}
                  role={roleKey}
                  salaryInfo={roleData.salary || DEFAULT_SALARY_INFO}
                  onChange={(info) => handleRoleSalaryChange(index, info)}
                  onApplyToAll={() => handleApplyToAllRoles(roleData.salary || DEFAULT_SALARY_INFO)}
                  showApplyButton={index === 0 && displayRoles.length > 1}
                />
              );
            })}
          </AccordionSection>

          {/* 수당 설정 섹션 */}
          <AccordionSection
            title="수당 설정"
            subtitle="모든 스태프에게 적용되는 수당을 설정합니다"
            expanded={expandedSections.allowances}
            onToggle={() => toggleSection('allowances')}
          >
            <AllowanceEditor
              allowances={allowances}
              onChange={setAllowances}
              showLabel={false}
            />
          </AccordionSection>

          {/* 세금 설정 섹션 */}
          <AccordionSection
            title="세금 설정"
            subtitle="정산 시 공제할 세금을 설정합니다"
            expanded={expandedSections.tax}
            onToggle={() => toggleSection('tax')}
          >
            <TaxSettingsEditor
              taxSettings={taxSettings}
              onChange={setTaxSettings}
              showLabel={false}
              showPreview={false}
            />
          </AccordionSection>

          <View className="h-4" />
        </ScrollView>

        {/* 하단 버튼 */}
        <View className="flex-row gap-4 px-5 py-5 border-t border-gray-200 dark:border-gray-700">
          <Pressable
            onPress={onClose}
            disabled={isSaving}
            className={`flex-1 py-4 rounded-xl bg-gray-100 dark:bg-gray-700 ${
              isSaving ? 'opacity-50' : 'active:opacity-70'
            }`}
          >
            <Text className="text-lg font-medium text-gray-700 dark:text-gray-300 text-center">
              취소
            </Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            className={`flex-1 py-4 rounded-xl bg-primary-500 ${
              isSaving ? 'opacity-50' : 'active:opacity-70'
            }`}
          >
            <Text className="text-lg font-semibold text-white text-center">
              {isSaving ? '저장 중...' : '저장'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export default SettlementSettingsModal;
