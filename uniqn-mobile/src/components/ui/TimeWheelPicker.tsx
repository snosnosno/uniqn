/**
 * UNIQN Mobile - 시간 선택 휠 피커 모달
 *
 * @description iOS 스타일 휠 피커로 시간(시/분)을 선택하는 모달
 * - 네이티브: ScrollView + snap 기반 휠 피커
 * - 웹: FlatList 기반 선택 리스트 (폴백) + Portal로 최상위 렌더링
 * @version 1.2.0
 */

import React, { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  FlatList,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { AlertCircleIcon } from '../icons';
import { isWeb } from '@/utils/platform';

// 웹에서만 react-dom 사용 (Portal용)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ReactDOM = Platform.OS === 'web' ? require('react-dom') : null;

// ============================================================================
// Types
// ============================================================================

export interface TimeValue {
  hour: number;
  minute: number;
}

export interface TimeWheelPickerProps {
  /** 모달 표시 여부 */
  visible: boolean;
  /** 현재 선택된 값 */
  value: TimeValue;
  /** 모달 제목 */
  title?: string;
  /** 최소 시간 (기본: 0) */
  minHour?: number;
  /** 최대 시간 (기본: 47, 24시 이상은 다음날) */
  maxHour?: number;
  /** 분 간격 (기본: 5) */
  minuteInterval?: number;
  /** 확인 콜백 */
  onConfirm: (value: TimeValue) => void;
  /** 닫기 콜백 */
  onClose: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

// ============================================================================
// Web Fallback Component (시/분 분리 선택)
// ============================================================================

function WebTimePicker({
  value,
  title,
  minHour,
  maxHour,
  minuteInterval,
  onConfirm,
  onClose,
}: Omit<TimeWheelPickerProps, 'visible'>) {
  const [selectedHour, setSelectedHour] = useState(value.hour);
  const [selectedMinute, setSelectedMinute] = useState(value.minute);
  const hourListRef = useRef<FlatList>(null);
  const minuteListRef = useRef<FlatList>(null);

  // 분 값을 interval에 맞게 정규화
  const normalizeMinute = useCallback(
    (minute: number) => {
      return Math.round(minute / minuteInterval!) * minuteInterval!;
    },
    [minuteInterval]
  );

  useEffect(() => {
    setSelectedHour(value.hour);
    setSelectedMinute(normalizeMinute(value.minute));
  }, [value, normalizeMinute]);

  // 시간 배열 생성 (0~47)
  const hours = useMemo(
    () => Array.from({ length: maxHour! - minHour! + 1 }, (_, i) => minHour! + i),
    [minHour, maxHour]
  );

  // 분 배열 생성 (interval 단위)
  const minutes = useMemo(
    () => Array.from({ length: 60 / minuteInterval! }, (_, i) => i * minuteInterval!),
    [minuteInterval]
  );

  // 확인
  const handleConfirm = useCallback(() => {
    onConfirm({ hour: selectedHour, minute: selectedMinute });
  }, [selectedHour, selectedMinute, onConfirm]);

  // 다음날 여부
  const isNextDay = selectedHour >= 24;

  // 시간 아이템 렌더링
  const renderHourItem = useCallback(
    ({ item: hour }: { item: number }) => {
      const isSelected = hour === selectedHour;
      const isNextDayHour = hour >= 24;
      return (
        <Pressable
          onPress={() => setSelectedHour(hour)}
          className={`items-center justify-center py-3 mx-1 rounded-lg ${
            isSelected ? 'bg-primary-100 dark:bg-primary-900/50' : ''
          }`}
          style={{ height: ITEM_HEIGHT }}
        >
          <Text
            className={`text-lg ${
              isSelected
                ? 'text-primary-600 dark:text-primary-400 font-bold'
                : 'text-gray-700 dark:text-gray-300'
            }`}
          >
            {hour.toString().padStart(2, '0')}
          </Text>
          {isNextDayHour && isSelected && (
            <Text className="text-xs text-orange-500 dark:text-orange-400">다음날</Text>
          )}
        </Pressable>
      );
    },
    [selectedHour]
  );

  // 분 아이템 렌더링
  const renderMinuteItem = useCallback(
    ({ item: minute }: { item: number }) => {
      const isSelected = minute === selectedMinute;
      return (
        <Pressable
          onPress={() => setSelectedMinute(minute)}
          className={`items-center justify-center py-3 mx-1 rounded-lg ${
            isSelected ? 'bg-primary-100 dark:bg-primary-900/50' : ''
          }`}
          style={{ height: ITEM_HEIGHT }}
        >
          <Text
            className={`text-lg ${
              isSelected
                ? 'text-primary-600 dark:text-primary-400 font-bold'
                : 'text-gray-700 dark:text-gray-300'
            }`}
          >
            {minute.toString().padStart(2, '0')}
          </Text>
        </Pressable>
      );
    },
    [selectedMinute]
  );

  const hourKeyExtractor = useCallback((item: number) => `hour-${item}`, []);
  const minuteKeyExtractor = useCallback((item: number) => `minute-${item}`, []);

  const getHourItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  const getMinuteItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  // 초기 스크롤 위치
  const initialHourIndex = useMemo(() => {
    const idx = hours.indexOf(selectedHour);
    return idx > 2 ? idx - 2 : 0;
  }, [hours, selectedHour]);

  const initialMinuteIndex = useMemo(() => {
    const idx = minutes.indexOf(selectedMinute);
    return idx > 2 ? idx - 2 : 0;
  }, [minutes, selectedMinute]);

  return (
    <View className="bg-white dark:bg-surface rounded-t-2xl">
      {/* 헤더 */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-surface-overlay">
        <Pressable onPress={onClose} className="py-2 px-3 min-w-[60px]">
          <Text className="text-gray-500 dark:text-gray-400 text-base">취소</Text>
        </Pressable>
        <Text className="text-base font-semibold text-gray-900 dark:text-white">{title}</Text>
        <Pressable onPress={handleConfirm} className="py-2 px-3 min-w-[60px] items-end">
          <Text className="text-primary-600 dark:text-primary-400 text-base font-semibold">
            확인
          </Text>
        </Pressable>
      </View>

      {/* 라벨 */}
      <View className="flex-row px-4 pt-3">
        <View className="flex-1 items-center">
          <Text className="text-sm text-gray-500 dark:text-gray-400 font-medium">시간</Text>
        </View>
        <View className="w-8" />
        <View className="flex-1 items-center">
          <Text className="text-sm text-gray-500 dark:text-gray-400 font-medium">분</Text>
        </View>
      </View>

      {/* 시간/분 선택 영역 */}
      <View className="flex-row px-4 py-2" style={{ height: PICKER_HEIGHT }}>
        {/* 시간 리스트 */}
        <View className="flex-1">
          <FlatList
            ref={hourListRef}
            data={hours}
            renderItem={renderHourItem}
            keyExtractor={hourKeyExtractor}
            getItemLayout={getHourItemLayout}
            initialScrollIndex={initialHourIndex}
            showsVerticalScrollIndicator={false}
          />
        </View>

        {/* 구분자 */}
        <View className="w-8 items-center justify-center">
          <Text className="text-2xl font-bold text-gray-900 dark:text-white">:</Text>
        </View>

        {/* 분 리스트 */}
        <View className="flex-1">
          <FlatList
            ref={minuteListRef}
            data={minutes}
            renderItem={renderMinuteItem}
            keyExtractor={minuteKeyExtractor}
            getItemLayout={getMinuteItemLayout}
            initialScrollIndex={initialMinuteIndex}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>

      {/* 다음날 안내 */}
      {isNextDay && (
        <View className="flex-row items-center justify-center px-4 py-2 mx-4 mb-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
          <AlertCircleIcon size={16} color="#F97316" />
          <Text className="ml-2 text-sm text-orange-600 dark:text-orange-400">
            다음날 새벽 {(selectedHour - 24).toString().padStart(2, '0')}:
            {selectedMinute.toString().padStart(2, '0')}
          </Text>
        </View>
      )}

      {/* 하단 여백 */}
      <View className="h-4" />
    </View>
  );
}

// ============================================================================
// Native Wheel Picker Component
// ============================================================================

function NativeWheelPicker({
  value,
  title,
  minHour,
  maxHour,
  minuteInterval,
  onConfirm,
  onClose,
}: Omit<TimeWheelPickerProps, 'visible'>) {
  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);
  const [selectedHour, setSelectedHour] = useState(value.hour);
  const [selectedMinute, setSelectedMinute] = useState(value.minute);

  // 시간 배열 생성 (0~47)
  const hours = useMemo(
    () => Array.from({ length: maxHour! - minHour! + 1 }, (_, i) => minHour! + i),
    [minHour, maxHour]
  );

  // 분 배열 생성 (5분 단위: 0, 5, 10, ... 55)
  const minutes = useMemo(
    () => Array.from({ length: 60 / minuteInterval! }, (_, i) => i * minuteInterval!),
    [minuteInterval]
  );

  // 분 값을 interval에 맞게 정규화
  const normalizeMinute = useCallback(
    (minute: number) => {
      return Math.round(minute / minuteInterval!) * minuteInterval!;
    },
    [minuteInterval]
  );

  // 초기 스크롤 위치 설정
  useEffect(() => {
    const hourIndex = value.hour - minHour!;
    const normalizedMinute = normalizeMinute(value.minute);
    const minuteIndex = normalizedMinute / minuteInterval!;

    setSelectedHour(value.hour);
    setSelectedMinute(normalizedMinute);

    setTimeout(() => {
      hourScrollRef.current?.scrollTo({
        y: hourIndex * ITEM_HEIGHT,
        animated: false,
      });
      minuteScrollRef.current?.scrollTo({
        y: minuteIndex * ITEM_HEIGHT,
        animated: false,
      });
    }, 50);
  }, [value, minHour, minuteInterval, normalizeMinute]);

  // 시간 스크롤 종료 핸들러
  const handleHourScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const index = Math.round(offsetY / ITEM_HEIGHT);
      const clampedIndex = Math.max(0, Math.min(index, hours.length - 1));
      const newHour = minHour! + clampedIndex;
      setSelectedHour(newHour);

      hourScrollRef.current?.scrollTo({
        y: clampedIndex * ITEM_HEIGHT,
        animated: true,
      });
    },
    [minHour, hours.length]
  );

  // 분 스크롤 종료 핸들러
  const handleMinuteScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const index = Math.round(offsetY / ITEM_HEIGHT);
      const clampedIndex = Math.max(0, Math.min(index, minutes.length - 1));
      const newMinute = clampedIndex * minuteInterval!;
      setSelectedMinute(newMinute);

      minuteScrollRef.current?.scrollTo({
        y: clampedIndex * ITEM_HEIGHT,
        animated: true,
      });
    },
    [minutes.length, minuteInterval]
  );

  // 확인 버튼
  const handleConfirm = useCallback(() => {
    onConfirm({ hour: selectedHour, minute: selectedMinute });
  }, [selectedHour, selectedMinute, onConfirm]);

  // 다음날 여부 (24시 이상)
  const isNextDay = selectedHour >= 24;

  return (
    <View className="bg-white dark:bg-surface rounded-t-2xl">
      {/* 헤더 */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-surface-overlay">
        <Pressable onPress={onClose} className="py-2 px-3 min-w-[60px]">
          <Text className="text-gray-500 dark:text-gray-400 text-base">취소</Text>
        </Pressable>
        <Text className="text-base font-semibold text-gray-900 dark:text-white">{title}</Text>
        <Pressable onPress={handleConfirm} className="py-2 px-3 min-w-[60px] items-end">
          <Text className="text-primary-600 dark:text-primary-400 text-base font-semibold">
            확인
          </Text>
        </Pressable>
      </View>

      {/* 휠 피커 영역 */}
      <View
        style={{ height: PICKER_HEIGHT }}
        className="relative overflow-hidden flex-row justify-center items-center"
      >
        {/* 선택 영역 하이라이트 */}
        <View
          className="absolute left-4 right-4 bg-gray-100 dark:bg-surface rounded-lg"
          style={{
            top: ITEM_HEIGHT * 2,
            height: ITEM_HEIGHT,
            pointerEvents: 'none',
          }}
        />

        {/* 시간 휠 */}
        <View className="flex-1" style={{ height: PICKER_HEIGHT }}>
          <ScrollView
            ref={hourScrollRef}
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_HEIGHT}
            decelerationRate="fast"
            onMomentumScrollEnd={handleHourScrollEnd}
            onScrollEndDrag={handleHourScrollEnd}
            contentContainerStyle={{
              paddingTop: ITEM_HEIGHT * 2,
              paddingBottom: ITEM_HEIGHT * 2,
            }}
          >
            {hours.map((hour) => {
              const isSelected = hour === selectedHour;
              const isNextDayHour = hour >= 24;
              return (
                <View
                  key={hour}
                  style={{ height: ITEM_HEIGHT }}
                  className="items-center justify-center"
                >
                  <Text
                    className={`text-xl ${
                      isSelected
                        ? 'font-bold text-gray-900 dark:text-white'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {hour.toString().padStart(2, '0')}
                  </Text>
                  {isNextDayHour && isSelected && (
                    <Text className="text-xs text-orange-500 dark:text-orange-400 -mt-1">
                      다음날
                    </Text>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* 구분자 */}
        <Text className="text-2xl font-bold text-gray-900 dark:text-white mx-2">:</Text>

        {/* 분 휠 */}
        <View className="flex-1" style={{ height: PICKER_HEIGHT }}>
          <ScrollView
            ref={minuteScrollRef}
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_HEIGHT}
            decelerationRate="fast"
            onMomentumScrollEnd={handleMinuteScrollEnd}
            onScrollEndDrag={handleMinuteScrollEnd}
            contentContainerStyle={{
              paddingTop: ITEM_HEIGHT * 2,
              paddingBottom: ITEM_HEIGHT * 2,
            }}
          >
            {minutes.map((minute) => {
              const isSelected = minute === selectedMinute;
              return (
                <View
                  key={minute}
                  style={{ height: ITEM_HEIGHT }}
                  className="items-center justify-center"
                >
                  <Text
                    className={`text-xl ${
                      isSelected
                        ? 'font-bold text-gray-900 dark:text-white'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {minute.toString().padStart(2, '0')}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* 다음날 안내 (24시 이상 선택 시) */}
      {isNextDay && (
        <View className="flex-row items-center justify-center px-4 py-2 mx-4 mb-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
          <AlertCircleIcon size={16} color="#F97316" />
          <Text className="ml-2 text-sm text-orange-600 dark:text-orange-400">
            다음날 새벽 {(selectedHour - 24).toString().padStart(2, '0')}:
            {selectedMinute.toString().padStart(2, '0')}
          </Text>
        </View>
      )}

      {/* 하단 여백 (Safe Area) */}
      <View className="h-8" />
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

// 웹 오버레이 컴포넌트 (Portal로 body에 렌더링)
function WebOverlay({
  visible,
  value,
  title,
  minHour,
  maxHour,
  minuteInterval,
  onConfirm,
  onClose,
}: TimeWheelPickerProps) {
  if (!visible) return null;

  const content = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
      }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <WebTimePicker
          value={value}
          title={title}
          minHour={minHour}
          maxHour={maxHour}
          minuteInterval={minuteInterval}
          onConfirm={onConfirm}
          onClose={onClose}
        />
      </div>
    </div>
  );

  // Portal을 사용해서 document.body에 직접 렌더링
  if (typeof document !== 'undefined' && ReactDOM) {
    return ReactDOM.createPortal(content, document.body);
  }

  return null;
}

export function TimeWheelPicker({
  visible,
  value,
  title = '시간 선택',
  minHour = 0,
  maxHour = 47,
  minuteInterval = 5,
  onConfirm,
  onClose,
}: TimeWheelPickerProps) {
  // 웹에서는 Portal로 body에 직접 렌더링 (z-index 문제 해결)
  if (isWeb) {
    return (
      <WebOverlay
        visible={visible}
        value={value}
        title={title}
        minHour={minHour}
        maxHour={maxHour}
        minuteInterval={minuteInterval}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    );
  }

  // 네이티브에서는 기존 Modal 사용
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/50 justify-end" onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <NativeWheelPicker
            value={value}
            title={title}
            minHour={minHour}
            maxHour={maxHour}
            minuteInterval={minuteInterval}
            onConfirm={onConfirm}
            onClose={onClose}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default TimeWheelPicker;
