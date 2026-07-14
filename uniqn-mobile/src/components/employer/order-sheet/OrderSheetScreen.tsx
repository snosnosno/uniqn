import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  roleName,
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
import { SalarySheet, type UniqueRole } from './sheets/SalarySheet';
import { WelfareSheet } from './sheets/WelfareSheet';
import { TaxSheet } from './sheets/TaxSheet';
import { ConditionsSheet } from './sheets/ConditionsSheet';
import { PreQuestionsSheet } from './sheets/PreQuestionsSheet';
import { PresetCarousel, type OrderSheetPreset } from './PresetCarousel';
import { DatePickerModal } from '@/components/employer/job-form/modals/DatePickerModal';
import { defaultAmountForRole, syncRoleSalaries } from '@/utils/order-sheet/roleSalaries';
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
  /** 프리셋 캐러셀(마지막 공고 + 저장 템플릿) — create.tsx가 조립해 전달(Task 9). */
  presets?: OrderSheetPreset[];
  /** "＋ 저장" 카드 → 현재 폼 값을 상위(create.tsx)로 넘겨 템플릿 저장 모달을 연다. */
  onSaveTemplate?: (values: OrderSheetFormValues) => void;
}

export function OrderSheetScreen({
  initialValues,
  onSubmit,
  isSubmitting,
  onSwitchToLegacyForm,
  onDirtyChange,
  myPhone = '',
  presets,
  onSaveTemplate,
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
  // 급여 시트 confirm 이력 — '기본값' 배지(프리필 제안 상태) 해제 판정용 파생 상태(스키마 필드 아님)
  const [salaryConfirmed, setSalaryConfirmed] = useState(false);

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
      // pending 창(300ms) 동안 사용자가 다른 시트를 열었으면(cur !== null) 그 선택을 존중 —
      // 예약 타이머가 사용자가 연 시트를 같은 렌더 패스에서 갈아치우는 레이스 차단.
      setActiveSheet((cur) => (cur === null ? next : cur));
    }, SHEET_DISMISS_ANIMATION_MS);
  }, []);

  // 슬롯별 역할 편집 타깃(객체) 좁히기 — rows/기타 시트 키(문자열)와 구분
  const slotRolesTarget: SlotRolesTarget | null =
    activeSheet !== null && typeof activeSheet === 'object' ? activeSheet : null;

  // 급여 시트(동일급여 OFF)용 고유 역할 — timeSlots에서 roleKey(기타는 customRole 단위) 기준 중복 제거,
  // 라벨은 orderRowMeta.roleName 재사용. by_role 전수 커버 게이트(스키마 superRefine)와 대칭.
  const uniqueRoles = useMemo<UniqueRole[]>(() => {
    const seen = new Map<string, UniqueRole>();
    for (const slot of values.timeSlots ?? []) {
      for (const r of slot.roles) {
        const key = r.role === 'other' ? `other:${r.customRole ?? ''}` : r.role;
        if (!seen.has(key)) {
          seen.set(key, {
            role: r.role,
            ...(r.customRole !== undefined ? { customRole: r.customRole } : {}),
            label: roleName(r.role, r.customRole),
          });
        }
      }
    }
    return [...seen.values()];
  }, [values.timeSlots]);

  // 역할 확정 시 급여 자동 프리필(설계 §S2.3) — confirm 핸들러(이벤트)에서만 호출, effect 금지(F3).
  // 후속 역할 추가(기존 엔트리가 있던 상태의 신규 주입)만 1회성 토스트로 알린다(2차 CEO-2 —
  // 초기 시드는 '기본값' 배지가 담당). useSameSalary=true(동일급여)면 no-op.
  const applyRoleSalarySync = useCallback(
    (nextTimeSlots: OrderSheetFormValues['timeSlots']) => {
      const current = form.getValues();
      if (current.useSameSalary ?? false) return;
      const prev = current.roleSalaries ?? [];
      const synced = syncRoleSalaries(nextTimeSlots ?? [], prev, current.salary.type);
      if (synced === prev) return;
      form.setValue('roleSalaries', synced, { shouldDirty: true, shouldValidate: true });
      const added = synced.slice(prev.length);
      if (prev.length > 0 && added.length > 0) {
        addToast({
          type: 'success',
          message: `기본 급여 적용: ${added
            .map(
              (rs) => `${roleName(rs.role, rs.customRole)} ${rs.salary.amount.toLocaleString()}원`
            )
            .join(' · ')} · 급여 행에서 수정 가능`,
        });
      }
    },
    [form, addToast]
  );

  // '기본값' 배지(CEO-2+Design-H2) — roleSalaries가 전부 역할별 기본값과 일치하고 급여 시트를
  // confirm한 적 없을 때만. 제출은 배지 상태에서도 허용(R4 존중) — 시각 게이트일 뿐.
  const showDefaultSalaryBadge = useMemo(() => {
    if (salaryConfirmed || (values.useSameSalary ?? false) || uniqueRoles.length === 0) {
      return false;
    }
    const roleSalaries = values.roleSalaries ?? [];
    return uniqueRoles.every((u) => {
      const entry = roleSalaries.find((rs) => rs.role === u.role && rs.customRole === u.customRole);
      return (
        entry !== undefined &&
        entry.salary.type !== 'other' &&
        entry.salary.amount === defaultAmountForRole(entry.role, entry.salary.type)
      );
    });
  }, [salaryConfirmed, values.useSameSalary, values.roleSalaries, uniqueRoles]);

  // 행 탭 라우팅 — roles 행은 슬롯 수에 따라 분기(1개=직접 역할 편집, 그 외=TimeSlotsSheet). 나머지는 그대로.
  // switchSheet 지연 전환 창(300ms) 중에는 무시 — 그 사이 새 시트를 열면 예약 타이머와 충돌(#244 레이스).
  const handleRowPress = useCallback(
    (key: OrderRowKey) => {
      if (pendingSheetRef.current) return;
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

  // 최근 제목/장소 — 프리셋(마지막 공고 + 템플릿)의 title/location 으로 채운다.
  // ⚠️ useMemo 참조 안정화 필수: 매 렌더 새 배열이면 시트 effect 의존이 흔들려 편집 상태가 리셋된다(Task 6 리뷰 승계).
  const recentTitles = useMemo<string[]>(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of presets ?? []) {
      const t = p.values.title?.trim();
      if (t && !seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
    return out;
  }, [presets]);

  const recentLocations = useMemo<OrderSheetLocation[]>(() => {
    const seen = new Set<string>();
    const out: OrderSheetLocation[] = [];
    for (const p of presets ?? []) {
      const loc = p.values.location;
      if (!loc?.name) continue;
      const key = `${loc.name}:${loc.address ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(loc);
    }
    return out;
  }, [presets]);

  // 프리셋 카드 탭 → 주문서 전체를 그 구성으로 교체(RHF reset). 저장 카드 탭 → 현재 값 상위로 전달.
  // by_role 프리셋은 reset 직전 syncRoleSalaries(Eng-H3) — 부분 커버 템플릿의 미커버 역할을 기본값으로 채운다.
  const handleApplyPreset = useCallback(
    (preset: OrderSheetPreset) => {
      const v = preset.values;
      if (v.useSameSalary ?? false) {
        form.reset(v);
      } else {
        form.reset({
          ...v,
          roleSalaries: syncRoleSalaries(v.timeSlots ?? [], v.roleSalaries ?? [], v.salary.type),
        });
      }
      setSalaryConfirmed(false);
    },
    [form]
  );
  const handleSavePreset = useCallback(() => {
    onSaveTemplate?.(form.getValues());
  }, [onSaveTemplate, form]);

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
        // 행 탭과 동일 변환 경유 — 'roles'/'time' 등은 setActiveSheet 직접 넣으면 시트 분기에 없어 무반응(H5 죽은 버튼).
        handleRowPress(next);
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
        {presets !== undefined && (
          <PresetCarousel
            presets={presets}
            onSelect={handleApplyPreset}
            onSavePress={handleSavePreset}
          />
        )}
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
                badge={key === 'salary' && showDefaultSalaryBadge ? '기본값' : undefined}
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
          onConfirm={(next) => {
            form.setValue('timeSlots', next, { shouldDirty: true, shouldValidate: true });
            applyRoleSalarySync(next);
          }}
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
          onConfirm={(next) => {
            const nextSlots = (values.timeSlots ?? []).map((s, idx) =>
              idx === slotRolesTarget.slotIndex ? { ...s, roles: next } : s
            );
            form.setValue('timeSlots', nextSlots, { shouldDirty: true, shouldValidate: true });
            applyRoleSalarySync(nextSlots);
          }}
          onClose={() =>
            slotRolesTarget.fromTimeSheet ? switchSheet('time') : setActiveSheet(null)
          }
        />
      )}
      {/* 급여 시트 3종 — 급여(타입·역할별)·복지·세금. rows 진입은 즉시(스왑 없음). */}
      {activeSheet === 'salary' && (
        <SalarySheet
          visible
          value={values.salary}
          useSameSalary={values.useSameSalary ?? false}
          roleSalaries={values.roleSalaries ?? []}
          uniqueRoles={uniqueRoles}
          onConfirm={(next) => {
            form.setValue('salary', next.salary, { shouldDirty: true, shouldValidate: true });
            form.setValue('useSameSalary', next.useSameSalary, {
              shouldDirty: true,
              shouldValidate: true,
            });
            form.setValue('roleSalaries', next.roleSalaries, {
              shouldDirty: true,
              shouldValidate: true,
            });
            setSalaryConfirmed(true); // '기본값' 배지 해제 — 사용자가 급여를 직접 확인함
          }}
          onClose={() => setActiveSheet(null)}
        />
      )}
      {activeSheet === 'welfare' && (
        <WelfareSheet
          visible
          value={values.allowances ?? {}}
          onConfirm={(next) =>
            form.setValue('allowances', next, { shouldDirty: true, shouldValidate: true })
          }
          onClose={() => setActiveSheet(null)}
        />
      )}
      {activeSheet === 'tax' && (
        <TaxSheet
          visible
          value={values.taxSettings}
          onConfirm={(next) =>
            form.setValue('taxSettings', next, { shouldDirty: true, shouldValidate: true })
          }
          onClose={() => setActiveSheet(null)}
        />
      )}
      {/* 조건 시트 — 복장·경력 프리셋. */}
      {activeSheet === 'conditions' && (
        <ConditionsSheet
          visible
          value={values.conditions ?? {}}
          onConfirm={(next) =>
            form.setValue('conditions', next, { shouldDirty: true, shouldValidate: true })
          }
          onClose={() => setActiveSheet(null)}
        />
      )}
      {/* 사전질문 시트 — QuestionCard 동형(인라인 라디오 유형·중첩 Modal 없음). */}
      {activeSheet === 'preQuestions' && (
        <PreQuestionsSheet
          visible
          value={values.preQuestions ?? []}
          onConfirm={(next) => {
            form.setValue('preQuestions', next.preQuestions, {
              shouldDirty: true,
              shouldValidate: true,
            });
            form.setValue('usesPreQuestions', next.usesPreQuestions, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }}
          onClose={() => setActiveSheet(null)}
        />
      )}
    </View>
  );
}
