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
}

export function ScheduleSlotsSheet({
  visible,
  value,
  onConfirm,
  onClose,
}: ScheduleSlotsSheetProps) {
  const seed: Slots = value.length > 0 ? value : [{ startTime: DEFAULT_START, roles: [] }];
  const [slots, setSlots] = useState<Slots>(seed);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

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
      title="시간 · 역할"
      footer={
        <Button
          onPress={() => {
            onConfirm(slots);
            onClose();
          }}
          disabled={!areSlotsComplete(slots)}
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
      </View>
    </SheetModal>
  );
}
