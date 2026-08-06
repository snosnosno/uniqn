/**
 * ScheduleSlotsSheet — 시간·역할 통합 시트 (주문서 일정·모집)
 *
 * @description 구 TimeSlotsSheet + RolesSheet(슬롯용)를 하나로 합친 시트. 슬롯 카드마다
 * 출근 시간과 역할을 같은 화면에서 편집하므로 시트→시트 전환이 없다 — iOS 중첩 Modal
 * 터치 먹통(#244) 회피용 300ms 지연 스왑이 구조적으로 불필요해졌다.
 * 시간 휠은 여전히 SheetModal 의 overlay 슬롯에 embedded 로 얹는다(중첩 Modal 금지 유효, #186/#243).
 * 슬롯이 2개 이상이면 아코디언 — 활성 카드 하나만 펼친다.
 */
import React, { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { TimeWheelPicker, type TimeValue } from '@/components/ui/TimeWheelPicker';
import { PlusIcon } from '@/components/icons';
import { SlotCard } from './SlotCard';
import type { SlotRoles } from './RoleCountEditor';
import { type OrderSheetValues } from '@/schemas/orderSheet.schema';
import { areSlotsComplete } from '../orderRowMeta';

type Slots = OrderSheetValues['scheduleGroups'][number]['timeSlots'];

const DEFAULT_START = '19:00';

const toTimeValue = (s: string): TimeValue => {
  const [hour = 19, minute = 0] = s.split(':').map(Number);
  return { hour, minute };
};
const toStartTime = (t: TimeValue) =>
  `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;

/** 진입 시 펼칠 카드 — 첫 미완성 슬롯(시간 미설정 또는 역할 0개), 없으면 첫 카드(§5).
 *  시간 미정(isTimeToBeAnnounced)은 완성으로 간주한다. */
const firstIncompleteIndex = (slots: Slots) => {
  const i = slots.findIndex(
    (s) => (!s.startTime && s.isTimeToBeAnnounced !== true) || s.roles.length === 0
  );
  return i >= 0 ? i : 0;
};

export interface ScheduleSlotsSheetProps {
  visible: boolean;
  value: Slots;
  onConfirm: (next: Slots) => void;
  onClose: () => void;
  /**
   * 예외 추출 모드(설계 §3.4·F11) — 이 카드의 날짜들. 넘기면 "적용할 날짜" 다중 선택 행이
   * 뜨고, 확인은 `onConfirmException` 으로 배출된다. **0개 선택으로 열고** 확인을 잠근다:
   * 기본 선택을 깔면 사장이 훑어보다 그대로 확인해 의도치 않은 분리가 생긴다.
   */
  selectableDates?: string[];
  onConfirmException?: (result: { dates: string[]; slots: Slots }) => void;
  /** 일반 모드 하단 진입 링크(F7③) — 조건을 고치러 들어온 자리가 예외를 깨닫는 자리다. */
  onSwitchToException?: () => void;
}

export function ScheduleSlotsSheet({
  visible,
  value,
  onConfirm,
  onClose,
  selectableDates,
  onConfirmException,
  onSwitchToException,
}: ScheduleSlotsSheetProps) {
  const seed: Slots = value.length > 0 ? value : [{ startTime: DEFAULT_START, roles: [] }];
  const [slots, setSlots] = useState<Slots>(seed);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const isExceptionMode = selectableDates !== undefined;
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const toggleDate = (date: string) =>
    setSelectedDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]
    );
  // 배출 순서는 화면 순서(카드 날짜 순)로 고정한다 — 탭한 순서로 내보내면 같은 선택이
  // 다른 배열이 되어 정규화 결과 비교·테스트가 흔들린다.
  const orderedSelection = (selectableDates ?? []).filter((d) => selectedDates.includes(d));
  const canConfirm = areSlotsComplete(slots) && (!isExceptionMode || orderedSelection.length > 0);

  /**
   * 슬롯별 안정 식별자 — SlotCard 의 key 이자 **펼침 대상의 식별자**다.
   * 배열 인덱스를 key 로 쓰면 **펼친 슬롯을 삭제할 때** 승계 슬롯이 같은 React 인스턴스를
   * 재사용해 RoleCountEditor 의 내부 상태(editing·lastCount·customOpen·customName)를 물려받는다.
   * Task 5 리뷰가 예고한 위험이자 Task 3 시나리오 C 와 같은 결함 클래스다.
   * 안정 id 를 쓰면 삭제된 카드가 통째로 언마운트되고 승계 슬롯은 깨끗한 편집기를 새로 마운트한다.
   */
  const nextIdRef = useRef(seed.length);
  const [slotIds, setSlotIds] = useState<string[]>(() => seed.map((_, i) => `slot-${i}`));
  /**
   * 펼침 대상을 인덱스가 아니라 **id** 로 들고 있는 이유:
   * 새 슬롯의 인덱스는 "직전 배열 길이"라서 addSlot 이 클로저의 `slots` 를 읽어야만 알 수 있는데,
   * 그러면 한 배치에서 두 번 호출될 때 slots 만 갱신을 잃고 slotIds 와 길이가 어긋난다.
   * id 는 호출 시점에 이미 확정되므로 세 상태(slots·slotIds·expandedId)가 전부 함수형 갱신으로
   * 같은 배치에서 일관되게 움직인다. 덤으로 삭제 시 인덱스 시프트 보정도 불필요해진다.
   * 초기값은 slotIds 와 같은 `slot-${i}` 규칙을 공유한다.
   */
  const [expandedId, setExpandedId] = useState<string>(() => `slot-${firstIncompleteIndex(seed)}`);

  const updateStart = (i: number, t: TimeValue) =>
    setSlots((prev) =>
      prev.map((s, idx) => {
        if (idx !== i) return s;
        // 시각을 고르면 미정 플래그를 **키째로** 제거한다(optional 계약 — undefined 잔존 금지)
        const { isTimeToBeAnnounced: _tba, ...rest } = s;
        return { ...rest, startTime: toStartTime(t) };
      })
    );

  /** 시간 미정 확정 — startTime 비우고 미정 플래그를 켠다 */
  const setTimeTBA = (i: number) =>
    setSlots((prev) =>
      prev.map((s, idx) =>
        idx === i ? { ...s, startTime: '', isTimeToBeAnnounced: true as const } : s
      )
    );

  const updateRoles = (i: number, roles: SlotRoles) =>
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, roles } : s)));

  const addSlot = () => {
    const id = `slot-${nextIdRef.current++}`;
    // roles 깊은복사 — 새 슬롯의 역할 편집이 첫 슬롯 roles 를 참조 변형하는 것을 막는다.
    setSlots((prev) => [
      ...prev,
      { startTime: '', roles: (prev[0]?.roles ?? []).map((r) => ({ ...r })) },
    ]);
    setSlotIds((prev) => [...prev, id]);
    setExpandedId(id);
  };

  const removeSlot = (i: number) => {
    const removedId = slotIds[i];
    setSlots((prev) => prev.filter((_, idx) => idx !== i));
    setSlotIds((prev) => prev.filter((_, idx) => idx !== i));
    // 펼친 카드를 지웠을 때만 이웃으로 승계한다(뒤 → 없으면 앞). 다른 카드가 펼쳐져 있었다면
    // 배열이 줄어도 그 id 는 그대로 유효하므로 인덱스 시프트 보정 자체가 필요 없다.
    // '마지막(펼친) 슬롯을 삭제하면 남은 슬롯이 펼쳐진다' 테스트가 이 승계를 지킨다.
    setExpandedId((cur) => (cur === removedId ? (slotIds[i + 1] ?? slotIds[i - 1] ?? cur) : cur));
  };

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title={isExceptionMode ? '시간 · 역할 — 일부 날짜만' : '시간 · 역할'}
      footer={
        <Button
          onPress={() => {
            if (isExceptionMode) {
              onConfirmException?.({ dates: orderedSelection, slots });
            } else {
              onConfirm(slots);
            }
            onClose();
          }}
          disabled={!canConfirm}
          testID="order-sheet-slots-confirm"
        >
          확인
        </Button>
      }
      overlay={
        pickerIndex !== null ? (
          <TimeWheelPicker
            visible
            embedded
            title="출근 시간"
            // `??` 가 아니라 `||` — 새 슬롯의 startTime 은 ''(빈 문자열)이라 `??` 를 통과해
            // 휠이 00:00 으로 열린다(구 TimeSlotsSheet 선재 버그). 빈 값도 기본값으로 떨어뜨린다.
            value={toTimeValue(slots[pickerIndex]?.startTime || DEFAULT_START)}
            minuteInterval={15}
            onConfirm={(t) => {
              updateStart(pickerIndex, t);
              setPickerIndex(null);
            }}
            onConfirmTBA={() => {
              setTimeTBA(pickerIndex);
              setPickerIndex(null);
            }}
            onClose={() => setPickerIndex(null)}
          />
        ) : undefined
      }
    >
      <View className="gap-2 px-4 pt-3 pb-2">
        {isExceptionMode ? (
          <View className="mb-1 rounded-xl bg-surface-page px-3.5 py-3 dark:bg-surface">
            <Text className="mb-2 text-xs font-sans-medium text-content-secondary">
              적용할 날짜
            </Text>
            <View className="flex-row flex-wrap gap-1.5">
              {(selectableDates ?? []).map((date) => {
                const selected = selectedDates.includes(date);
                const [, month, day] = date.split('-');
                const label = `${Number(month)}/${Number(day)}`;
                return (
                  <Pressable
                    key={date}
                    onPress={() => toggleDate(date)}
                    className={`min-h-[36px] items-center justify-center rounded-full px-3 py-1.5 active:opacity-80 ${
                      selected
                        ? 'bg-primary-500'
                        : 'bg-surface-card border border-secondary-200 dark:border-surface-overlay'
                    }`}
                    accessibilityRole="button"
                    accessibilityLabel={`${Number(month)}월 ${Number(day)}일${
                      selected ? ', 선택됨' : ''
                    }`}
                    testID={`order-sheet-exception-date-${date}`}
                  >
                    <Text
                      className={
                        selected
                          ? 'text-sm font-sans-medium text-white'
                          : 'text-sm font-sans-medium text-content-primary dark:text-content-primary'
                      }
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {orderedSelection.length === 0 ? (
              <Text className="mt-2 text-[11px] font-sans text-content-muted">
                다르게 할 날짜를 골라주세요
              </Text>
            ) : null}
          </View>
        ) : null}
        {/*
          새벽 근무 날짜 관례(D3) — 시각만 저장하고 종료 시각은 두지 않는 모델이라,
          "밤 22시 시작"과 "새벽 2시 시작"을 날짜로만 구분한다. 사장이 금요일 영업의
          새벽 2시 슬롯을 '금요일'에 적으면 스태프 근무표에는 하루 앞선 날에 뜬다.
          코드로 막을 수 있는 성질이 아니라(둘 다 유효한 입력이다) 관례를 말해 준다.
        */}
        <View className="mb-1 rounded-xl border border-secondary-100 bg-surface-card px-3.5 py-3 dark:border-surface-overlay">
          <Text className="text-xs font-sans leading-[1.125rem] text-content-secondary dark:leading-5">
            새벽에 시작하는 근무는 <Text className="font-sans-bold">실제 출근하는 날짜</Text>로
            등록해 주세요. 예를 들어 금요일 영업의 새벽 2시 근무는 토요일 02:00 이에요.
          </Text>
        </View>
        {slots.map((slot, i) => (
          <SlotCard
            key={slotIds[i]}
            slot={slot}
            index={i}
            expanded={slotIds[i] === expandedId}
            removable={slots.length > 1}
            onExpand={() => setExpandedId(slotIds[i])}
            onPressTime={() => setPickerIndex(i)}
            onChangeRoles={(roles) => updateRoles(i, roles)}
            onRemove={() => removeSlot(i)}
          />
        ))}
        <Pressable
          onPress={addSlot}
          testID="order-time-add-slot"
          accessibilityRole="button"
          accessibilityLabel="시간대 추가"
          className="min-h-[44px] flex-row items-center justify-center gap-1 rounded-xl border border-dashed border-secondary-300 dark:border-surface-overlay px-4 py-3 active:opacity-80"
        >
          <PlusIcon size={16} />
          <Text className="text-sm text-content-secondary font-sans">시간대 추가</Text>
        </Pressable>
        {/* F7③ — 예외 추출 3중 진입로 중 하나. 조건을 고치러 들어온 자리에서 "이 중 며칠만
            다르네"를 깨닫는 경우가 많아, 카드 밖으로 나갔다 다시 들어오게 하지 않는다. */}
        {!isExceptionMode && onSwitchToException ? (
          <Pressable
            onPress={onSwitchToException}
            className="min-h-[44px] items-center justify-center active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="일부 날짜만 다른 조건으로 나누기"
            testID="order-sheet-slots-switch-exception"
          >
            <Text className="text-sm font-sans-medium text-primary-600 dark:text-primary-400">
              일부 날짜만 다르게 할까요?
            </Text>
          </Pressable>
        ) : null}
      </View>
    </SheetModal>
  );
}
