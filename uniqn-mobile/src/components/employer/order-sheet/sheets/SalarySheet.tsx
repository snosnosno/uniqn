/**
 * SalarySheet — 급여 시트 (주문서 급여)
 *
 * @description 급여 타입 세그먼트(시급/일급/월급/협의) + 시급만 ±1,000 스테퍼(그 외 기본값+직접입력),
 * 협의(other)는 금액 없이 { type:'other', amount:0 }로 발행한다. '모든 역할 동일 급여' OFF 시 시간대의
 * 고유 역할별 금액을 입력받으며, 타입은 공통 세그먼트를 따르고 금액만 역할별(2026-07-14 결정).
 * 확정 값은 부모(OrderSheetScreen)로 흘려보내고 부모가 form.setValue(shouldValidate)로 zod 경계
 * (역할별 전수 커버 superRefine 포함)를 태운다. 단일 SheetModal — 중첩 Modal 없음.
 */
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { useThemeStore } from '@/stores/themeStore';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { MinusIcon, PlusIcon } from '@/components/icons';
import { DEFAULT_SALARY_BY_TYPE, HOURLY_STEP } from '@/utils/order-sheet/mappers';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';

type Salary = OrderSheetValues['salary'];
type RoleSalaries = OrderSheetValues['roleSalaries'];
type RoleKey = RoleSalaries[number]['role'];

/** 부모가 timeSlots에서 유도해 전달하는 고유 역할(기타는 customRole 단위) */
export interface UniqueRole {
  role: RoleKey;
  customRole?: string;
  label: string;
}

export interface SalarySheetProps {
  visible: boolean;
  value: Salary;
  useSameSalary: boolean;
  roleSalaries: RoleSalaries;
  uniqueRoles: UniqueRole[];
  onConfirm: (next: { salary: Salary; useSameSalary: boolean; roleSalaries: RoleSalaries }) => void;
  onClose: () => void;
}

const TYPE_LABELS = [
  { type: 'hourly', label: '시급' },
  { type: 'daily', label: '일급' },
  { type: 'monthly', label: '월급' },
  { type: 'other', label: '협의' },
] as const;

const sameRole = (a: { role: RoleKey; customRole?: string }, b: UniqueRole) =>
  a.role === b.role && a.customRole === b.customRole;

export function SalarySheet({
  visible,
  value,
  useSameSalary,
  roleSalaries,
  uniqueRoles,
  onConfirm,
  onClose,
}: SalarySheetProps) {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const placeholderColor = isDarkMode ? SECONDARY_PALETTE[500] : SECONDARY_PALETTE[400];
  const [salary, setSalary] = useState<Salary>(
    value.amount > 0 || value.type === 'other'
      ? value
      : { type: 'hourly', amount: DEFAULT_SALARY_BY_TYPE.hourly }
  );
  const [same, setSame] = useState(useSameSalary);
  const [perRole, setPerRole] = useState<RoleSalaries>(roleSalaries);
  const [directInput, setDirectInput] = useState(false);

  const switchType = (type: Salary['type']) => {
    // 협의(other)는 금액 없음 — { type:'other', amount:0 } (문서 게이트 min(0) 허용 실측)
    setSalary({ type, amount: type === 'other' ? 0 : DEFAULT_SALARY_BY_TYPE[type] });
    setDirectInput(type !== 'hourly' ? false : directInput);
    // 역할별 금액은 유지하되 타입만 공통 세그먼트로 정렬(금액만 역할별 — 2026-07-14 결정)
    setPerRole((prev) =>
      prev.map((p) => ({
        ...p,
        salary: { type, amount: type === 'other' ? 0 : p.salary.amount },
      }))
    );
  };

  const perRoleValid = uniqueRoles.every((u) => {
    const s = perRole.find((p) => sameRole(p, u))?.salary;
    return s !== undefined && (s.type === 'other' || s.amount > 0);
  });
  const confirmDisabled = same
    ? salary.type !== 'other' && salary.amount <= 0
    : uniqueRoles.length === 0 || !perRoleValid;

  const stepHourly = (delta: number) =>
    setSalary((s) => ({ ...s, amount: Math.max(HOURLY_STEP, s.amount + delta) }));

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="급여"
      footer={
        <Button
          onPress={() => {
            onConfirm({ salary, useSameSalary: same, roleSalaries: same ? [] : perRole });
            onClose();
          }}
          disabled={confirmDisabled}
        >
          확인
        </Button>
      }
    >
      <View className="px-4 pt-3 pb-2">
        {/* 급여 타입 세그먼트 (라디오 그룹) */}
        <View
          className="flex-row gap-1 p-1 rounded-xl bg-surface-card border border-secondary-200 dark:border-surface-overlay mb-3"
          accessibilityRole="radiogroup"
        >
          {TYPE_LABELS.map(({ type, label }) => {
            const selected = salary.type === type;
            return (
              <Pressable
                key={type}
                onPress={() => switchType(type)}
                testID={`order-sheet-salary-type-${type}`}
                className={`flex-1 items-center justify-center py-2 min-h-[44px] rounded-lg ${
                  selected
                    ? 'bg-primary-100 dark:bg-primary-900/30 border border-primary-500'
                    : 'active:opacity-80'
                }`}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={label}
              >
                <Text
                  className={`text-sm font-sans-medium ${
                    selected
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-secondary-700 dark:text-secondary-300'
                  }`}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 금액 입력 영역 — 협의/시급 스테퍼/직접 입력 분기 */}
        {salary.type === 'other' ? (
          <View className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 mb-2">
            <Text className="text-sm text-content-secondary font-sans">
              급여는 지원자와 협의로 결정해요 — 금액 없이 등록돼요
            </Text>
          </View>
        ) : salary.type === 'hourly' && !directInput ? (
          <View className="flex-row items-center justify-between rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-2 mb-2">
            <Pressable
              onPress={() => stepHourly(-HOURLY_STEP)}
              className="w-11 h-11 items-center justify-center active:opacity-80"
              testID="order-sheet-salary-minus"
              accessibilityRole="button"
              accessibilityLabel="시급 1,000원 내리기"
            >
              <MinusIcon size={20} />
            </Pressable>
            <Text className="text-lg font-sans-bold text-content-primary">
              {salary.amount.toLocaleString()}
              <Text className="text-xs text-content-muted font-sans"> 원</Text>
            </Text>
            <Pressable
              onPress={() => stepHourly(HOURLY_STEP)}
              className="w-11 h-11 items-center justify-center active:opacity-80"
              testID="order-sheet-salary-plus"
              accessibilityRole="button"
              accessibilityLabel="시급 1,000원 올리기"
            >
              <PlusIcon size={20} />
            </Pressable>
          </View>
        ) : (
          <TextInput
            value={salary.amount > 0 ? String(salary.amount) : ''}
            keyboardType="number-pad"
            onChangeText={(t) =>
              setSalary((s) => ({
                ...s,
                amount: Number.parseInt(t.replace(/[^0-9]/g, ''), 10) || 0,
              }))
            }
            placeholder={`기본값 ${DEFAULT_SALARY_BY_TYPE[
              salary.type as 'hourly' | 'daily' | 'monthly'
            ].toLocaleString()}원`}
            placeholderTextColor={placeholderColor}
            testID="order-sheet-salary-amount"
            className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 mb-2 text-content-primary font-sans"
          />
        )}

        {/* 시급만 스테퍼↔직접입력 전환 */}
        {salary.type === 'hourly' && (
          <Pressable
            onPress={() => setDirectInput((v) => !v)}
            className="mb-3 min-h-[44px] justify-center active:opacity-80"
            accessibilityRole="button"
          >
            <Text className="text-xs text-content-secondary font-sans">
              {directInput ? '스테퍼로 조절 (±1,000원)' : '직접 입력'}
            </Text>
          </Pressable>
        )}

        {/* 모든 역할 동일 급여 토글 */}
        <Pressable
          onPress={() => setSame((v) => !v)}
          testID="order-sheet-salary-same-toggle"
          className={`flex-row items-center gap-2 rounded-xl border px-4 py-3 min-h-[44px] ${
            same
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
              : 'border-secondary-200 dark:border-surface-overlay'
          } active:opacity-80`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: same }}
        >
          <View
            className={`w-5 h-5 rounded-md border ${
              same
                ? 'bg-primary-500 border-primary-500'
                : 'border-secondary-300 dark:border-surface-overlay'
            }`}
          />
          <Text className="text-sm font-sans-medium text-content-primary">모든 역할 동일 급여</Text>
        </Pressable>

        {/* 역할별 급여(동일급여 OFF) — 타입은 공통 세그먼트, 금액만 역할별 */}
        {!same &&
          (uniqueRoles.length === 0 ? (
            <View className="mt-3 rounded-xl border border-dashed border-secondary-200 dark:border-surface-overlay px-4 py-6 items-center">
              <Text className="text-sm text-content-secondary font-sans text-center">
                역할을 먼저 추가해주세요.{'\n'}역할별로 급여를 다르게 정할 수 있어요.
              </Text>
            </View>
          ) : (
            <View className="mt-3 gap-2">
              {uniqueRoles.map((u) => {
                const entry = perRole.find((p) => sameRole(p, u));
                const setRoleAmount = (t: string) => {
                  const amount = Number.parseInt(t.replace(/[^0-9]/g, ''), 10) || 0;
                  setPerRole((prev) => [
                    ...prev.filter((p) => !sameRole(p, u)),
                    {
                      role: u.role,
                      ...(u.customRole !== undefined ? { customRole: u.customRole } : {}),
                      salary: { type: salary.type, amount: salary.type === 'other' ? 0 : amount },
                    },
                  ]);
                };
                return (
                  <View
                    key={`${u.role}:${u.customRole ?? ''}`}
                    testID={`order-sheet-salary-role-${u.role}:${u.customRole ?? ''}`}
                    className="flex-row items-center gap-3 rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-2.5"
                  >
                    <Text
                      className="flex-1 text-sm font-sans-medium text-content-primary"
                      numberOfLines={1}
                    >
                      {u.label}
                    </Text>
                    {salary.type === 'other' ? (
                      <Text className="text-sm text-content-muted font-sans">협의</Text>
                    ) : (
                      <TextInput
                        value={entry && entry.salary.amount > 0 ? String(entry.salary.amount) : ''}
                        onChangeText={setRoleAmount}
                        keyboardType="number-pad"
                        placeholder="금액"
                        placeholderTextColor={placeholderColor}
                        testID={`order-sheet-salary-role-input-${u.role}:${u.customRole ?? ''}`}
                        className="w-28 rounded-lg border border-secondary-200 dark:border-surface-overlay px-2 py-1.5 text-right text-sm text-content-primary font-sans"
                      />
                    )}
                  </View>
                );
              })}
            </View>
          ))}
      </View>
    </SheetModal>
  );
}
