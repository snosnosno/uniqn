import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  errorMessageForRow,
  errorRowTargets,
  firstUnsetRow,
  getRowState,
  orderGroupsFor,
  resolveGroupIndexByDates,
  roleName,
  summarizeGroupDates,
  type OrderRowKey,
  type OrderRowTarget,
} from './orderRowMeta';
import { OrderGroup } from './OrderGroup';
import { OrderRow } from './OrderRow';
import { ScheduleSection } from './ScheduleSection';
import {
  cloneSlots,
  defaultFixedSchedule,
  SLOTS_SHEET_ROWS,
  type GroupTimeSlots,
  type ScheduleGroups,
} from './orderSheetTypes';
import { useScheduleMutations } from './hooks/useScheduleMutations';
import { useSheetChain } from './hooks/useSheetChain';
import { useOrderSheetPresets } from './hooks/useOrderSheetPresets';
import { usePostingTypeSwitch } from './hooks/usePostingTypeSwitch';
import { TypeSegment } from './TypeSegment';
import { TitleSheet } from './sheets/TitleSheet';
import { PlaceSheet } from './sheets/PlaceSheet';
import { ContactSheet } from './sheets/ContactSheet';
import { DescriptionSheet } from './sheets/DescriptionSheet';
import { ScheduleSlotsSheet } from './sheets/ScheduleSlotsSheet';
import { RolesSheet } from './sheets/RolesSheet';
import { WorkConditionSheet } from './sheets/WorkConditionSheet';
import { SalarySheet, type UniqueRole } from './sheets/SalarySheet';
import { WelfareSheet } from './sheets/WelfareSheet';
import { TaxSheet } from './sheets/TaxSheet';
import { ConditionsSheet } from './sheets/ConditionsSheet';
import { PreQuestionsSheet } from './sheets/PreQuestionsSheet';
import { PresetCarousel, type OrderSheetPreset } from './PresetCarousel';
import { ScheduleDatesSheet } from './sheets/ScheduleDatesSheet';
import { InformationCircleIcon } from '@/components/icons';
import { SheetChainContext } from '@/components/ui/SheetChainContext';
import {
  defaultAmountForRole,
  syncRoleSalaries,
  syncRoleSalariesForRoles,
} from '@/utils/order-sheet/roleSalaries';

/** 날짜 칩 탭으로 지목한 카드를 강조해 두는 시간 — 눈이 따라올 만큼만 짧게(F2) */
const CARD_HIGHLIGHT_MS = 2400;

export interface OrderSheetScreenProps {
  initialValues: OrderSheetFormValues;
  onSubmit: (values: OrderSheetValues) => Promise<void>;
  isSubmitting: boolean;
  /** RHF dirty 상태를 상위(create.tsx)로 끌어올려 useUnsavedChangesGuard에 연결 */
  onDirtyChange?: (dirty: boolean) => void;
  /** ContactSheet "내 프로필 번호" 라디오용 — create.tsx가 profile.phone 전달 */
  myPhone?: string;
  /** 프리셋 캐러셀(마지막 공고 + 저장 템플릿) — create.tsx가 조립해 전달(Task 9). */
  presets?: OrderSheetPreset[];
  /** 프리셋을 아직 불러오는 중인지 — 로딩과 '없음'을 구분해야 거짓 안내를 막는다(ORDER-9). */
  presetsLoading?: boolean;
  /** "＋ 저장" 카드 → 현재 폼 값을 상위(create.tsx)로 넘겨 템플릿 저장 모달을 연다. */
  onSaveTemplate?: (values: OrderSheetFormValues) => void;
  /** 편집 모드(S3) — 타입 세그먼트 잠금·'이대로 수정' 라벨·대회 생성 배너 숨김(승인상태 보존 ⑥) */
  mode?: 'create' | 'edit';
  /** 연쇄 전환 딤을 호스트로 위임(B1) — 이 화면 밖 형제(StackHeader 등)까지 덮으려면 호스트가
   *  통지를 받아 OrderSheetChainScrim 을 SafeAreaView 레벨에 렌더한다. 제공 시 내부 딤은
   *  렌더하지 않는다(black/50 이중 적층 방지).
   *  ⚠️ 반드시 안정 콜백(useState setter·useCallback)으로 넘길 것 — inline arrow 를 넘기면
   *  clearPendingSwap 의존 cleanup effect 가 렌더마다 재실행되어 대기 중 스왑 예약(180ms)이
   *  조기 취소되고 연쇄가 조용히 죽는다. */
  onChainSwappingChange?: (swapping: boolean) => void;
}

export function OrderSheetScreen({
  initialValues,
  onSubmit,
  isSubmitting,
  onDirtyChange,
  myPhone = '',
  presets,
  presetsLoading = false,
  onSaveTemplate,
  mode = 'create',
  onChainSwappingChange,
}: OrderSheetScreenProps) {
  const { addToast } = useToastStore();
  // 하단 고정 CTA가 iOS 홈 인디케이터 safe-area를 침범하지 않도록 bottom inset 반영(L7).
  // 웹은 insets.bottom=0 → 기존 24px 유지(무해). SafeAreaProvider 밖이어도 0 폴백.
  const insets = useSafeAreaInsets();
  // 3제네릭 필수(Global Constraints·스파이크 실측): 폼 상태=z.input, handleSubmit 콜백=z.output
  const form = useForm<OrderSheetFormValues, unknown, OrderSheetValues>({
    resolver: zodResolver(orderSheetValuesSchema),
    defaultValues: initialValues,
    mode: 'onChange',
  });
  const values = form.watch();
  const { errors, isDirty } = form.formState;
  // 급여 시트 confirm 이력 — '기본값' 배지(프리필 제안 상태) 해제 판정용 파생 상태(스키마 필드 아님)
  const [salaryConfirmed, setSalaryConfirmed] = useState(false);

  // 시트 연쇄(무장·지연 스왑·딤) 일체는 전용 훅이 소유한다 — 셋은 서로를 취소·해제하는
  // 타이밍 계약이라 한자리에 있어야 읽힌다.
  const {
    activeSheet,
    setActiveSheet,
    chainValue,
    chainSwapping,
    clearPendingSwap,
    handleRowPress,
    confirmRow,
    closeSheet,
    handlePressCondition,
    openException,
  } = useSheetChain({ form, ...(onChainSwappingChange ? { onChainSwappingChange } : {}) });

  // 일정 타깃(객체) 좁히기 — rows/기타 시트 키(문자열)와 구분
  const scheduleTarget =
    activeSheet !== null && typeof activeSheet === 'object' ? activeSheet : null;
  const datesTarget = scheduleTarget?.key === 'dates' ? scheduleTarget : null;
  const slotsTarget = scheduleTarget?.key === 'slots' ? scheduleTarget : null;

  const scheduleGroups: ScheduleGroups = useMemo(
    () => values.scheduleGroups ?? [],
    [values.scheduleGroups]
  );
  const groupCount = scheduleGroups.length;

  /** 전 카드 날짜 합집합 — 날짜 시트의 시드(전 일정 스코프) */
  const allSelectedDates = useMemo(
    () => [...new Set(scheduleGroups.flatMap((g) => g.dates ?? []))].sort(),
    [scheduleGroups]
  );

  /**
   * 시트에 넘길 카드 조건 — 시트가 열려 있는 동안 정규화가 카드를 옮겼을 수 있으므로
   * 날짜집합으로 재해석해 찾고, **깊은복사**해 넘긴다(F11 — 시트 내부 편집이 폼 상태를
   * 참조로 건드리지 않게).
   */
  const slotsSheetValue = useMemo<GroupTimeSlots>(() => {
    if (slotsTarget === null) return [];
    const index = resolveGroupIndexByDates(values, slotsTarget.dates, slotsTarget.fallbackIndex);
    return cloneSlots(index === null ? [] : scheduleGroups[index]?.timeSlots);
  }, [slotsTarget, values, scheduleGroups]);

  /**
   * 시트의 "적용할 날짜" 후보 — 그 카드의 날짜들.
   * 단 **날짜가 아직 없는 조건 카드**(템플릿 프리셋이 만드는 그것)는 후보가 비어 버려
   * 영영 날짜를 받지 못한다. 그때는 공고 전체 날짜를 후보로 줘서 여기서 배정받게 한다.
   */
  const slotsSheetDates = useMemo<string[]>(() => {
    if (slotsTarget === null) return [];
    const cardDates = [...slotsTarget.dates];
    return cardDates.length > 0 ? cardDates : allSelectedDates;
  }, [slotsTarget, allSelectedDates]);

  // 급여 시트(동일급여 OFF)용 고유 역할 — 전 그룹 timeSlots에서 roleKey(기타는 customRole 단위) 기준
  // 중복 제거, 라벨은 orderRowMeta.roleName 재사용. by_role 전수 커버 게이트(스키마 superRefine)와 대칭.
  const uniqueRoles = useMemo<UniqueRole[]>(() => {
    const seen = new Map<string, UniqueRole>();
    // 고정(fixed)은 평탄 fixedSchedule.roles, dated는 전 그룹 timeSlots 역할 합집합(S2).
    const src =
      values.postingType === 'fixed'
        ? (values.fixedSchedule?.roles ?? [])
        : scheduleGroups.flatMap((g) => g.timeSlots ?? []).flatMap((s) => s.roles);
    for (const r of src) {
      const key = r.role === 'other' ? `other:${r.customRole ?? ''}` : r.role;
      if (!seen.has(key)) {
        seen.set(key, {
          role: r.role,
          ...(r.customRole !== undefined ? { customRole: r.customRole } : {}),
          label: roleName(r.role, r.customRole),
        });
      }
    }
    return [...seen.values()];
  }, [values.postingType, values.fixedSchedule, scheduleGroups]);

  // 동기화 결과 반영 + 신규 추가분 1회 안내 — dated(applyRoleSalarySync)·fixed(역할 시트 confirm) 공용
  // (전체리뷰 P2 — verbatim 중복 통합). 초기 시드(prev 비어있음)는 '기본값' 배지가 담당해 토스트 없음.
  // syncRoleSalaries* 는 append-only + 변화 없으면 입력 참조 반환 계약(roleSalaries.ts) — slice가 추가분.
  const applySyncedRoleSalaries = useCallback(
    (
      prev: NonNullable<OrderSheetFormValues['roleSalaries']>,
      synced: NonNullable<OrderSheetFormValues['roleSalaries']>
    ) => {
      if (synced === prev) return;
      form.setValue('roleSalaries', synced, { shouldDirty: true, shouldValidate: true });
      const added = synced.slice(prev.length);
      if (prev.length > 0 && added.length > 0) {
        addToast({
          type: 'success',
          message: `기본 급여 적용: ${added
            .map(
              (rs) =>
                `${roleName(rs.role, rs.customRole)} ${
                  rs.salary.type === 'other' ? '협의' : `${rs.salary.amount.toLocaleString()}원`
                }`
            )
            .join(' · ')} · 급여 행에서 수정 가능`,
        });
      }
    },
    [form, addToast]
  );

  // 역할 확정 시 급여 자동 프리필(설계 §S2.3) — confirm 핸들러(이벤트)에서만 호출, effect 금지(F3).
  // 후속 역할 추가(기존 엔트리가 있던 상태의 신규 주입)만 1회성 토스트로 알린다(2차 CEO-2 —
  // 초기 시드는 '기본값' 배지가 담당). useSameSalary=true(동일급여)면 no-op.
  const applyRoleSalarySync = useCallback(
    (nextGroups: ScheduleGroups) => {
      const current = form.getValues();
      if (current.useSameSalary ?? false) return;
      const prev = current.roleSalaries ?? [];
      const nextSlots = nextGroups.flatMap((g) => g.timeSlots ?? []);
      applySyncedRoleSalaries(prev, syncRoleSalaries(nextSlots, prev, current.salary.type));
    },
    [form, applySyncedRoleSalaries]
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

  // 일정 뮤테이션 일체(커밋·고지·되돌리기)는 전용 훅이 소유한다 — 이 화면의 모든 일정 쓰기가
  // commitGroups 를 지나고, 정규화의 암묵 동작 고지는 notifyScheduleChange 하나로 모인다.
  const {
    handleDeleteCard,
    handleDatesConfirm,
    handleSlotsConfirm,
    handleToggleRun,
    openExceptionRef,
  } = useScheduleMutations({ form, addToast, clearPendingSwap, applyRoleSalarySync });

  // 렌더 중 ref 쓰기는 React 규칙 위반 — 토스트 액션 탭은 커밋 이후에만 가능하므로 effect 로 충분하다.
  // openExceptionRef 는 훅이 준 안정 참조지만, 훅 경계를 넘어오면서 eslint 가 그걸 증명하지
  // 못한다 — deps 에 넣어도 재실행되지 않으므로 경고를 억제하는 대신 그냥 적는다.
  useEffect(() => {
    openExceptionRef.current = openException;
  }, [openException, openExceptionRef]);

  /** F2 — 날짜 칩 탭은 그 날짜가 속한 카드로 데려간다(예외 추출 제2 진입로) */
  const [highlightedCard, setHighlightedCard] = useState<number | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const sectionYRef = useRef(0);
  const cardYRef = useRef(new Map<number, number>());
  useEffect(
    () => () => {
      if (highlightTimerRef.current !== null) clearTimeout(highlightTimerRef.current);
    },
    []
  );

  const handlePressDateChip = useCallback(
    (date: string) => {
      const groups = form.getValues().scheduleGroups ?? [];
      const index = groups.findIndex((g) => (g.dates ?? []).includes(date));
      if (index < 0) return;
      setHighlightedCard(index);
      const cardY = cardYRef.current.get(index);
      if (cardY !== undefined) {
        // 카드 y 는 섹션 내부 좌표라 섹션 offset 을 더한다. 헤더 여백만큼의 오차는 남지만
        // 목적(그 카드를 눈에 띄게 만들기)은 하이라이트가 담당하므로 근사로 충분하다.
        scrollRef.current?.scrollTo({
          y: Math.max(0, sectionYRef.current + cardY - 24),
          animated: true,
        });
      }
      if (highlightTimerRef.current !== null) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => {
        highlightTimerRef.current = null;
        setHighlightedCard(null);
      }, CARD_HIGHLIGHT_MS);
    },
    [form]
  );

  const handleCardLayoutY = useCallback((cardIndex: number, y: number) => {
    cardYRef.current.set(cardIndex, y);
  }, []);

  // 프리셋(최근 입력 후보 + 1탭 적용/저장) — 폼 전체를 갈아치우는 유일한 경로라 되돌리기를 낀다.
  const { recentTitles, recentLocations, handleApplyPreset, handleSavePreset } =
    useOrderSheetPresets({
      form,
      presets,
      addToast,
      clearPendingSwap,
      setSalaryConfirmed,
      ...(onSaveTemplate ? { onSaveTemplate } : {}),
    });

  // dirty 상태 상위 동기화 — useUnsavedChangesGuard(create.tsx)가 주문서 경로에서도 작동하도록
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  /** 행(그룹 스코프) → RHF 에러 메시지 — 경로 워커 경유(중첩 그룹·급여 에러 포함, 리뷰 Eng-H1) */
  const rowError = useCallback(
    (key: OrderRowKey, groupIndex = 0): string | undefined =>
      errorMessageForRow(errors as Record<string, unknown>, key, groupIndex),
    [errors]
  );

  // 타입 전환(dated ↔ fixed) — 반대 축 입력을 파기하지 않고 스태시했다가 복귀 시 되살린다.
  const handleTypeChange = usePostingTypeSwitch({ form, addToast, clearPendingSwap });

  const handleSubmitPress = form.handleSubmit(
    (valid) => {
      // 딤은 pointerEvents='none' 이라 연쇄 대기 창에서도 제출이 눌린다 — 제출로 넘어가면
      // 예약된 시트는 의미가 없다(실패 경로는 handleRowPress 가 이미 취소한다).
      clearPendingSwap();
      return onSubmit(valid);
    },
    (submitErrors) => {
      // 1순위: 미설정 행 순차 유도. 2순위(값은 있는데 invalid — XSS 문자열·프리필 이상치): 첫 에러 행 시트 열기.
      // 3순위: 매핑 실패 시 토스트 폴백 — "버튼이 아무 반응 없는" 죽은 상태 금지(리뷰 H5·F5).
      // 전 단계가 {key, groupIndex}를 흘린다(리뷰 Design-M3).
      const next: OrderRowTarget | null =
        firstUnsetRow(values) ??
        errorRowTargets(submitErrors as Record<string, unknown>)[0] ??
        null;
      if (next !== null) {
        // 행 탭과 동일 변환 경유 — 'roles'/'time' 등은 setActiveSheet 직접 넣으면 시트 분기에 없어 무반응(H5 죽은 버튼).
        handleRowPress(next.key, next.groupIndex);
        return;
      }
      addToast({ type: 'error', message: '입력값을 확인해주세요.' });
    }
  );

  const unsetTarget = firstUnsetRow(values);
  const submitLabel = (() => {
    if (unsetTarget === null) {
      if (mode === 'edit') return '이대로 수정'; // 대회 포함 — 편집은 승인상태 보존(⑥), 재승인 요청 아님
      return values.postingType === 'tournament' ? '승인 요청하기' : '이대로 등록';
    }
    const { key, groupIndex } = unsetTarget;
    const state = getRowState(values, key, groupIndex);
    // 그룹 2개+의 일정 행은 날짜 요약 접두로 그룹을 식별시킨다("7/22 일정의 시간부터 선택하기")
    const isScheduleRow = key === 'dates' || key === 'time' || key === 'roles';
    const prefix =
      groupCount > 1 && isScheduleRow
        ? (() => {
            const dates = scheduleGroups[groupIndex]?.dates ?? [];
            return dates.length > 0
              ? `${summarizeGroupDates(dates)} 일정의 `
              : `${groupIndex + 1}번째 일정의 `;
          })()
        : '';
    return `${prefix}${state.label}부터 ${key === 'title' ? '입력' : '선택'}하기`;
  })();

  return (
    <SheetChainContext.Provider value={chainValue}>
      <View className="flex-1 bg-surface-page">
        <ScrollView ref={scrollRef} className="flex-1 px-4 pt-3" contentContainerClassName="pb-28">
          {presets !== undefined && (
            <PresetCarousel
              presets={presets}
              isLoading={presetsLoading}
              onSelect={handleApplyPreset}
              onSavePress={handleSavePreset}
            />
          )}
          <View className="mb-3">
            <TypeSegment
              value={values.postingType}
              onChange={handleTypeChange}
              disabled={mode === 'edit'}
            />
          </View>
          {/* 대회 승인 안내(S1) — 대회 공고는 관리자 승인 게시. 편집은 승인상태 보존(⑥)이라 숨김(S3). */}
          {values.postingType === 'tournament' && mode !== 'edit' ? (
            <View
              className="flex-row items-start gap-2 mb-3 rounded-xl bg-surface-card border border-secondary-100 dark:border-surface-overlay px-3.5 py-3"
              accessibilityRole="alert"
              testID="order-sheet-tournament-notice"
            >
              <InformationCircleIcon size={18} />
              <Text className="flex-1 text-xs font-sans text-content-secondary leading-[1.125rem] dark:leading-5">
                대회 공고는 관리자 승인 후 게시돼요. 승인까지 1~2 영업일이 걸릴 수 있어요.
              </Text>
            </View>
          ) : null}
          {/* 고정(fixed)은 orderGroupsFor가 '근무조건'(workConditions·roles) 섹션을 반환 — '일정 · 모집' 특수 분기 미진입(S2). */}
          {orderGroupsFor(values.postingType).map((section) => {
            if (section.title !== '일정 · 모집') {
              return (
                <OrderGroup key={section.title} title={section.title}>
                  {section.rows.map((key) => (
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
              );
            }
            // 일정·모집 — 조건 유도 그룹핑(설계 §3.2). 날짜 요약 행 + 조건 카드 N개.
            // 카드 수·경계는 사장이 고르지 않는다: 같은 조건이면 한 카드, 다르면 갈라진다.
            return (
              <View
                key={section.title}
                onLayout={(e) => {
                  sectionYRef.current = e.nativeEvent.layout.y;
                }}
              >
                <ScheduleSection
                  values={values}
                  rowError={rowError}
                  highlightedCardIndex={highlightedCard}
                  onPressDates={() => handleRowPress('dates', 0)}
                  onPressDateChip={handlePressDateChip}
                  onPressCondition={handlePressCondition}
                  onToggleRun={handleToggleRun}
                  onDeleteCard={handleDeleteCard}
                  onCardLayoutY={handleCardLayoutY}
                />
              </View>
            );
          })}
        </ScrollView>
        <View
          className="absolute bottom-0 left-0 right-0 px-4 pt-2 bg-surface-page border-t border-secondary-100 dark:border-surface-overlay"
          style={{ paddingBottom: Math.max(24, insets.bottom + 8) }}
        >
          {/* 편집 하단 2버튼 패턴 계승(레거시 기능 소실 방지) — 좌 ghost 템플릿 저장 + 우 primary 수정(S3). */}
          <View className="flex-row items-center gap-2">
            {mode === 'edit' && onSaveTemplate !== undefined ? (
              <Button
                variant="ghost"
                onPress={handleSavePreset}
                disabled={isSubmitting}
                accessibilityLabel="템플릿으로 저장"
                testID="order-sheet-edit-save-template"
              >
                템플릿 저장
              </Button>
            ) : null}
            <View className="flex-1">
              <Button
                onPress={handleSubmitPress}
                disabled={isSubmitting}
                loading={isSubmitting}
                testID={mode === 'edit' ? 'job-posting-edit-submit' : 'job-posting-create-submit'}
              >
                {submitLabel}
              </Button>
            </View>
          </View>
        </View>
        {/* 연쇄 전환 딤 — 시트가 잠깐 사라지는 구간에서 밝은 목록이 번쩍이는 것을 막는다.
          다음 시트 백드롭과 같은 black/50. pointerEvents none 이라 터치를 막지 않는다.
          StackHeader 는 이 컴포넌트 밖이라 여기서는 못 덮는다 — 호스트가 onChainSwappingChange 로
          위임받으면(B1) 내부 딤은 접고 호스트의 OrderSheetChainScrim 한 장이 헤더까지 덮는다. */}
        {chainSwapping && onChainSwappingChange === undefined ? (
          <View
            className="absolute top-0 left-0 right-0 bottom-0 bg-black/50 dark:bg-black/50"
            pointerEvents="none"
            testID="order-sheet-chain-scrim"
          />
        ) : null}
        {/* 기본정보 시트 4종 — 제목·장소·연락처·설명(Task 6). activeSheet 스위치로 동시 1개만 마운트. */}
        {activeSheet === 'title' && (
          <TitleSheet
            visible
            value={values.title}
            recentTitles={recentTitles}
            onConfirm={(v) => {
              form.setValue('title', v, { shouldDirty: true, shouldValidate: true });
              confirmRow({ key: 'title', groupIndex: 0 });
            }}
            onClose={closeSheet}
          />
        )}
        {activeSheet === 'place' && (
          <PlaceSheet
            visible
            value={values.location}
            recentLocations={recentLocations}
            onConfirm={(v) => {
              form.setValue('location', v, { shouldDirty: true, shouldValidate: true });
              confirmRow({ key: 'place', groupIndex: 0 });
            }}
            onClose={closeSheet}
          />
        )}
        {activeSheet === 'contact' && (
          <ContactSheet
            visible
            value={values.contactPhone}
            myPhone={myPhone}
            onConfirm={(v) => {
              form.setValue('contactPhone', v, { shouldDirty: true, shouldValidate: true });
              confirmRow({ key: 'contact', groupIndex: 0 });
            }}
            onClose={closeSheet}
          />
        )}
        {activeSheet === 'description' && (
          <DescriptionSheet
            visible
            value={values.description ?? ''}
            onConfirm={(v) => {
              form.setValue('description', v, { shouldDirty: true, shouldValidate: true });
              confirmRow({ key: 'description', groupIndex: 0 });
            }}
            onClose={closeSheet}
          />
        )}
        {/* 고정(fixed) 근무조건 시트 — 주 출근일수·출근시간(협의). fixedSchedule.roles는 병합으로 보존하고,
          협의 전환 시 startTime은 승계하지 않고 next 값(부재면 드롭)으로 재구성한다(토글 시맨틱 정합, S2). */}
        {activeSheet === 'workConditions' && values.fixedSchedule && (
          <WorkConditionSheet
            visible
            value={{
              daysPerWeek: values.fixedSchedule.daysPerWeek,
              ...(values.fixedSchedule.startTime
                ? { startTime: values.fixedSchedule.startTime }
                : {}),
              isStartTimeNegotiable: values.fixedSchedule.isStartTimeNegotiable ?? false,
            }}
            onConfirm={(next) => {
              // non-null 단언 대신 옵셔널 — 렌더 게이트가 보장하지만 계약을 코드로 명시(전체리뷰 P4)
              const fs = form.getValues().fixedSchedule;
              form.setValue(
                'fixedSchedule',
                {
                  daysPerWeek: next.daysPerWeek,
                  isStartTimeNegotiable: next.isStartTimeNegotiable,
                  roles: fs?.roles ?? [],
                  ...(next.startTime ? { startTime: next.startTime } : {}),
                },
                { shouldDirty: true, shouldValidate: true }
              );
              confirmRow({ key: 'workConditions', groupIndex: 0 });
            }}
            onClose={closeSheet}
          />
        )}
        {/* 고정(fixed) 역할 시트 — 평탄 fixedSchedule.roles 편집. 확정 시 by_role 급여 자동 프리필(dated 대칭, S2). */}
        {activeSheet === 'fixedRoles' && values.fixedSchedule && (
          <RolesSheet
            visible
            value={values.fixedSchedule.roles}
            onConfirm={(next) => {
              // non-null 단언 대신 기본값 폴백 — 렌더 게이트가 보장하지만 계약을 코드로 명시(전체리뷰 P4)
              const fs = form.getValues().fixedSchedule ?? defaultFixedSchedule();
              form.setValue(
                'fixedSchedule',
                { ...fs, roles: next },
                { shouldDirty: true, shouldValidate: true }
              );
              // 확정 시 by_role 급여 자동 프리필 + 1회 안내 — dated applyRoleSalarySync와 공용 헬퍼(P2 중복 통합)
              const cur = form.getValues();
              if (!(cur.useSameSalary ?? false)) {
                const prev = cur.roleSalaries ?? [];
                applySyncedRoleSalaries(
                  prev,
                  syncRoleSalariesForRoles(next, prev, cur.salary.type)
                );
              }
              confirmRow({ key: 'roles', groupIndex: 0 }, SLOTS_SHEET_ROWS);
            }}
            onClose={closeSheet}
          />
        )}
        {/* 일정·모집 시트 2종 — 날짜(전 일정 스코프)·시간역할(카드 스코프).
          행 탭 경로에는 시트→시트 스왑이 없다. 미설정 연쇄(confirmRow)만 SHEET_CHAIN_SWAP_MS
          지연 후 다음 시트를 마운트한다(#244 겹침 회피 패턴 승계). */}
        {datesTarget && (
          <ScheduleDatesSheet
            visible
            postingType={values.postingType}
            initialSelectedDates={allSelectedDates}
            onConfirm={(dates) => {
              handleDatesConfirm(dates);
              setActiveSheet(null);
              // F9 — 날짜를 막 정한 신규 카드는 시간이 비어 있다. 여기서 연쇄를 끊으면
              // 이 화면 최다 전환점(날짜→시간)이 죽는다. confirmRow 가 다음 미설정 행을
              // 날짜집합 앵커와 함께 예약한다.
              confirmRow({ key: 'dates', groupIndex: 0 });
            }}
            onClose={closeSheet}
          />
        )}
        {slotsTarget && (
          <ScheduleSlotsSheet
            // 다른 카드로 옮겨 가면 새 시트다 — 같은 인스턴스를 재사용하면 앞 카드의
            // 날짜 선택 상태를 물려받는다.
            key={`slots-${slotsTarget.fallbackIndex}`}
            visible
            value={slotsSheetValue}
            selectableDates={slotsSheetDates}
            requiresDatePick={slotsTarget.dates.length === 0}
            onConfirm={({ dates, slots }) => {
              const index = handleSlotsConfirm(slotsTarget, dates, slots);
              if (index === null) return;
              confirmRow(
                { key: 'roles', groupIndex: index, dates: slotsTarget.dates },
                SLOTS_SHEET_ROWS
              );
            }}
            onClose={closeSheet}
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
            multiGroup={groupCount > 1}
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
              confirmRow({ key: 'salary', groupIndex: 0 });
            }}
            onClose={closeSheet}
          />
        )}
        {activeSheet === 'welfare' && (
          <WelfareSheet
            visible
            value={values.allowances ?? {}}
            onConfirm={(next) => {
              form.setValue('allowances', next, { shouldDirty: true, shouldValidate: true });
              confirmRow({ key: 'welfare', groupIndex: 0 });
            }}
            onClose={closeSheet}
          />
        )}
        {activeSheet === 'tax' && (
          <TaxSheet
            visible
            value={values.taxSettings}
            onConfirm={(next) => {
              form.setValue('taxSettings', next, { shouldDirty: true, shouldValidate: true });
              confirmRow({ key: 'tax', groupIndex: 0 });
            }}
            onClose={closeSheet}
          />
        )}
        {/* 조건 시트 — 복장·조건 프리셋. */}
        {activeSheet === 'conditions' && (
          <ConditionsSheet
            visible
            value={values.conditions ?? {}}
            onConfirm={(next) => {
              form.setValue('conditions', next, { shouldDirty: true, shouldValidate: true });
              confirmRow({ key: 'conditions', groupIndex: 0 });
            }}
            onClose={closeSheet}
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
              confirmRow({ key: 'preQuestions', groupIndex: 0 });
            }}
            onClose={closeSheet}
          />
        )}
      </View>
    </SheetChainContext.Provider>
  );
}
