/**
 * UNIQN Mobile - 날짜별 요구사항 섹션 (간소화)
 *
 * @description regular/urgent/tournament 타입의 날짜별 요구사항 관리
 * @version 2.0.0
 *
 * 주요 기능:
 * - regular/urgent: 단일 날짜 (1개)
 * - tournament: 복수 날짜 (최대 30개)
 * - 시작시간만 입력 (종료시간 제거)
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { PlusIcon } from '@/components/icons';
import { DATE_CONSTRAINTS } from '@/constants';
import { DatePickerModal } from '../modals';
import { DateRequirementCard } from '../cards';
import { migrateFormDataForRead } from '@/services/jobPostingMigration';
import type { JobPostingFormData } from '@/types';
import type { DateSpecificRequirement } from '@/types/jobPosting/dateRequirement';

// ============================================================================
// Types
// ============================================================================

interface DateRequirementsSectionProps {
  data: JobPostingFormData;
  onUpdate: (data: Partial<JobPostingFormData>) => void;
  errors?: Record<string, string>;
}

// ============================================================================
// Component
// ============================================================================

export function DateRequirementsSection({
  data,
  onUpdate,
  errors,
}: DateRequirementsSectionProps) {
  const { postingType } = data;

  // 모달 상태
  const [showDatePicker, setShowDatePicker] = useState(false);

  // 타입별 제약사항
  const constraints = useMemo(() => {
    if (!postingType) return { maxDates: 1, label: '단일 날짜' };
    return DATE_CONSTRAINTS[postingType];
  }, [postingType]);

  // 마이그레이션: tournamentDates → dateSpecificRequirements 자동 변환
  useEffect(() => {
    const result = migrateFormDataForRead(data);
    if (result.migrated && result.data.dateSpecificRequirements) {
      onUpdate({
        dateSpecificRequirements: result.data.dateSpecificRequirements as DateSpecificRequirement[],
      });
    }
  }, [data.tournamentDates, data.dateSpecificRequirements, onUpdate]);

  // 현재 날짜 목록
  const dateRequirements = useMemo(() => {
    return (data.dateSpecificRequirements ?? []) as DateSpecificRequirement[];
  }, [data.dateSpecificRequirements]);

  // 이미 선택된 날짜 목록
  const existingDates = useMemo(() => {
    return dateRequirements.map(req => {
      const dateValue = req.date;
      if (typeof dateValue === 'string') return dateValue;
      if ('toDate' in dateValue && typeof dateValue.toDate === 'function') {
        return dateValue.toDate().toISOString().split('T')[0] ?? '';
      }
      if ('seconds' in dateValue) {
        return new Date(dateValue.seconds * 1000).toISOString().split('T')[0] ?? '';
      }
      return '';
    }).filter(Boolean);
  }, [dateRequirements]);

  // 날짜 추가 가능 여부
  const canAddDate = useMemo(() => {
    return dateRequirements.length < constraints.maxDates;
  }, [dateRequirements.length, constraints.maxDates]);

  // 날짜 선택 처리 (다중 날짜 지원)
  const handleSelectDates = useCallback((dates: string[]) => {
    // 여러 날짜에 대해 기본 날짜 요구사항 생성
    const newRequirements: DateSpecificRequirement[] = dates.map(date => ({
      date,
      timeSlots: [
        {
          id: `${Date.now()}-${Math.random()}`,
          startTime: '09:00',
          isTimeToBeAnnounced: false,
          roles: [
            {
              id: `${Date.now()}-${Math.random()}`,
              role: 'dealer',
              headcount: 1,
            },
          ],
        },
      ],
    }));

    const updated = [...dateRequirements, ...newRequirements];
    onUpdate({ dateSpecificRequirements: updated });
  }, [dateRequirements, onUpdate]);

  // 날짜 삭제
  const handleRemoveDate = useCallback(
    (index: number) => {
      if (dateRequirements.length <= 1) {
        // TODO: Toast 알림 - 최소 1개 필요
        return;
      }

      const updated = dateRequirements.filter((_, i) => i !== index);
      onUpdate({ dateSpecificRequirements: updated });
    },
    [dateRequirements, onUpdate]
  );

  // 날짜 업데이트
  const handleUpdateDate = useCallback(
    (index: number, requirement: Partial<DateSpecificRequirement>) => {
      const updated = [...dateRequirements];
      updated[index] = { ...updated[index]!, ...requirement };
      onUpdate({ dateSpecificRequirements: updated });
    },
    [dateRequirements, onUpdate]
  );

  return (
    <View>
      {/* 헤더 */}
      <View className="mb-4">
        <Text className="text-sm text-gray-600 dark:text-gray-400">
          최대 {constraints.maxDates}개 날짜 추가 가능
        </Text>
      </View>

      {/* 날짜 목록 */}
      {dateRequirements.length === 0 ? (
        <View className="p-8 items-center">
          <Text className="text-gray-500 dark:text-gray-400">
            날짜를 추가해주세요
          </Text>
        </View>
      ) : (
        <View className="mb-4">
          {dateRequirements.map((req, index) => (
            <DateRequirementCard
              key={index}
              requirement={req}
              index={index}
              canRemove={dateRequirements.length > 1}
              onUpdate={handleUpdateDate}
              onRemove={handleRemoveDate}
            />
          ))}
        </View>
      )}

      {/* 날짜 추가 버튼 */}
      <Pressable
        onPress={() => setShowDatePicker(true)}
        disabled={!canAddDate}
        className={`flex-row items-center justify-center p-4 rounded-lg border-2 border-dashed ${
          canAddDate
            ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 opacity-50'
        }`}
        accessibilityLabel="날짜 추가"
        accessibilityRole="button"
        accessibilityHint={
          canAddDate ? '새 날짜를 추가합니다' : '더 이상 추가할 수 없습니다'
        }
      >
        <View className="mr-2">
          <PlusIcon size={20} color={canAddDate ? '#3B82F6' : '#9CA3AF'} />
        </View>
        <Text
          className={`font-medium ${
            canAddDate
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-400 dark:text-gray-600'
          }`}
        >
          날짜 추가 {canAddDate && `(${dateRequirements.length}/${constraints.maxDates})`}
        </Text>
      </Pressable>

      {/* 에러 메시지 */}
      {errors?.dateSpecificRequirements && (
        <Text className="mt-2 text-sm text-red-600 dark:text-red-400">
          {errors.dateSpecificRequirements}
        </Text>
      )}

      {/* 날짜 선택 모달 */}
      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelectDates={handleSelectDates}
        postingType={postingType ?? 'regular'}
        existingDates={existingDates}
      />
    </View>
  );
}
