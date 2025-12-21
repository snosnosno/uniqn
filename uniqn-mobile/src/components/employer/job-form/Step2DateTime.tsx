/**
 * UNIQN Mobile - 공고 작성 Step 2: 일정
 *
 * @description 근무일, 근무 시간 입력
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Button, FormField, Input } from '@/components';
import { CalendarIcon, ClockIcon, ExclamationTriangleIcon } from '@/components/icons';
import { dateTimeSchema } from '@/schemas/jobPosting.schema';
import type { JobPostingFormData } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface Step2DateTimeProps {
  data: JobPostingFormData;
  onUpdate: (data: Partial<JobPostingFormData>) => void;
  onNext: () => void;
  onPrev: () => void;
  disabled?: boolean;
}

// 시간 슬롯 옵션
const TIME_SLOTS = [
  '10:00 - 18:00',
  '12:00 - 20:00',
  '14:00 - 22:00',
  '16:00 - 24:00',
  '18:00 - 02:00',
  '20:00 - 04:00',
  '22:00 - 06:00',
];

// ============================================================================
// Helper Functions
// ============================================================================

const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = weekdays[date.getDay()];
  return `${year}년 ${month}월 ${day}일 (${weekday})`;
};

const getNextDays = (count: number): string[] => {
  const dates: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < count; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }

  return dates;
};

// ============================================================================
// Component
// ============================================================================

export function Step2DateTime({ data, onUpdate, onNext, onPrev, disabled = false }: Step2DateTimeProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimeSlotPicker, setShowTimeSlotPicker] = useState(false);

  const nextDays = getNextDays(14); // 2주치 날짜

  // 유효성 검증
  const validate = useCallback(() => {
    const result = dateTimeSchema.safeParse({
      workDate: data.workDate,
      timeSlot: data.timeSlot,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return false;
    }

    setErrors({});
    return true;
  }, [data]);

  // 다음 단계
  const handleNext = useCallback(() => {
    if (validate()) {
      onNext();
    }
  }, [validate, onNext]);

  // 긴급 여부 체크 (7일 이내)
  const isUrgentDate = useCallback((dateString: string): boolean => {
    const targetDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  }, []);

  return (
    <View className="flex-1 p-4">
      {/* 비활성화 경고 */}
      {disabled && (
        <View className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <Text className="text-sm text-gray-600 dark:text-gray-400">
            확정된 지원자가 있어 일정을 수정할 수 없습니다.
          </Text>
        </View>
      )}

      {/* 근무일 선택 */}
      <FormField label="근무 날짜" required error={errors.workDate}>
        <Pressable
          onPress={() => !disabled && setShowDatePicker(!showDatePicker)}
          disabled={disabled}
          className={`flex-row items-center px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg ${disabled ? 'opacity-50' : ''}`}
        >
          <CalendarIcon size={20} color="#6B7280" />
          <Text
            className={`ml-3 flex-1 ${
              data.workDate
                ? 'text-gray-900 dark:text-white'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            {data.workDate ? formatDate(data.workDate) : '날짜를 선택해주세요'}
          </Text>
        </Pressable>

        {/* 날짜 선택 그리드 */}
        {showDatePicker && (
          <View className="mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <View className="flex-row flex-wrap gap-2">
              {nextDays.map((date) => {
                const isSelected = data.workDate === date;
                const isToday = date === nextDays[0];
                const urgent = isUrgentDate(date);

                return (
                  <Pressable
                    key={date}
                    onPress={() => {
                      onUpdate({ workDate: date, isUrgent: urgent });
                      setShowDatePicker(false);
                    }}
                    className={`px-3 py-2 rounded-lg border ${
                      isSelected
                        ? 'bg-primary-600 border-primary-600'
                        : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        isSelected
                          ? 'text-white'
                          : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {isToday ? '오늘' : formatDate(date).split(' ').slice(1).join(' ')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </FormField>

      {/* 긴급 공고 표시 */}
      {data.workDate && data.isUrgent && (
        <View className="mt-3 flex-row items-center px-3 py-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          <ExclamationTriangleIcon size={18} color="#F97316" />
          <Text className="ml-2 text-sm text-orange-700 dark:text-orange-300">
            7일 이내 긴급 공고로 등록됩니다 (상단 노출 혜택)
          </Text>
        </View>
      )}

      {/* 근무 시간 선택 */}
      <FormField label="근무 시간" required error={errors.timeSlot} className="mt-4">
        <Pressable
          onPress={() => !disabled && setShowTimeSlotPicker(!showTimeSlotPicker)}
          disabled={disabled}
          className={`flex-row items-center px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg ${disabled ? 'opacity-50' : ''}`}
        >
          <ClockIcon size={20} color="#6B7280" />
          <Text
            className={`ml-3 flex-1 ${
              data.timeSlot
                ? 'text-gray-900 dark:text-white'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            {data.timeSlot || '시간을 선택해주세요'}
          </Text>
        </Pressable>

        {/* 시간 선택 목록 */}
        {showTimeSlotPicker && (
          <View className="mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {TIME_SLOTS.map((slot, index) => (
              <Pressable
                key={slot}
                onPress={() => {
                  onUpdate({ timeSlot: slot });
                  setShowTimeSlotPicker(false);
                }}
                className={`px-4 py-3 ${
                  index < TIME_SLOTS.length - 1
                    ? 'border-b border-gray-100 dark:border-gray-700'
                    : ''
                } ${
                  data.timeSlot === slot
                    ? 'bg-primary-50 dark:bg-primary-900/30'
                    : ''
                }`}
              >
                <Text className={`font-medium ${
                  data.timeSlot === slot
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-900 dark:text-white'
                }`}>
                  {slot}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </FormField>

      {/* 직접 입력 */}
      <FormField label="또는 직접 입력" className="mt-4">
        <Input
          placeholder="예: 19:00 - 03:00"
          value={!TIME_SLOTS.includes(data.timeSlot) ? data.timeSlot : ''}
          onChangeText={(timeSlot) => onUpdate({ timeSlot })}
          editable={!disabled}
          className={disabled ? 'opacity-50' : ''}
        />
      </FormField>

      {/* 버튼 영역 */}
      <View className="mt-6 flex-row gap-3">
        <Button variant="outline" size="lg" onPress={onPrev} className="flex-1">
          이전
        </Button>
        <Button variant="primary" size="lg" onPress={handleNext} className="flex-[2]">
          다음 단계
        </Button>
      </View>
    </View>
  );
}
