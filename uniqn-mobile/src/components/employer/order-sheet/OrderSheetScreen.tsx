import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { useToastStore } from '@/stores/toastStore';
import {
  orderSheetValuesSchema,
  type OrderSheetFormValues,
  type OrderSheetValues,
} from '@/schemas/orderSheet.schema';
import {
  ORDER_GROUPS,
  firstUnsetRow,
  getRowState,
  rowKeyForErrorField,
  type OrderRowKey,
} from './orderRowMeta';
import { OrderGroup } from './OrderGroup';
import { OrderRow } from './OrderRow';
import { TypeSegment } from './TypeSegment';
import type { PostingType } from '@/types/jobPosting';

export interface OrderSheetScreenProps {
  initialValues: OrderSheetFormValues;
  onSubmit: (values: OrderSheetValues) => Promise<void>;
  isSubmitting: boolean;
  onSwitchToLegacyForm: (type: 'fixed' | 'tournament') => void;
  /** RHF dirty 상태를 상위(create.tsx)로 끌어올려 useUnsavedChangesGuard에 연결 */
  onDirtyChange?: (dirty: boolean) => void;
  /** Task 9 프리셋 캐러셀 자리 */
  headerSlot?: React.ReactNode;
}

export function OrderSheetScreen({
  initialValues,
  onSubmit,
  isSubmitting,
  onSwitchToLegacyForm,
  onDirtyChange,
  headerSlot,
}: OrderSheetScreenProps) {
  const { addToast } = useToastStore();
  // 3제네릭 필수(Global Constraints·스파이크 실측): 폼 상태=z.input, handleSubmit 콜백=z.output
  const form = useForm<OrderSheetFormValues, unknown, OrderSheetValues>({
    resolver: zodResolver(orderSheetValuesSchema),
    defaultValues: initialValues,
    mode: 'onChange',
  });
  const values = form.watch();
  const { errors, isDirty } = form.formState;
  // activeSheet 값은 Task 6~8에서 시트를 장착할 때 읽는다 — 이번 태스크는 스위치(setter)만 배선
  const [, setActiveSheet] = useState<OrderRowKey | null>(null);

  // dirty 상태 상위 동기화 — useUnsavedChangesGuard(create.tsx)가 주문서 경로에서도 작동하도록
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  /** 행 키 → RHF 첫 에러 메시지 (행 에러 배지 배선 — 리뷰 H5/설계 스펙 "행 단위 에러 배지") */
  const rowError = useCallback(
    (key: OrderRowKey): string | undefined => {
      const entry = Object.entries(errors).find(([field]) => rowKeyForErrorField(field) === key);
      const err = entry?.[1] as { message?: string } | undefined;
      return typeof err?.message === 'string' ? err.message : undefined;
    },
    [errors]
  );

  const handleTypeChange = useCallback(
    (t: PostingType) => {
      if (t === 'fixed' || t === 'tournament') {
        onSwitchToLegacyForm(t); // dirty 확인 다이얼로그는 create.tsx(Step 6)에서 처리
        return;
      }
      form.setValue('postingType', t, { shouldDirty: true });
    },
    [form, onSwitchToLegacyForm]
  );

  const handleSubmitPress = form.handleSubmit(
    (valid) => onSubmit(valid),
    (submitErrors) => {
      // 1순위: 미설정 행 순차 유도. 2순위(값은 있는데 invalid — XSS 문자열·프리필 이상치): 첫 에러 행 시트 열기.
      // 3순위: 매핑 실패 시 토스트 폴백 — "버튼이 아무 반응 없는" 죽은 상태 금지(리뷰 H5·보안 4).
      const next =
        firstUnsetRow(values) ??
        Object.keys(submitErrors)
          .map(rowKeyForErrorField)
          .find((k): k is OrderRowKey => k !== null) ??
        null;
      if (next !== null) {
        setActiveSheet(next);
        return;
      }
      addToast({ type: 'error', message: '입력값을 확인해주세요.' });
    }
  );

  const unsetKey = firstUnsetRow(values);
  const submitLabel =
    unsetKey === null
      ? '이대로 등록'
      : `${getRowState(values, unsetKey).label}부터 ${unsetKey === 'title' ? '입력' : '선택'}하기`;

  return (
    <View className="flex-1 bg-surface-page">
      <ScrollView className="flex-1 px-4 pt-3" contentContainerClassName="pb-28">
        {headerSlot}
        <View className="mb-3">
          <TypeSegment value={values.postingType} onChange={handleTypeChange} />
        </View>
        {ORDER_GROUPS.map((group) => (
          <OrderGroup key={group.title} title={group.title}>
            {group.rows.map((key) => (
              <OrderRow
                key={key}
                state={getRowState(values, key)}
                error={rowError(key)}
                onPress={() => setActiveSheet(key)}
                testID={`order-sheet-row-${key}`}
              />
            ))}
          </OrderGroup>
        ))}
      </ScrollView>
      <View className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-2 bg-surface-page border-t border-secondary-100 dark:border-surface-overlay">
        <Button
          onPress={handleSubmitPress}
          disabled={isSubmitting}
          loading={isSubmitting}
          testID="job-posting-create-submit"
        >
          {submitLabel}
        </Button>
      </View>
      {/* 시트들: Task 6~8에서 activeSheet 스위치로 장착 */}
    </View>
  );
}
