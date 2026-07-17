/**
 * WorkConditionSheet — 근무조건 시트 (주문서 고정 공고, S2)
 *
 * @description 주 출근일수 칩(0=협의)·출근시간 휠(TimeWheelPicker embedded overlay)·협의 토글.
 * 레거시 FixedSchedule(ScheduleSection) 시맨틱을 주문서 시트 관례로 재현 — 중첩 Modal 없음(#186/#243).
 * 게시기간 7일 자동 안내를 상단에 노출한다.
 */
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { TimeWheelPicker, type TimeValue } from '@/components/ui/TimeWheelPicker';
import { CheckIcon } from '@/components/icons';

export interface WorkConditionValue {
  daysPerWeek: number;
  startTime?: string;
  isStartTimeNegotiable: boolean;
}
export interface WorkConditionSheetProps {
  visible: boolean;
  value: WorkConditionValue;
  onConfirm: (next: WorkConditionValue) => void;
  onClose: () => void;
}

const DAYS_OPTIONS = [
  { value: 0, label: '협의' },
  { value: 1, label: '1일' },
  { value: 2, label: '2일' },
  { value: 3, label: '3일' },
  { value: 4, label: '4일' },
  { value: 5, label: '5일' },
  { value: 6, label: '6일' },
  { value: 7, label: '7일' },
];
const DEFAULT_START = '19:00';
const toTimeValue = (s?: string): TimeValue => {
  const [hour = 19, minute = 0] = (s ?? DEFAULT_START).split(':').map(Number);
  return { hour, minute };
};
const toStartTime = (t: TimeValue) =>
  `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;

export function WorkConditionSheet({
  visible,
  value,
  onConfirm,
  onClose,
}: WorkConditionSheetProps) {
  const [daysPerWeek, setDaysPerWeek] = useState(value.daysPerWeek);
  const [startTime, setStartTime] = useState<string | undefined>(value.startTime);
  const [negotiable, setNegotiable] = useState(value.isStartTimeNegotiable);
  const [pickerOpen, setPickerOpen] = useState(false);

  const toggleNegotiable = () => {
    setNegotiable((prev) => {
      const next = !prev;
      if (next) setStartTime(undefined); // 협의로 전환 시 시간 초기화(레거시 동일)
      return next;
    });
  };

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="근무조건"
      footer={
        <Button
          onPress={() => {
            onConfirm({
              daysPerWeek,
              isStartTimeNegotiable: negotiable,
              ...(negotiable ? {} : startTime ? { startTime } : {}),
            });
            onClose();
          }}
        >
          확인
        </Button>
      }
      overlay={
        pickerOpen ? (
          <TimeWheelPicker
            visible
            embedded
            title="출근 시간"
            value={toTimeValue(startTime)}
            minuteInterval={5}
            onConfirm={(t) => {
              setStartTime(toStartTime(t));
              setPickerOpen(false);
            }}
            onClose={() => setPickerOpen(false)}
          />
        ) : undefined
      }
    >
      <View className="px-4 pt-3 pb-2 gap-4">
        {/* 게시기간 안내 — 카드 틴트(impeccable §14 border-l 금지) */}
        <View className="rounded-xl bg-surface-card border border-secondary-100 dark:border-surface-overlay px-3.5 py-3">
          <Text className="text-xs font-sans text-content-secondary leading-[1.125rem] dark:leading-5">
            고정 공고는 상시 반복 근무예요. 게시 기간은 7일이며, 만료 후 재등록할 수 있어요.
          </Text>
        </View>

        {/* 주 출근일수 */}
        <View className="gap-2">
          <Text className="text-sm font-sans-medium text-content-secondary">주 출근일수</Text>
          {/* 주 출근일수 칩 라디오 그룹(0=협의~7일 개수 선택, 요일 개별선택 아님 — 설계 확정③) —
              스크린리더 그룹 맥락(RolesSheet radiogroup 관례 동일) */}
          <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
            {DAYS_OPTIONS.map((o) => {
              const selected = daysPerWeek === o.value;
              return (
                <Pressable
                  key={o.value}
                  onPress={() => setDaysPerWeek(o.value)}
                  testID={`work-condition-days-${o.value}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  className={`px-4 py-2 min-h-[44px] justify-center rounded-lg border ${
                    selected
                      ? 'border-primary-500 bg-primary-100 dark:border-primary-400 dark:bg-primary-900/30'
                      : 'border-secondary-200 dark:border-surface-overlay'
                  } active:opacity-80`}
                >
                  <Text
                    className={`text-sm font-sans-medium ${selected ? 'text-primary-600 dark:text-primary-400' : 'text-content-secondary'}`}
                  >
                    {o.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 출근 시간 + 협의 토글 */}
        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-sans-medium text-content-secondary">출근 시간</Text>
            <Pressable
              onPress={toggleNegotiable}
              testID="work-condition-negotiable"
              accessibilityRole="checkbox"
              accessibilityLabel="출근 시간 협의"
              accessibilityState={{ checked: negotiable }}
              className="flex-row items-center min-h-[44px] active:opacity-80"
              hitSlop={8}
            >
              <View
                className={`w-5 h-5 rounded border items-center justify-center mr-1.5 ${negotiable ? 'bg-primary-600 border-primary-600' : 'bg-surface-card border-secondary-300 dark:border-surface-overlay'}`}
              >
                {negotiable && <CheckIcon size={14} color="#FFFFFF" />}
              </View>
              <Text className="text-sm text-content-muted dark:text-secondary-400 font-sans">
                협의
              </Text>
            </Pressable>
          </View>
          {negotiable ? (
            <View className="rounded-xl bg-surface-card border border-secondary-100 dark:border-surface-overlay px-4 py-3">
              <Text className="text-center text-sm text-content-secondary font-sans">
                출근 시간은 협의 후 결정돼요
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={() => setPickerOpen(true)}
              testID="work-condition-time"
              accessibilityRole="button"
              accessibilityLabel={`출근 시간 ${startTime ?? '미설정'} 변경`}
              className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 min-h-[44px] justify-center active:opacity-80"
            >
              <Text className="text-base font-sans-bold text-content-primary">
                출근 {startTime ?? '--:--'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </SheetModal>
  );
}
