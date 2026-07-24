/**
 * SlotCard — 슬롯 1개(출근 시간 + 역할)의 아코디언 카드
 *
 * @description 펼침이면 시간 트리거·삭제·RoleCountEditor 를 렌더하고, 접힘이면 한 줄 요약만 렌더한다.
 * 접힘 시 편집기를 아예 마운트하지 않으므로 여러 카드가 있어도 역할 testID 가 충돌하지 않는다.
 * 활성 인덱스는 부모(ScheduleSlotsSheet)가 소유한다 — 펼침 여부 상태는 갖지 않는다.
 *
 * ⚠️ 펼침/접힘은 반드시 **분리된 두 반환문**으로 유지한다. 애니메이션을 붙인다고 두 분기를
 * 한 트리로 합치고 본문 display 를 토글하면 접힘 시에도 RoleCountEditor 가 마운트된 채
 * 남아 (1) testID 다중 매치 (2) 슬롯 간 편집 state 누수가 생긴다(테스트 3건이 이를 잡는다).
 */
import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { ChevronRightIcon } from '@/components/icons';
import { RoleCountEditor, roleLabel, type SlotRoles } from './RoleCountEditor';

export interface SlotCardProps {
  slot: { startTime: string; isTimeToBeAnnounced?: true; roles: SlotRoles };
  index: number;
  expanded: boolean;
  /** 슬롯이 2개 이상일 때만 true — 마지막 슬롯은 삭제 불가 */
  removable: boolean;
  onExpand: () => void;
  onPressTime: () => void;
  onChangeRoles: (next: SlotRoles) => void;
  onRemove: () => void;
}

/** 시간 표기 — 미정 슬롯은 '미정'(접힘·펼침·a11y 공용) */
const timeLabel = (slot: SlotCardProps['slot'], fallback: string) =>
  slot.isTimeToBeAnnounced === true ? '미정' : slot.startTime || fallback;

/** 접힘 요약 — 한글 라벨 사용(raw key "dealer" 노출 금지) */
const summarize = (slot: SlotCardProps['slot']) => {
  const time = timeLabel(slot, '--:--');
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
  // 동작 줄이기 — 프로젝트 기존 패턴(Skeleton.tsx:68, OfflineStatusBar.tsx:69) 승계.
  // ON 이면 진입/종료 애니메이션 없이 즉시 전환한다.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    return () => {
      mounted = false;
    };
  }, []);

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
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(300)}
      exiting={reduceMotion ? undefined : FadeOut.duration(225)}
      accessibilityState={{ expanded: true }}
      className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3"
    >
      <View className="flex-row items-center justify-between mb-2">
        <Pressable
          onPress={onPressTime}
          testID={`order-time-start-${index}`}
          accessibilityRole="button"
          accessibilityLabel={`출근 시간 ${timeLabel(slot, '미설정')} 변경`}
          className="min-h-[44px] justify-center active:opacity-80"
        >
          <Text className="text-base font-sans-bold text-content-primary">
            출근 {timeLabel(slot, '--:--')}
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
    </Animated.View>
  );
}
