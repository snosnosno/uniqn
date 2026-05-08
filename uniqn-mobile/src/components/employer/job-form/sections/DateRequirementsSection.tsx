import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { PlusIcon } from '@/components/icons';
import { DATE_CONSTRAINTS } from '@/constants';
import type { JobPostingFormData } from '@/types';
import { type DateSpecificRequirement, type TimeSlot } from '@/types/jobPosting/dateRequirement';
import { buildSeedTimeSlots } from '@/utils/job-posting/draftRoles';
import { generateId } from '@/utils/generateId';
import { DatePickerModal, GroupingConfirmModal } from '../modals';
import { DateRequirementCard, DateRangeCard } from '../cards';
import {
  groupRequirementsToDateRanges,
  groupConsecutiveDates,
  toDateString,
  type DateRangeGroup,
} from '@/utils/date';

interface DateRequirementsSectionProps {
  data: JobPostingFormData;
  onUpdate: (data: Partial<JobPostingFormData>) => void;
  errors?: Record<string, string>;
}

export function DateRequirementsSection({ data, onUpdate, errors }: DateRequirementsSectionProps) {
  const { postingType } = data;
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showGroupingModal, setShowGroupingModal] = useState(false);
  const [pendingDates, setPendingDates] = useState<string[]>([]);

  const supportsGroupedDates =
    postingType === 'regular' || postingType === 'urgent' || postingType === 'tournament';
  const constraints = useMemo(() => {
    if (!postingType) {
      return { maxDates: 1, label: 'single date' };
    }

    return DATE_CONSTRAINTS[postingType];
  }, [postingType]);

  const dateRequirements = useMemo(() => {
    return (data.dateSpecificRequirements ?? []) as DateSpecificRequirement[];
  }, [data.dateSpecificRequirements]);

  const dateRangeGroups = useMemo(() => {
    if (!supportsGroupedDates) {
      return [];
    }

    return groupRequirementsToDateRanges(dateRequirements);
  }, [dateRequirements, supportsGroupedDates]);

  const hasGroupedRequirements = useMemo(() => {
    return dateRequirements.some((requirement) => requirement.isGrouped === true);
  }, [dateRequirements]);

  const existingDates = useMemo(() => {
    return dateRequirements.map((req) => toDateString(req.date)).filter(Boolean);
  }, [dateRequirements]);

  const canAddDate = useMemo(() => {
    return dateRequirements.length < constraints.maxDates;
  }, [constraints.maxDates, dateRequirements.length]);

  const handleAddDatesAsGroup = useCallback(
    (dates: string[]) => {
      const consecutiveGroups = groupConsecutiveDates(dates);
      const seedTimeSlots = buildSeedTimeSlots(data);
      const newRequirements: DateSpecificRequirement[] = [];

      for (const group of consecutiveGroups) {
        const sharedTimeSlots = deepCloneTimeSlots(seedTimeSlots);

        for (const date of group) {
          newRequirements.push({
            date,
            timeSlots: deepCloneTimeSlots(sharedTimeSlots),
            isGrouped: true,
          });
        }
      }

      onUpdate({ dateSpecificRequirements: [...dateRequirements, ...newRequirements] });
    },
    [data, dateRequirements, onUpdate]
  );

  const handleAddDatesIndividually = useCallback(
    (dates: string[]) => {
      const seedTimeSlots = buildSeedTimeSlots(data);
      const newRequirements: DateSpecificRequirement[] = dates.map((date) => ({
        date,
        timeSlots: deepCloneTimeSlots(seedTimeSlots),
        isGrouped: false,
      }));

      onUpdate({ dateSpecificRequirements: [...dateRequirements, ...newRequirements] });
    },
    [data, dateRequirements, onUpdate]
  );

  const handleSelectDates = useCallback(
    (dates: string[]) => {
      const sortedDates = [...dates].sort();

      if (supportsGroupedDates && sortedDates.length > 1) {
        setPendingDates(sortedDates);
        setShowGroupingModal(true);
        return;
      }

      handleAddDatesIndividually(sortedDates);
    },
    [handleAddDatesIndividually, supportsGroupedDates]
  );

  const handleGroupingConfirm = useCallback(
    (shouldGroup: boolean) => {
      if (shouldGroup) {
        handleAddDatesAsGroup(pendingDates);
      } else {
        handleAddDatesIndividually(pendingDates);
      }

      setPendingDates([]);
      setShowGroupingModal(false);
    },
    [handleAddDatesAsGroup, handleAddDatesIndividually, pendingDates]
  );

  const handleGroupingClose = useCallback(() => {
    setPendingDates([]);
    setShowGroupingModal(false);
  }, []);

  const handleRemoveDate = useCallback(
    (index: number) => {
      onUpdate({
        dateSpecificRequirements: dateRequirements.filter(
          (_, currentIndex) => currentIndex !== index
        ),
      });
    },
    [dateRequirements, onUpdate]
  );

  const handleUpdateDate = useCallback(
    (index: number, requirement: Partial<DateSpecificRequirement>) => {
      const updated = [...dateRequirements];
      updated[index] = { ...updated[index]!, ...requirement };
      onUpdate({ dateSpecificRequirements: updated });
    },
    [dateRequirements, onUpdate]
  );

  const handleUpdateGroup = useCallback(
    (groupIndex: number, groupUpdate: Partial<DateRangeGroup>) => {
      if (!groupUpdate.timeSlots) {
        return;
      }

      const group = dateRangeGroups[groupIndex];
      if (!group) {
        return;
      }

      const updated = dateRequirements.map((requirement) => {
        const currentDate = toDateString(requirement.date);
        if (currentDate >= group.startDate && currentDate <= group.endDate) {
          return {
            ...requirement,
            timeSlots: deepCloneTimeSlots(groupUpdate.timeSlots ?? []),
          };
        }

        return requirement;
      });

      onUpdate({ dateSpecificRequirements: updated });
    },
    [dateRangeGroups, dateRequirements, onUpdate]
  );

  const handleRemoveGroup = useCallback(
    (groupIndex: number) => {
      const group = dateRangeGroups[groupIndex];
      if (!group) {
        return;
      }

      const updated = dateRequirements.filter((requirement) => {
        const currentDate = toDateString(requirement.date);
        return currentDate < group.startDate || currentDate > group.endDate;
      });

      onUpdate({ dateSpecificRequirements: updated });
    },
    [dateRangeGroups, dateRequirements, onUpdate]
  );

  const totalDateCount = dateRequirements.length;
  const totalGroupCount = dateRangeGroups.length;

  return (
    <View>
      <View className="mb-3">
        <Text className="text-sm text-content-muted dark:text-secondary-400 font-sans">
          최대 {constraints.maxDates}개 날짜 추가 가능
          {hasGroupedRequirements && totalGroupCount > 0 && (
            <Text className="text-secondary-500 dark:text-secondary-500 font-sans">
              {' '}
              (현재 {totalGroupCount}개 일정, {totalDateCount}일)
            </Text>
          )}
        </Text>
        {supportsGroupedDates && (
          <Text className="mt-1 text-xs text-warning-600 dark:text-warning-400 font-sans">
            연속 날짜는 그룹으로 묶을지, 개별 날짜로 관리할지 선택할 수 있습니다.
          </Text>
        )}
      </View>

      {dateRequirements.length === 0 ? (
        <View className="items-center p-8">
          <Text className="text-secondary-500 dark:text-secondary-400 font-sans">
            날짜를 추가해 주세요.
          </Text>
        </View>
      ) : hasGroupedRequirements ? (
        <View className="mb-3">
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
        <View className="mb-3">
          {dateRequirements.map((requirement, index) => (
            <DateRequirementCard
              key={index}
              requirement={requirement}
              index={index}
              canRemove={true}
              onUpdate={handleUpdateDate}
              onRemove={handleRemoveDate}
            />
          ))}
        </View>
      )}

      <Pressable
        onPress={() => setShowDatePicker(true)}
        disabled={!canAddDate}
        className={`flex-row items-center justify-center rounded-lg border-2 border-dashed p-4 ${
          canAddDate
            ? 'border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/20'
            : 'border-secondary-300 bg-surface-page dark:bg-surface opacity-50 dark:border-surface-overlay dark:bg-surface'
        }`}
        accessibilityLabel="날짜 추가"
        accessibilityRole="button"
        testID="job-posting-add-date-button"
        accessibilityHint={canAddDate ? '새 날짜를 추가합니다.' : '더 이상 추가할 수 없습니다.'}
      >
        <View className="mr-2">
          <PlusIcon size={20} color={canAddDate ? '#D4AF37' : SECONDARY_PALETTE[400]} />
        </View>
        <Text
          className={`font-sans-medium ${
            canAddDate
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-secondary-400 dark:text-secondary-600'
          }`}
        >
          날짜 추가 {canAddDate && `(${totalDateCount}/${constraints.maxDates})`}
        </Text>
      </Pressable>

      {errors?.dateSpecificRequirements && (
        <Text className="mt-2 text-sm text-error-600 dark:text-error-400 font-sans">
          {errors.dateSpecificRequirements}
        </Text>
      )}

      {showDatePicker ? (
        <DatePickerModal
          visible={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          onSelectDates={handleSelectDates}
          postingType={postingType ?? 'regular'}
          existingDates={existingDates}
        />
      ) : null}

      {showGroupingModal ? (
        <GroupingConfirmModal
          visible={showGroupingModal}
          dates={pendingDates}
          onConfirm={handleGroupingConfirm}
          onClose={handleGroupingClose}
        />
      ) : null}
    </View>
  );
}

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
