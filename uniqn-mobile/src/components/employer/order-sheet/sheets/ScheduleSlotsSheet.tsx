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
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';

type Slots = OrderSheetValues['scheduleGroups'][number]['timeSlots'];

const DEFAULT_START = '19:00';

const toTimeValue = (s: string): TimeValue => {
  const [hour = 19, minute = 0] = s.split(':').map(Number);
  return { hour, minute };
};
const toStartTime = (t: TimeValue) =>
  `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;

/** 진입 시 펼칠 카드 — 첫 미완성 슬롯(시간 미설정 또는 역할 0개), 없으면 첫 카드(§5) */
const firstIncompleteIndex = (slots: Slots) => {
  const i = slots.findIndex((s) => !s.startTime || s.roles.length === 0);
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
  const [expanded, setExpanded] = useState<number>(() => firstIncompleteIndex(seed));
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  /**
   * 슬롯별 안정 식별자 — SlotCard 의 key 로 쓴다.
   * 배열 인덱스를 key 로 쓰면 **펼친 슬롯을 삭제할 때** 승계 슬롯이 같은 React 인스턴스를
   * 재사용해 RoleCountEditor 의 내부 상태(editing·lastCount·customOpen·customName)를 물려받는다.
   * Task 5 리뷰가 예고한 위험이자 Task 3 시나리오 C 와 같은 결함 클래스다.
   * 안정 id 를 쓰면 삭제된 카드가 통째로 언마운트되고 승계 슬롯은 깨끗한 편집기를 새로 마운트한다.
   */
  const nextIdRef = useRef(seed.length);
  const [slotIds, setSlotIds] = useState<string[]>(() => seed.map((_, i) => `slot-${i}`));

  const updateStart = (i: number, t: TimeValue) =>
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, startTime: toStartTime(t) } : s)));

  const updateRoles = (i: number, roles: SlotRoles) =>
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, roles } : s)));

  const addSlot = () => {
    // roles 깊은복사 — 새 슬롯의 역할 편집이 첫 슬롯 roles 를 참조 변형하는 것을 막는다.
    const next: Slots = [
      ...slots,
      { startTime: '', roles: (slots[0]?.roles ?? []).map((r) => ({ ...r })) },
    ];
    setSlots(next);
    setSlotIds((prev) => [...prev, `slot-${nextIdRef.current++}`]);
    setExpanded(next.length - 1);
  };

  const removeSlot = (i: number) => {
    const next = slots.filter((_, idx) => idx !== i);
    setSlots(next);
    setSlotIds((prev) => prev.filter((_, idx) => idx !== i));
    // `cur > i` 항은 **영구 도달불가**(커버리지 0)라 회귀 테스트가 없다 — SlotCard 가 삭제 버튼을
    // 펼친 카드에만 렌더하므로 removeSlot(i) 는 항상 i === expanded 다. 방어적으로만 남긴다.
    // 반면 else 의 클램프(Math.min)는 도달 가능하다 — 마지막(펼친) 슬롯 삭제 시 남은 카드를
    // 펼치는 경로이고, '마지막(펼친) 슬롯을 삭제하면 남은 슬롯이 펼쳐진다' 테스트가 지킨다.
    setExpanded((cur) => (cur > i ? cur - 1 : Math.min(cur, Math.max(0, next.length - 1))));
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
            value={toTimeValue(slots[pickerIndex]?.startTime ?? DEFAULT_START)}
            minuteInterval={5}
            onConfirm={(t) => {
              updateStart(pickerIndex, t);
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
            expanded={expanded === i}
            removable={slots.length > 1}
            onExpand={() => setExpanded(i)}
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
