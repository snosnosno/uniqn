/**
 * UNIQN Mobile - 숫자 선택 휠 피커 모달
 *
 * @description iOS 스타일 휠 피커로 숫자를 선택하는 모달
 * @version 1.0.0
 */

import React, { useCallback, useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';

// ============================================================================
// Types
// ============================================================================

export interface NumberPickerModalProps {
  /** 모달 표시 여부 */
  visible: boolean;
  /** 현재 선택된 값 */
  value: number;
  /** 최소값 (기본: 1) */
  min?: number;
  /** 최대값 (기본: 200) */
  max?: number;
  /** 모달 제목 */
  title?: string;
  /** 확인 콜백 */
  onConfirm: (value: number) => void;
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
// Component
// ============================================================================

export function NumberPickerModal({
  visible,
  value,
  min = 1,
  max = 200,
  title = '인원 선택',
  onConfirm,
  onClose,
}: NumberPickerModalProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const [selectedValue, setSelectedValue] = useState(value);

  // 숫자 배열 생성
  const numbers = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  // 초기 스크롤 위치 설정
  useEffect(() => {
    if (visible && scrollViewRef.current) {
      const index = value - min;
      const offset = index * ITEM_HEIGHT;
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: offset, animated: false });
      }, 50);
      setSelectedValue(value);
    }
  }, [visible, value, min]);

  // 스크롤 종료 시 가장 가까운 아이템으로 스냅
  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const index = Math.round(offsetY / ITEM_HEIGHT);
      const clampedIndex = Math.max(0, Math.min(index, numbers.length - 1));
      const newValue = min + clampedIndex;
      setSelectedValue(newValue);

      // 정확한 위치로 스냅
      scrollViewRef.current?.scrollTo({
        y: clampedIndex * ITEM_HEIGHT,
        animated: true,
      });
    },
    [min, numbers.length]
  );

  // 확인 버튼
  const handleConfirm = useCallback(() => {
    onConfirm(selectedValue);
  }, [selectedValue, onConfirm]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/50 justify-end"
        onPress={onClose}
      >
        <Pressable
          className="bg-white dark:bg-gray-800 rounded-t-2xl"
          onPress={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <Pressable onPress={onClose} className="py-2 px-3">
              <Text className="text-gray-500 dark:text-gray-400 text-base">
                취소
              </Text>
            </Pressable>
            <Text className="text-base font-semibold text-gray-900 dark:text-white">
              {title}
            </Text>
            <Pressable onPress={handleConfirm} className="py-2 px-3">
              <Text className="text-blue-600 dark:text-blue-400 text-base font-semibold">
                확인
              </Text>
            </Pressable>
          </View>

          {/* 휠 피커 */}
          <View
            style={{ height: PICKER_HEIGHT }}
            className="relative overflow-hidden"
          >
            {/* 선택 영역 하이라이트 */}
            <View
              className="absolute left-4 right-4 bg-gray-100 dark:bg-gray-700 rounded-lg"
              style={{
                top: ITEM_HEIGHT * 2,
                height: ITEM_HEIGHT,
                pointerEvents: 'none',
              }}
            />

            {/* 상단/하단 페이드 효과 */}
            <View
              className="absolute top-0 left-0 right-0 z-10"
              style={{ height: ITEM_HEIGHT * 2, pointerEvents: 'none' }}
            >
              <View className="flex-1 bg-gradient-to-b from-white dark:from-gray-800" />
            </View>
            <View
              className="absolute bottom-0 left-0 right-0 z-10"
              style={{ height: ITEM_HEIGHT * 2, pointerEvents: 'none' }}
            >
              <View className="flex-1 bg-gradient-to-t from-white dark:from-gray-800" />
            </View>

            <ScrollView
              ref={scrollViewRef}
              showsVerticalScrollIndicator={false}
              snapToInterval={ITEM_HEIGHT}
              decelerationRate="fast"
              onMomentumScrollEnd={handleScrollEnd}
              onScrollEndDrag={handleScrollEnd}
              contentContainerStyle={{
                paddingTop: ITEM_HEIGHT * 2,
                paddingBottom: ITEM_HEIGHT * 2,
              }}
            >
              {numbers.map((num) => {
                const isSelected = num === selectedValue;
                return (
                  <View
                    key={num}
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
                      {num}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>

          {/* 하단 여백 (Safe Area) */}
          <View className="h-8" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
