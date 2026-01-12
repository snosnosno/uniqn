/**
 * UNIQN Mobile - 스태프 신고 모달
 *
 * @description 구인자가 확정 스태프를 신고하는 모달
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import {
  AlertTriangleIcon,
  CheckIcon,
  AlertCircleIcon,
  UserIcon,
} from '../icons';
import {
  EMPLOYEE_REPORT_TYPES,
  REPORT_SEVERITY_COLORS,
  getReportSeverity,
  type EmployeeReportType,
  type ReportTypeInfo,
  type CreateReportInput,
} from '@/types/report';
import { getRoleDisplayName } from '@/types/unified';
import type { ConfirmedStaff } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  staff: ConfirmedStaff | null;
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

function ReportTypeOption({
  typeInfo,
  isSelected,
  onSelect,
}: ReportTypeOptionProps) {
  const severityColors = REPORT_SEVERITY_COLORS[typeInfo.severity];

  return (
    <Pressable
      onPress={onSelect}
      className={`
        p-4 rounded-xl mb-2
        ${isSelected
          ? 'border-2 border-red-500 bg-red-50 dark:bg-red-900/20'
          : 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
        }
      `}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text
              className={`
                text-base font-semibold
                ${isSelected
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-900 dark:text-white'
                }
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
  type: EmployeeReportType | null;
}

function SeverityIndicator({ type }: SeverityIndicatorProps) {
  if (!type) return null;

  const severity = getReportSeverity(type);
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
      <Text className={`ml-2 text-sm ${severityColors.text}`}>
        {severityLabels[severity]}
      </Text>
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ReportModal({
  visible,
  onClose,
  staff,
  jobPostingId,
  jobPostingTitle,
  onSubmit,
  isLoading = false,
}: ReportModalProps) {
  const [selectedType, setSelectedType] = useState<EmployeeReportType | null>(null);
  const [description, setDescription] = useState('');

  // staff 변경 시 초기화
  useEffect(() => {
    if (staff) {
      setSelectedType(null);
      setDescription('');
    }
  }, [staff]);

  // 유효성 검사
  const isValid = useMemo(() => {
    return selectedType !== null && description.trim().length >= 10;
  }, [selectedType, description]);

  // 유형 선택
  const handleSelectType = useCallback((type: EmployeeReportType) => {
    setSelectedType(type);
  }, []);

  // 제출
  const handleSubmit = useCallback(() => {
    if (!isValid || !staff || !selectedType) return;

    const input: CreateReportInput = {
      type: selectedType,
      targetId: staff.staffId,
      targetName: staff.staffName,
      jobPostingId,
      jobPostingTitle,
      workLogId: staff.id,
      workDate: staff.date,
      description: description.trim(),
    };

    onSubmit(input);
  }, [isValid, staff, selectedType, jobPostingId, jobPostingTitle, description, onSubmit]);

  // 닫기
  const handleClose = useCallback(() => {
    setSelectedType(null);
    setDescription('');
    onClose();
  }, [onClose]);

  if (!staff) return null;

  return (
    <Modal
      visible={visible}
      onClose={handleClose}
      title="스태프 신고"
      position="bottom"
    >
      <View className="p-4">
        {/* 스태프 정보 */}
        <Card
          variant="filled"
          padding="md"
          className="mb-4 bg-red-50 dark:bg-red-900/20"
        >
          <View className="flex-row items-center">
            <View className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 items-center justify-center">
              <UserIcon size={24} color="#EF4444" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-base font-semibold text-gray-900 dark:text-white">
                {staff.staffName}
              </Text>
              <View className="flex-row items-center mt-1">
                <Badge variant="default" size="sm">
                  {getRoleDisplayName(staff.role, staff.customRole)}
                </Badge>
                <Text className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  {staff.date}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* 신고 유형 선택 */}
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          신고 유형 선택 <Text className="text-red-500">*</Text>
        </Text>

        <ScrollView
          className="max-h-56 mb-4"
          showsVerticalScrollIndicator={false}
        >
          {EMPLOYEE_REPORT_TYPES.map((typeInfo) => (
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
          <View className="mb-4">
            <SeverityIndicator type={selectedType} />
          </View>
        )}

        {/* 상세 설명 */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            상세 설명 <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="구체적인 상황을 설명해주세요 (최소 10자)"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white min-h-[100px]"
          />
          <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {description.length}/500자 (최소 10자)
          </Text>
        </View>

        {/* 안내 메시지 */}
        <View className="flex-row items-start p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg mb-4">
          <AlertCircleIcon size={16} color="#D97706" />
          <View className="ml-2 flex-1">
            <Text className="text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">
              신고 시 유의사항
            </Text>
            <Text className="text-xs text-yellow-600 dark:text-yellow-400">
              • 허위 신고는 제재의 대상이 될 수 있습니다{'\n'}
              • 신고 내용은 관리자가 검토 후 처리됩니다{'\n'}
              • 심각한 사안은 즉시 조치될 수 있습니다
            </Text>
          </View>
        </View>

        {/* 버튼 */}
        <View className="flex-row gap-3">
          <Button
            variant="secondary"
            onPress={handleClose}
            disabled={isLoading}
            className="flex-1"
          >
            취소
          </Button>
          <Button
            variant="danger"
            onPress={handleSubmit}
            loading={isLoading}
            disabled={!isValid}
            className="flex-1"
            icon={<AlertTriangleIcon size={18} color="#FFFFFF" />}
          >
            신고하기
          </Button>
        </View>
      </View>
    </Modal>
  );
}

export default ReportModal;
