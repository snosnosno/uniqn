/**
 * UNIQN Mobile - 공고 작성 Step 2: 일정 (고정)
 *
 * @description fixed 타입용 주 출근일수 + 요일 선택 + 출근시간
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Button, FormField } from '@/components';
import { DatePicker } from '@/components/ui/DatePicker';
import { ClockIcon, CalendarDaysIcon } from '@/components/icons';
import type { JobPostingFormData } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface Step2FixedScheduleProps {
  data: JobPostingFormData;
  onUpdate: (data: Partial<JobPostingFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const WEEKDAYS = [
  { key: '월', label: '월' },
  { key: '화', label: '화' },
  { key: '수', label: '수' },
  { key: '목', label: '목' },
  { key: '금', label: '금' },
  { key: '토', label: '토' },
  { key: '일', label: '일' },
];

const DAYS_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

// ============================================================================
// Utils
// ============================================================================

/**
 * HH:mm 문자열을 Date 객체로 변환
 */
function parseTime(timeString: string): Date | null {
  if (!timeString) return null;
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/**
 * Date 객체를 HH:mm 문자열로 변환
 */
function formatTime(date: Date | null): string {
  if (!date) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// ============================================================================
// Component
// ============================================================================

export function Step2FixedSchedule({ data, onUpdate, onNext, onBack }: Step2FixedScheduleProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 요일 토글 핸들러
  const handleWeekdayToggle = useCallback((day: string) => {
    const currentDays = data.workDays || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day];

    onUpdate({ workDays: newDays });
    setErrors((prev) => ({ ...prev, workDays: '' }));
  }, [data.workDays, onUpdate]);

  // 출근일수 변경 핸들러
  const handleDaysPerWeekChange = useCallback((days: number) => {
    onUpdate({ daysPerWeek: days });
    setErrors((prev) => ({ ...prev, daysPerWeek: '' }));
  }, [onUpdate]);

  // 시간 변경 핸들러
  const handleTimeChange = useCallback((time: Date | null) => {
    onUpdate({ startTime: formatTime(time) });
    setErrors((prev) => ({ ...prev, startTime: '' }));
  }, [onUpdate]);

  // 유효성 검증
  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (!data.daysPerWeek || data.daysPerWeek < 1 || data.daysPerWeek > 7) {
      newErrors.daysPerWeek = '주 출근일수를 선택해주세요 (1-7일)';
    }

    if (!data.startTime) {
      newErrors.startTime = '출근 시간을 선택해주세요';
    }

    // 선택된 요일 수가 출근일수보다 많으면 경고 (선택 사항)
    if (data.workDays && data.workDays.length > 0 && data.daysPerWeek && data.workDays.length !== data.daysPerWeek) {
      // 경고만 표시, 에러는 아님
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [data.daysPerWeek, data.startTime, data.workDays]);

  // 다음 단계
  const handleNext = useCallback(() => {
    if (validate()) {
      onNext();
    }
  }, [validate, onNext]);

  // 선택된 요일 표시 텍스트
  const selectedDaysText = useMemo(() => {
    if (!data.workDays || data.workDays.length === 0) return '요일 선택 (선택사항)';

    // 요일 순서대로 정렬
    const orderedDays = WEEKDAYS.filter(w => data.workDays.includes(w.key)).map(w => w.label);
    return orderedDays.join(', ');
  }, [data.workDays]);

  return (
    <View className="flex-1 p-4">
      {/* 고정 공고 안내 */}
      <View className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
        <Text className="text-sm text-indigo-700 dark:text-indigo-300">
          고정 공고는 장기 근무를 위한 공고입니다.{'\n'}
          주 출근일수와 출근 시간을 설정해주세요.
        </Text>
      </View>

      {/* 주 출근일수 선택 */}
      <FormField label="주 출근일수" required error={errors.daysPerWeek}>
        <View className="flex-row flex-wrap gap-2">
          {DAYS_OPTIONS.map((days) => {
            const isSelected = data.daysPerWeek === days;
            return (
              <Pressable
                key={days}
                onPress={() => handleDaysPerWeekChange(days)}
                className={`
                  px-4 py-2 rounded-lg border-2
                  ${isSelected
                    ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-900/30'
                    : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
                  }
                `}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
              >
                <Text
                  className={`
                    font-medium
                    ${isSelected
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-gray-900 dark:text-white'
                    }
                  `}
                >
                  {days}일
                </Text>
              </Pressable>
            );
          })}
        </View>
      </FormField>

      {/* 출근 요일 선택 (선택사항) */}
      <FormField label="출근 요일" className="mt-4">
        <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          협의 가능한 요일을 선택해주세요 (선택사항)
        </Text>
        <View className="flex-row gap-2">
          {WEEKDAYS.map((weekday) => {
            const isSelected = data.workDays?.includes(weekday.key);
            const isWeekend = weekday.key === '토' || weekday.key === '일';

            return (
              <Pressable
                key={weekday.key}
                onPress={() => handleWeekdayToggle(weekday.key)}
                className={`
                  flex-1 py-3 rounded-lg border-2 items-center
                  ${isSelected
                    ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-900/30'
                    : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
                  }
                `}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={`${weekday.label}요일`}
              >
                <Text
                  className={`
                    font-medium text-sm
                    ${isSelected
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : isWeekend
                        ? 'text-red-500 dark:text-red-400'
                        : 'text-gray-900 dark:text-white'
                    }
                  `}
                >
                  {weekday.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </FormField>

      {/* 출근 시간 */}
      <FormField label="출근 시간" required error={errors.startTime} className="mt-4">
        <DatePicker
          value={parseTime(data.startTime)}
          onChange={handleTimeChange}
          placeholder="시간을 선택하세요"
          mode="time"
          error={!!errors.startTime}
        />
      </FormField>

      {/* 선택된 일정 요약 */}
      {data.daysPerWeek && data.startTime && (
        <View className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-700">
          <Text className="text-sm font-medium text-indigo-900 dark:text-indigo-100 mb-2">
            선택된 근무 조건
          </Text>
          <View className="flex-row items-center mb-1">
            <CalendarDaysIcon size={16} color="#6366F1" />
            <Text className="ml-2 text-sm text-indigo-800 dark:text-indigo-200">
              주 {data.daysPerWeek}일 근무
            </Text>
          </View>
          {data.workDays && data.workDays.length > 0 && (
            <View className="flex-row items-center mb-1 ml-6">
              <Text className="text-xs text-indigo-600 dark:text-indigo-300">
                ({selectedDaysText})
              </Text>
            </View>
          )}
          <View className="flex-row items-center">
            <ClockIcon size={16} color="#6366F1" />
            <Text className="ml-2 text-sm text-indigo-800 dark:text-indigo-200">
              {data.startTime} 출근
            </Text>
          </View>
        </View>
      )}

      {/* 버튼 그룹 */}
      <View className="flex-row gap-3 mt-6">
        <View className="flex-1">
          <Button variant="outline" size="lg" onPress={onBack} fullWidth>
            이전
          </Button>
        </View>
        <View className="flex-1">
          <Button variant="primary" size="lg" onPress={handleNext} fullWidth>
            다음 단계
          </Button>
        </View>
      </View>
    </View>
  );
}

export default Step2FixedSchedule;
