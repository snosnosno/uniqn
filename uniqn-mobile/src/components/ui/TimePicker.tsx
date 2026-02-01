/**
 * UNIQN Mobile - TimePicker 컴포넌트
 *
 * @description 30분 간격 시간 선택 (모달 + 스크롤 리스트)
 * @version 2.0.0
 */

import React, { memo, useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import { XMarkIcon, CheckIcon, ChevronDownIcon } from '@/components/icons';

// ============================================================================
// Types
// ============================================================================

export interface TimePickerProps {
  /** 현재 선택된 시간 (HH:mm 형식) */
  value: string;
  /** 시간 변경 콜백 */
  onChange: (time: string) => void;
  /** 레이블 */
  label?: string;
  /** 플레이스홀더 */
  placeholder?: string;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 에러 상태 */
  error?: boolean;
  /** 에러 메시지 */
  errorMessage?: string;
  /** 시작 시간 (기본: 00:00) */
  minTime?: string;
  /** 종료 시간 (기본: 23:30) */
  maxTime?: string;
  /** 간격 (분, 기본: 30) */
  interval?: number;
  /** 추가 스타일 클래스 */
  className?: string;
  /** 테스트 ID */
  testID?: string;
}

interface TimeSlot {
  value: string;
  label: string;
}

// ============================================================================
// Utils
// ============================================================================

function generateTimeSlots(
  minTime: string,
  maxTime: string,
  interval: number
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const [minHour, minMinute] = minTime.split(':').map(Number);
  const [maxHour, maxMinute] = maxTime.split(':').map(Number);

  let currentMinutes = minHour * 60 + minMinute;
  const endMinutes = maxHour * 60 + maxMinute;

  while (currentMinutes <= endMinutes) {
    const hours = Math.floor(currentMinutes / 60);
    const minutes = currentMinutes % 60;
    const value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    const label = formatTimeDisplay(value);
    slots.push({ value, label });
    currentMinutes += interval;
  }

  return slots;
}

function formatTimeDisplay(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${period} ${displayHour}:${minutes}`;
}

// ============================================================================
// TimeSlotItem Component
// ============================================================================

const TimeSlotItem = memo(function TimeSlotItem({
  item,
  isSelected,
  onSelect,
}: {
  item: TimeSlot;
  isSelected: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <Pressable
      onPress={() => onSelect(item.value)}
      className={`
        flex-row items-center justify-between px-4 py-4
        border-b border-gray-100 dark:border-surface-overlay
        ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}
      `}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${item.label} 선택`}
    >
      <Text
        className={`text-base ${
          isSelected
            ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
            : 'text-gray-900 dark:text-white'
        }`}
      >
        {item.label}
      </Text>
      {isSelected && (
        <CheckIcon size={20} color="#4F46E5" />
      )}
    </Pressable>
  );
});

// ============================================================================
// TimePicker Component
// ============================================================================

export const TimePicker = memo(function TimePicker({
  value,
  onChange,
  label,
  placeholder = '시간을 선택하세요',
  disabled = false,
  error = false,
  errorMessage,
  minTime = '00:00',
  maxTime = '23:30',
  interval = 30,
  className = '',
  testID,
}: TimePickerProps) {
  const [showModal, setShowModal] = useState(false);

  // 시간 슬롯 생성
  const timeSlots = useMemo(
    () => generateTimeSlots(minTime, maxTime, interval),
    [minTime, maxTime, interval]
  );

  // 현재 선택된 인덱스 (초기 스크롤 위치용)
  const selectedIndex = useMemo(() => {
    const index = timeSlots.findIndex((slot) => slot.value === value);
    return Math.max(0, index);
  }, [timeSlots, value]);

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

  // 시간 선택
  const handleSelect = useCallback(
    (time: string) => {
      onChange(time);
      closeModal();
    },
    [onChange, closeModal]
  );

  // 표시할 텍스트
  const displayText = value ? formatTimeDisplay(value) : placeholder;

  // 입력 필드 스타일
  const getInputStyle = () => {
    const base = 'flex-row items-center px-4 py-3 rounded-lg border-2';
    if (disabled) {
      return `${base} bg-gray-100 dark:bg-surface border-gray-200 dark:border-surface-overlay`;
    }
    if (error) {
      return `${base} bg-white dark:bg-surface border-red-500`;
    }
    return `${base} bg-white dark:bg-surface border-gray-300 dark:border-surface-overlay`;
  };

  // FlatList renderItem
  const renderItem = useCallback(
    ({ item }: { item: TimeSlot }) => (
      <TimeSlotItem
        item={item}
        isSelected={item.value === value}
        onSelect={handleSelect}
      />
    ),
    [value, handleSelect]
  );

  // FlatList keyExtractor
  const keyExtractor = useCallback((item: TimeSlot) => item.value, []);

  // FlatList getItemLayout (최적화)
  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: 56, // py-4 (16px * 2) + text height (~24px)
      offset: 56 * index,
      index,
    }),
    []
  );

  return (
    <View className={className} testID={testID}>
      {/* 레이블 */}
      {label && (
        <Text className="mb-2 font-medium text-gray-900 dark:text-white">
          {label}
        </Text>
      )}

      {/* 트리거 버튼 */}
      <Pressable
        onPress={openModal}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label ?? '시간 선택'}
        accessibilityState={{ disabled }}
        accessibilityHint="탭하여 시간을 선택하세요"
        className={getInputStyle()}
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
        <ChevronDownIcon
          size={20}
          color={disabled ? '#9CA3AF' : '#6B7280'}
        />
      </Pressable>

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
        onDismiss={closeModal}
        accessibilityViewIsModal
      >
        <View className="flex-1 justify-end">
          {/* 백드롭 - 별도 레이어 (button 중첩 방지) */}
          <Pressable
            onPress={closeModal}
            className="absolute inset-0 bg-black/50"
            accessibilityRole="button"
            accessibilityLabel="모달 닫기"
            accessibilityHint="탭하여 시간 선택을 취소하세요"
          />

          {/* 모달 컨텐츠 - 백드롭과 형제 관계 */}
          <View className="bg-white dark:bg-surface rounded-t-2xl max-h-[70%]">
            {/* 헤더 */}
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-surface-overlay">
              <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                출근 시간 선택
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

            {/* 시간 리스트 */}
            <FlatList
              data={timeSlots}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              getItemLayout={getItemLayout}
              initialScrollIndex={selectedIndex > 2 ? selectedIndex - 2 : 0}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 34 : 16 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
});

// ============================================================================
// TimePickerGrid (deprecated - 호환성 유지용)
// ============================================================================

export interface TimePickerGridProps extends TimePickerProps {
  /** @deprecated 사용되지 않음 */
  columns?: number;
}

/**
 * @deprecated TimePicker를 사용하세요
 */
export const TimePickerGrid = TimePicker;

export default TimePicker;
