/**
 * UNIQN Mobile - 공고 작성 일정 섹션
 *
 * @description 공고 타입별 일정 입력 (regular/urgent, fixed, tournament)
 * @version 1.0.0
 */

import React, { useCallback, useMemo, memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { FormField } from '@/components';
import { DatePicker } from '@/components/ui/DatePicker';
import { TimePicker } from '@/components/ui/TimePicker';
import {
  CalendarIcon,
  ClockIcon,
  PlusIcon,
  TrashIcon,
  StarIcon,
  CheckIcon,
} from '@/components/icons';
import type { JobPostingFormData, TournamentDay } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface ScheduleSectionProps {
  data: JobPostingFormData;
  onUpdate: (data: Partial<JobPostingFormData>) => void;
  errors?: Record<string, string>;
}

// ============================================================================
// Utils
// ============================================================================

function parseDate(dateString: string): Date | null {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date: Date | null): string {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============================================================================
// Constants
// ============================================================================


/** 주 출근일수 옵션 (0 = 협의) */
const DAYS_OPTIONS = [
  { value: 0, label: '협의' },
  { value: 1, label: '1일' },
  { value: 2, label: '2일' },
  { value: 3, label: '3일' },
  { value: 4, label: '4일' },
  { value: 5, label: '5일' },
  { value: 6, label: '6일' },
  { value: 7, label: '7일' },
];

// ============================================================================
// Sub Components
// ============================================================================

/** 단일 날짜 선택 (regular/urgent) */
const SingleDateSchedule = memo(function SingleDateSchedule({
  data,
  onUpdate,
  errors,
  isUrgent,
}: {
  data: JobPostingFormData;
  onUpdate: (data: Partial<JobPostingFormData>) => void;
  errors?: Record<string, string>;
  isUrgent: boolean;
}) {
  const minimumDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }, []);

  const maximumDate = useMemo(() => {
    if (!isUrgent) return undefined;
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 7);
    return maxDate;
  }, [isUrgent]);

  return (
    <View>
      {isUrgent && (
        <View className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <Text className="text-sm text-red-700 dark:text-red-300">
            긴급 공고는 오늘부터 7일 이내의 날짜만 선택할 수 있습니다.
          </Text>
        </View>
      )}

      <View className="flex-row gap-3">
        <View className="flex-1">
          <FormField
            label="근무 날짜"
            required
            error={errors?.workDate}
            icon={<CalendarIcon size={16} color="#6B7280" />}
          >
            <DatePicker
              value={parseDate(data.workDate)}
              onChange={(date) => onUpdate({ workDate: formatDate(date) })}
              placeholder="날짜를 선택하세요"
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              mode="date"
              error={!!errors?.workDate}
            />
          </FormField>
        </View>

        <View className="flex-1">
          <FormField
            label="출근 시간"
            required
            error={errors?.startTime}
            icon={<ClockIcon size={16} color="#6B7280" />}
          >
            <TimePicker
              value={data.startTime}
              onChange={(time) => onUpdate({ startTime: time })}
              placeholder="시간을 선택하세요"
              error={!!errors?.startTime}
            />
          </FormField>
        </View>
      </View>
    </View>
  );
});

/** 고정 근무 스케줄 (fixed) */
const FixedSchedule = memo(function FixedSchedule({
  data,
  onUpdate,
  errors,
}: {
  data: JobPostingFormData;
  onUpdate: (data: Partial<JobPostingFormData>) => void;
  errors?: Record<string, string>;
}) {
  const isNegotiable = data.isStartTimeNegotiable ?? false;

  const handleNegotiableToggle = () => {
    onUpdate({
      isStartTimeNegotiable: !isNegotiable,
      // 협의로 변경 시 시간 초기화
      ...(isNegotiable ? {} : { startTime: '' }),
    });
  };

  return (
    <View>
      <View className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
        <Text className="text-sm text-indigo-700 dark:text-indigo-300">
          고정 공고는 장기 근무를 위한 공고입니다.
        </Text>
      </View>

      {/* 주 출근일수 */}
      <FormField label="주 출근일수" required error={errors?.daysPerWeek}>
        <View className="flex-row flex-wrap gap-2">
          {DAYS_OPTIONS.map((option) => {
            const isSelected = data.daysPerWeek === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => onUpdate({ daysPerWeek: option.value })}
                className={`
                  px-4 py-2 rounded-lg border-2
                  ${isSelected
                    ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-900/30'
                    : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
                  }
                `}
              >
                <Text className={`font-medium ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-white'}`}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </FormField>

      {/* 출근 시간 */}
      <View className="mt-4">
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
              출근 시간
            </Text>
            {!isNegotiable && (
              <Text className="text-sm text-red-500 ml-1">*</Text>
            )}
          </View>
          {/* 협의 체크박스 */}
          <Pressable
            onPress={handleNegotiableToggle}
            className="flex-row items-center"
          >
            <View
              className={`w-5 h-5 rounded border items-center justify-center mr-1.5
                ${isNegotiable
                  ? 'bg-indigo-600 border-indigo-600'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                }`}
            >
              {isNegotiable && <CheckIcon size={14} color="#FFFFFF" />}
            </View>
            <Text className="text-sm text-gray-600 dark:text-gray-400">협의</Text>
          </Pressable>
        </View>

        {isNegotiable ? (
          <View className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <Text className="text-gray-500 dark:text-gray-400 text-center">
              출근 시간은 협의 후 결정됩니다
            </Text>
          </View>
        ) : (
          <TimePicker
            value={data.startTime}
            onChange={(time) => onUpdate({ startTime: time })}
            placeholder="시간을 선택하세요"
            error={!!errors?.startTime}
          />
        )}
        {errors?.startTime && (
          <Text className="mt-1 text-sm text-red-500">{errors.startTime}</Text>
        )}
      </View>
    </View>
  );
});

/** 토너먼트 일정 (tournament) */
const TournamentSchedule = memo(function TournamentSchedule({
  data,
  onUpdate,
  errors,
}: {
  data: JobPostingFormData;
  onUpdate: (data: Partial<JobPostingFormData>) => void;
  errors?: Record<string, string>;
}) {
  const tournamentDates = data.tournamentDates || [];
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const handleAddDay = useCallback(() => {
    const newDay: TournamentDay = {
      day: tournamentDates.length + 1,
      date: '',
      startTime: '',
    };
    onUpdate({ tournamentDates: [...tournamentDates, newDay] });
  }, [tournamentDates, onUpdate]);

  const handleDeleteDay = useCallback((index: number) => {
    const newDates = tournamentDates
      .filter((_, i) => i !== index)
      .map((day, i) => ({ ...day, day: i + 1 }));
    onUpdate({ tournamentDates: newDates });
  }, [tournamentDates, onUpdate]);

  const handleDateChange = useCallback((index: number, date: Date | null) => {
    const newDates = [...tournamentDates];
    newDates[index] = { ...newDates[index], date: formatDate(date) };
    onUpdate({ tournamentDates: newDates });
  }, [tournamentDates, onUpdate]);

  const handleTimeChange = useCallback((index: number, time: string) => {
    const newDates = [...tournamentDates];
    newDates[index] = { ...newDates[index], startTime: time };
    onUpdate({ tournamentDates: newDates });
  }, [tournamentDates, onUpdate]);

  return (
    <View>
      <View className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
        <View className="flex-row items-start">
          <StarIcon size={20} color="#F59E0B" />
          <View className="ml-2 flex-1">
            <Text className="text-sm font-medium text-amber-800 dark:text-amber-200">
              대회 공고 안내
            </Text>
            <Text className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              대회 공고는 여러 날짜를 선택할 수 있습니다. 관리자 승인 후 게시됩니다.
            </Text>
          </View>
        </View>
      </View>

      {/* Day 목록 */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
          대회 일정 ({tournamentDates.length}일)
        </Text>
        <Pressable
          onPress={handleAddDay}
          className="flex-row items-center px-3 py-2 bg-amber-500 dark:bg-amber-600 rounded-lg"
        >
          <PlusIcon size={16} color="#FFFFFF" />
          <Text className="ml-1 text-white font-medium text-sm">Day 추가</Text>
        </Pressable>
      </View>

      {tournamentDates.length === 0 ? (
        <View className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 items-center">
          <CalendarIcon size={40} color="#9CA3AF" />
          <Text className="mt-2 text-gray-500 dark:text-gray-400 text-center text-sm">
            아직 추가된 일정이 없습니다.{'\n'}'Day 추가' 버튼을 눌러 일정을 추가해주세요.
          </Text>
        </View>
      ) : (
        tournamentDates.map((day, index) => (
          <View
            key={`day-${index}`}
            className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-3"
          >
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 items-center justify-center">
                  <Text className="text-amber-700 dark:text-amber-300 font-bold text-sm">
                    {day.day}
                  </Text>
                </View>
                <Text className="ml-2 font-semibold text-gray-900 dark:text-white">
                  Day {day.day}
                </Text>
              </View>
              {tournamentDates.length > 1 && (
                <Pressable
                  onPress={() => handleDeleteDay(index)}
                  className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20"
                >
                  <TrashIcon size={18} color="#EF4444" />
                </Pressable>
              )}
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-xs text-gray-600 dark:text-gray-400 mb-1">날짜</Text>
                <DatePicker
                  value={parseDate(day.date)}
                  onChange={(date) => handleDateChange(index, date)}
                  placeholder="날짜 선택"
                  minimumDate={today}
                  mode="date"
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-gray-600 dark:text-gray-400 mb-1">출근 시간</Text>
                <TimePicker
                  value={day.startTime}
                  onChange={(time) => handleTimeChange(index, time)}
                  placeholder="시간 선택"
                />
              </View>
            </View>
          </View>
        ))
      )}

      {/* 에러 메시지 */}
      {errors?.tournamentDates && (
        <Text className="mt-2 text-sm text-red-500">{errors.tournamentDates}</Text>
      )}
    </View>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export const ScheduleSection = memo(function ScheduleSection({
  data,
  onUpdate,
  errors = {},
}: ScheduleSectionProps) {
  const { postingType } = data;

  // 공고 타입에 따라 다른 스케줄 UI 렌더링
  switch (postingType) {
    case 'fixed':
      return <FixedSchedule data={data} onUpdate={onUpdate} errors={errors} />;
    case 'tournament':
      return <TournamentSchedule data={data} onUpdate={onUpdate} errors={errors} />;
    case 'urgent':
      return <SingleDateSchedule data={data} onUpdate={onUpdate} errors={errors} isUrgent />;
    case 'regular':
    default:
      return <SingleDateSchedule data={data} onUpdate={onUpdate} errors={errors} isUrgent={false} />;
  }
});

export default ScheduleSection;
