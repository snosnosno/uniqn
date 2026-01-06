/**
 * UNIQN Mobile - DatePicker 컴포넌트
 *
 * @description 접근성 지원 날짜 선택 컴포넌트
 * @version 1.0.0
 */

import React, { memo, useState, useCallback } from 'react';
import { View, Text, Pressable, Platform, Modal as RNModal } from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarIcon, XMarkIcon } from '@/components/icons';

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
  /** 선택 모드 */
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
  dateFormat = 'yyyy년 MM월 dd일',
  mode = 'date',
  className = '',
  testID,
}: DatePickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  // Android에서 임시 날짜 저장용
  const [tempDate, setTempDate] = useState<Date>(value ?? new Date());

  // 포맷에 따른 표시 문자열
  const getDisplayFormat = useCallback(() => {
    if (mode === 'time') return 'HH:mm';
    if (mode === 'datetime') return 'yyyy년 MM월 dd일 HH:mm';
    return dateFormat;
  }, [mode, dateFormat]);

  // 표시할 텍스트
  const displayText = value
    ? format(value, getDisplayFormat(), { locale: ko })
    : placeholder;

  // 피커 열기
  const openPicker = useCallback(() => {
    if (!disabled) {
      setTempDate(value ?? new Date());
      setShowPicker(true);
    }
  }, [disabled, value]);

  // 피커 닫기
  const closePicker = useCallback(() => {
    setShowPicker(false);
  }, []);

  // 날짜 선택 핸들러
  const handleChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        // Android: dismissed 또는 set 이벤트
        setShowPicker(false);
        if (event.type === 'set' && selectedDate) {
          onChange(selectedDate);
        }
      } else {
        // iOS: 실시간 업데이트
        if (selectedDate) {
          setTempDate(selectedDate);
        }
      }
    },
    [onChange]
  );

  // iOS 확인 버튼
  const handleConfirm = useCallback(() => {
    onChange(tempDate);
    closePicker();
  }, [tempDate, onChange, closePicker]);

  // 날짜 초기화
  const handleClear = useCallback(() => {
    onChange(null);
  }, [onChange]);

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

  // 텍스트 스타일
  const getTextStyle = () => {
    if (disabled) {
      return 'text-gray-400 dark:text-gray-500';
    }
    if (!value) {
      return 'text-gray-400 dark:text-gray-500';
    }
    return 'text-gray-900 dark:text-white';
  };

  return (
    <View className={className} testID={testID}>
      {/* 레이블 */}
      {label && (
        <Text className="mb-2 font-medium text-gray-900 dark:text-white">
          {label}
        </Text>
      )}

      {/* 입력 필드 */}
      <Pressable
        onPress={openPicker}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label ?? '날짜 선택'}
        accessibilityState={{ disabled }}
        accessibilityHint="탭하여 날짜를 선택하세요"
        className={getInputStyle()}
      >
        {/* 캘린더 아이콘 */}
        <CalendarIcon
          size={20}
          color={disabled ? '#9CA3AF' : '#6B7280'}
        />

        {/* 날짜 텍스트 */}
        <Text className={`flex-1 ml-3 text-base ${getTextStyle()}`}>
          {displayText}
        </Text>

        {/* 초기화 버튼 */}
        {value && !disabled && (
          <Pressable
            onPress={handleClear}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="날짜 초기화"
          >
            <XMarkIcon size={20} color="#9CA3AF" />
          </Pressable>
        )}
      </Pressable>

      {/* 에러 메시지 */}
      {error && errorMessage && (
        <Text className="mt-2 text-sm text-red-500">{errorMessage}</Text>
      )}

      {/* iOS: 모달로 표시 */}
      {Platform.OS === 'ios' && showPicker && (
        <RNModal
          visible={showPicker}
          transparent
          animationType="slide"
          onRequestClose={closePicker}
        >
          <View className="flex-1 justify-end bg-black/50">
            <View className="bg-white dark:bg-gray-800 rounded-t-2xl">
              {/* 헤더 */}
              <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <Pressable onPress={closePicker}>
                  <Text className="text-base text-gray-500 dark:text-gray-400">
                    취소
                  </Text>
                </Pressable>
                <Text className="text-base font-semibold text-gray-900 dark:text-white">
                  {label ?? '날짜 선택'}
                </Text>
                <Pressable onPress={handleConfirm}>
                  <Text className="text-base font-semibold text-indigo-600 dark:text-indigo-400">
                    확인
                  </Text>
                </Pressable>
              </View>

              {/* 피커 */}
              <DateTimePicker
                value={tempDate}
                mode={mode}
                display="spinner"
                onChange={handleChange}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                locale="ko-KR"
                textColor={Platform.OS === 'ios' ? undefined : '#1F2937'}
              />
            </View>
          </View>
        </RNModal>
      )}

      {/* Android: 인라인 표시 */}
      {Platform.OS === 'android' && showPicker && (
        <DateTimePicker
          value={tempDate}
          mode={mode}
          display="default"
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}
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
