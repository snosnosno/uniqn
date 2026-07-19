/**
 * RoleCountEditor — 역할·인원 편집기 (공용)
 *
 * @description 날짜형(ScheduleSlotsSheet 슬롯)과 고정(RolesSheet)이 공유하는 controlled 편집기.
 * 일반 역할 5종은 칩 토글(탭=1명 추가, 재탭=해제)이지만 '기타'는 토글하지 않는다 —
 * 이름이 다른 커스텀 역할을 여러 개 담을 수 있어야 하므로 "＋ 직접 입력" 액션으로 분리한다(설계 §4.1).
 * 시트·슬롯·고정 여부를 모르며 roles/onChange 만 받는다.
 */
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { STAFF_ROLES } from '@/constants/jobPosting';
import { MinusIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { useThemeStore } from '@/stores/themeStore';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { roleName } from '../orderRowMeta';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';

export type SlotRoles = OrderSheetValues['scheduleGroups'][number]['timeSlots'][number]['roles'];
type RoleKey = SlotRoles[number]['role'];
type ToggleRoleKey = Exclude<RoleKey, 'other'>;

const MIN_COUNT = 1;
const MAX_COUNT = 99;
const clampCount = (n: number) => Math.min(MAX_COUNT, Math.max(MIN_COUNT, n));

/** 토글 대상 = '기타'를 제외한 5종. '기타'는 직접입력 액션으로 분리(§4.1) */
const TOGGLE_ROLES = STAFF_ROLES.filter((r) => r.key !== 'other');

/**
 * 역할 표시명 — orderRowMeta.roleName(orderRowMeta.ts:297) 재사용.
 * 구 RolesSheet 는 같은 로직을 로컬로 재정의했는데, 그 중복을 여기서 끝낸다.
 */
export const roleLabel = (r: SlotRoles[number]) => roleName(r.role, r.customRole);

export interface RoleCountEditorProps {
  roles: SlotRoles;
  onChange: (next: SlotRoles) => void;
}

export function RoleCountEditor({ roles, onChange }: RoleCountEditorProps) {
  // 칩 해제 시 인원 기억 — 실수로 껐다 켰을 때 "딜러 12명"이 1명으로 리셋되지 않게 한다(§4.2).
  // 폼이 아니라 컴포넌트 로컬 state — 시트를 닫으면 사라진다.
  const [lastCount, setLastCount] = useState<Partial<Record<ToggleRoleKey, number>>>({});

  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');

  /** 커스텀 역할 추가 — 같은 이름이 이미 있으면 기존 행을 유지(중복 행 방지, 현행 시맨틱 승계) */
  const addCustom = () => {
    const name = customName.trim();
    if (!name) return;
    const exists = roles.some((r) => r.role === 'other' && r.customRole === name);
    if (!exists) {
      onChange([...roles, { role: 'other', customRole: name, count: MIN_COUNT }]);
    }
    setCustomName('');
    setCustomOpen(false);
  };

  const toggleRole = (key: ToggleRoleKey) => {
    const found = roles.find((r) => r.role === key);
    if (found) {
      setLastCount((prev) => ({ ...prev, [key]: found.count }));
      onChange(roles.filter((r) => r.role !== key));
      return;
    }
    onChange([...roles, { role: key, count: lastCount[key] ?? MIN_COUNT }]);
  };

  const setCountAt = (i: number, next: number) =>
    onChange(roles.map((r, idx) => (idx === i ? { ...r, count: clampCount(next) } : r)));

  const removeAt = (i: number) => {
    const target = roles[i];
    if (target && target.role !== 'other') {
      setLastCount((prev) => ({ ...prev, [target.role]: target.count }));
    }
    onChange(roles.filter((_, idx) => idx !== i));
  };

  return (
    <View>
      <View className="flex-row flex-wrap gap-2 mb-3">
        {TOGGLE_ROLES.map((r) => {
          const checked = roles.some((x) => x.role === r.key);
          return (
            <Pressable
              key={r.key}
              onPress={() => toggleRole(r.key as ToggleRoleKey)}
              testID={`order-role-chip-${r.key}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={r.name}
              className={`px-3.5 py-2 min-h-[44px] justify-center rounded-full border ${
                checked
                  ? 'border-primary-500 bg-primary-100 dark:bg-primary-900/30'
                  : 'border-secondary-200 dark:border-surface-overlay'
              } active:opacity-80`}
            >
              <Text
                className={`text-sm font-sans-medium ${
                  checked ? 'text-primary-600 dark:text-primary-400' : 'text-content-secondary'
                }`}
              >
                {r.name}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setCustomOpen((v) => !v)}
          testID="order-role-custom-open"
          accessibilityRole="button"
          accessibilityLabel="역할 직접 입력"
          className="px-3.5 py-2 min-h-[44px] justify-center rounded-full border border-dashed border-secondary-300 dark:border-surface-overlay active:opacity-80"
        >
          <Text className="text-sm font-sans-medium text-content-secondary">＋ 직접 입력</Text>
        </Pressable>
      </View>

      {customOpen && (
        <View className="mb-3 gap-2">
          <TextInput
            value={customName}
            onChangeText={setCustomName}
            maxLength={20}
            placeholder="역할 이름 직접 입력 (예: 칩카운터)"
            placeholderTextColor={isDarkMode ? SECONDARY_PALETTE[500] : SECONDARY_PALETTE[400]}
            testID="order-sheet-role-custom"
            className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 text-content-primary font-sans"
          />
          <Pressable
            onPress={addCustom}
            disabled={customName.trim().length === 0}
            testID="order-role-add"
            accessibilityRole="button"
            accessibilityLabel="입력한 역할 추가"
            className={`min-h-[44px] items-center justify-center rounded-xl border border-dashed border-secondary-300 dark:border-surface-overlay px-4 py-3 active:opacity-80 ${
              customName.trim().length === 0 ? 'opacity-40' : ''
            }`}
          >
            <Text className="text-sm text-content-secondary font-sans">이 역할 추가</Text>
          </Pressable>
        </View>
      )}

      {roles.length > 0 && (
        <View className="gap-1.5">
          {roles.map((r, i) => (
            <View
              key={`${r.role}-${r.customRole ?? ''}-${i}`}
              testID={`order-role-item-${i}`}
              className="flex-row items-center justify-between rounded-xl bg-surface-card border border-secondary-100 dark:border-surface-overlay px-4 py-2.5"
            >
              <Text
                className="flex-1 text-sm font-sans-medium text-content-primary"
                numberOfLines={1}
              >
                {roleLabel(r)}
              </Text>
              <View className="flex-row items-center gap-1">
                <Pressable
                  onPress={() => setCountAt(i, r.count - 1)}
                  testID={`order-role-count-minus-${i}`}
                  className="w-11 h-11 items-center justify-center active:opacity-80"
                  accessibilityRole="button"
                  accessibilityLabel={`${roleLabel(r)} 인원 줄이기`}
                >
                  <MinusIcon size={16} />
                </Pressable>
                <Text className="text-sm font-sans-bold text-content-primary w-10 text-center">
                  {r.count}명
                </Text>
                <Pressable
                  onPress={() => setCountAt(i, r.count + 1)}
                  testID={`order-role-count-plus-${i}`}
                  className="w-11 h-11 items-center justify-center active:opacity-80"
                  accessibilityRole="button"
                  accessibilityLabel={`${roleLabel(r)} 인원 늘리기`}
                >
                  <PlusIcon size={16} />
                </Pressable>
                <Pressable
                  onPress={() => removeAt(i)}
                  className="w-11 h-11 items-center justify-center active:opacity-80"
                  accessibilityRole="button"
                  accessibilityLabel={`${roleLabel(r)} 삭제`}
                >
                  <TrashIcon size={16} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
