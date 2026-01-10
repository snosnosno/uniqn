/**
 * UNIQN Mobile - DatePicker 컴포넌트
 *
 * @description 캘린더 뷰 날짜 선택 (모달 + CalendarPicker)
 * @version 2.0.0
 */

import React, { memo, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
} from 'react-native';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { XMarkIcon, ChevronDownIcon } from '@/components/icons';
import { CalendarPicker } from './CalendarPicker';

// ============================================================================
// Types
// ============================================================================

export interface DatePickerProps {
  /** 현재 선택된 날짜 */
  value: Date | null;
  /** 날짜 변경 콜백 */
  onChange: (date: Date | null) => void;
  /** 레이블 */
  label?: string;
  /** 플레이스홀더 */
  placeholder?: string;
  /** 최소 날짜 */
  minimumDate?: Date;
  /** 최대 날짜 */
  maximumDate?: Date;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 에러 상태 */
  error?: boolean;
  /** 에러 메시지 */
  errorMessage?: string;
  /** 날짜 포맷 */
  dateFormat?: string;
  /** 선택 모드 (date만 지원, time은 TimePicker 사용) */
  mode?: 'date' | 'time' | 'datetime';
  /** 추가 스타일 클래스 */
  className?: string;
  /** 테스트 ID */
  testID?: string;
}

// ============================================================================
// Component
// ============================================================================

export const DatePicker = memo(function DatePicker({
  value,
  onChange,
  label,
  placeholder = '날짜를 선택하세요',
  minimumDate,
  maximumDate,
  disabled = false,
  error = false,
  errorMessage,
  dateFormat = 'MM월 dd일 (EEE)',
  mode = 'date',
  className = '',
  testID,
}: DatePickerProps) {
  const [showModal, setShowModal] = useState(false);

  // 모달 열기
  const openModal = useCallback(() => {
    if (!disabled) {
      setShowModal(true);
    }
  }, [disabled]);

  // 모달 닫기
  const closeModal = useCallback(() => {
    setShowModal(false);
  }, []);

  // 날짜 선택
  const handleDateSelect = useCallback(
    (date: Date) => {
      onChange(date);
      closeModal();
    },
    [onChange, closeModal]
  );

  // 날짜 초기화
  const handleClear = useCallback(() => {
    onChange(null);
  }, [onChange]);

  // 표시할 텍스트
  const displayText = value
    ? format(value, dateFormat, { locale: ko })
    : placeholder;

  // 입력 필드 스타일
  const getInputStyle = () => {
    const base = 'flex-row items-center px-4 py-3 rounded-lg border-2';
    if (disabled) {
      return `${base} bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600`;
    }
    if (error) {
      return `${base} bg-white dark:bg-gray-800 border-red-500`;
    }
    return `${base} bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600`;
  };

  // time 모드는 TimePicker 사용 권장 (여기서는 기본 동작만)
  if (mode === 'time') {
    return (
      <View className={className} testID={testID}>
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          시간 선택은 TimePicker를 사용하세요
        </Text>
      </View>
    );
  }

  return (
    <View className={className} testID={testID}>
      {/* 레이블 */}
      {label && (
        <Text className="mb-2 font-medium text-gray-900 dark:text-white">
          {label}
        </Text>
      )}

      {/* 트리거 영역 - 버튼 중첩 방지를 위해 flex 구조 변경 */}
      <View className={getInputStyle()}>
        {/* 날짜 선택 영역 */}
        <Pressable
          onPress={openModal}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={label ?? '날짜 선택'}
          accessibilityState={{ disabled }}
          accessibilityHint="탭하여 날짜를 선택하세요"
          className="flex-row items-center flex-1"
        >
          <Text
            className={`flex-1 ${value ? 'text-base' : 'text-sm'} ${
              disabled
                ? 'text-gray-400 dark:text-gray-500'
                : value
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            {displayText}
          </Text>
        </Pressable>

        {/* 초기화/화살표 버튼 (별도 영역으로 분리) */}
        {value && !disabled ? (
          <Pressable
            onPress={handleClear}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="날짜 초기화"
            className="ml-2"
          >
            <XMarkIcon size={20} color="#9CA3AF" />
          </Pressable>
        ) : (
          <ChevronDownIcon
            size={20}
            color={disabled ? '#9CA3AF' : '#6B7280'}
          />
        )}
      </View>

      {/* 에러 메시지 */}
      {error && errorMessage && (
        <Text className="mt-2 text-sm text-red-500">{errorMessage}</Text>
      )}

      {/* 모달 */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white dark:bg-gray-800 rounded-t-2xl">
            {/* 헤더 */}
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-700">
              <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                날짜 선택
              </Text>
              <Pressable
                onPress={closeModal}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="닫기"
              >
                <XMarkIcon size={24} color="#6B7280" />
              </Pressable>
            </View>

            {/* 캘린더 */}
            <View className="px-2 pb-8">
              <CalendarPicker
                value={value}
                onChange={handleDateSelect}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
});

// ============================================================================
// DateRangePicker Component
// ============================================================================

export interface DateRangePickerProps {
  /** 시작 날짜 */
  startDate: Date | null;
  /** 종료 날짜 */
  endDate: Date | null;
  /** 날짜 범위 변경 콜백 */
  onChange: (range: { startDate: Date | null; endDate: Date | null }) => void;
  /** 레이블 */
  label?: string;
  /** 시작 날짜 플레이스홀더 */
  startPlaceholder?: string;
  /** 종료 날짜 플레이스홀더 */
  endPlaceholder?: string;
  /** 최소 날짜 */
  minimumDate?: Date;
  /** 최대 날짜 */
  maximumDate?: Date;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 에러 상태 */
  error?: boolean;
  /** 에러 메시지 */
  errorMessage?: string;
  /** 추가 스타일 클래스 */
  className?: string;
  /** 테스트 ID */
  testID?: string;
}

export const DateRangePicker = memo(function DateRangePicker({
  startDate,
  endDate,
  onChange,
  label,
  startPlaceholder = '시작일',
  endPlaceholder = '종료일',
  minimumDate,
  maximumDate,
  disabled = false,
  error = false,
  errorMessage,
  className = '',
  testID,
}: DateRangePickerProps) {
  // 시작 날짜 변경
  const handleStartChange = useCallback(
    (date: Date | null) => {
      // 종료일보다 늦으면 종료일도 변경
      if (date && endDate && date > endDate) {
        onChange({ startDate: date, endDate: date });
      } else {
        onChange({ startDate: date, endDate });
      }
    },
    [endDate, onChange]
  );

  // 종료 날짜 변경
  const handleEndChange = useCallback(
    (date: Date | null) => {
      onChange({ startDate, endDate: date });
    },
    [startDate, onChange]
  );

  return (
    <View className={className} testID={testID}>
      {label && (
        <Text className="mb-2 font-medium text-gray-900 dark:text-white">
          {label}
        </Text>
      )}

      <View className="flex-row items-center space-x-2">
        {/* 시작 날짜 */}
        <View className="flex-1">
          <DatePicker
            value={startDate}
            onChange={handleStartChange}
            placeholder={startPlaceholder}
            minimumDate={minimumDate}
            maximumDate={endDate ?? maximumDate}
            disabled={disabled}
            error={error}
          />
        </View>

        <Text className="text-gray-500 dark:text-gray-400">~</Text>

        {/* 종료 날짜 */}
        <View className="flex-1">
          <DatePicker
            value={endDate}
            onChange={handleEndChange}
            placeholder={endPlaceholder}
            minimumDate={startDate ?? minimumDate}
            maximumDate={maximumDate}
            disabled={disabled}
            error={error}
          />
        </View>
      </View>

      {/* 에러 메시지 */}
      {error && errorMessage && (
        <Text className="mt-2 text-sm text-red-500">{errorMessage}</Text>
      )}
    </View>
  );
});

export default DatePicker;
