/**
 * TimeSlotsSheet — 출근 시간 시트 (주문서 일정·모집)
 *
 * @description 시간대 목록(다중). 각 슬롯의 출근 시간은 TimeWheelPicker(embedded overlay)로 편집한다 —
 * 중첩 Modal 대신 SheetModal overlay 슬롯에 absoluteFill 로 얹어 iOS 터치 먹통(#186/#243)을 피한다.
 * 슬롯 지속(onConfirm)은 부모가 form.setValue 로 zod 경계를 태우고, 슬롯별 역할 편집(onEditSlotRoles)은
 * 부모에서 이 시트를 닫고 RolesSheet 를 여는 #244 지연 전환을 태운다(직접 스왑 금지).
 */
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { TimeWheelPicker, type TimeValue } from '@/components/ui/TimeWheelPicker';
import { PlusIcon, ChevronRightIcon } from '@/components/icons';
import { roleName } from '../orderRowMeta';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';

type Slots = OrderSheetValues['timeSlots'];

export interface TimeSlotsSheetProps {
  visible: boolean;
  value: Slots;
  onConfirm: (next: Slots) => void;
  onClose: () => void;
  /** 슬롯별 역할 편집 진입 — 부모가 이 시트를 닫고 RolesSheet(slotIndex) 를 #244 지연 전환으로 연다 */
  onEditSlotRoles: (slotIndex: number) => void;
}

const DEFAULT_START = '19:00';

const toTimeValue = (s: string): TimeValue => {
  const [hour = 19, minute = 0] = s.split(':').map(Number);
  return { hour, minute };
};
const toStartTime = (t: TimeValue) =>
  `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;

const rolesSummary = (roles: Slots[number]['roles']) =>
  // rows 요약(orderRowMeta.summarizeRoles)과 동일하게 한글 라벨 사용 — raw key("dealer") 노출 금지.
  roles.map((r) => `${roleName(r.role, r.customRole)} ${r.count}`).join(' · ');

export function TimeSlotsSheet({
  visible,
  value,
  onConfirm,
  onClose,
  onEditSlotRoles,
}: TimeSlotsSheetProps) {
  const [slots, setSlots] = useState<Slots>(
    value.length > 0 ? value : [{ startTime: DEFAULT_START, roles: [] }]
  );
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  const updateStart = (i: number, t: TimeValue) =>
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, startTime: toStartTime(t) } : s)));

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="출근 시간"
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
          <View
            key={i}
            className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3"
          >
            <View className="flex-row items-center justify-between">
              <Pressable
                onPress={() => setPickerIndex(i)}
                className="min-h-[44px] justify-center active:opacity-80"
                testID={`order-time-start-${i}`}
                accessibilityRole="button"
                accessibilityLabel={`출근 시간 ${slot.startTime || '미설정'} 변경`}
              >
                <Text className="text-base font-sans-bold text-content-primary">
                  출근 {slot.startTime || '--:--'}
                </Text>
              </Pressable>
              {slots.length > 1 && (
                <Pressable
                  onPress={() => setSlots((prev) => prev.filter((_, idx) => idx !== i))}
                  className="min-h-[44px] px-2 justify-center active:opacity-80"
                  hitSlop={8}
                  testID={`order-time-remove-${i}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${i + 1}번째 시간대 삭제`}
                >
                  <Text className="text-sm text-content-muted font-sans">삭제</Text>
                </Pressable>
              )}
            </View>
            {/* 역할 편집 진입 — onConfirm(슬롯 지속) 후 onEditSlotRoles(i). 부모가 #244 지연 전환으로 스왑. */}
            <Pressable
              onPress={() => {
                onConfirm(slots);
                onEditSlotRoles(i);
              }}
              className="mt-1 min-h-[44px] flex-row items-center justify-between active:opacity-80"
              testID={`order-time-roles-${i}`}
              accessibilityRole="button"
              accessibilityLabel={`${i + 1}번째 시간대 역할 설정`}
            >
              <Text className="flex-1 text-xs text-content-secondary font-sans">
                {slot.roles.length > 0 ? rolesSummary(slot.roles) : '이 시간대 역할 설정'}
              </Text>
              <ChevronRightIcon size={16} />
            </Pressable>
          </View>
        ))}
        <Pressable
          onPress={() =>
            setSlots((prev) => [...prev, { startTime: '', roles: prev[0]?.roles ?? [] }])
          }
          className="min-h-[44px] flex-row items-center justify-center gap-1 rounded-xl border border-dashed border-secondary-300 dark:border-surface-overlay px-4 py-3 active:opacity-80"
          testID="order-time-add-slot"
          accessibilityRole="button"
          accessibilityLabel="시간대 추가"
        >
          <PlusIcon size={16} />
          <Text className="text-sm text-content-secondary font-sans">시간대 추가</Text>
        </Pressable>
      </View>
    </SheetModal>
  );
}
