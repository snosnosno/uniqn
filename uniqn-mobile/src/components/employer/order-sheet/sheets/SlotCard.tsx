/**
 * SlotCard — 슬롯 1개(출근 시간 + 역할)의 아코디언 카드
 *
 * @description 펼침이면 시간 트리거·삭제·RoleCountEditor 를 렌더하고, 접힘이면 한 줄 요약만 렌더한다.
 * 접힘 시 편집기를 아예 마운트하지 않으므로 여러 카드가 있어도 역할 testID 가 충돌하지 않는다.
 * 활성 인덱스는 부모(ScheduleSlotsSheet)가 소유한다 — 이 컴포넌트는 상태를 갖지 않는다.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRightIcon } from '@/components/icons';
import { RoleCountEditor, roleLabel, type SlotRoles } from './RoleCountEditor';

export interface SlotCardProps {
  slot: { startTime: string; roles: SlotRoles };
  index: number;
  expanded: boolean;
  /** 슬롯이 2개 이상일 때만 true — 마지막 슬롯은 삭제 불가 */
  removable: boolean;
  onExpand: () => void;
  onPressTime: () => void;
  onChangeRoles: (next: SlotRoles) => void;
  onRemove: () => void;
}

/** 접힘 요약 — 한글 라벨 사용(raw key "dealer" 노출 금지) */
const summarize = (slot: SlotCardProps['slot']) => {
  const time = slot.startTime || '--:--';
  const roles =
    slot.roles.length > 0
      ? slot.roles.map((r) => `${roleLabel(r)} ${r.count}명`).join(' · ')
      : '역할 미설정';
  return `${time} · ${roles}`;
};

export function SlotCard({
  slot,
  index,
  expanded,
  removable,
  onExpand,
  onPressTime,
  onChangeRoles,
  onRemove,
}: SlotCardProps) {
  if (!expanded) {
    return (
      <Pressable
        onPress={onExpand}
        testID={`order-time-roles-${index}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: false }}
        accessibilityLabel={`${summarize(slot)}, 탭하여 펼치기`}
        className="min-h-[44px] flex-row items-center justify-between rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 active:opacity-80"
      >
        <Text className="flex-1 text-sm font-sans-medium text-content-secondary" numberOfLines={1}>
          {summarize(slot)}
        </Text>
        <ChevronRightIcon size={16} />
      </Pressable>
    );
  }

  return (
    <View
      accessibilityState={{ expanded: true }}
      className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3"
    >
      <View className="flex-row items-center justify-between mb-2">
        <Pressable
          onPress={onPressTime}
          testID={`order-time-start-${index}`}
          accessibilityRole="button"
          accessibilityLabel={`출근 시간 ${slot.startTime || '미설정'} 변경`}
          className="min-h-[44px] justify-center active:opacity-80"
        >
          <Text className="text-base font-sans-bold text-content-primary">
            출근 {slot.startTime || '--:--'}
          </Text>
        </Pressable>
        {removable && (
          <Pressable
            onPress={onRemove}
            hitSlop={8}
            testID={`order-time-remove-${index}`}
            accessibilityRole="button"
            accessibilityLabel={`${index + 1}번째 시간대 삭제`}
            className="min-h-[44px] px-2 justify-center active:opacity-80"
          >
            <Text className="text-sm text-content-muted font-sans">삭제</Text>
          </Pressable>
        )}
      </View>
      <RoleCountEditor roles={slot.roles} onChange={onChangeRoles} />
    </View>
  );
}
