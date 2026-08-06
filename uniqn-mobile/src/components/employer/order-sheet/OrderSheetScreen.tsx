import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { useToastStore } from '@/stores/toastStore';
import { triggerHaptic } from '@/utils/haptics';
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
  nextUnsetRowAfter,
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
  normalizeScheduleGroups,
  setRunGrouped,
} from '@/utils/order-sheet/normalizeScheduleGroups';
import { applyDateSelection, extractException } from '@/utils/order-sheet/scheduleCardEdits';
import { UNDO_DELAY_MS } from '@/constants/undo';
import { TypeSegment } from './TypeSegment';
import { TitleSheet } from './sheets/TitleSheet';
import { PlaceSheet, type OrderSheetLocation } from './sheets/PlaceSheet';
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
import { SheetChainContext, type SheetChainValue } from '@/components/ui/SheetChainContext';
import { SHEET_CHAIN_DATES_SCRIM_HOLD_MS, SHEET_CHAIN_SWAP_MS } from '@/constants/animation';
import {
  defaultAmountForRole,
  syncRoleSalaries,
  syncRoleSalariesForRoles,
} from '@/utils/order-sheet/roleSalaries';
import type { PostingType } from '@/types/jobPosting';

type ScheduleGroups = NonNullable<OrderSheetFormValues['scheduleGroups']>;
type GroupTimeSlots = ScheduleGroups[number]['timeSlots'];

/**
 * 활성 시트 상태 — 행 키(비일정) 또는 일정 타깃.
 *
 * 날짜 시트는 **전 일정 스코프** 하나뿐이다(조건 유도 그룹핑 — 사장은 날짜만 고르고 카드
 * 경계는 조건이 정한다). 구 whole/edit/add 3모드와 3지 세그먼트가 여기서 사라진다.
 */
type DatesTarget = { key: 'dates' };
/**
 * 시간·역할 시트 타깃 — 좌표를 **날짜집합**으로 든다(§3.7·F9).
 * 시트가 열려 있는 동안 정규화가 카드 순서를 바꿀 수 있으므로 confirm 시점에 재해석한다.
 * mode: edit=카드 조건 편집 · exception=일부 날짜만 다른 조건으로 분리.
 */
type SlotsTarget = {
  key: 'slots';
  dates: readonly string[];
  fallbackIndex: number;
  mode: 'edit' | 'exception';
};
type ActiveSheet =
  // 'workConditions'는 Exclude<OrderRowKey,...>에 이미 포함(고정 근무조건 시트).
  // 'fixedRoles'는 OrderRowKey가 아닌 고정 전용 시트 키 — 그룹 슬롯 roles와 구분하려 별도 추가(S2).
  | Exclude<OrderRowKey, 'dates' | 'time' | 'roles'>
  | 'fixedRoles'
  | DatesTarget
  | SlotsTarget
  | null;

/**
 * ScheduleSlotsSheet 하나가 커버하는 행들 — 시간·역할은 행이 둘이지만 시트는 하나다.
 * 확인은 roles 로만 보고되므로, 연쇄가 방금 확인한 시트를 곧바로 다시 열지 않으려면
 * 두 행 모두 "확인됨"으로 넘겨야 한다(넘기지 않으면 time 재오픈 루프).
 */
const SLOTS_SHEET_ROWS: readonly OrderRowKey[] = ['time', 'roles'];

/** 폼 슬롯 깊은복사(F1/E6) — 분할·시드 시 참조 공유로 타 그룹이 오염되는 것을 차단 */
const cloneSlots = (slots: GroupTimeSlots | undefined): GroupTimeSlots =>
  (slots ?? []).map((s) => ({ ...s, roles: s.roles.map((r) => ({ ...r })) }));

/** 날짜 칩 탭으로 지목한 카드를 강조해 두는 시간 — 눈이 따라올 만큼만 짧게(F2) */
const CARD_HIGHLIGHT_MS = 2400;

/** 자동 시드된 기본값과 다른, **사용자가 실제로 넣은** 근무조건이 있는가. */
function hasUserFixedInput(fixed: OrderSheetFormValues['fixedSchedule']): boolean {
  if (fixed === undefined) return false;
  const seed = defaultFixedSchedule();
  return (
    (fixed.roles?.length ?? 0) > 0 ||
    fixed.startTime !== undefined ||
    fixed.isStartTimeNegotiable !== seed.isStartTimeNegotiable ||
    fixed.daysPerWeek !== seed.daysPerWeek
  );
}

/** 고정 전환/방어 시드 기본값 — 제품 기본 주 5일(레거시 INITIAL은 0=협의, jobPostingForm.ts:202) */
const defaultFixedSchedule = (): NonNullable<OrderSheetFormValues['fixedSchedule']> => ({
  daysPerWeek: 5,
  isStartTimeNegotiable: false,
  roles: [],
});

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
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  // 급여 시트 confirm 이력 — '기본값' 배지(프리필 제안 상태) 해제 판정용 파생 상태(스키마 필드 아님)
  const [salaryConfirmed, setSalaryConfirmed] = useState(false);

  // 연쇄 입력(미설정 항목 이어가기) 상태.
  // chainArmedRef: 이 시트를 "미설정 행"으로 열었는가 — 이미 채워진 행 수정은 연쇄하지 않는다.
  // pendingSwapRef: 지연 스왑 예약. 두 네이티브 Modal 겹침 회피용 대기(#244 패턴 승계).
  const chainArmedRef = useRef(false);
  const pendingSwapRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // datesScrimHoldRef: 날짜 시트 진입 후 백드롭이 다 올라올 때까지 딤을 잡아 두는 예약.
  const datesScrimHoldRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 전환 창 동안 화면을 어둡게 유지 — 시트가 사라진 순간 밝은 목록이 번쩍이는 것을 막는다.
  // 다음 시트의 백드롭과 같은 농도(black/50)라 인수인계에 이음매가 없다.
  const [chainSwapping, setChainSwapping] = useState(false);
  // 딤 토글 단일 경로 — 호스트 위임(B1) 통지를 겸한다. setChainSwapping 직접 호출 금지:
  // 통지가 빠지면 호스트 딤이 고착되거나(꺼짐 누락) 아예 안 뜬다(켜짐 누락).
  const updateChainSwapping = useCallback(
    (swapping: boolean) => {
      setChainSwapping(swapping);
      onChainSwappingChange?.(swapping);
    },
    [onChainSwappingChange]
  );
  const clearPendingSwap = useCallback(() => {
    if (pendingSwapRef.current !== null) {
      clearTimeout(pendingSwapRef.current);
      pendingSwapRef.current = null;
    }
    if (datesScrimHoldRef.current !== null) {
      clearTimeout(datesScrimHoldRef.current);
      datesScrimHoldRef.current = null;
    }
    updateChainSwapping(false);
  }, [updateChainSwapping]);
  useEffect(() => clearPendingSwap, [clearPendingSwap]);

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

  /** 방어 시드(H5) — fixed 전용 시트 진입 시 fixedSchedule 부재면 기본값으로 채워 렌더 게이트를 통과시킨다. */
  const seedFixedScheduleIfMissing = useCallback(() => {
    if (form.getValues().fixedSchedule === undefined) {
      form.setValue('fixedSchedule', defaultFixedSchedule(), {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [form]);

  /**
   * 행 → 시트 라우팅 + 연쇄 무장 판정. 사용자 탭과 연쇄 예약이 공유하는 단일 진입점.
   * 무장 = 지금 여는 행이 "필수인데 비어 있음" — 이미 채워진 행 수정은 확인 시 목록으로 복귀한다.
   *
   * 행 탭 라우팅(그룹 스코프) — dates는 단일 그룹=whole(세그먼트)·다그룹=edit(헤더 재편집),
   * 시간·역할은 통합 시트 하나로 진입(설계 §6).
   */
  const openRow = useCallback(
    (key: OrderRowKey, groupIndex = 0) => {
      const current = form.getValues();
      const state = getRowState(current, key, groupIndex);
      chainArmedRef.current = !state.optional && state.unset;
      const groups = current.scheduleGroups ?? [];
      if (key === 'dates') {
        // 딤 해제 책임이 여기로 넘어온다: 날짜 시트만 SheetModal 이 아니라 DatePickerModal(ui/Modal)
        // 래핑이라 SheetChainContext 를 소비하지 않는다 → 시트가 떠도 onEntered() 통지가 없어
        // handleChainEntered 가 영영 안 불린다. 걷지 않으면 딤이 화면 전체에 영구 잔존한다.
        //
        // 단 즉시 걷으면 안 된다 — ui/Modal 백드롭은 0→1 페이드인이라(200ms) 그 사이 밝은
        // 주문서 목록이 드러난다. 백드롭이 다 올라온 뒤에 걷어야 이음매가 없다.
        // 취소·재탭 등으로 먼저 빠져나가는 경로는 clearPendingSwap 이 이 예약도 함께 정리한다.
        if (datesScrimHoldRef.current !== null) clearTimeout(datesScrimHoldRef.current);
        datesScrimHoldRef.current = setTimeout(() => {
          datesScrimHoldRef.current = null;
          updateChainSwapping(false);
        }, SHEET_CHAIN_DATES_SCRIM_HOLD_MS);
        setActiveSheet({ key: 'dates' });
        return;
      }
      // 시간·역할은 통합 시트 하나로 진입한다(설계 §6). 고정(fixed)은 단일 fixedSchedule.roles
      // 편집이라 전용 시트로 분기하는 기존 동작을 유지한다(S2).
      if (key === 'time' || key === 'roles') {
        if (current.postingType === 'fixed') {
          seedFixedScheduleIfMissing();
          setActiveSheet('fixedRoles');
          return;
        }
        setActiveSheet({
          key: 'slots',
          dates: [...(groups[groupIndex]?.dates ?? [])],
          fallbackIndex: groupIndex,
          mode: 'edit',
        });
        return;
      }
      if (key === 'workConditions') {
        // 방어(H5·전체리뷰 P4): fixedSchedule 부재 상태로 진입해도 시트가 열리도록 시드 —
        // 렌더 게이트(activeSheet==='workConditions' && values.fixedSchedule)와 정합.
        seedFixedScheduleIfMissing();
        setActiveSheet('workConditions');
        return;
      }
      // 나머지는 행 키 그대로 시트 오픈.
      setActiveSheet(key);
    },
    [form, seedFixedScheduleIfMissing, updateChainSwapping]
  );

  /**
   * 사용자가 직접 행을 탭한 경로. 연쇄 예약이 대기 중이면 취소한다 —
   * 사용자의 명시적 선택이 자동 예약을 이긴다(#244 의 "무시" 가드와 반대 방향:
   * 그쪽은 시트가 떠 있는 상태의 오탭 방지였고, 여기는 시트가 없는 대기 창이라
   * 탭을 막으면 사용자가 180ms 동안 아무것도 못 누르는 죽은 구간이 된다).
   */
  const handleRowPress = useCallback(
    (key: OrderRowKey, groupIndex = 0) => {
      clearPendingSwap();
      openRow(key, groupIndex);
    },
    [clearPendingSwap, openRow]
  );

  /**
   * 시트 확인 후 다음 미설정 항목으로 이어간다.
   * 무장되지 않았으면(이미 채워진 행 수정) 아무것도 하지 않고 목록으로 돌아간다.
   *
   * 시트가 onConfirm 직후 onClose 로 activeSheet 를 null 로 내리므로 여기서 닫지 않는다.
   * ⚠️ 호출 순서: onConfirm(폼 반영 → confirmRow) → onClose(무장 해제). confirmRow 를
   *    onClose 뒤로 옮기면 무장이 이미 꺼져 연쇄가 침묵으로 죽는다.
   */
  const confirmRow = useCallback(
    (target: OrderRowTarget, coveredKeys?: readonly OrderRowKey[]) => {
      if (!chainArmedRef.current) return;
      chainArmedRef.current = false;
      // setValue 직후라 watch 값은 아직 옛것 — getValues 로 최신 폼을 읽는다.
      const next = nextUnsetRowAfter(form.getValues(), target, coveredKeys);
      if (next === null) {
        // 연쇄 완료(연출 B3) — 무장된 연쇄에서 마지막 미설정 항목을 채웠다. 결정적 순간이라
        // 성공 햅틱 1회로 완료를 알린다(룰 17). 웹은 no-op이지만 CTA가 '이대로 등록'으로
        // 바뀌는 시각 신호가 별도로 있다. 토스트는 절제를 위해 생략(룰 12).
        void triggerHaptic('success');
        return;
      }
      // 전환 안내(a11y C1) — 딤 스왑 대기(180ms) 동안 스크린리더가 침묵하지 않도록,
      // 다음 시트가 실제로 뜨기 전 예약 시점에 다음 항목 라벨을 읽어 준다.
      const nextLabel = getRowState(form.getValues(), next.key, next.groupIndex).label;
      AccessibilityInfo.announceForAccessibility(`다음 항목: ${nextLabel}`);
      updateChainSwapping(true);
      pendingSwapRef.current = setTimeout(() => {
        pendingSwapRef.current = null;
        // F9 — 180ms 대기 동안 정규화가 카드 순서를 바꿨을 수 있다(같은 조건으로 수렴하면
        // 카드가 병합되고, 예외를 뽑으면 갈라진다). 예약 시점 인덱스가 아니라 **날짜집합**으로
        // 현재 카드를 다시 구한다. 카드가 통째로 사라졌으면 연쇄를 조용히 끝낸다 —
        // 엉뚱한 카드의 시트를 열어 입력을 잘못 쓰는 것보다 낫다.
        const resolved = resolveGroupIndexByDates(form.getValues(), next.dates, next.groupIndex);
        if (resolved === null) return;
        openRow(next.key, resolved);
      }, SHEET_CHAIN_SWAP_MS);
    },
    [form, openRow, updateChainSwapping]
  );

  // 시트가 화면에 올라오면 딤을 걷는다 — 백드롭과 딤이 겹쳐 이중으로 어두워지는 프레임을 최소화.
  const handleChainEntered = useCallback(() => updateChainSwapping(false), [updateChainSwapping]);
  const chainValue = useMemo<SheetChainValue>(
    () => ({ entering: chainSwapping, onEntered: handleChainEntered }),
    [chainSwapping, handleChainEntered]
  );

  /** 시트 닫기 — X·백드롭으로 나가면 연쇄를 끊는다(확인 경로는 이미 confirmRow 가 소비 후 해제). */
  const closeSheet = useCallback(() => {
    chainArmedRef.current = false;
    setActiveSheet(null);
    // 딤 안전망 — 예약이 없을 때만 걷는다.
    // ⚠️ 무조건 걷으면 안 된다: 확인 경로의 호출 순서는 onConfirm(→ confirmRow 가 딤을 켬)
    //    직후 onClose(=이 함수)라, 무조건 끄면 방금 켠 딤이 즉시 꺼져 전환 번쩍임이 복귀한다.
    //    예약(pendingSwapRef) 존재 여부가 "연쇄 전환 중"과 "그냥 닫힘"을 가르는 유일한 신호다.
    if (pendingSwapRef.current === null) {
      // 날짜 시트를 취소로 닫는 경로 — 백드롭이 사라지므로 딤 유지 예약도 함께 거둔다.
      if (datesScrimHoldRef.current !== null) {
        clearTimeout(datesScrimHoldRef.current);
        datesScrimHoldRef.current = null;
      }
      updateChainSwapping(false);
    }
  }, [updateChainSwapping]);

  /** 폼 그룹 커밋 단일 경로 — 정규화·급여 동기화·시드 계약을 한자리에 모은다.
   *  화면의 모든 일정 뮤테이션이 여기를 지난다(정규화를 잊는 실수를 구조적으로 차단). */
  const commitGroups = useCallback(
    (next: ScheduleGroups) => {
      // 빈 시드 계약(§8.4) — 결과가 완전히 비면 초기 상태(mappers.initialOrderSheetValues)와
      // 같은 빈 그룹 1개를 남긴다. 정규화 자체는 fixed(scheduleGroups=[])를 깨지 않으려고
      // 시드하지 않으므로, 시드는 이 화면 계층의 책임이다.
      const seeded: ScheduleGroups =
        next.length > 0 ? next : [{ dates: [], timeSlots: [], grouped: false }];
      form.setValue('scheduleGroups', seeded, { shouldDirty: true, shouldValidate: true });
      applyRoleSalarySync(seeded);
      return seeded;
    },
    [form, applyRoleSalarySync]
  );

  /** 카드 삭제(즉시) + Undo 토스트 — impeccable §12, 리뷰 Design-M2.
   *  Undo 는 삭제 직전 전체 스냅샷 복원 — 정규화가 인덱스를 바꿀 수 있어 단건 재삽입은 성립하지 않는다. */
  const handleDeleteCard = useCallback(
    (cardIndex: number) => {
      // 연쇄 예약 취소 — 180ms 대기 창 안에서 카드를 삭제하면 예약이 사라진 카드를 가리킨다.
      clearPendingSwap();
      const current = form.getValues().scheduleGroups ?? [];
      if (current.length <= 1) return; // E4: 마지막 카드는 버튼 자체 미노출 — 방어
      const target = current[cardIndex];
      if (!target) return;
      const snapshot = current.map((g) => ({
        ...g,
        dates: [...(g.dates ?? [])],
        timeSlots: cloneSlots(g.timeSlots),
      }));
      commitGroups(normalizeScheduleGroups(current.filter((_, i) => i !== cardIndex)));
      addToast({
        type: 'success',
        message: `${summarizeGroupDates(target.dates ?? []) || '일정'} 일정을 삭제했어요`,
        duration: UNDO_DELAY_MS,
        action: {
          label: '되돌리기',
          onPress: () => {
            clearPendingSwap();
            commitGroups(snapshot);
          },
        },
      });
    },
    [form, addToast, clearPendingSwap, commitGroups]
  );

  /** 폼 그룹 스냅샷(깊은복사) — Undo 복원용 */
  const snapshotGroups = useCallback(
    (groups: ScheduleGroups): ScheduleGroups =>
      groups.map((g) => ({
        ...g,
        dates: [...(g.dates ?? [])],
        timeSlots: cloneSlots(g.timeSlots),
      })),
    []
  );

  /**
   * 날짜 확정 — **전 일정 스코프**. 해제분은 소속 카드에서 빠지고, 추가분은 인접 카드가
   * 조건을 승계한다(F10). 카드의 마지막 날짜가 빠지면 그 카드의 **조건까지** 사라지므로
   * 되돌릴 길을 반드시 준다(F6 — 이 화면에서 정보 손실이 가장 큰 사건이다).
   */
  const handleDatesConfirm = useCallback(
    (dates: string[]) => {
      const current = form.getValues().scheduleGroups ?? [];
      const snapshot = snapshotGroups(current);
      const { groups: next, removedCards } = applyDateSelection(current, dates);
      commitGroups(next);
      if (removedCards.length === 0) return;
      const label = removedCards
        .map((c) => summarizeGroupDates(c.dates ?? []))
        .filter(Boolean)
        .join(' · ');
      addToast({
        type: 'info',
        message: `${label || '일정'} 조건이 함께 삭제됐어요`,
        duration: UNDO_DELAY_MS,
        action: {
          label: '되돌리기',
          onPress: () => {
            clearPendingSwap();
            commitGroups(snapshot);
          },
        },
      });
    },
    [form, snapshotGroups, commitGroups, addToast, clearPendingSwap]
  );

  /**
   * 카드 조건 확정 — 좌표를 날짜집합으로 재해석해 stale 인덱스에 덮어쓰지 않는다(§3.7).
   *
   * ⚠️ null 분기(카드 소멸)는 **방어 경로**다. 지금 UI 에서는 시트가 모달로 화면을 덮고 있어
   *    열려 있는 동안 폼을 바꿀 길이 거의 없다 — 그래서 화면 레벨 테스트가 없다. 계약 자체는
   *    `resolveGroupIndexByDates` 유닛이 고정한다. 비모달 편집이나 외부 폼 리셋이 생기면
   *    이 분기가 실제 경로가 되므로 남겨 둔다(조용히 버리는 것보다 고지가 낫다).
   */
  const handleSlotsConfirm = useCallback(
    (target: SlotsTarget, nextSlots: GroupTimeSlots) => {
      const current = form.getValues();
      const index = resolveGroupIndexByDates(current, target.dates, target.fallbackIndex);
      if (index === null) {
        addToast({ type: 'info', message: '일정이 바뀌어 반영하지 못했어요' });
        return null;
      }
      const groups = current.scheduleGroups ?? [];
      const next = normalizeScheduleGroups(
        groups.map((g, i) => (i === index ? { ...g, timeSlots: nextSlots } : g))
      );
      commitGroups(next);
      return index;
    },
    [form, addToast, commitGroups]
  );

  /** 예외 추출 확정 — 고른 날짜만 새 조건으로 분리한다(§3.4). 다중 예외가 1회 입력으로 끝난다. */
  const handleExceptionConfirm = useCallback(
    (target: SlotsTarget, picked: string[], nextSlots: GroupTimeSlots) => {
      const current = form.getValues();
      const index = resolveGroupIndexByDates(current, target.dates, target.fallbackIndex);
      const groups = current.scheduleGroups ?? [];
      const next = index === null ? null : extractException(groups, index, picked, nextSlots);
      if (next === null) {
        addToast({ type: 'info', message: '일정이 바뀌어 반영하지 못했어요' });
        return;
      }
      commitGroups(next);
    },
    [form, addToast, commitGroups]
  );

  /** 묶음지원 토글 — run 만 선분할한 뒤 정규화에 맡긴다(Eng F-6). */
  const handleToggleRun = useCallback(
    (cardIndex: number, run: string[], on: boolean) => {
      clearPendingSwap();
      const groups = form.getValues().scheduleGroups ?? [];
      commitGroups(setRunGrouped(groups, cardIndex, run, on));
    },
    [form, clearPendingSwap, commitGroups]
  );

  /** 카드 조건 행 탭 — 미설정 카드면 연쇄를 무장한다(기존 openRow 규칙 승계). */
  const handlePressCondition = useCallback(
    (cardIndex: number) => {
      clearPendingSwap();
      handleRowPress('time', cardIndex);
    },
    [clearPendingSwap, handleRowPress]
  );

  /** 예외 추출 진입 — 카드의 날짜집합을 기억하고 0개 선택 상태로 시트를 연다(F11). */
  const openException = useCallback(
    (cardIndex: number) => {
      clearPendingSwap();
      chainArmedRef.current = false; // 예외 추출은 "채우기"가 아니라 "나누기" — 연쇄 대상이 아니다
      const groups = form.getValues().scheduleGroups ?? [];
      setActiveSheet({
        key: 'slots',
        dates: [...(groups[cardIndex]?.dates ?? [])],
        fallbackIndex: cardIndex,
        mode: 'exception',
      });
    },
    [form, clearPendingSwap]
  );

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
  // by_role 프리셋은 reset 직전 sync(Eng-H3) — 부분 커버 템플릿의 미커버 역할을 기본값으로 채운다.
  // fixed 프리셋은 역할 소스가 fixedSchedule.roles(전체리뷰 P3·P6 — dated 소스만 쓰면 갭필 무동작).
  const handleApplyPreset = useCallback(
    (preset: OrderSheetPreset) => {
      // 연쇄 예약 취소 — 대기 창(180ms) 안에서 폼 전체가 교체되면 예약된 타깃이 새 프리셋 값 위에
      // phantom 시트로 재등장한다(리뷰 실측: 프리셋 적용 직후 '연락처' 시트 팝업).
      clearPendingSwap();
      // 카드 1탭이 폼 **전체**를 갈아치운다 — 되돌릴 자산이 같은 파일(handleDeleteGroup)에
      // 이미 있는데 안 쓰고 있었다. 지금까지 쓴 입력이 있을 때만 스냅샷+Undo 를 얹는다
      // (impeccable §12 Undo > Confirm — 확인 다이얼로그는 1탭 적용의 속도를 죽인다).
      const hadInput = form.formState.isDirty;
      const snapshot = hadInput ? structuredClone(form.getValues()) : null;
      const v = preset.values;
      // ⚠️ keepDefaultValues — 기본 reset 은 defaultValues 까지 프리셋으로 바꿔 isDirty 를
      //    false 로 떨어뜨린다. 그러면 프리셋을 얹은 채 화면을 나가도 이탈 경고가 안 뜬다.
      const resetOptions = { keepDefaultValues: true } as const;
      if (v.useSameSalary ?? false) {
        form.reset(v, resetOptions);
      } else {
        form.reset(
          {
            ...v,
            roleSalaries:
              v.postingType === 'fixed'
                ? syncRoleSalariesForRoles(
                    v.fixedSchedule?.roles ?? [],
                    v.roleSalaries ?? [],
                    v.salary.type
                  )
                : syncRoleSalaries(
                    (v.scheduleGroups ?? []).flatMap((g) => g.timeSlots ?? []),
                    v.roleSalaries ?? [],
                    v.salary.type
                  ),
          },
          resetOptions
        );
      }
      setSalaryConfirmed(false);
      if (snapshot) {
        addToast({
          type: 'success',
          message: `'${preset.title}' 구성으로 바꿨어요`,
          duration: 5000,
          action: {
            label: '되돌리기',
            onPress: () => {
              clearPendingSwap();
              form.reset(snapshot, resetOptions);
              setSalaryConfirmed(false);
            },
          },
        });
      }
    },
    [form, clearPendingSwap, addToast]
  );
  const handleSavePreset = useCallback(() => {
    // 상위(create/edit)가 TemplateModal 을 연다 — 그 모달은 "주문서 시트가 닫힌 상태에서만 열린다"는
    // 전제(#244 중첩 RN Modal 회피)로 설계됐다. 연쇄 예약이 살아 있으면 그 위로 시트가 겹쳐 뜬다.
    clearPendingSwap();
    onSaveTemplate?.(form.getValues());
  }, [onSaveTemplate, form, clearPendingSwap]);

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

  // 타입 전환 축 데이터 보존(M7 승계 — 무경고 소실 금지, 전체리뷰 4관점 수렴) — dated↔fixed 전환은
  // 반대 축 입력을 파기하는 대신 세션 한정 스태시(ref)에 보관하고 복귀 시 복원한다. S1까지 이 보장을
  // 담당하던 create.tsx 레거시 전환 Alert는 S2 내부화로 사문 — 여기가 승계 지점.
  const stashedGroupsRef = useRef<ScheduleGroups | null>(null);
  const stashedFixedRef = useRef<OrderSheetFormValues['fixedSchedule'] | null>(null);
  // Undo 가 handleTypeChange 자신을 부르므로 ref 로 우회한다(선언 순환 회피).
  const handleTypeChangeRef = useRef<
    ((t: PostingType, options?: { silent?: boolean }) => void) | null
  >(null);

  /** 전환으로 사라진 입력을 고지하고 되돌릴 길을 준다 — 스태시가 있어도 알려주지 않으면 없는 것과 같다. */
  const notifyTypeSwitch = useCallback(
    (clearedLabel: string | null, previousType: PostingType) => {
      if (!clearedLabel) return;
      addToast({
        type: 'info',
        message: `${clearedLabel}을 잠시 치워뒀어요`,
        duration: 5000,
        action: {
          label: '되돌리기',
          // 되돌리기는 이전 타입으로 다시 전환하는 것 — 스태시 복원 경로를 그대로 재사용한다.
          // silent — 되돌리기가 반대 축을 다시 치우면서 두 번째 토스트를 띄우면 핑퐁이 된다.
          onPress: () => handleTypeChangeRef.current?.(previousType, { silent: true }),
        },
      });
    },
    [addToast]
  );

  const handleTypeChange = useCallback(
    (t: PostingType, options?: { silent?: boolean }) => {
      // 연쇄 예약 취소 — 대기 창(180ms) 안에서 폼 구조(행 구성)가 바뀌면 예약된 타깃이
      // 새 타입의 폼 위에서 phantom 시트가 된다(fixed→dated 전환 시 '근무조건' 시트 팝업 실측).
      clearPendingSwap();
      const cur = form.getValues();
      if (cur.postingType === t) return; // 동일 타입 재탭 no-op — 오탭이 dirty만 남기는 것 방지
      const previousType = cur.postingType;
      // 전환이 **실제로 데이터를 치웠을 때만** 신호를 낸다. 지금까지는 날짜·시간대가 화면에서
      // 사라지는데 아무 알림이 없어(ORDER-11), 사장은 자기가 지운 줄도 몰랐다.
      // ⚠️ fixed 축은 `!== undefined` 로 보면 안 된다 — dated→fixed 전환이 defaultFixedSchedule()
      //    을 **자동 시드**하므로, 빈 폼에서 '고정' 탭을 눌렀다 되돌리기만 해도 "치워뒀어요" 가
      //    뜬다. dated 축처럼 **사용자가 실제로 넣은 값**이 있는지로 판정한다.
      const clearedLabel =
        t === 'fixed'
          ? (cur.scheduleGroups ?? []).some(
              (g) => g.dates.length > 0 || (g.timeSlots ?? []).length > 0
            )
            ? '일정·모집 입력'
            : null
          : hasUserFixedInput(cur.fixedSchedule)
            ? '근무조건 입력'
            : null;
      if (t === 'fixed') {
        form.setValue('postingType', 'fixed', { shouldDirty: true });
        // 고정은 scheduleGroups가 반드시 비어야 한다(배열 원소 스키마 회피) — 소거 전 의미 있는
        // 입력(날짜·시간대)이 있으면 스태시(M7: dated 복귀 시 복원).
        const groups = cur.scheduleGroups ?? [];
        if (groups.some((g) => g.dates.length > 0 || (g.timeSlots ?? []).length > 0)) {
          stashedGroupsRef.current = groups;
        }
        form.setValue('scheduleGroups', [], { shouldDirty: true, shouldValidate: true });
        if (cur.fixedSchedule === undefined) {
          // 직전 fixed 입력이 스태시에 있으면 복원, 없으면 제품 기본값 시드(주 5일).
          // ⚠️ fixedSchedule을 undefined로 두면 근무조건 행·시트가 죽는다 — UI는 항상 시드
          //    (#194 mixed-draft 방어 자체는 mappers.valuesToDraft fixed 분기가 이중 담당).
          form.setValue('fixedSchedule', stashedFixedRef.current ?? defaultFixedSchedule(), {
            shouldDirty: true,
            shouldValidate: true,
          });
        }
        if (!options?.silent) notifyTypeSwitch(clearedLabel, previousType);
        return;
      }
      // dated(regular|urgent|tournament) — fixed에서 오면 근무조건 스태시 후 정리(M7), 그룹 복원/시드
      form.setValue('postingType', t, { shouldDirty: true });
      if (cur.fixedSchedule !== undefined) {
        stashedFixedRef.current = cur.fixedSchedule;
        form.setValue('fixedSchedule', undefined, { shouldDirty: true, shouldValidate: true });
      }
      if ((form.getValues().scheduleGroups ?? []).length === 0) {
        const restored = stashedGroupsRef.current;
        form.setValue(
          'scheduleGroups',
          restored && restored.length > 0
            ? restored
            : [{ dates: [], timeSlots: [], grouped: false }],
          { shouldDirty: true, shouldValidate: true }
        );
      }
      if (!options?.silent) notifyTypeSwitch(clearedLabel, previousType);
    },
    [form, clearPendingSwap, notifyTypeSwitch]
  );
  // 렌더 중 ref 쓰기는 React 규칙 위반(동시 렌더에서 폐기된 렌더의 쓰기가 남는다).
  // 토스트 탭은 커밋 이후에만 가능하므로 effect 타이밍으로 충분하다.
  useEffect(() => {
    handleTypeChangeRef.current = handleTypeChange;
  }, [handleTypeChange]);

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
                  onPressException={openException}
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
            // 전 일정 스코프라 "다른 그룹이 이미 쓴 날짜"라는 개념이 없다 — 상한은
            // DatePickerModal 이 선택 개수로 직접 관리한다.
            existingDates={[]}
            showSegment={false}
            initialSegment="same"
            onConfirm={({ dates }) => {
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
            // 모드가 바뀌면 새 시트다 — 같은 인스턴스를 재사용하면 예외 모드의 날짜 선택이
            // 직전 세션 상태를 물려받는다.
            key={`${slotsTarget.mode}-${slotsTarget.fallbackIndex}`}
            visible
            value={slotsSheetValue}
            {...(slotsTarget.mode === 'exception'
              ? {
                  selectableDates: [...slotsTarget.dates],
                  onConfirmException: ({ dates, slots }) =>
                    handleExceptionConfirm(slotsTarget, dates, slots),
                }
              : slotsTarget.dates.length > 1
                ? {
                    onSwitchToException: () =>
                      setActiveSheet({ ...slotsTarget, mode: 'exception' }),
                  }
                : {})}
            onConfirm={(next) => {
              const index = handleSlotsConfirm(slotsTarget, next);
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
