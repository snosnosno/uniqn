/**
 * UNIQN Mobile - 날짜별 요구사항 섹션 (연속 날짜 그룹화)
 *
 * @description regular/urgent/tournament 타입의 날짜별 요구사항 관리
 * @version 3.0.0
 *
 * 주요 기능:
 * - regular/urgent: 단일 날짜 (1개)
 * - tournament: 복수 날짜 (최대 30개) + 연속 날짜 자동 그룹화
 * - 시작시간만 입력 (종료시간 제거)
 *
 * 연속 날짜 그룹화:
 * - 연속 날짜 + 동일 timeSlots → 하나의 DateRangeCard로 표시
 * - Firebase 저장 시 개별 DateSpecificRequirement로 확장 (호환성 유지)
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { PlusIcon } from '@/components/icons';
import { DATE_CONSTRAINTS } from '@/constants';
import { DatePickerModal, GroupingConfirmModal } from '../modals';
import { DateRequirementCard, DateRangeCard } from '../cards';
import { migrateFormDataForRead } from '@/services/jobPostingMigration';
import {
  groupRequirementsToDateRanges,
  groupConsecutiveDates,
  toDateString,
  type DateRangeGroup,
} from '@/utils/date';
import { generateId } from '@/utils/generateId';
import type { JobPostingFormData } from '@/types';
import type {
  DateSpecificRequirement,
  TimeSlot,
  RoleRequirement,
} from '@/types/jobPosting/dateRequirement';

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

export function DateRequirementsSection({ data, onUpdate, errors }: DateRequirementsSectionProps) {
  const { postingType } = data;

  // 모달 상태
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showGroupingModal, setShowGroupingModal] = useState(false);
  const [pendingDates, setPendingDates] = useState<string[]>([]);

  // 대회 공고 여부 (그룹화 활성화)
  const isTournament = postingType === 'tournament';

  // 타입별 제약사항
  const constraints = useMemo(() => {
    if (!postingType) return { maxDates: 1, label: '단일 날짜' };
    return DATE_CONSTRAINTS[postingType];
  }, [postingType]);

  // 마이그레이션: tournamentDates → dateSpecificRequirements 자동 변환
  const { tournamentDates, dateSpecificRequirements } = data;
  useEffect(() => {
    const result = migrateFormDataForRead(data);
    if (result.migrated && result.data.dateSpecificRequirements) {
      onUpdate({
        dateSpecificRequirements: result.data.dateSpecificRequirements as DateSpecificRequirement[],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- data 전체가 아닌 특정 필드만 의존
  }, [tournamentDates, dateSpecificRequirements, onUpdate]);

  // 현재 날짜 목록
  const dateRequirements = useMemo(() => {
    return (data.dateSpecificRequirements ?? []) as DateSpecificRequirement[];
  }, [data.dateSpecificRequirements]);

  // 대회 공고: 연속 날짜 그룹화 (UI 표시용)
  const dateRangeGroups = useMemo(() => {
    if (!isTournament) return [];
    return groupRequirementsToDateRanges(dateRequirements);
  }, [isTournament, dateRequirements]);

  // 이미 선택된 날짜 목록
  const existingDates = useMemo(() => {
    return dateRequirements.map((req) => toDateString(req.date)).filter(Boolean);
  }, [dateRequirements]);

  // 날짜 추가 가능 여부
  const canAddDate = useMemo(() => {
    return dateRequirements.length < constraints.maxDates;
  }, [dateRequirements.length, constraints.maxDates]);

  // 그룹으로 날짜 추가 (연속 날짜만 그룹화, 비연속은 개별)
  const handleAddDatesAsGroup = useCallback(
    (dates: string[]) => {
      // 연속 날짜끼리만 그룹화 (예: [1/19, 1/20, 1/21], [1/23])
      const consecutiveGroups = groupConsecutiveDates(dates);

      const newRequirements: DateSpecificRequirement[] = [];

      // 각 연속 그룹마다 별도의 공유 timeSlots 생성
      for (const group of consecutiveGroups) {
        const sharedTimeSlots: TimeSlot[] = [
          {
            id: generateId(),
            startTime: '09:00',
            isTimeToBeAnnounced: false,
            roles: [
              {
                id: generateId(),
                role: 'dealer',
                headcount: 1,
              } as RoleRequirement,
            ],
          },
        ];

        // 해당 그룹의 모든 날짜에 동일한 timeSlots 복제 적용
        for (const date of group) {
          newRequirements.push({
            date,
            timeSlots: deepCloneTimeSlots(sharedTimeSlots),
            isGrouped: true, // 그룹으로 표시
          });
        }
      }

      const updated = [...dateRequirements, ...newRequirements];
      onUpdate({ dateSpecificRequirements: updated });
    },
    [dateRequirements, onUpdate]
  );

  // 개별로 날짜 추가 (독립 timeSlots)
  const handleAddDatesIndividually = useCallback(
    (dates: string[]) => {
      const newRequirements: DateSpecificRequirement[] = dates.map((date) => ({
        date,
        timeSlots: [
          {
            id: generateId(),
            startTime: '09:00',
            isTimeToBeAnnounced: false,
            roles: [
              {
                id: generateId(),
                role: 'dealer',
                headcount: 1,
              } as RoleRequirement,
            ],
          },
        ],
        isGrouped: false, // 개별로 표시
      }));

      const updated = [...dateRequirements, ...newRequirements];
      onUpdate({ dateSpecificRequirements: updated });
    },
    [dateRequirements, onUpdate]
  );

  // 날짜 선택 처리 (다중 날짜 지원 + 그룹화 선택)
  const handleSelectDates = useCallback(
    (dates: string[]) => {
      // 정렬된 날짜
      const sortedDates = [...dates].sort();

      // 대회 공고이고 2개 이상인 경우, 그룹화 선택 모달 표시 (연속/비연속 모두)
      if (isTournament && sortedDates.length > 1) {
        setPendingDates(sortedDates);
        setShowGroupingModal(true);
      } else {
        // 단일 날짜 또는 비대회 공고: 개별로 추가
        handleAddDatesIndividually(sortedDates);
      }
    },
    [isTournament, handleAddDatesIndividually]
  );

  // 그룹화 확인 핸들러
  const handleGroupingConfirm = useCallback(
    (shouldGroup: boolean) => {
      if (shouldGroup) {
        // 그룹으로 추가 (공유 timeSlots)
        handleAddDatesAsGroup(pendingDates);
      } else {
        // 개별로 추가 (독립 timeSlots)
        handleAddDatesIndividually(pendingDates);
      }
      setPendingDates([]);
      setShowGroupingModal(false);
    },
    [pendingDates, handleAddDatesAsGroup, handleAddDatesIndividually]
  );

  // 그룹화 모달 닫기 핸들러
  const handleGroupingClose = useCallback(() => {
    setPendingDates([]);
    setShowGroupingModal(false);
  }, []);

  // ============================================================================
  // 개별 날짜 핸들러 (regular/urgent용)
  // ============================================================================

  // 날짜 삭제 (개별) - 마지막 날짜도 삭제 가능
  const handleRemoveDate = useCallback(
    (index: number) => {
      const updated = dateRequirements.filter((_, i) => i !== index);
      onUpdate({ dateSpecificRequirements: updated });
    },
    [dateRequirements, onUpdate]
  );

  // 날짜 업데이트 (개별)
  const handleUpdateDate = useCallback(
    (index: number, requirement: Partial<DateSpecificRequirement>) => {
      const updated = [...dateRequirements];
      updated[index] = { ...updated[index]!, ...requirement };
      onUpdate({ dateSpecificRequirements: updated });
    },
    [dateRequirements, onUpdate]
  );

  // ============================================================================
  // 그룹 핸들러 (tournament용)
  // ============================================================================

  // 그룹 업데이트 (timeSlots 변경 시 해당 그룹의 모든 날짜에 반영)
  const handleUpdateGroup = useCallback(
    (groupIndex: number, groupUpdate: Partial<DateRangeGroup>) => {
      if (!groupUpdate.timeSlots) return;

      // 현재 그룹 정보
      const group = dateRangeGroups[groupIndex];
      if (!group) return;

      // 그룹에 속한 날짜들 찾기
      const groupStartDate = group.startDate;
      const groupEndDate = group.endDate;

      // 해당 그룹의 모든 날짜에 새 timeSlots 적용
      const updated = dateRequirements.map((req) => {
        const reqDate = toDateString(req.date);
        if (reqDate >= groupStartDate && reqDate <= groupEndDate) {
          return {
            ...req,
            timeSlots: deepCloneTimeSlots(groupUpdate.timeSlots!),
          };
        }
        return req;
      });

      onUpdate({ dateSpecificRequirements: updated });
    },
    [dateRangeGroups, dateRequirements, onUpdate]
  );

  // 그룹 삭제 (그룹에 속한 모든 날짜 삭제) - 마지막 그룹도 삭제 가능
  const handleRemoveGroup = useCallback(
    (groupIndex: number) => {
      const group = dateRangeGroups[groupIndex];
      if (!group) return;

      const groupStartDate = group.startDate;
      const groupEndDate = group.endDate;

      // 그룹에 속하지 않은 날짜들만 유지
      const updated = dateRequirements.filter((req) => {
        const reqDate = toDateString(req.date);
        return reqDate < groupStartDate || reqDate > groupEndDate;
      });

      onUpdate({ dateSpecificRequirements: updated });
    },
    [dateRangeGroups, dateRequirements, onUpdate]
  );

  // 총 날짜 수 (그룹 기반)
  const totalDateCount = dateRequirements.length;
  const totalGroupCount = dateRangeGroups.length;

  return (
    <View>
      {/* 헤더 */}
      <View className="mb-4">
        <Text className="text-sm text-gray-600 dark:text-gray-400">
          최대 {constraints.maxDates}개 날짜 추가 가능
          {isTournament && totalGroupCount > 0 && (
            <Text className="text-gray-500 dark:text-gray-500">
              {' '}
              (현재 {totalGroupCount}개 일정, {totalDateCount}일)
            </Text>
          )}
        </Text>
        {isTournament && (
          <Text className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            연속 날짜 선택 시 그룹화 여부를 선택할 수 있습니다
          </Text>
        )}
      </View>

      {/* 날짜 목록 */}
      {dateRequirements.length === 0 ? (
        <View className="p-8 items-center">
          <Text className="text-gray-500 dark:text-gray-400">날짜를 추가해주세요</Text>
        </View>
      ) : isTournament ? (
        // 대회 공고: 그룹 기반 렌더링
        <View className="mb-4">
          {dateRangeGroups.map((group, groupIndex) => (
            <DateRangeCard
              key={group.id}
              group={group}
              index={groupIndex}
              canRemove={true}
              onUpdate={handleUpdateGroup}
              onRemove={handleRemoveGroup}
            />
          ))}
        </View>
      ) : (
        // 일반/긴급 공고: 개별 날짜 렌더링
        <View className="mb-4">
          {dateRequirements.map((req, index) => (
            <DateRequirementCard
              key={index}
              requirement={req}
              index={index}
              canRemove={true}
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
            ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20'
            : 'border-gray-300 dark:border-surface-overlay bg-gray-50 dark:bg-surface opacity-50'
        }`}
        accessibilityLabel="날짜 추가"
        accessibilityRole="button"
        accessibilityHint={canAddDate ? '새 날짜를 추가합니다' : '더 이상 추가할 수 없습니다'}
      >
        <View className="mr-2">
          <PlusIcon size={20} color={canAddDate ? '#A855F7' : '#9CA3AF'} />
        </View>
        <Text
          className={`font-medium ${
            canAddDate
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-gray-400 dark:text-gray-600'
          }`}
        >
          날짜 추가 {canAddDate && `(${totalDateCount}/${constraints.maxDates})`}
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

      {/* 연속 날짜 그룹화 선택 모달 */}
      <GroupingConfirmModal
        visible={showGroupingModal}
        dates={pendingDates}
        onConfirm={handleGroupingConfirm}
        onClose={handleGroupingClose}
      />
    </View>
  );
}

// ============================================================================
// 헬퍼 함수
// ============================================================================

/**
 * TimeSlots 깊은 복사
 */
function deepCloneTimeSlots(timeSlots: TimeSlot[]): TimeSlot[] {
  return timeSlots.map((slot) => ({
    ...slot,
    id: generateId(),
    roles: slot.roles.map((role) => ({
      ...role,
      id: generateId(),
    })),
  }));
}
