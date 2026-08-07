/**
 * UNIQN Mobile - 날짜 선택 모달
 *
 * @description 캘린더 UI를 통한 날짜 선택 모달 (다중 선택 지원)
 * @version 5.0.0 - 전 일정 스코프 어휘 + 빈 선택 확정
 *
 * 🔑 **스코프는 "추가"가 아니라 "최종 집합"이다.** 프로덕션 소비자는 `ScheduleDatesSheet`
 *    하나이고(= 주문서 전 일정 스코프), 담긴 선택이 그대로 결과가 된다. 그래서 확인 라벨은
 *    'N개 추가'가 아니라 'N일 저장'이고, 칩을 해제하는 것은 삭제다.
 *    additive 시절의 `existingDates`(선택 불가 잠금 + '이미 추가된 날짜' 안내)는 그 소비자가
 *    항상 빈 배열을 넘겨 **죽은 회로**였으므로 제거했다 — 상한은 선택 개수로만 관리한다.
 *
 * 주요 기능:
 * - CalendarPicker 캘린더 UI로 날짜 선택
 * - 다중 날짜 선택 지원 (담긴 집합이 곧 결과)
 * - 타입별 제약사항 표시 (regular/urgent: 1개, tournament: 30개)
 * - 빈 선택 확정 지원 — 날짜가 있었을 때만 파괴 확인
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
import { confirmAction } from '@/utils/confirmAction';
import type { PostingType } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface DatePickerModalProps {
  /** 모달 표시 여부 */
  visible: boolean;
  /** 모달 닫기 콜백 */
  onClose: () => void;
  /** 날짜 선택 콜백 — 담긴 집합이 그대로 결과다(빈 배열 = 일정 비우기) */
  onSelectDates: (dates: string[]) => void;
  /** 공고 타입 */
  postingType: PostingType;
  /**
   * 초기 선택 상태 시드 — 전달되면 이 날짜들이 selectedDates 로 시드되어 재선택·해제 가능.
   * 주문서(order-sheet)가 기존 날짜를 재편집할 때 넘긴다. 미전달 시 빈 배열로 시작한다.
   *
   * 🔑 이 값이 **비어 있었는지**가 빈 확정의 파괴성을 가른다 — 원래 없던 것을 비우는 건
   *    파괴가 아니므로 확인을 묻지 않는다.
   */
  initialSelectedDates?: string[];
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
  initialSelectedDates,
}: DatePickerModalProps) {
  const { addToast } = useToastStore();
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  // 다중 선택을 위한 상태 (Date 배열) — initialSelectedDates 가 있으면 시드(재선택·해제 가능)
  const [selectedDates, setSelectedDates] = useState<Date[]>(() =>
    (initialSelectedDates ?? []).map(parseYmdLocal).filter((d): d is Date => d !== null)
  );

  // 타입별 제약사항 — 전 일정 스코프라 상한은 선택 개수 그 자체에 걸린다
  const constraints = DATE_CONSTRAINTS[postingType];
  const maxDates = constraints.maxDates;
  // 시드가 비어 있었다면 지울 것이 없다 — 빈 확정이 파괴가 아니다
  const hadInitialDates = (initialSelectedDates?.length ?? 0) > 0;

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
      if (dates.length > maxDates) {
        addToast({
          type: 'warning',
          message: `최대 ${maxDates}개까지 선택할 수 있습니다`,
        });
        return;
      }
      setSelectedDates(dates);
    },
    [maxDates, addToast]
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

  /**
   * 확인 버튼 — 담긴 집합을 그대로 확정한다.
   *
   * 🔑 빈 확정을 막지 않는다. `applyDateSelection`(@/utils/order-sheet/scheduleCardEdits)이
   *    이미 빈 집합을 정의해 뒀다(카드 1개면 조건 보존·날짜만 비움, 다수면 첫 카드 조건을
   *    승계하고 나머지를 removedCards 로 고지). 여기서 막으면 **일정을 되돌릴 길이 사라진다** —
   *    카드가 1개면 삭제 X 도 없어 빈 상태로 갈 방법이 아예 없었다.
   *    대신 원래 날짜가 있었을 때만 파괴 확인을 받는다(없던 것을 비우는 건 파괴가 아니다).
   */
  const commitDates = useCallback(
    (dates: Date[]) => {
      // YYYY-MM-DD 형식으로 변환 + 날짜순 정렬
      const dateStrings = dates.map((date) => format(date, 'yyyy-MM-dd')).sort();
      onSelectDates(dateStrings);
      setSelectedDates([]);
      onClose();
    },
    [onSelectDates, onClose]
  );

  const handleConfirm = useCallback(() => {
    if (selectedDates.length === 0 && hadInitialDates) {
      confirmAction({
        title: '일정을 모두 비울까요?',
        message:
          '담겨 있던 날짜가 전부 사라지고, 그 날짜에만 걸려 있던 조건 카드도 함께 사라집니다.',
        confirmText: '일정 비우기',
        destructive: true,
        onConfirm: () => commitDates([]),
      });
      return;
    }

    commitDates(selectedDates);
  }, [selectedDates, hadInitialDates, commitDates]);

  // 모달 닫기 처리
  const handleClose = useCallback(() => {
    setSelectedDates([]);
    onClose();
  }, [onClose]);

  // 선택된 날짜 정렬 (표시용)
  const sortedSelectedDates = useMemo(() => {
    return [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
  }, [selectedDates]);

  const confirmLabel =
    selectedDates.length > 0
      ? `${selectedDates.length}일 저장`
      : hadInitialDates
        ? '일정 비우기'
        : '일정 저장';

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
      {/* 라벨은 결과를 말한다(v1 룰 11·12) — 담긴 집합이 곧 저장될 일정이고,
          0개는 파괴적이므로 '비우기'로 예고한다. 단 원래 비어 있었으면 지울 것이 없다. */}
      <Pressable
        onPress={handleConfirm}
        className="flex-1 py-2.5 rounded-md bg-primary-600"
        accessibilityRole="button"
        accessibilityLabel={confirmLabel}
        testID="job-posting-date-confirm-button"
      >
        <Text className="text-content-onGold text-center font-sans-semibold">{confirmLabel}</Text>
      </Pressable>
    </View>
  );

  return (
    <Modal visible={visible} onClose={handleClose} title="날짜 선택" size="lg" footer={footer}>
      {/* 선택 현황 + 상한 안내 (한 블록 통합) — 개수 정보가 두 블록에 흩어져 중복이었다.
          전 일정 스코프라 '담긴 개수'와 '상한' 두 수치면 충분하다. */}
      <View className="mb-2 p-2.5 bg-surface-page dark:bg-surface rounded-lg">
        <View className="flex-row justify-between items-center mb-1.5">
          <View className="flex-row items-center gap-1.5 flex-1">
            <Text className="text-sm text-content-primary dark:text-content-primary font-sans-medium">
              선택한 날짜 {selectedDates.length}개
            </Text>
            <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
              {`최대 ${maxDates}개까지`}
            </Text>
          </View>
          {selectedDates.length > 0 && (
            <Pressable onPress={handleClearAll} accessibilityLabel="전체 해제">
              <Text className="text-xs text-error-500 dark:text-error-400 font-sans">
                전체 해제
              </Text>
            </Pressable>
          )}
        </View>

        {postingType === 'urgent' && (
          <Text className="text-xs text-primary-600 dark:text-primary-400 mb-1.5 font-sans">
            급구 공고는 오늘부터 7일 이내만 선택할 수 있습니다
          </Text>
        )}

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
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          maxSelections={maxDates}
        />
      </View>
    </Modal>
  );
}
