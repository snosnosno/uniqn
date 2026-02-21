/**
 * UNIQN Mobile - 신고 모달
 *
 * @description 양방향 신고 지원 모달
 *   - mode='employer': 구인자 → 스태프 신고
 *   - mode='employee': 구직자 → 구인자 신고
 * @version 1.1.0
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { AlertTriangleIcon, CheckIcon, AlertCircleIcon, UserIcon, BriefcaseIcon } from '../icons';
import {
  EMPLOYEE_REPORT_TYPES,
  EMPLOYER_REPORT_TYPES,
  REPORT_SEVERITY_COLORS,
  getReportSeverity,
  type ReportType,
  type ReporterType,
  type ReportTypeInfo,
  type CreateReportInput,
} from '@/types/report';
import { getRoleDisplayName } from '@/types/unified';
import type { ConfirmedStaff } from '@/types';

// ============================================================================
// Types
// ============================================================================

/**
 * 신고 대상 정보 (구직자→구인자 신고용)
 */
export interface ReportTarget {
  id: string;
  name: string;
}

export interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  /** 신고 모드: 'employer'=구인자가 신고, 'employee'=구직자가 신고 */
  mode?: ReporterType;
  /** 스태프 정보 (mode='employer'일 때 사용) */
  staff?: ConfirmedStaff | null;
  /** 신고 대상 정보 (mode='employee'일 때 사용) */
  target?: ReportTarget | null;
  jobPostingId: string;
  jobPostingTitle?: string;
  onSubmit: (input: CreateReportInput) => void;
  isLoading?: boolean;
}

// ============================================================================
// Sub-components
// ============================================================================

interface ReportTypeOptionProps {
  typeInfo: ReportTypeInfo;
  isSelected: boolean;
  onSelect: () => void;
}

function ReportTypeOption({ typeInfo, isSelected, onSelect }: ReportTypeOptionProps) {
  const severityColors = REPORT_SEVERITY_COLORS[typeInfo.severity];
  const severityLabel =
    typeInfo.severity === 'critical'
      ? '심각'
      : typeInfo.severity === 'high'
        ? '높음'
        : typeInfo.severity === 'medium'
          ? '보통'
          : '낮음';

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${typeInfo.label} - ${typeInfo.description}`}
      accessibilityHint={`심각도: ${severityLabel}`}
      className={`
        p-4 rounded-xl mb-2
        ${
          isSelected
            ? 'border-2 border-red-500 bg-red-50 dark:bg-red-900/20'
            : 'border border-gray-200 dark:border-surface-overlay bg-white dark:bg-surface'
        }
      `}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text
              className={`
                text-base font-semibold
                ${isSelected ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}
              `}
            >
              {typeInfo.label}
            </Text>
            <View className={`ml-2 px-2 py-0.5 rounded ${severityColors.bg}`}>
              <Text className={`text-xs ${severityColors.text}`}>
                {typeInfo.severity === 'critical'
                  ? '심각'
                  : typeInfo.severity === 'high'
                    ? '높음'
                    : typeInfo.severity === 'medium'
                      ? '보통'
                      : '낮음'}
              </Text>
            </View>
          </View>
          <Text className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {typeInfo.description}
          </Text>
        </View>

        {isSelected && (
          <View className="h-6 w-6 rounded-full bg-red-500 items-center justify-center">
            <CheckIcon size={14} color="#FFFFFF" />
          </View>
        )}
      </View>
    </Pressable>
  );
}

interface SeverityIndicatorProps {
  type: ReportType | null;
  reporterType?: ReporterType;
}

function SeverityIndicator({ type, reporterType }: SeverityIndicatorProps) {
  if (!type) return null;

  const severity = getReportSeverity(type, reporterType);
  const severityColors = REPORT_SEVERITY_COLORS[severity];

  const severityLabels = {
    critical: '심각한 문제로 분류됩니다',
    high: '높은 심각도로 분류됩니다',
    medium: '중간 심각도로 분류됩니다',
    low: '경미한 문제로 분류됩니다',
  };

  const severityIcons = {
    critical: '#DC2626',
    high: '#EF4444',
    medium: '#F59E0B',
    low: '#EAB308',
  };

  return (
    <View className={`flex-row items-center p-3 rounded-lg ${severityColors.bg}`}>
      <AlertTriangleIcon size={16} color={severityIcons[severity]} />
      <Text className={`ml-2 text-sm ${severityColors.text}`}>{severityLabels[severity]}</Text>
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ReportModal({
  visible,
  onClose,
  mode = 'employer',
  staff,
  target,
  jobPostingId,
  jobPostingTitle,
  onSubmit,
  isLoading = false,
}: ReportModalProps) {
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [description, setDescription] = useState('');

  // 모드에 따른 신고 유형 목록 (메모이제이션)
  const reportTypes = useMemo(() => {
    return mode === 'employee' ? EMPLOYER_REPORT_TYPES : EMPLOYEE_REPORT_TYPES;
  }, [mode]);

  // 모드에 따른 타이틀
  const modalTitle = mode === 'employee' ? '구인자 신고' : '스태프 신고';

  // 신고 대상 정보 통합
  const reportTarget = useMemo(() => {
    if (mode === 'employee' && target) {
      return { id: target.id, name: target.name };
    }
    if (mode === 'employer' && staff) {
      return { id: staff.staffId, name: staff.staffName };
    }
    return null;
  }, [mode, staff, target]);

  // staff 또는 target 변경 시 초기화
  useEffect(() => {
    if (staff || target) {
      setSelectedType(null);
      setDescription('');
    }
  }, [staff, target]);

  // 유효성 검사
  const isValid = useMemo(() => {
    return selectedType !== null && description.trim().length >= 10;
  }, [selectedType, description]);

  // 유형 선택
  const handleSelectType = useCallback((type: ReportType) => {
    setSelectedType(type);
  }, []);

  // 제출
  const handleSubmit = useCallback(() => {
    if (!isValid || !reportTarget || !selectedType) return;

    const input: CreateReportInput = {
      type: selectedType,
      reporterType: mode,
      targetId: reportTarget.id,
      targetName: reportTarget.name,
      jobPostingId,
      jobPostingTitle,
      // 구인자→스태프 신고만 workLog 정보 포함
      ...(mode === 'employer' &&
        staff && {
          workLogId: staff.id,
          workDate: staff.date,
        }),
      description: description.trim(),
    };

    onSubmit(input);
  }, [
    isValid,
    reportTarget,
    selectedType,
    mode,
    staff,
    jobPostingId,
    jobPostingTitle,
    description,
    onSubmit,
  ]);

  // 닫기
  const handleClose = useCallback(() => {
    setSelectedType(null);
    setDescription('');
    onClose();
  }, [onClose]);

  // 신고 대상이 없으면 렌더링하지 않음
  if (!reportTarget) return null;

  return (
    <Modal visible={visible} onClose={handleClose} title={modalTitle} position="bottom">
      <View>
        {/* 신고 대상 정보 */}
        <Card variant="filled" padding="sm" className="mb-3 bg-red-50 dark:bg-red-900/20">
          <View className="flex-row items-center">
            <View className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 items-center justify-center">
              {mode === 'employee' ? (
                <BriefcaseIcon size={24} color="#EF4444" />
              ) : (
                <UserIcon size={24} color="#EF4444" />
              )}
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-base font-semibold text-gray-900 dark:text-white">
                {reportTarget.name}
              </Text>
              {mode === 'employer' && staff ? (
                <View className="flex-row items-center mt-1">
                  <Badge variant="default" size="sm">
                    {getRoleDisplayName(staff.role, staff.customRole)}
                  </Badge>
                  <Text className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                    {staff.date}
                  </Text>
                </View>
              ) : (
                <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {jobPostingTitle || '구인자'}
                </Text>
              )}
            </View>
          </View>
        </Card>

        {/* 신고 유형 선택 */}
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          신고 유형 선택 <Text className="text-red-500">*</Text>
        </Text>

        <ScrollView
          className="max-h-52 mb-3"
          showsVerticalScrollIndicator={true}
          accessibilityRole="radiogroup"
          accessibilityLabel="신고 유형 선택"
        >
          {reportTypes.map((typeInfo) => (
            <ReportTypeOption
              key={typeInfo.key}
              typeInfo={typeInfo}
              isSelected={selectedType === typeInfo.key}
              onSelect={() => handleSelectType(typeInfo.key)}
            />
          ))}
        </ScrollView>

        {/* 심각도 표시 */}
        {selectedType && (
          <View className="mb-3">
            <SeverityIndicator type={selectedType} reporterType={mode} />
          </View>
        )}

        {/* 상세 설명 */}
        <View className="mb-3">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            상세 설명 <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="구체적인 상황을 설명해주세요 (최소 10자)"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            accessibilityLabel="신고 상세 설명"
            accessibilityHint="구체적인 상황을 최소 10자 이상 입력해주세요"
            className="p-2.5 border border-gray-200 dark:border-surface-overlay rounded-lg bg-white dark:bg-surface text-gray-900 dark:text-white min-h-[80px]"
          />
          <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {description.length}/500자 (최소 10자)
          </Text>
        </View>

        {/* 안내 메시지 */}
        <View className="flex-row items-start p-2.5 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg mb-3">
          <AlertCircleIcon size={14} color="#D97706" />
          <View className="ml-2 flex-1">
            <Text className="text-xs font-medium text-yellow-700 dark:text-yellow-300 mb-0.5">
              신고 시 유의사항
            </Text>
            <Text className="text-xs text-yellow-600 dark:text-yellow-400 leading-4">
              • 허위 신고는 제재의 대상이 될 수 있습니다{'\n'}• 신고 내용은 관리자가 검토 후
              처리됩니다
            </Text>
          </View>
        </View>

        {/* 버튼 */}
        <View className="flex-row gap-3">
          <Button
            variant="secondary"
            onPress={handleClose}
            disabled={isLoading}
            style={{ flex: 1 }}
            accessibilityLabel="신고 취소"
            accessibilityHint="신고를 취소하고 모달을 닫습니다"
          >
            취소
          </Button>
          <Button
            variant="danger"
            onPress={handleSubmit}
            loading={isLoading}
            disabled={!isValid}
            style={{ flex: 1 }}
            icon={<AlertTriangleIcon size={18} color="#FFFFFF" />}
            accessibilityLabel="신고 제출"
            accessibilityHint={
              isValid ? '선택한 유형으로 신고를 제출합니다' : '신고 유형과 설명을 모두 입력해주세요'
            }
          >
            신고하기
          </Button>
        </View>
      </View>
    </Modal>
  );
}

export default ReportModal;
