/**
 * RolesSheet — 역할 시트 (주문서 일정·모집)
 *
 * @description 역할 칩(라디오) + 기타 직접입력 + 인원 스테퍼로 역할을 추가하고, 추가된 역할을
 * 다역할 목록으로 관리한다(행별 ±1 스테퍼·삭제). 특정 슬롯의 roles 만 편집하며 onConfirm 으로
 * 부모에 흘려보내면 부모가 form.setValue(shouldValidate) 로 zod safeText(customRole XSS·max20) 경계를 태운다.
 * 단일 SheetModal — 중첩 Modal 없음(#186/#243 회피).
 */
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { useThemeStore } from '@/stores/themeStore';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { STAFF_ROLES } from '@/constants/jobPosting';
import { MinusIcon, PlusIcon, TrashIcon } from '@/components/icons';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';

type SlotRoles = OrderSheetValues['timeSlots'][number]['roles'];
type RoleKey = SlotRoles[number]['role'];

export interface RolesSheetProps {
  visible: boolean;
  value: SlotRoles;
  onConfirm: (next: SlotRoles) => void;
  onClose: () => void;
}

const MAX_COUNT = 99;

const roleLabel = (r: SlotRoles[number]) =>
  r.role === 'other'
    ? (r.customRole ?? '기타')
    : (STAFF_ROLES.find((s) => s.key === r.role)?.name ?? r.role);

export function RolesSheet({ visible, value, onConfirm, onClose }: RolesSheetProps) {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const [roles, setRoles] = useState<SlotRoles>(value);
  const [picking, setPicking] = useState<RoleKey>('dealer');
  const [customName, setCustomName] = useState('');
  const [count, setCount] = useState(1);

  const isCustom = picking === 'other';
  const trimmedCustom = customName.trim();
  const addDisabled = isCustom && trimmedCustom.length === 0;

  const addCurrent = () => {
    if (addDisabled) return;
    const entry: SlotRoles[number] = isCustom
      ? { role: 'other', customRole: trimmedCustom, count }
      : { role: picking, count };
    // 동일 역할(기타는 이름까지 동일)이면 교체 — 중복 행 방지
    setRoles((prev) => [
      ...prev.filter((r) => !(r.role === entry.role && r.customRole === entry.customRole)),
      entry,
    ]);
    setCount(1);
    setCustomName('');
  };

  const adjustRow = (i: number, delta: number) =>
    setRoles((prev) =>
      prev.map((x, idx) =>
        idx === i ? { ...x, count: Math.min(MAX_COUNT, Math.max(1, x.count + delta)) } : x
      )
    );

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="어떤 역할이 필요하세요?"
      footer={
        <Button
          onPress={() => {
            onConfirm(roles);
            onClose();
          }}
          disabled={roles.length === 0}
        >
          확인
        </Button>
      }
    >
      <View className="px-4 pt-3 pb-2">
        {/* 역할 선택 칩 (라디오 그룹) */}
        <View className="flex-row flex-wrap gap-2 mb-3" accessibilityRole="radiogroup">
          {STAFF_ROLES.map((r) => {
            const selected = picking === r.key;
            return (
              <Pressable
                key={r.key}
                onPress={() => setPicking(r.key as RoleKey)}
                testID={`order-role-chip-${r.key}`}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={r.name}
                className={`px-3.5 py-2 min-h-[44px] justify-center rounded-full border ${
                  selected
                    ? 'border-primary-500 bg-primary-100 dark:bg-primary-900/30'
                    : 'border-secondary-200 dark:border-surface-overlay'
                } active:opacity-80`}
              >
                <Text
                  className={`text-sm font-sans-medium ${
                    selected ? 'text-primary-600 dark:text-primary-400' : 'text-content-secondary'
                  }`}
                >
                  {r.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 기타 직접입력 */}
        {isCustom && (
          <TextInput
            value={customName}
            onChangeText={setCustomName}
            maxLength={20}
            placeholder="역할 이름 직접 입력 (예: 칩카운터)"
            placeholderTextColor={isDarkMode ? SECONDARY_PALETTE[500] : SECONDARY_PALETTE[400]}
            testID="order-sheet-role-custom"
            className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 mb-3 text-content-primary font-sans"
          />
        )}

        {/* 추가 전 인원 스테퍼 */}
        <View className="flex-row items-center justify-between rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-2 mb-3">
          <Pressable
            onPress={() => setCount((c) => Math.max(1, c - 1))}
            testID="order-role-count-minus"
            className="w-11 h-11 items-center justify-center active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="인원 줄이기"
          >
            <MinusIcon size={18} />
          </Pressable>
          <Text className="text-base font-sans-bold text-content-primary">
            {count}
            <Text className="text-xs text-content-muted font-sans"> 명</Text>
          </Text>
          <Pressable
            onPress={() => setCount((c) => Math.min(MAX_COUNT, c + 1))}
            testID="order-role-count-plus"
            className="w-11 h-11 items-center justify-center active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="인원 늘리기"
          >
            <PlusIcon size={18} />
          </Pressable>
        </View>

        {/* 이 역할 추가 */}
        <Pressable
          onPress={addCurrent}
          disabled={addDisabled}
          testID="order-role-add"
          className={`min-h-[44px] flex-row items-center justify-center gap-1 rounded-xl border border-dashed border-secondary-300 dark:border-surface-overlay px-4 py-3 mb-3 active:opacity-80 ${
            addDisabled ? 'opacity-40' : ''
          }`}
          accessibilityRole="button"
          accessibilityLabel="이 역할 추가"
        >
          <PlusIcon size={16} />
          <Text className="text-sm text-content-secondary font-sans">이 역할 추가</Text>
        </Pressable>

        {/* 추가된 역할 목록 — 행별 ±1 스테퍼·삭제 */}
        {roles.length > 0 && (
          <View className="gap-1.5">
            {roles.map((r, i) => (
              <View
                key={i}
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
                    onPress={() => adjustRow(i, -1)}
                    className="w-11 h-11 items-center justify-center active:opacity-80"
                    accessibilityRole="button"
                    accessibilityLabel={`${roleLabel(r)} 인원 줄이기`}
                  >
                    <MinusIcon size={16} />
                  </Pressable>
                  <Text className="text-sm font-sans-bold text-content-primary w-8 text-center">
                    {r.count}명
                  </Text>
                  <Pressable
                    onPress={() => adjustRow(i, 1)}
                    className="w-11 h-11 items-center justify-center active:opacity-80"
                    accessibilityRole="button"
                    accessibilityLabel={`${roleLabel(r)} 인원 늘리기`}
                  >
                    <PlusIcon size={16} />
                  </Pressable>
                  <Pressable
                    onPress={() => setRoles((prev) => prev.filter((_, idx) => idx !== i))}
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
    </SheetModal>
  );
}
