import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { useToastStore } from '@/stores/toastStore';
import { SHEET_DISMISS_ANIMATION_MS } from '@/constants/animation';
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
import { TitleSheet } from './sheets/TitleSheet';
import { PlaceSheet, type OrderSheetLocation } from './sheets/PlaceSheet';
import { ContactSheet } from './sheets/ContactSheet';
import { DescriptionSheet } from './sheets/DescriptionSheet';
import { TimeSlotsSheet } from './sheets/TimeSlotsSheet';
import { RolesSheet } from './sheets/RolesSheet';
import { DatePickerModal } from '@/components/employer/job-form/modals/DatePickerModal';
import type { PostingType } from '@/types/jobPosting';

/**
 * 활성 시트 상태 — 행 키 또는 슬롯별 역할 편집 타깃.
 * slotRoles: 특정 시간대(slotIndex)의 역할만 편집. fromTimeSheet=true 면 확인/닫기 시 TimeSlotsSheet 로 복귀
 * (복수 슬롯일 때 그 안에서 진입), false 면 rows 로 닫는다(단일 슬롯 직접 진입).
 */
type SlotRolesTarget = { key: 'slotRoles'; slotIndex: number; fromTimeSheet: boolean };
type ActiveSheet = OrderRowKey | SlotRolesTarget | null;

export interface OrderSheetScreenProps {
  initialValues: OrderSheetFormValues;
  onSubmit: (values: OrderSheetValues) => Promise<void>;
  isSubmitting: boolean;
  onSwitchToLegacyForm: (type: 'fixed' | 'tournament') => void;
  /** RHF dirty 상태를 상위(create.tsx)로 끌어올려 useUnsavedChangesGuard에 연결 */
  onDirtyChange?: (dirty: boolean) => void;
  /** ContactSheet "내 프로필 번호" 라디오용 — create.tsx가 profile.phone 전달 */
  myPhone?: string;
  /** Task 9 프리셋 캐러셀 자리 */
  headerSlot?: React.ReactNode;
}

export function OrderSheetScreen({
  initialValues,
  onSubmit,
  isSubmitting,
  onSwitchToLegacyForm,
  onDirtyChange,
  myPhone = '',
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
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);

  // 시트→시트 직접 스왑은 iOS 중첩 Modal 터치 먹통(#244)을 유발 — 먼저 닫고 dismiss 애니메이션 뒤 다음을 연다.
  // 재진입 가드(pendingSheetRef)로 더블탭 시 이중 예약을 막고, 언마운트 시 예약을 정리한다(ScheduleDetailModal closeSheetThen 패턴).
  const pendingSheetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearPendingSheet = useCallback(() => {
    if (pendingSheetRef.current) {
      clearTimeout(pendingSheetRef.current);
      pendingSheetRef.current = null;
    }
  }, []);
  useEffect(() => clearPendingSheet, [clearPendingSheet]);

  const switchSheet = useCallback((next: ActiveSheet) => {
    if (pendingSheetRef.current) return; // 재진입 가드
    setActiveSheet(null);
    pendingSheetRef.current = setTimeout(() => {
      pendingSheetRef.current = null;
      setActiveSheet(next);
    }, SHEET_DISMISS_ANIMATION_MS);
  }, []);

  // 슬롯별 역할 편집 타깃(객체) 좁히기 — rows/기타 시트 키(문자열)와 구분
  const slotRolesTarget: SlotRolesTarget | null =
    activeSheet !== null && typeof activeSheet === 'object' ? activeSheet : null;

  // 행 탭 라우팅 — roles 행은 슬롯 수에 따라 분기(1개=직접 역할 편집, 그 외=TimeSlotsSheet). 나머지는 그대로.
  const handleRowPress = useCallback(
    (key: OrderRowKey) => {
      if (key === 'roles') {
        const count = values.timeSlots?.length ?? 0;
        setActiveSheet(
          count === 1 ? { key: 'slotRoles', slotIndex: 0, fromTimeSheet: false } : 'time'
        );
        return;
      }
      setActiveSheet(key);
    },
    [values.timeSlots]
  );

  // 최근 제목/장소 — Task 9(프리셋 캐러셀)에서 템플릿 title/location 으로 채운다. 그 전까지 빈 배열.
  const recentTitles: string[] = [];
  const recentLocations: OrderSheetLocation[] = [];

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
                onPress={() => handleRowPress(key)}
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
      {/* 기본정보 시트 4종 — 제목·장소·연락처·설명(Task 6). activeSheet 스위치로 동시 1개만 마운트. */}
      {activeSheet === 'title' && (
        <TitleSheet
          visible
          value={values.title}
          recentTitles={recentTitles}
          onConfirm={(v) => form.setValue('title', v, { shouldDirty: true, shouldValidate: true })}
          onClose={() => setActiveSheet(null)}
        />
      )}
      {activeSheet === 'place' && (
        <PlaceSheet
          visible
          value={values.location}
          recentLocations={recentLocations}
          onConfirm={(v) =>
            form.setValue('location', v, { shouldDirty: true, shouldValidate: true })
          }
          onClose={() => setActiveSheet(null)}
        />
      )}
      {activeSheet === 'contact' && (
        <ContactSheet
          visible
          value={values.contactPhone}
          myPhone={myPhone}
          onConfirm={(v) =>
            form.setValue('contactPhone', v, { shouldDirty: true, shouldValidate: true })
          }
          onClose={() => setActiveSheet(null)}
        />
      )}
      {activeSheet === 'description' && (
        <DescriptionSheet
          visible
          value={values.description ?? ''}
          onConfirm={(v) =>
            form.setValue('description', v, { shouldDirty: true, shouldValidate: true })
          }
          onClose={() => setActiveSheet(null)}
        />
      )}
      {/* 일정·모집 시트 3종 — 날짜(달력)·시간(다중 시간대)·역할(슬롯별). rows 진입은 즉시,
          TimeSlotsSheet↔RolesSheet 스왑만 switchSheet(#244 지연 전환)을 태운다. */}
      {activeSheet === 'dates' && (
        <DatePickerModal
          visible
          onClose={() => setActiveSheet(null)}
          postingType={values.postingType}
          existingDates={[]}
          initialSelectedDates={values.dates}
          onSelectDates={(dates) => {
            form.setValue('dates', dates, { shouldDirty: true, shouldValidate: true });
            setActiveSheet(null);
          }}
        />
      )}
      {activeSheet === 'time' && (
        <TimeSlotsSheet
          visible
          value={values.timeSlots}
          onConfirm={(next) =>
            form.setValue('timeSlots', next, { shouldDirty: true, shouldValidate: true })
          }
          onClose={() => setActiveSheet(null)}
          onEditSlotRoles={(slotIndex) =>
            switchSheet({ key: 'slotRoles', slotIndex, fromTimeSheet: true })
          }
        />
      )}
      {slotRolesTarget && (
        <RolesSheet
          visible
          value={values.timeSlots[slotRolesTarget.slotIndex]?.roles ?? []}
          onConfirm={(next) =>
            form.setValue(
              'timeSlots',
              (values.timeSlots ?? []).map((s, idx) =>
                idx === slotRolesTarget.slotIndex ? { ...s, roles: next } : s
              ),
              { shouldDirty: true, shouldValidate: true }
            )
          }
          onClose={() =>
            slotRolesTarget.fromTimeSheet ? switchSheet('time') : setActiveSheet(null)
          }
        />
      )}
    </View>
  );
}
