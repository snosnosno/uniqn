/**
 * UNIQN Mobile - 공고 작성 Step 2: 일정 (지원/긴급)
 *
 * @description regular/urgent 타입용 단일 날짜 + 출근시간 선택
 * @version 2.0.0 - 출근시간만 사용 (종료시간 없음)
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text } from 'react-native';
import { Button, FormField } from '@/components';
import { DatePicker } from '@/components/ui/DatePicker';
import { ClockIcon, CalendarIcon } from '@/components/icons';
import type { JobPostingFormData } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface Step2DateTimeProps {
  data: JobPostingFormData;
  onUpdate: (data: Partial<JobPostingFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

// ============================================================================
// Utils
// ============================================================================

/**
 * YYYY-MM-DD 문자열을 Date 객체로 변환
 */
function parseDate(dateString: string): Date | null {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Date 객체를 YYYY-MM-DD 문자열로 변환
 */
function formatDate(date: Date | null): string {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * HH:mm 문자열을 Date 객체로 변환 (오늘 날짜 기준)
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

/**
 * 날짜를 한글로 포맷팅
 */
function formatDateKorean(dateString: string): string {
  if (!dateString) return '';
  const date = parseDate(dateString);
  if (!date) return '';
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = weekdays[date.getDay()];
  return `${year}년 ${month}월 ${day}일 (${weekday})`;
}

// ============================================================================
// Component
// ============================================================================

export function Step2DateTime({ data, onUpdate, onNext, onBack }: Step2DateTimeProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isUrgent = data.postingType === 'urgent';

  // 최소 날짜 (오늘)
  const minimumDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }, []);

  // 최대 날짜 (긴급: 7일 이내)
  const maximumDate = useMemo(() => {
    if (!isUrgent) return undefined;
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 7);
    maxDate.setHours(23, 59, 59, 999);
    return maxDate;
  }, [isUrgent]);

  // 날짜 변경 핸들러
  const handleDateChange = useCallback((date: Date | null) => {
    onUpdate({ workDate: formatDate(date) });
    setErrors((prev) => ({ ...prev, workDate: '' }));
  }, [onUpdate]);

  // 시간 변경 핸들러
  const handleTimeChange = useCallback((time: Date | null) => {
    onUpdate({ startTime: formatTime(time) });
    setErrors((prev) => ({ ...prev, startTime: '' }));
  }, [onUpdate]);

  // 유효성 검증
  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (!data.workDate) {
      newErrors.workDate = '근무 날짜를 선택해주세요';
    } else if (isUrgent) {
      // 긴급 공고: 7일 이내 검증
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const workDate = parseDate(data.workDate);
      if (workDate) {
        const diffDays = Math.ceil(
          (workDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diffDays < 0) {
          newErrors.workDate = '지난 날짜는 선택할 수 없습니다';
        } else if (diffDays > 7) {
          newErrors.workDate = '긴급 공고는 7일 이내만 가능합니다';
        }
      }
    }

    if (!data.startTime) {
      newErrors.startTime = '출근 시간을 선택해주세요';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [data.workDate, data.startTime, isUrgent]);

  // 다음 단계
  const handleNext = useCallback(() => {
    if (validate()) {
      onNext();
    }
  }, [validate, onNext]);

  return (
    <View className="flex-1 p-4">
      {/* 긴급 공고 안내 */}
      {isUrgent && (
        <View className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <Text className="text-sm text-red-700 dark:text-red-300">
            긴급 공고는 오늘부터 7일 이내의 날짜만 선택할 수 있습니다.
          </Text>
        </View>
      )}

      {/* 근무 날짜 */}
      <FormField label="근무 날짜" required error={errors.workDate}>
        <DatePicker
          value={parseDate(data.workDate)}
          onChange={handleDateChange}
          placeholder="날짜를 선택하세요"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          mode="date"
          error={!!errors.workDate}
        />
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
      {data.workDate && data.startTime && (
        <View className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
          <Text className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
            선택된 일정
          </Text>
          <View className="flex-row items-center mb-1">
            <CalendarIcon size={16} color="#3B82F6" />
            <Text className="ml-2 text-sm text-blue-800 dark:text-blue-200">
              {formatDateKorean(data.workDate)}
            </Text>
          </View>
          <View className="flex-row items-center">
            <ClockIcon size={16} color="#3B82F6" />
            <Text className="ml-2 text-sm text-blue-800 dark:text-blue-200">
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

export default Step2DateTime;
