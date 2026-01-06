/**
 * UNIQN Mobile - 공고 작성 Step 2: 일정 (대회)
 *
 * @description tournament 타입용 여러 날짜 선택 (Day 1, Day 2, Day 3...)
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Button } from '@/components';
import { DatePicker } from '@/components/ui/DatePicker';
import {
  PlusIcon,
  TrashIcon,
  ClockIcon,
  CalendarIcon,
  StarIcon,
} from '@/components/icons';
import type { JobPostingFormData, TournamentDay } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface Step2TournamentDatesProps {
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

/**
 * 날짜를 한글로 포맷팅 (간략 버전)
 */
function formatDateShort(dateString: string): string {
  if (!dateString) return '';
  const date = parseDate(dateString);
  if (!date) return '';
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = weekdays[date.getDay()];
  return `${month}/${day} (${weekday})`;
}

// ============================================================================
// Sub Components
// ============================================================================

interface DayCardProps {
  day: TournamentDay;
  onDateChange: (date: Date | null) => void;
  onTimeChange: (time: Date | null) => void;
  onDelete: () => void;
  canDelete: boolean;
  error?: string;
}

const DayCard = React.memo(function DayCard({
  day,
  onDateChange,
  onTimeChange,
  onDelete,
  canDelete,
  error,
}: DayCardProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <View className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-3">
      {/* 헤더 */}
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
          {day.date && (
            <Text className="ml-2 text-sm text-gray-500 dark:text-gray-400">
              {formatDateShort(day.date)}
            </Text>
          )}
        </View>
        {canDelete && (
          <Pressable
            onPress={onDelete}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20"
            accessibilityRole="button"
            accessibilityLabel={`Day ${day.day} 삭제`}
          >
            <TrashIcon size={18} color="#EF4444" />
          </Pressable>
        )}
      </View>

      {/* 날짜 선택 */}
      <View className="mb-3">
        <Text className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          날짜 <Text className="text-red-500">*</Text>
        </Text>
        <DatePicker
          value={parseDate(day.date)}
          onChange={onDateChange}
          placeholder="날짜를 선택하세요"
          minimumDate={today}
          mode="date"
          error={!!error}
        />
      </View>

      {/* 출근 시간 */}
      <View>
        <Text className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          출근 시간 <Text className="text-red-500">*</Text>
        </Text>
        <DatePicker
          value={parseTime(day.startTime)}
          onChange={onTimeChange}
          placeholder="시간을 선택하세요"
          mode="time"
          error={!!error}
        />
      </View>

      {/* 에러 메시지 */}
      {error && (
        <Text className="mt-2 text-sm text-red-500">{error}</Text>
      )}
    </View>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export function Step2TournamentDates({ data, onUpdate, onNext, onBack }: Step2TournamentDatesProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const tournamentDates = data.tournamentDates || [];

  // Day 추가
  const handleAddDay = useCallback(() => {
    const newDay: TournamentDay = {
      day: tournamentDates.length + 1,
      date: '',
      startTime: '',
    };
    onUpdate({ tournamentDates: [...tournamentDates, newDay] });
  }, [tournamentDates, onUpdate]);

  // Day 삭제
  const handleDeleteDay = useCallback((index: number) => {
    const newDates = tournamentDates
      .filter((_, i) => i !== index)
      .map((day, i) => ({ ...day, day: i + 1 })); // Day 번호 재정렬
    onUpdate({ tournamentDates: newDates });
    setErrors({});
  }, [tournamentDates, onUpdate]);

  // 날짜 변경
  const handleDateChange = useCallback((index: number, date: Date | null) => {
    const newDates = [...tournamentDates];
    newDates[index] = { ...newDates[index], date: formatDate(date) };
    onUpdate({ tournamentDates: newDates });
    setErrors((prev) => ({ ...prev, [`day${index}`]: '' }));
  }, [tournamentDates, onUpdate]);

  // 시간 변경
  const handleTimeChange = useCallback((index: number, time: Date | null) => {
    const newDates = [...tournamentDates];
    newDates[index] = { ...newDates[index], startTime: formatTime(time) };
    onUpdate({ tournamentDates: newDates });
    setErrors((prev) => ({ ...prev, [`day${index}`]: '' }));
  }, [tournamentDates, onUpdate]);

  // 유효성 검증
  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (tournamentDates.length === 0) {
      newErrors.general = '최소 1일 이상의 대회 일정을 추가해주세요';
    }

    tournamentDates.forEach((day, index) => {
      if (!day.date) {
        newErrors[`day${index}`] = `Day ${day.day}: 날짜를 선택해주세요`;
      }
      if (!day.startTime) {
        newErrors[`day${index}`] = `Day ${day.day}: 출근 시간을 선택해주세요`;
      }
    });

    // 날짜 중복 검사
    const dates = tournamentDates.map(d => d.date).filter(Boolean);
    const uniqueDates = new Set(dates);
    if (dates.length !== uniqueDates.size) {
      newErrors.general = '중복된 날짜가 있습니다. 각 Day는 다른 날짜여야 합니다.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [tournamentDates]);

  // 다음 단계
  const handleNext = useCallback(() => {
    if (validate()) {
      onNext();
    }
  }, [validate, onNext]);

  return (
    <View className="flex-1">
      <ScrollView className="flex-1 p-4">
        {/* 대회 공고 안내 */}
        <View className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <View className="flex-row items-start">
            <StarIcon size={20} color="#F59E0B" />
            <View className="ml-2 flex-1">
              <Text className="text-sm font-medium text-amber-800 dark:text-amber-200">
                대회 공고 안내
              </Text>
              <Text className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                대회 공고는 여러 날짜를 선택할 수 있습니다.{'\n'}
                관리자 승인 후 게시됩니다.
              </Text>
            </View>
          </View>
        </View>

        {/* 일반 에러 메시지 */}
        {errors.general && (
          <View className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <Text className="text-sm text-red-700 dark:text-red-300">
              {errors.general}
            </Text>
          </View>
        )}

        {/* Day 목록 */}
        <View className="mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-semibold text-gray-900 dark:text-white">
              대회 일정 ({tournamentDates.length}일)
            </Text>
            <Pressable
              onPress={handleAddDay}
              className="flex-row items-center px-3 py-2 bg-amber-500 dark:bg-amber-600 rounded-lg"
              accessibilityRole="button"
              accessibilityLabel="Day 추가"
            >
              <PlusIcon size={16} color="#FFFFFF" />
              <Text className="ml-1 text-white font-medium text-sm">
                Day 추가
              </Text>
            </Pressable>
          </View>

          {/* Day 카드 목록 */}
          {tournamentDates.length === 0 ? (
            <View className="p-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 items-center">
              <CalendarIcon size={48} color="#9CA3AF" />
              <Text className="mt-3 text-gray-500 dark:text-gray-400 text-center">
                아직 추가된 일정이 없습니다.{'\n'}
                'Day 추가' 버튼을 눌러 일정을 추가해주세요.
              </Text>
            </View>
          ) : (
            tournamentDates.map((day, index) => (
              <DayCard
                key={`day-${index}`}
                day={day}
                onDateChange={(date) => handleDateChange(index, date)}
                onTimeChange={(time) => handleTimeChange(index, time)}
                onDelete={() => handleDeleteDay(index)}
                canDelete={tournamentDates.length > 1}
                error={errors[`day${index}`]}
              />
            ))
          )}
        </View>

        {/* 선택된 일정 요약 */}
        {tournamentDates.length > 0 && tournamentDates.every(d => d.date && d.startTime) && (
          <View className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
            <Text className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
              대회 일정 요약
            </Text>
            {tournamentDates.map((day) => (
              <View key={day.day} className="flex-row items-center mb-1">
                <Text className="text-sm text-amber-800 dark:text-amber-200 font-medium w-12">
                  Day {day.day}
                </Text>
                <CalendarIcon size={14} color="#D97706" />
                <Text className="ml-1 text-sm text-amber-700 dark:text-amber-300">
                  {formatDateShort(day.date)}
                </Text>
                <View className="ml-3">
                  <ClockIcon size={14} color="#D97706" />
                </View>
                <Text className="ml-1 text-sm text-amber-700 dark:text-amber-300">
                  {day.startTime}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* 버튼 그룹 (고정) */}
      <View className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <View className="flex-row gap-3">
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
    </View>
  );
}

export default Step2TournamentDates;
