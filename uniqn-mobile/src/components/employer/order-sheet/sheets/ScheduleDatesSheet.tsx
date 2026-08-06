/**
 * ScheduleDatesSheet — 주문서 날짜 시트 (DatePickerModal 래핑, S1)
 *
 * @description 그룹 스코프 날짜 선택 + 3지 세그먼트(설계 §S1 D1/Design-H1):
 * ① "모든 날짜 같은 조건"(기본 — 단일 그룹, grouped=false: 지원자는 날짜별 지원, 현행 동등)
 * ② "연속된 날짜는 통째로"(연속 구간별 분할 + grouped=true — 구형 '그룹으로 묶기' 시맨틱:
 *    지원자가 연속 범위를 통째로 지원. 연속쌍 없으면 비활성)
 * ③ "날짜마다 따로"(날짜별 N그룹, grouped=false)
 * 구조는 그대로 두고 문구만 결과 중심으로 고쳤다(2026-08-06) — 라벨=무엇을 고르는지,
 * hint=고르면 어떻게 되는지. ②는 실제 연속 구간 날짜를, ③은 나뉘는 카드 수를 문구에 넣고,
 * 비활성일 때는 사유("붙어 있는 날짜가 없어 고를 수 없어요")를 같은 자리에 말한다.
 * 세그먼트는 **캘린더 위** 고정 슬롯(2일 미만 비활성 — 노출/숨김 전환의 모달 내부 점프 방지,
 * 2차 Design-low). 캘린더 아래에 있으면 선택을 끝낸 뒤 스크롤을 더 내려야 발견되므로 위로 올렸다.
 * showSegment=false(그룹 재편집·추가 모드)면 세그먼트 자체를 렌더하지 않는다(ⓓ 재귀 분할 방지).
 * 분할 실행은 confirm 시 부모(OrderSheetScreen)가 수행 — 시트 세션 내에서는 그룹이 갈라지지
 * 않으므로 E6 병합 확인이 구조적으로 불필요하다(시그니처 분화가 생길 수 없음).
 */
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { DatePickerModal } from '@/components/employer/job-form/modals/DatePickerModal';
import { groupConsecutiveDates, hasGroupableDates } from '@/utils/date';
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

/** 'YYYY-MM-DD' → '8/10'. 문자열만 다뤄 Date 왕복(타임존 밀림)이 없다. */
function toMonthDay(ymd: string): string {
  const [, month, day] = ymd.split('-');
  return `${Number(month)}/${Number(day)}`;
}

/**
 * 연속 2일 이상 구간 라벨 — '8/10~8/11'. 구간이 여럿이면 2개까지 나열하고 나머지는 '외 N구간'.
 * ②가 실제로 무엇을 묶는지 날짜로 보여주기 위한 표시 전용(분할 실행은 부모가 confirm 시 수행).
 */
function consecutiveRunLabels(dates: string[]): string {
  const runs = groupConsecutiveDates(dates).filter((run) => run.length > 1);
  const shown = runs
    .slice(0, 2)
    .map((run) => `${toMonthDay(run[0]!)}~${toMonthDay(run[run.length - 1]!)}`);
  const rest = runs.length - shown.length;
  return rest > 0 ? `${shown.join(', ')} 외 ${rest}구간` : shown.join(', ');
}

/**
 * 세그먼트 문구 — 라벨은 '무엇을 고르는지', hint는 '고르면 어떻게 되는지'(결과)를 말한다.
 * 구 문구는 결과를 감춰 3지선다의 차이가 드러나지 않았다(②의 '하루만 지원 불가', ③의 '카드 N개로 분할').
 * 선택 날짜에 따라 문구가 바뀌므로 상수가 아니라 빌더다 — 비활성 사유까지 hint로 노출한다.
 */
function buildSegments(
  selectedDates: string[]
): { mode: ScheduleSplitMode; label: string; badge?: string; hint: string }[] {
  const count = selectedDates.length;
  const runLabels = consecutiveRunLabels(selectedDates);
  return [
    {
      mode: 'same',
      label: '모든 날짜 같은 조건',
      badge: '기본',
      hint: '지원자가 원하는 날짜만 골라 지원해요 (하루만도 가능)',
    },
    {
      mode: 'grouped',
      label: '연속된 날짜는 통째로',
      hint: runLabels
        ? `${runLabels} 다 나올 사람만 지원해요 (하루만 지원 불가)`
        : '붙어 있는 날짜가 없어 고를 수 없어요',
    },
    {
      mode: 'separate',
      label: '날짜마다 따로',
      hint:
        count > 1
          ? `일정 카드가 ${count}개로 나뉘어요 · 날짜별로 시간·역할·인원을 다르게`
          : '날짜별로 시간·역할·인원을 다르게 정해요',
    },
  ];
}

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
      renderAboveCalendar={
        showSegment
          ? ({ selectedDates }) => {
              const multi = selectedDates.length >= 2;
              const groupable = hasGroupableDates(selectedDates);
              return (
                <View
                  className="mb-2 p-2.5 bg-surface-page dark:bg-surface rounded-lg"
                  accessibilityRole="radiogroup"
                >
                  {/* 헤더는 항상 한 줄 — 안내를 별 줄로 넣으면 2번째 날짜를 고르는 순간
                      캘린더가 한 줄 밀린다(세그먼트가 캘린더 위에 있으므로). */}
                  <Text className="text-xs text-secondary-500 dark:text-secondary-400 mb-1.5 font-sans">
                    {multi
                      ? '여러 날짜, 어떻게 받을까요?'
                      : '여러 날짜, 어떻게 받을까요? (날짜 2개 이상 선택 시)'}
                  </Text>
                  {buildSegments(selectedDates).map(({ mode, label, badge, hint }) => {
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
                        accessibilityLabel={`${label}${badge ? ` (${badge})` : ''}, ${hint}`}
                      >
                        <View
                          className={`w-4 h-4 rounded-full border-2 ${
                            selected
                              ? 'border-primary-500 bg-primary-500'
                              : 'border-secondary-300 dark:border-surface-overlay'
                          }`}
                        />
                        <View className="flex-1">
                          <View className="flex-row items-center gap-1.5">
                            <Text
                              className={`text-sm font-sans-medium ${
                                selected
                                  ? 'text-primary-700 dark:text-primary-300'
                                  : 'text-content-primary'
                              }`}
                            >
                              {label}
                            </Text>
                            {badge && (
                              <Text className="text-[10px] text-secondary-500 dark:text-secondary-400 font-sans">
                                {badge}
                              </Text>
                            )}
                          </View>
                          <Text className="text-[11px] text-content-muted font-sans leading-4 dark:leading-[1.1rem]">
                            {hint}
                          </Text>
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
