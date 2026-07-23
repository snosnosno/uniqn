/**
 * RoleSalaryField — 지점 역할 단가 입력 프리미티브 (JIT 급여 설계 §B, 3표면 공용)
 *
 * AddSlotSheet JIT 인라인 / VenueSettingsSheet 행 편집 / 지점 정산 배지 시트가 공유한다.
 * 타입 세그먼트는 시급/일급/월급 3종 — '협의' 없음(자동 계산 목적상 amount:0 은 폴백과 같은 오답).
 * 시급은 ±1,000 스테퍼 + 직접입력, 일/월급은 직접입력. 금액은 MAX_SALARY_AMOUNT 클램프.
 * SalarySheet(주문서) 행 패턴의 축소판 — 여기서는 단일 역할 1행만 다룬다.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { MinusIcon, PlusIcon } from '@/components/icons';
import {
  DEFAULT_ROLE_HOURLY,
  DEFAULT_ROLE_HOURLY_FALLBACK,
  DEFAULT_SALARY_BY_TYPE,
  MAX_SALARY_AMOUNT,
} from '@/constants/jobPosting';
import { HOURLY_STEP } from '@/utils/order-sheet/mappers';

export type VenueSalaryDraft = { type: 'hourly' | 'daily' | 'monthly'; amount: number };

const TYPE_LABELS = [
  { type: 'hourly', label: '시급' },
  { type: 'daily', label: '일급' },
  { type: 'monthly', label: '월급' },
] as const;

/** 역할별 초기 드래프트 — 시급 + 역할 차등 기본단가(주문서 프리필과 동일 상수). */
export function defaultVenueSalaryDraft(role: string): VenueSalaryDraft {
  return { type: 'hourly', amount: DEFAULT_ROLE_HOURLY[role] ?? DEFAULT_ROLE_HOURLY_FALLBACK };
}

const clamp = (amount: number) => Math.max(0, Math.min(MAX_SALARY_AMOUNT, amount));

export interface RoleSalaryFieldProps {
  roleLabel: string;
  value: VenueSalaryDraft;
  onChange: (next: VenueSalaryDraft) => void;
  onDismiss?: () => void;
  caption?: string;
}

export function RoleSalaryField({
  roleLabel,
  value,
  onChange,
  onDismiss,
  caption,
}: RoleSalaryFieldProps) {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState('');

  const handleType = useCallback(
    (type: VenueSalaryDraft['type']) => () => {
      if (type === value.type) return;
      onChange({ type, amount: DEFAULT_SALARY_BY_TYPE[type] });
    },
    [value.type, onChange]
  );

  const step = useCallback(
    (dir: 1 | -1) => () => onChange({ ...value, amount: clamp(value.amount + dir * HOURLY_STEP) }),
    [value, onChange]
  );

  const commitDirect = useCallback(() => {
    const parsed = parseInt(draftText.replace(/[^0-9]/g, ''), 10);
    if (!Number.isNaN(parsed)) onChange({ ...value, amount: clamp(parsed) });
    setEditing(false);
  }, [draftText, value, onChange]);

  return (
    <View className="gap-2 rounded-md border border-secondary-200 bg-surface-page p-3 dark:border-surface-overlay dark:bg-surface-elevated">
      <Text className="text-sm font-sans-medium text-content-primary">
        {caption ?? `${roleLabel} 단가 미설정 — 지금 입력하면 이후 자동으로 적용돼요`}
      </Text>

      {/* 급여 타입 세그먼트 (협의 없음) */}
      <View className="flex-row gap-1 rounded-lg bg-surface-card p-1 dark:bg-surface">
        {TYPE_LABELS.map(({ type, label }) => (
          <Pressable
            key={type}
            onPress={handleType(type)}
            accessibilityRole="tab"
            accessibilityState={{ selected: value.type === type }}
            className={`flex-1 items-center rounded-md py-2 active:opacity-80 ${
              value.type === type ? 'bg-primary-500 dark:bg-primary-600' : ''
            }`}
          >
            <Text
              className={`text-sm font-sans-medium ${
                value.type === type ? 'text-white' : 'text-content-secondary'
              }`}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* 금액 — 시급은 스테퍼, 금액 탭 시 직접입력 */}
      <View className="flex-row items-center justify-between">
        {value.type === 'hourly' ? (
          <Pressable
            onPress={step(-1)}
            accessibilityRole="button"
            accessibilityLabel="금액 내리기"
            hitSlop={10}
            className="h-11 w-11 items-center justify-center rounded-md bg-surface-card dark:bg-surface"
          >
            <MinusIcon size={18} color={SECONDARY_PALETTE[isDarkMode ? 400 : 500]} />
          </Pressable>
        ) : (
          <View className="w-11" />
        )}

        {editing ? (
          <TextInput
            value={draftText}
            onChangeText={setDraftText}
            onBlur={commitDirect}
            onSubmitEditing={commitDirect}
            keyboardType="number-pad"
            returnKeyType="done"
            accessibilityLabel="금액 직접 입력"
            className="min-w-[120px] rounded-md border border-primary-400 px-3 py-2 text-center text-base font-sans-semibold text-content-primary"
          />
        ) : (
          <Pressable
            onPress={() => {
              setDraftText(String(value.amount));
              setEditing(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="금액 직접 입력 열기"
            className="min-h-[44px] justify-center px-3"
          >
            <Text className="text-lg font-sans-bold text-content-primary">
              {value.amount.toLocaleString('ko-KR')}원
            </Text>
          </Pressable>
        )}

        {value.type === 'hourly' ? (
          <Pressable
            onPress={step(1)}
            accessibilityRole="button"
            accessibilityLabel="금액 올리기"
            hitSlop={10}
            className="h-11 w-11 items-center justify-center rounded-md bg-surface-card dark:bg-surface"
          >
            <PlusIcon size={18} color={SECONDARY_PALETTE[isDarkMode ? 400 : 500]} />
          </Pressable>
        ) : (
          <View className="w-11" />
        )}
      </View>

      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          className="min-h-[44px] items-center justify-center"
        >
          <Text className="text-sm text-content-secondary underline">나중에 설정</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
