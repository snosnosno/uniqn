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

/**
 * 행 식별자 — 편집 상태(`editing`)의 키.
 * 인덱스는 불안정 식별자다: 행이 삭제/추가되면 같은 인덱스가 다른 역할을 가리키므로
 * "딜러에 입력하던 값"이 그 자리를 승계한 플로어에 커밋될 수 있다.
 * '기타'는 customRole 까지 포함해야 서로 구분된다(orderRowMeta.ts:301 roleKey 와 동일 패턴).
 */
const rowKeyOf = (r: SlotRoles[number]) =>
  r.role === 'other' ? `other:${r.customRole ?? ''}` : r.role;

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

  // 편집 중 raw 문자열 — 중간 상태("1")를 즉시 clamp 하면 두 자리 입력이 불가능해진다.
  // 한 번에 한 입력만 포커스되므로 단일 슬롯으로 충분하다.
  // 식별자는 key(rowKeyOf)와 index 를 **둘 다** 들고 둘 다 일치할 때만 커밋·표시한다 —
  // 두 식별자는 서로 다른 오염을 막으며 상호보완한다.
  //  - key: 배열 shape 이 바뀌어 그 자리를 승계한 *다른 역할*에 값이 커밋되는 것을 막는다.
  //  - index: rowKeyOf 가 같은 값을 내는 중복 행(예: customRole 없는 'other' 2행)에서
  //    뒤 행 onFocus 가 앞 행의 편집 텍스트를 덮어써 *값의 출처*가 오염되는 것을 막는다.
  //    (커밋 대상 행 `i` 는 렌더 클로저라 정확하지만, 값이 다른 행 것이면 결과는 똑같이 오데이터다.)
  const [editing, setEditing] = useState<{ key: string; index: number; text: string } | null>(null);

  /** 커스텀 역할 추가 — 같은 이름이 이미 있으면 기존 행을 유지(중복 행 방지, 현행 시맨틱 승계) */
  const addCustom = () => {
    const name = customName.trim();
    if (!name) return;
    const exists = roles.some((r) => r.role === 'other' && r.customRole === name);
    if (!exists) {
      // 편집 무효화하지 않는다 — 배열 끝 append 는 기존 행의 인덱스도 식별자도 바꾸지 않는다.
      // (무효화하면 `keyboardShouldPersistTaps="handled"` 로 blur 없이 추가할 때 입력값이 증발한다)
      onChange([...roles, { role: 'other', customRole: name, count: MIN_COUNT }]);
    }
    setCustomName('');
    setCustomOpen(false);
  };

  const toggleRole = (key: ToggleRoleKey) => {
    const found = roles.find((r) => r.role === key);
    if (found) {
      // 해제(제거)만 인덱스를 앞당겨 shape 을 바꾼다 → 진행 중 편집 무효화.
      setEditing(null);
      setLastCount((prev) => ({ ...prev, [key]: found.count }));
      onChange(roles.filter((r) => r.role !== key));
      return;
    }
    // 추가는 배열 끝 append — 기존 행의 인덱스·식별자가 그대로이므로 편집을 무효화하지 않는다.
    // 기억한 인원도 clamp 를 태운다 — `??` 는 0 을 통과시키고, 레거시 draft 의
    // 범위 밖 값(150 등)이 zod min(1).max(99) 를 위반한 채 폼으로 흘러든다.
    onChange([...roles, { role: key, count: clampCount(lastCount[key] ?? MIN_COUNT) }]);
  };

  const setCountAt = (i: number, next: number) => {
    const clamped = clampCount(next);
    if (clamped === roles[i]?.count) return; // 경계 탭 no-op — 불필요한 재검증 차단
    onChange(roles.map((r, idx) => (idx === i ? { ...r, count: clamped } : r)));
  };

  /**
   * blur 커밋 — `rowKey`/`i` 는 blur 가 발생한 시점에 그 자리를 차지한 행의 식별자·인덱스다.
   * 편집을 시작한 행과 **둘 중 하나라도** 다르면(포커스 이동·행 삭제·행 부활·중복 키) 커밋하지 않는다.
   * 이때 `editing` 을 비우지 않는 것이 중요하다 — 지금 포커스된 다른 행의 편집이 살아 있다.
   */
  const commitEditing = (i: number, rowKey: string) => {
    if (editing?.key !== rowKey || editing.index !== i) return;
    const parsed = Number.parseInt(editing.text, 10);
    // 빈값·0·NaN 은 직전 값 유지 — 0명 저장 방지(§4.3)
    if (Number.isFinite(parsed) && parsed >= MIN_COUNT) setCountAt(i, parsed);
    setEditing(null);
  };

  const removeAt = (i: number) => {
    setEditing(null); // 배열 shape 변경 → 진행 중 편집 무효화(인덱스 승계 오커밋 차단)
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
          {roles.map((r, i) => {
            const rowKey = rowKeyOf(r);
            return (
              <View
                key={`${rowKey}-${i}`}
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
                  <TextInput
                    value={
                      editing?.key === rowKey && editing.index === i
                        ? editing.text
                        : String(r.count)
                    }
                    onFocus={() => setEditing({ key: rowKey, index: i, text: String(r.count) })}
                    onChangeText={(t) =>
                      setEditing({
                        key: rowKey,
                        index: i,
                        text: t.replace(/[^0-9]/g, '').slice(0, 2),
                      })
                    }
                    onBlur={() => commitEditing(i, rowKey)}
                    keyboardType="number-pad"
                    maxLength={2}
                    selectTextOnFocus
                    testID={`order-role-count-input-${i}`}
                    accessibilityLabel={`${roleLabel(r)} 인원, 숫자 직접 입력`}
                    className="w-10 h-11 text-center text-sm font-sans-bold text-content-primary"
                  />
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
            );
          })}
        </View>
      )}
    </View>
  );
}
