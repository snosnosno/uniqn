/**
 * UNIQN Mobile - 날짜 선택 모달
 *
 * @description 캘린더 UI를 통한 날짜 선택 모달 (다중 선택 지원)
 * @version 4.0.0 - 다중 선택 모드 추가
 *
 * 주요 기능:
 * - CalendarPicker 캘린더 UI로 날짜 선택
 * - 다중 날짜 선택 지원 (한 번에 여러 날짜 추가)
 * - 타입별 제약사항 표시 (regular/urgent: 1개, tournament: 30개)
 * - 중복 날짜 검사 (이미 추가된 날짜 표시)
 * - 긴급 공고 7일 이내 제한
 * - 과거 날짜 선택 불가
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { PRIMARY_COLORS } from '@/constants/colors';
import { format, addDays } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { Modal } from '@/components/ui/Modal';
import { CalendarPicker } from '@/components/ui/CalendarPicker';
import { useToastStore } from '@/stores/toastStore';
import { useThemeStore } from '@/stores/themeStore';
import { DATE_CONSTRAINTS } from '@/constants';
import { XMarkIcon } from '@/components/icons';
import type { PostingType } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface DatePickerModalProps {
  /** 모달 표시 여부 */
  visible: boolean;
  /** 모달 닫기 콜백 */
  onClose: () => void;
  /** 날짜 선택 콜백 (다중 날짜) */
  onSelectDates: (dates: string[]) => void;
  /** 공고 타입 */
  postingType: PostingType;
  /** 이미 선택된 날짜 목록 (선택 불가·취소선 표시) */
  existingDates: string[];
  /**
   * 초기 선택 상태 시드 (additive) — 전달되면 이 날짜들이 selectedDates 로 시드되어 재선택·해제 가능.
   * 주문서(order-sheet)가 기존 날짜 재편집 시 사용한다(existingDates 로 넘기면 재선택 불가·데드엔드).
   * 미전달 시 빈 배열로 시작(기존 호출부 무회귀). remainingSlots 계산은 existingDates 기준 그대로.
   */
  initialSelectedDates?: string[];
  /**
   * 캘린더 아래 액세서리 슬롯(S1 — 주문서 3지 세그먼트). 현재 선택 날짜를 받아 렌더한다.
   * 미전달 시 렌더 없음(기존 호출부 무회귀).
   */
  renderBottomAccessory?: (ctx: { selectedDates: string[] }) => React.ReactNode;
}

/** 'YYYY-MM-DD' → 로컬 자정 Date. CalendarPicker 의 isSameDay·format(yyyy-MM-dd) 왕복과 정합. */
function parseYmdLocal(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

// ============================================================================
// Component
// ============================================================================

export function DatePickerModal({
  visible,
  onClose,
  onSelectDates,
  postingType,
  existingDates,
  initialSelectedDates,
  renderBottomAccessory,
}: DatePickerModalProps) {
  const { addToast } = useToastStore();
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  // 다중 선택을 위한 상태 (Date 배열) — initialSelectedDates 가 있으면 시드(재선택·해제 가능)
  const [selectedDates, setSelectedDates] = useState<Date[]>(() =>
    (initialSelectedDates ?? []).map(parseYmdLocal).filter((d): d is Date => d !== null)
  );

  // 타입별 제약사항
  const constraints = DATE_CONSTRAINTS[postingType];
  // 추가 가능한 남은 개수
  const remainingSlots = constraints.maxDates - existingDates.length;
  const canAddMore = remainingSlots > 0;

  // 최소/최대 날짜 계산
  const { minimumDate, maximumDate } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 최소 날짜: 오늘
    const minDate = today;

    // 최대 날짜: 긴급 공고는 7일 이내
    let maxDate: Date | undefined;
    if (postingType === 'urgent') {
      maxDate = addDays(today, 7);
    }

    return { minimumDate: minDate, maximumDate: maxDate };
  }, [postingType]);

  // 캘린더에서 날짜 선택/해제
  const handleMultiSelectChange = useCallback(
    (dates: Date[]) => {
      // 최대 선택 개수 확인
      if (dates.length > remainingSlots) {
        addToast({
          type: 'warning',
          message: `최대 ${remainingSlots}개까지 선택할 수 있습니다`,
        });
        return;
      }
      setSelectedDates(dates);
    },
    [remainingSlots, addToast]
  );

  // 선택된 날짜 개별 제거
  const handleRemoveDate = useCallback((dateToRemove: Date) => {
    setSelectedDates((prev) =>
      prev.filter((d) => format(d, 'yyyy-MM-dd') !== format(dateToRemove, 'yyyy-MM-dd'))
    );
  }, []);

  // 전체 선택 해제
  const handleClearAll = useCallback(() => {
    setSelectedDates([]);
  }, []);

  // 확인 버튼
  const handleConfirm = useCallback(() => {
    if (selectedDates.length === 0) {
      addToast({ type: 'error', message: '날짜를 선택해주세요' });
      return;
    }

    // YYYY-MM-DD 형식으로 변환
    const dateStrings = selectedDates.map((date) => format(date, 'yyyy-MM-dd')).sort(); // 날짜순 정렬

    // 선택 완료
    onSelectDates(dateStrings);
    setSelectedDates([]);
    onClose();
  }, [selectedDates, onSelectDates, onClose, addToast]);

  // 모달 닫기 처리
  const handleClose = useCallback(() => {
    setSelectedDates([]);
    onClose();
  }, [onClose]);

  // 선택된 날짜 정렬 (표시용)
  const sortedSelectedDates = useMemo(() => {
    return [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
  }, [selectedDates]);

  const footer = (
    <View className="flex-row gap-3">
      <Pressable
        onPress={handleClose}
        className="flex-1 bg-secondary-200 dark:bg-surface-elevated py-2.5 rounded-md"
        accessibilityRole="button"
        accessibilityLabel="취소"
        testID="job-posting-date-cancel-button"
      >
        <Text className="text-content-secondary dark:text-secondary-200 text-center font-sans-medium">
          취소
        </Text>
      </Pressable>
      <Pressable
        onPress={handleConfirm}
        disabled={!canAddMore || selectedDates.length === 0}
        className={`flex-1 py-2.5 rounded-md ${
          canAddMore && selectedDates.length > 0
            ? 'bg-primary-600'
            : 'bg-secondary-300 dark:bg-surface-elevated opacity-50'
        }`}
        accessibilityRole="button"
        accessibilityLabel="확인"
        testID="job-posting-date-confirm-button"
      >
        <Text className="text-content-onGold text-center font-sans-semibold">
          {selectedDates.length > 0 ? `${selectedDates.length}개 추가` : '확인'}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <Modal visible={visible} onClose={handleClose} title="날짜 선택" size="lg" footer={footer}>
      {/* 제약사항 안내 */}
      <View className="mb-2 p-2.5 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
        <Text className="text-sm text-primary-700 dark:text-primary-300 font-sans">
          최대 {constraints.maxDates}개 추가 가능 (현재: {existingDates.length}개, 남은 슬롯:{' '}
          {remainingSlots}개)
        </Text>
        {postingType === 'urgent' && (
          <Text className="text-xs text-primary-600 dark:text-primary-400 mt-0.5 font-sans">
            급구 공고는 오늘부터 7일 이내만 선택할 수 있습니다
          </Text>
        )}
      </View>

      {/* 선택된 날짜 목록 */}
      <View className="mb-2 p-2.5 bg-surface-page dark:bg-surface rounded-lg">
        <View className="flex-row justify-between items-center mb-1.5">
          <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
            선택한 날짜 ({selectedDates.length}개)
          </Text>
          {selectedDates.length > 0 && (
            <Pressable onPress={handleClearAll} accessibilityLabel="전체 해제">
              <Text className="text-xs text-error-500 dark:text-error-400 font-sans">
                전체 해제
              </Text>
            </Pressable>
          )}
        </View>

        {selectedDates.length === 0 ? (
          <Text className="text-content-placeholder font-sans">캘린더에서 날짜를 선택하세요</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            {sortedSelectedDates.map((date) => (
              <View
                key={date.toISOString()}
                className="flex-row items-center bg-primary-100 dark:bg-primary-900/50 rounded-sm px-3 py-1.5 mr-2"
              >
                <Text className="text-sm text-primary-800 dark:text-primary-200 mr-1 font-sans">
                  {format(date, 'M/d (EEE)', { locale: ko })}
                </Text>
                <Pressable
                  onPress={() => handleRemoveDate(date)}
                  hitSlop={8}
                  accessibilityLabel={`${format(date, 'M월 d일')} 선택 해제`}
                >
                  <XMarkIcon
                    size={14}
                    color={isDarkMode ? PRIMARY_COLORS[300] : PRIMARY_COLORS[700]}
                  />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* 캘린더 */}
      <View className="mb-2">
        <CalendarPicker
          multiSelect
          selectedDates={selectedDates}
          onMultiSelectChange={handleMultiSelectChange}
          disabledDates={existingDates}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          maxSelections={remainingSlots}
        />
      </View>

      {/* 하단 액세서리(주문서 3지 세그먼트 등) — 선택 날짜에 반응 */}
      {renderBottomAccessory
        ? renderBottomAccessory({
            selectedDates: sortedSelectedDates.map((d) => format(d, 'yyyy-MM-dd')),
          })
        : null}

      {/* 이미 추가된 날짜 안내 */}
      {existingDates.length > 0 && (
        <View className="mb-2 p-2.5 bg-surface-page dark:bg-surface rounded-lg">
          <Text className="text-xs text-secondary-500 dark:text-secondary-400 mb-1 font-sans">
            이미 추가된 날짜 ({existingDates.length}개) - 취소선 표시
          </Text>
          <Text className="text-sm text-content-muted dark:text-secondary-300 font-sans">
            {existingDates.slice(0, 5).join(', ')}
            {existingDates.length > 5 && ` 외 ${existingDates.length - 5}개`}
          </Text>
        </View>
      )}
    </Modal>
  );
}
