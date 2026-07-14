/**
 * ScheduleDatesSheet — 주문서 날짜 시트 (DatePickerModal 래핑, S1)
 *
 * @description 그룹 스코프 날짜 선택 + 3지 세그먼트(설계 §S1 D1/Design-H1):
 * ① "모든 날짜 같은 조건"(기본 — 단일 그룹, grouped=false: 지원자는 날짜별 지원, 현행 동등)
 * ② "연속 날짜 묶음 지원"(연속 구간별 분할 + grouped=true — 구형 '그룹으로 묶기' 시맨틱:
 *    지원자가 연속 범위를 통째로 지원. 연속쌍 없으면 비활성)
 * ③ "날짜마다 따로"(날짜별 N그룹, grouped=false)
 * 세그먼트는 고정 슬롯(2일 미만 비활성 — 노출/숨김 전환의 모달 내부 점프 방지, 2차 Design-low).
 * showSegment=false(그룹 재편집·추가 모드)면 세그먼트 자체를 렌더하지 않는다(ⓓ 재귀 분할 방지).
 * 분할 실행은 confirm 시 부모(OrderSheetScreen)가 수행 — 시트 세션 내에서는 그룹이 갈라지지
 * 않으므로 E6 병합 확인이 구조적으로 불필요하다(시그니처 분화가 생길 수 없음).
 */
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { DatePickerModal } from '@/components/employer/job-form/modals/DatePickerModal';
import { hasGroupableDates } from '@/utils/date';
import type { PostingType } from '@/types/jobPosting';

export type ScheduleSplitMode = 'same' | 'grouped' | 'separate';

export interface ScheduleDatesSheetProps {
  visible: boolean;
  postingType: PostingType;
  /** 이 그룹의 기존 날짜(재선택·해제 가능 시드) */
  initialSelectedDates: string[];
  /** 타 그룹 날짜 합집합 — 선택 불가 + 전역 상한(remainingSlots) 자동 유지 */
  existingDates: string[];
  /** 단일 그룹(전체 일정) 편집일 때만 true — 재편집/추가 모드는 숨김(ⓓ) */
  showSegment: boolean;
  /** 세그먼트 초기값(ⓐ 폼 상태 역산 — grouped=true 그룹 재진입 시 ② 유지, 침묵 해제 차단) */
  initialSegment: ScheduleSplitMode;
  onConfirm: (result: { dates: string[]; segment: ScheduleSplitMode }) => void;
  onClose: () => void;
}

const SEGMENTS: { mode: ScheduleSplitMode; label: string; hint: string }[] = [
  { mode: 'same', label: '모든 날짜 같은 조건', hint: '지원자는 날짜별로 지원해요' },
  { mode: 'grouped', label: '연속 날짜 묶음 지원', hint: '연속 구간을 통째로 지원받아요' },
  { mode: 'separate', label: '날짜마다 따로', hint: '날짜별로 시간·역할을 따로 정해요' },
];

export function ScheduleDatesSheet({
  visible,
  postingType,
  initialSelectedDates,
  existingDates,
  showSegment,
  initialSegment,
  onConfirm,
  onClose,
}: ScheduleDatesSheetProps) {
  const [segment, setSegment] = useState<ScheduleSplitMode>(initialSegment);

  return (
    <DatePickerModal
      visible={visible}
      onClose={onClose}
      postingType={postingType}
      existingDates={existingDates}
      initialSelectedDates={initialSelectedDates}
      onSelectDates={(dates) => {
        // 비활성 세그먼트의 raw 상태가 흘러가 의도치 않은 분할이 되지 않게 유효값으로 클램프
        // (리뷰 M-1 — 예: grouped 재진입 후 비연속으로 변경하면 ②는 disabled인데 state는 잔존).
        const multi = dates.length >= 2;
        const effective: ScheduleSplitMode =
          !showSegment || !multi || (segment === 'grouped' && !hasGroupableDates(dates))
            ? 'same'
            : segment;
        onConfirm({ dates, segment: effective });
      }}
      renderBottomAccessory={
        showSegment
          ? ({ selectedDates }) => {
              const multi = selectedDates.length >= 2;
              const groupable = hasGroupableDates(selectedDates);
              return (
                <View
                  className="mb-2 p-2.5 bg-surface-page dark:bg-surface rounded-lg"
                  accessibilityRole="radiogroup"
                >
                  <Text className="text-xs text-secondary-500 dark:text-secondary-400 mb-1.5 font-sans">
                    여러 날짜는 어떻게 모집할까요?
                  </Text>
                  {SEGMENTS.map(({ mode, label, hint }) => {
                    const disabled = !multi || (mode === 'grouped' && !groupable);
                    const selected = segment === mode && !disabled;
                    return (
                      <Pressable
                        key={mode}
                        onPress={() => setSegment(mode)}
                        disabled={disabled}
                        testID={`order-sheet-dates-segment-${mode}`}
                        className={`flex-row items-center gap-2 rounded-lg px-2 py-2 min-h-[44px] ${
                          selected ? 'bg-primary-100 dark:bg-primary-900/30' : ''
                        } ${disabled ? 'opacity-40' : 'active:opacity-80'}`}
                        accessibilityRole="radio"
                        accessibilityState={{ selected, disabled }}
                        accessibilityLabel={`${label}, ${hint}`}
                      >
                        <View
                          className={`w-4 h-4 rounded-full border-2 ${
                            selected
                              ? 'border-primary-500 bg-primary-500'
                              : 'border-secondary-300 dark:border-surface-overlay'
                          }`}
                        />
                        <View className="flex-1">
                          <Text
                            className={`text-sm font-sans-medium ${
                              selected
                                ? 'text-primary-700 dark:text-primary-300'
                                : 'text-content-primary'
                            }`}
                          >
                            {label}
                          </Text>
                          <Text className="text-[11px] text-content-muted font-sans">{hint}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              );
            }
          : undefined
      }
    />
  );
}
