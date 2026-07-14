/**
 * SalarySheet — 급여 시트 (주문서 급여)
 *
 * @description 급여 타입 세그먼트(시급/일급/월급/협의)는 공통, 금액만 역할별(2026-07-14 결정).
 * '모든 역할 동일 급여' ON: 시급 ±1,000 스테퍼(그 외 직접입력), 협의는 { type:'other', amount:0 }.
 * OFF(기본 — 설계 §S2): 상단 단일 금액 영역을 숨기고 역할별 행 [라벨 | − 금액 +]을 렌더한다 —
 * 시급이면 스테퍼, 금액 탭 시 해당 행 인라인 직접입력(완료 버튼·빈 blur=이전 값 복원, 2차 Design-H3).
 * 오픈 시 미커버 역할은 기본값(딜러 2만/플로어 3만/기타 2만)으로 시드된다(프리필 안전망).
 * 타입 전환은 사용자 수정 금액 보존 — 전환 전 타입 기본값과 동일한(미수정) 행만 재시드(FIX-3).
 * 확정 값은 부모(OrderSheetScreen)로 흘려보내고 부모가 form.setValue(shouldValidate)로 zod 경계
 * (역할별 전수 커버 superRefine 포함)를 태운다. 단일 SheetModal — 중첩 Modal 없음.
 */
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { useThemeStore } from '@/stores/themeStore';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { CheckIcon, MinusIcon, PlusIcon } from '@/components/icons';
import { MAX_SALARY_AMOUNT } from '@/constants/jobPosting';
import { DEFAULT_SALARY_BY_TYPE, HOURLY_STEP } from '@/utils/order-sheet/mappers';
import { defaultAmountForRole, syncRoleSalariesForRoles } from '@/utils/order-sheet/roleSalaries';
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

const uniqueRoleKey = (u: { role: string; customRole?: string }) =>
  `${u.role}:${u.customRole ?? ''}`;

const clampAmount = (amount: number) => Math.min(MAX_SALARY_AMOUNT, amount);

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
  const [salary, setSalary] = useState<Salary>(() =>
    value.amount > 0 || value.type === 'other'
      ? value
      : { type: 'hourly', amount: DEFAULT_SALARY_BY_TYPE.hourly }
  );
  const [same, setSame] = useState(useSameSalary);
  // 오픈 시 미커버 역할 기본값 시드(프리필 안전망 — 설계 §S2.4). 시드 기준 타입은 초기 세그먼트.
  const [perRole, setPerRole] = useState<RoleSalaries>(() =>
    syncRoleSalariesForRoles(
      uniqueRoles,
      roleSalaries,
      value.amount > 0 || value.type === 'other' ? value.type : 'hourly'
    )
  );
  const [directInput, setDirectInput] = useState(false);
  // 인라인 직접입력 중인 역할 행(uniqueRoleKey) — 행 단위 전환(2차 Design-H3)
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const switchType = (type: Salary['type']) => {
    const prevType = salary.type;
    // 협의(other)는 금액 없음 — { type:'other', amount:0 } (문서 게이트 min(0) 허용 실측)
    setSalary({ type, amount: type === 'other' ? 0 : DEFAULT_SALARY_BY_TYPE[type] });
    setDirectInput(type !== 'hourly' ? false : directInput);
    setEditingKey(null);
    // 사용자 수정 금액 보존(3보이스 합의 T2) — 전환 전 타입의 역할별 기본값과 동일한(=미수정)
    // 행만 새 타입 기본값으로 재시드(FIX-3). 협의는 금액 축이 없어 보존 대상 제외(왕복 0 유지 확정).
    setPerRole((prev) =>
      prev.map((p) => {
        if (type === 'other') return { ...p, salary: { type, amount: 0 } };
        const wasDefault =
          prevType !== 'other' && p.salary.amount === defaultAmountForRole(p.role, prevType);
        return {
          ...p,
          salary: {
            type,
            amount: wasDefault ? defaultAmountForRole(p.role, type) : p.salary.amount,
          },
        };
      })
    );
  };

  const setRoleAmount = (u: UniqueRole, amount: number) => {
    setPerRole((prev) => {
      const exists = prev.some((p) => sameRole(p, u));
      if (exists) {
        return prev.map((p) =>
          sameRole(p, u) ? { ...p, salary: { type: salary.type, amount } } : p
        );
      }
      return [
        ...prev,
        {
          role: u.role,
          ...(u.customRole !== undefined ? { customRole: u.customRole } : {}),
          salary: { type: salary.type, amount },
        },
      ];
    });
  };

  const roleAmount = (u: UniqueRole) => perRole.find((p) => sameRole(p, u))?.salary.amount ?? 0;

  const stepRole = (u: UniqueRole, delta: number) =>
    setRoleAmount(u, clampAmount(Math.max(HOURLY_STEP, roleAmount(u) + delta)));

  const startEditing = (u: UniqueRole) => {
    const amount = roleAmount(u);
    setEditingText(amount > 0 ? String(amount) : '');
    setEditingKey(uniqueRoleKey(u));
  };

  /** 인라인 입력 확정 — 빈/0 입력은 이전 값 복원(0/미정 퇴행 금지, 2차 Design-H3) */
  const commitEditing = (u: UniqueRole) => {
    const parsed = Number.parseInt(editingText.replace(/[^0-9]/g, ''), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      setRoleAmount(u, clampAmount(parsed));
    }
    setEditingKey(null);
  };

  const perRoleValid = uniqueRoles.every((u) => {
    const s = perRole.find((p) => sameRole(p, u))?.salary;
    return s !== undefined && (s.type === 'other' || s.amount > 0);
  });
  const confirmDisabled = same
    ? salary.type !== 'other' && salary.amount <= 0
    : uniqueRoles.length === 0 || !perRoleValid;

  const stepHourly = (delta: number) =>
    setSalary((s) => ({ ...s, amount: clampAmount(Math.max(HOURLY_STEP, s.amount + delta)) }));

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="급여"
      footer={
        <Button
          onPress={() => {
            // 무효 고아 프루닝(리뷰 M-1) — 커버 밖(비표시)이면서 검증 불가(비협의·0원)인 엔트리가
            // 폼 상태에 남으면 zod가 거부하는데 시트에선 보이지도 고칠 수도 없는 dead-end가 된다.
            // 유효 고아(사용자 금액·협의)는 잔류 유지(재추가 시 금액 복원 — 설계 §S2.3).
            const pruned = perRole.filter(
              (p) =>
                uniqueRoles.some((u) => sameRole(p, u)) ||
                p.salary.type === 'other' ||
                p.salary.amount > 0
            );
            onConfirm({ salary, useSameSalary: same, roleSalaries: same ? [] : pruned });
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

        {/* 단일 금액 영역 — 동일급여 ON일 때만(OFF면 숨김 — R4 위반 지점 제거, 설계 §S2.4) */}
        {same &&
          (salary.type === 'other' ? (
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
                  amount: clampAmount(Number.parseInt(t.replace(/[^0-9]/g, ''), 10) || 0),
                }))
              }
              placeholder={`기본값 ${DEFAULT_SALARY_BY_TYPE[
                salary.type as 'hourly' | 'daily' | 'monthly'
              ].toLocaleString()}원`}
              placeholderTextColor={placeholderColor}
              testID="order-sheet-salary-amount"
              className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 mb-2 text-content-primary font-sans"
            />
          ))}

        {/* 시급만 스테퍼↔직접입력 전환 (동일급여 ON 전용) */}
        {same && salary.type === 'hourly' && (
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

        {/* 역할별 급여(동일급여 OFF) — 타입은 공통 세그먼트, 금액만 역할별.
            시급=스테퍼 [라벨 | − 금액 +], 금액 탭=인라인 직접입력(완료 44px·빈 blur 복원),
            일/월급=직접입력, 협의=라벨. 행 높이 고정(전환 레이아웃 점프 방지). */}
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
                const key = uniqueRoleKey(u);
                const amount = roleAmount(u);
                const isEditing = editingKey === key;
                return (
                  <View
                    key={key}
                    testID={`order-sheet-salary-role-${key}`}
                    className="flex-row items-center gap-2 rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-3 py-1 min-h-[52px]"
                  >
                    <Text
                      className="flex-1 text-sm font-sans-medium text-content-primary"
                      numberOfLines={1}
                    >
                      {u.label}
                    </Text>
                    {salary.type === 'other' ? (
                      <Text className="text-sm text-content-muted font-sans">협의</Text>
                    ) : isEditing ? (
                      <>
                        <TextInput
                          value={editingText}
                          onChangeText={setEditingText}
                          keyboardType="number-pad"
                          returnKeyType="done"
                          // 명시적 금액 탭 제스처의 연속 동작 — 화면 마운트 autoFocus(룰 20)와 다른 맥락
                          autoFocus
                          onBlur={() => commitEditing(u)}
                          onSubmitEditing={() => commitEditing(u)}
                          placeholder="금액"
                          placeholderTextColor={placeholderColor}
                          testID={`order-sheet-salary-role-input-${key}`}
                          className="w-28 rounded-lg border border-primary-500 px-2 py-1.5 text-right text-sm text-content-primary font-sans"
                        />
                        <Pressable
                          onPress={() => commitEditing(u)}
                          className="w-11 h-11 items-center justify-center active:opacity-80"
                          testID={`order-sheet-salary-role-done-${key}`}
                          accessibilityRole="button"
                          accessibilityLabel={`${u.label} 금액 입력 완료`}
                        >
                          <CheckIcon size={20} />
                        </Pressable>
                      </>
                    ) : salary.type === 'hourly' ? (
                      <>
                        <Pressable
                          onPress={() => stepRole(u, -HOURLY_STEP)}
                          className="w-11 h-11 items-center justify-center active:opacity-80"
                          testID={`order-sheet-salary-role-minus-${key}`}
                          accessibilityRole="button"
                          accessibilityLabel={`${u.label} 시급 1,000원 내리기`}
                        >
                          <MinusIcon size={18} />
                        </Pressable>
                        <Pressable
                          onPress={() => startEditing(u)}
                          className="min-h-[44px] min-w-[44px] items-center justify-center px-1 active:opacity-80"
                          testID={`order-sheet-salary-role-amount-${key}`}
                          accessibilityRole="button"
                          accessibilityLabel={`${u.label} 시급 ${amount.toLocaleString()}원`}
                          accessibilityHint="탭하여 직접 입력"
                        >
                          <Text
                            className="text-base font-sans-bold text-content-primary"
                            style={{ textDecorationLine: 'underline' }}
                          >
                            {amount.toLocaleString()}
                            <Text className="text-xs text-content-muted font-sans"> 원</Text>
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => stepRole(u, HOURLY_STEP)}
                          className="w-11 h-11 items-center justify-center active:opacity-80"
                          testID={`order-sheet-salary-role-plus-${key}`}
                          accessibilityRole="button"
                          accessibilityLabel={`${u.label} 시급 1,000원 올리기`}
                        >
                          <PlusIcon size={18} />
                        </Pressable>
                      </>
                    ) : (
                      <TextInput
                        value={amount > 0 ? String(amount) : ''}
                        onChangeText={(t) =>
                          setRoleAmount(
                            u,
                            clampAmount(Number.parseInt(t.replace(/[^0-9]/g, ''), 10) || 0)
                          )
                        }
                        keyboardType="number-pad"
                        placeholder="금액"
                        placeholderTextColor={placeholderColor}
                        testID={`order-sheet-salary-role-input-${key}`}
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
