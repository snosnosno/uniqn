import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
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
  nextUnsetRowAfter,
  orderGroupsFor,
  roleName,
  summarizeGroupDates,
  summarizeTotalRoles,
  type OrderRowKey,
  type OrderRowTarget,
} from './orderRowMeta';
import { OrderGroup } from './OrderGroup';
import { OrderRow } from './OrderRow';
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
import { ScheduleDatesSheet, type ScheduleSplitMode } from './sheets/ScheduleDatesSheet';
import { InformationCircleIcon, XMarkIcon } from '@/components/icons';
import { SheetChainContext, type SheetChainValue } from '@/components/ui/SheetChainContext';
import { SHEET_CHAIN_SWAP_MS } from '@/constants/animation';
import { groupConsecutiveDates, hasGroupableDates } from '@/utils/date';
import {
  defaultAmountForRole,
  syncRoleSalaries,
  syncRoleSalariesForRoles,
} from '@/utils/order-sheet/roleSalaries';
import type { PostingType } from '@/types/jobPosting';

type ScheduleGroups = NonNullable<OrderSheetFormValues['scheduleGroups']>;
type GroupTimeSlots = ScheduleGroups[number]['timeSlots'];

/**
 * 활성 시트 상태 — 행 키(비일정) 또는 그룹 스코프 일정 타깃(S1).
 * dates.mode: whole=단일 그룹 전체 편집(3지 세그먼트 노출) · edit=기존 그룹 재편집(세그먼트 숨김 ⓓ)
 * · add=새 그룹 추가(직전 그룹 시간/역할 깊은복사 시드).
 */
type DatesTarget = { key: 'dates'; groupIndex: number; mode: 'whole' | 'edit' | 'add' };
/** 시간·역할 통합 시트 타깃 — 구 TimeTarget + SlotRolesTarget 을 대체한다(시트 전환이 사라짐). */
type SlotsTarget = { key: 'slots'; groupIndex: number };
type ActiveSheet =
  // 'workConditions'는 Exclude<OrderRowKey,...>에 이미 포함(고정 근무조건 시트).
  // 'fixedRoles'는 OrderRowKey가 아닌 고정 전용 시트 키 — 그룹 슬롯 roles와 구분하려 별도 추가(S2).
  | Exclude<OrderRowKey, 'dates' | 'time' | 'roles'>
  | 'fixedRoles'
  | DatesTarget
  | SlotsTarget
  | null;

/** 폼 슬롯 깊은복사(F1/E6) — 분할·시드 시 참조 공유로 타 그룹이 오염되는 것을 차단 */
const cloneSlots = (slots: GroupTimeSlots | undefined): GroupTimeSlots =>
  (slots ?? []).map((s) => ({ ...s, roles: s.roles.map((r) => ({ ...r })) }));

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
  /** "＋ 저장" 카드 → 현재 폼 값을 상위(create.tsx)로 넘겨 템플릿 저장 모달을 연다. */
  onSaveTemplate?: (values: OrderSheetFormValues) => void;
  /** 편집 모드(S3) — 타입 세그먼트 잠금·'이대로 수정' 라벨·대회 생성 배너 숨김(승인상태 보존 ⑥) */
  mode?: 'create' | 'edit';
  /** 확정 지원자 존재(S3) — 일정·역할 행 잠금. 서버 updateWithTransaction 가드와 대칭(급여는 열어둠) */
  scheduleLocked?: boolean;
}

export function OrderSheetScreen({
  initialValues,
  onSubmit,
  isSubmitting,
  onDirtyChange,
  myPhone = '',
  presets,
  onSaveTemplate,
  mode = 'create',
  scheduleLocked = false,
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
  // 전환 창 동안 화면을 어둡게 유지 — 시트가 사라진 순간 밝은 목록이 번쩍이는 것을 막는다.
  // 다음 시트의 백드롭과 같은 농도(black/50)라 인수인계에 이음매가 없다.
  const [chainSwapping, setChainSwapping] = useState(false);
  const clearPendingSwap = useCallback(() => {
    if (pendingSwapRef.current !== null) {
      clearTimeout(pendingSwapRef.current);
      pendingSwapRef.current = null;
    }
    setChainSwapping(false);
  }, []);
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

  // 확정 지원자 일정 잠금(S3) — 서버 BusinessError(일정/역할 변경 불가)를 UI에서 선제 안내.
  // 급여 행은 잠그지 않는다(identity 비교는 역할 키 집합만 — 금액 수정은 서버 허용 실측).
  const LOCKED_ROW_KEYS: ReadonlySet<OrderRowKey> = useMemo(
    () => new Set<OrderRowKey>(['dates', 'time', 'roles', 'workConditions']),
    []
  );
  const guardScheduleLock = useCallback(
    (key?: OrderRowKey): boolean => {
      if (!scheduleLocked) return false;
      if (key !== undefined && !LOCKED_ROW_KEYS.has(key)) return false;
      addToast({
        type: 'warning',
        message: '확정된 지원자가 있어 일정과 역할은 수정할 수 없어요.',
      });
      return true;
    },
    [scheduleLocked, LOCKED_ROW_KEYS, addToast]
  );

  /**
   * 행 → 시트 라우팅 + 연쇄 무장 판정. 사용자 탭과 연쇄 예약이 공유하는 단일 진입점.
   * 무장 = 지금 여는 행이 "필수인데 비어 있음" — 이미 채워진 행 수정은 확인 시 목록으로 복귀한다.
   *
   * 행 탭 라우팅(그룹 스코프) — dates는 단일 그룹=whole(세그먼트)·다그룹=edit(헤더 재편집),
   * 시간·역할은 통합 시트 하나로 진입(설계 §6).
   */
  const openRow = useCallback(
    (key: OrderRowKey, groupIndex = 0) => {
      if (guardScheduleLock(key)) {
        // 잠금 차단 시 딤 해제 — 토스트만 띄우고 나가면 시트가 뜰 주체가 없어
        // chainSwapping 이 켜진 채 고착된다(화면 전체가 어두운 데드엔드).
        setChainSwapping(false);
        return;
      }
      const current = form.getValues();
      const state = getRowState(current, key, groupIndex);
      chainArmedRef.current = !state.optional && state.unset;
      const groups = current.scheduleGroups ?? [];
      if (key === 'dates') {
        // 딤 해제: 날짜 시트만 SheetModal 이 아니라 DatePickerModal(ui/Modal) 래핑이라
        // SheetChainContext 를 소비하지 않는다 → 시트가 떠도 onEntered() 통지가 없어
        // handleChainEntered 가 영영 안 불린다. 여기서 걷지 않으면 확인이든 취소든
        // 딤이 화면 전체에 영구 잔존한다(다른 행을 탭해야 우연히 회복).
        // 설계 스펙의 절충("날짜 시트는 연출 미적용 — 기존 연출 그대로")과 정합.
        setChainSwapping(false);
        setActiveSheet({ key: 'dates', groupIndex, mode: groups.length > 1 ? 'edit' : 'whole' });
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
        setActiveSheet({ key: 'slots', groupIndex });
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
    [form, seedFixedScheduleIfMissing, guardScheduleLock]
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
    (target: OrderRowTarget) => {
      if (!chainArmedRef.current) return;
      chainArmedRef.current = false;
      // setValue 직후라 watch 값은 아직 옛것 — getValues 로 최신 폼을 읽는다
      const next = nextUnsetRowAfter(form.getValues(), target);
      if (next === null) return;
      setChainSwapping(true);
      pendingSwapRef.current = setTimeout(() => {
        pendingSwapRef.current = null;
        openRow(next.key, next.groupIndex);
      }, SHEET_CHAIN_SWAP_MS);
    },
    [form, openRow]
  );

  // 시트가 화면에 올라오면 딤을 걷는다 — 백드롭과 딤이 겹쳐 이중으로 어두워지는 프레임을 최소화.
  const handleChainEntered = useCallback(() => setChainSwapping(false), []);
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
    if (pendingSwapRef.current === null) setChainSwapping(false);
  }, []);

  /** 그룹 삭제(즉시) + Undo 토스트 5초 — impeccable §12, 리뷰 Design-M2.
   *  복원은 삭제 그룹 단건 재삽입(리뷰 L-6) — 5초 내 타 그룹 편집을 함께 되돌리지 않는다. */
  const handleDeleteGroup = useCallback(
    (groupIndex: number) => {
      if (guardScheduleLock()) return;
      // 연쇄 예약 취소 — 180ms 대기 창 안에서 그룹을 삭제하면 예약된 groupIndex 가 stale 이 되어
      // phantom 시트가 뜨고, 거기서 확인한 입력은 groupIndex 매치 실패로 조용히 유실된다.
      clearPendingSwap();
      const current = form.getValues().scheduleGroups ?? [];
      if (current.length <= 1) return; // E4: 마지막 그룹은 버튼 자체 미노출 — 방어
      const target = current[groupIndex];
      if (!target) return;
      const removed = {
        ...target,
        dates: [...target.dates],
        timeSlots: cloneSlots(target.timeSlots),
      };
      const next = current.filter((_, i) => i !== groupIndex);
      form.setValue('scheduleGroups', next, { shouldDirty: true, shouldValidate: true });
      addToast({
        type: 'success',
        message: `${summarizeGroupDates(removed.dates) || '일정'} 일정을 삭제했어요`,
        duration: 5000,
        action: {
          label: '되돌리기',
          onPress: () => {
            const now = form.getValues().scheduleGroups ?? [];
            const insertAt = Math.min(groupIndex, now.length);
            form.setValue(
              'scheduleGroups',
              [...now.slice(0, insertAt), removed, ...now.slice(insertAt)],
              { shouldDirty: true, shouldValidate: true }
            );
          },
        },
      });
    },
    [form, addToast, guardScheduleLock, clearPendingSwap]
  );

  /** "+ 일정 추가" — 새 그룹은 날짜 시트부터, 시간/역할은 직전 그룹 깊은복사 시드(리뷰 Design-L2).
   *  add 모드는 세그먼트 미노출(v1 확정 — 리뷰 M-2 기록): 다그룹 상태에서 새 묶음지원(②) 구간은
   *  전체 날짜 whole+② 경로(동일 조건)로 우회 가능하고, 조건이 다른 복수 묶음 구간은 v1 범위 밖.
   *  confirm-시점-분할 단순성(E6 구조적 회피)을 유지하는 절충이다. */
  const handleAddSchedule = useCallback(() => {
    if (guardScheduleLock()) return;
    clearPendingSwap();
    const groups = form.getValues().scheduleGroups ?? [];
    chainArmedRef.current = true; // 새 그룹은 정의상 미설정 — 날짜 확정 후 시간·역할로 이어간다
    setActiveSheet({ key: 'dates', groupIndex: groups.length, mode: 'add' });
  }, [form, guardScheduleLock, clearPendingSwap]);

  /** 날짜 시트 확정 — whole 모드는 세그먼트에 따라 그룹 분할/유지(분할은 confirm 시점에만 실행) */
  const handleDatesConfirm = useCallback(
    (target: DatesTarget, dates: string[], segment: ScheduleSplitMode) => {
      const current = form.getValues().scheduleGroups ?? [];
      const sorted = [...dates].sort();
      let next: ScheduleGroups;
      if (target.mode === 'add') {
        const seed = cloneSlots(current[current.length - 1]?.timeSlots);
        next = [...current, { dates: sorted, timeSlots: seed, grouped: false }];
      } else if (target.mode === 'edit') {
        // grouped 그룹의 날짜가 연속쌍을 전부 잃으면 묶음지원 라벨 의미가 사라짐 — 해제(리뷰 L-2)
        next = current.map((g, i) =>
          i === target.groupIndex
            ? { ...g, dates: sorted, grouped: (g.grouped ?? false) && hasGroupableDates(sorted) }
            : g
        );
      } else {
        // whole — 단일 그룹 전체 편집(세그먼트). 분할 시 기존 공통 시간/역할을 각 그룹에 깊은복사 승계(E6).
        const base = current[target.groupIndex] ?? { dates: [], timeSlots: [], grouped: false };
        if (segment === 'separate') {
          next = sorted.map((d) => ({
            dates: [d],
            timeSlots: cloneSlots(base.timeSlots),
            grouped: false,
          }));
        } else if (segment === 'grouped') {
          // 연속 run별 분할 — run 길이 2+만 묶음지원(grouped=true), 단독 날짜는 날짜별 지원 유지(F6)
          next = groupConsecutiveDates(sorted).map((run) => ({
            dates: run,
            timeSlots: cloneSlots(base.timeSlots),
            grouped: run.length > 1,
          }));
        } else {
          next = [{ ...base, dates: sorted, grouped: false }];
        }
      }
      form.setValue('scheduleGroups', next, { shouldDirty: true, shouldValidate: true });
    },
    [form]
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
  // by_role 프리셋은 reset 직전 sync(Eng-H3) — 부분 커버 템플릿의 미커버 역할을 기본값으로 채운다.
  // fixed 프리셋은 역할 소스가 fixedSchedule.roles(전체리뷰 P3·P6 — dated 소스만 쓰면 갭필 무동작).
  const handleApplyPreset = useCallback(
    (preset: OrderSheetPreset) => {
      // 연쇄 예약 취소 — 대기 창(180ms) 안에서 폼 전체가 교체되면 예약된 타깃이 새 프리셋 값 위에
      // phantom 시트로 재등장한다(리뷰 실측: 프리셋 적용 직후 '연락처' 시트 팝업).
      clearPendingSwap();
      const v = preset.values;
      if (v.useSameSalary ?? false) {
        form.reset(v);
      } else {
        form.reset({
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
        });
      }
      setSalaryConfirmed(false);
    },
    [form, clearPendingSwap]
  );
  const handleSavePreset = useCallback(() => {
    onSaveTemplate?.(form.getValues());
  }, [onSaveTemplate, form]);

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

  const handleTypeChange = useCallback(
    (t: PostingType) => {
      // 연쇄 예약 취소 — 대기 창(180ms) 안에서 폼 구조(행 구성)가 바뀌면 예약된 타깃이
      // 새 타입의 폼 위에서 phantom 시트가 된다(fixed→dated 전환 시 '근무조건' 시트 팝업 실측).
      clearPendingSwap();
      const cur = form.getValues();
      if (cur.postingType === t) return; // 동일 타입 재탭 no-op — 오탭이 dirty만 남기는 것 방지
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
    },
    [form, clearPendingSwap]
  );

  const handleSubmitPress = form.handleSubmit(
    (valid) => onSubmit(valid),
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
        <ScrollView className="flex-1 px-4 pt-3" contentContainerClassName="pb-28">
          {presets !== undefined && (
            <PresetCarousel
              presets={presets}
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
          {/* 확정 지원자 일정 잠금(S3) — 일정·역할 행 편집 차단 안내. 서버 identity 가드와 대칭(급여는 열림). */}
          {scheduleLocked ? (
            <View
              className="flex-row items-start gap-2 mb-3 rounded-xl bg-surface-card border border-warning-200 dark:border-warning-800 px-3.5 py-3"
              accessibilityRole="alert"
              testID="order-sheet-schedule-locked-notice"
            >
              <InformationCircleIcon size={18} />
              <Text className="flex-1 text-xs font-sans text-content-secondary leading-[1.125rem] dark:leading-5">
                확정된 지원자가 있어 일정과 역할 정보는 수정할 수 없어요.
              </Text>
            </View>
          ) : null}
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
            // 일정·모집(S1) — 그룹 1개: 현행 3행 동일 / 2개+: 서브그룹(헤더+시간/역할 2행) 반복 +
            // h-px 디바이더(중첩 카드 금지 — impeccable §6) + 섹션 캡션 총원 + "+ 일정 추가".
            return (
              <OrderGroup
                key={section.title}
                title={section.title}
                caption={groupCount > 1 ? summarizeTotalRoles(values) || undefined : undefined}
              >
                {groupCount <= 1 ? (
                  section.rows.map((key) => (
                    <OrderRow
                      key={key}
                      state={getRowState(values, key, 0)}
                      error={rowError(key, 0)}
                      onPress={() => handleRowPress(key, 0)}
                      testID={`order-sheet-row-${key}`}
                    />
                  ))
                ) : (
                  <>
                    {scheduleGroups.map((group, gi) => {
                      const datesError = rowError('dates', gi);
                      const datesSummary = summarizeGroupDates(group.dates ?? []);
                      return (
                        <View key={`schedule-group-${gi}`}>
                          {gi > 0 ? (
                            <View className="h-px bg-secondary-100 dark:bg-surface-overlay" />
                          ) : null}
                          <View className="flex-row items-center pl-4 pr-1 pt-1.5">
                            <Pressable
                              onPress={() => handleRowPress('dates', gi)}
                              className="flex-1 min-h-[44px] justify-center active:opacity-80"
                              accessibilityRole="button"
                              accessibilityLabel={`일정 날짜 ${
                                (group.dates ?? [])
                                  .map((d) => {
                                    const [, m, day] = d.split('-');
                                    return `${Number(m)}월 ${Number(day)}일`;
                                  })
                                  .join(', ') || '미설정'
                              }, 탭하여 날짜 편집${datesError ? `, 오류: ${datesError}` : ''}`}
                              testID={`order-sheet-group-dates-${gi}`}
                            >
                              <Text className="text-sm font-sans-bold text-content-primary">
                                {datesSummary || '날짜 미설정'}
                              </Text>
                              {datesError ? (
                                <Text className="text-[11px] text-error-500 dark:text-error-400 font-sans">
                                  {datesError}
                                </Text>
                              ) : null}
                            </Pressable>
                            {/* 삭제 — muted 위계 강등 + hitSlop 확장(2차 Design-medium). E4: 그룹 1개면 미노출 */}
                            <Pressable
                              onPress={() => handleDeleteGroup(gi)}
                              hitSlop={14}
                              className="w-8 h-8 items-center justify-center active:opacity-80"
                              accessibilityRole="button"
                              accessibilityLabel={`${datesSummary || '이'} 일정 삭제`}
                              testID={`order-sheet-group-delete-${gi}`}
                            >
                              <XMarkIcon size={16} />
                            </Pressable>
                          </View>
                          {(['time', 'roles'] as const).map((key) => (
                            <OrderRow
                              key={key}
                              state={getRowState(values, key, gi)}
                              error={rowError(key, gi)}
                              onPress={() => handleRowPress(key, gi)}
                              testID={`order-sheet-row-${key}-${gi}`}
                            />
                          ))}
                        </View>
                      );
                    })}
                  </>
                )}
                <Pressable
                  onPress={handleAddSchedule}
                  className="min-h-[44px] items-center justify-center border-t border-secondary-100 dark:border-surface-overlay active:opacity-80"
                  accessibilityRole="button"
                  accessibilityLabel="일정 추가"
                  testID="order-sheet-add-schedule"
                >
                  <Text className="text-sm font-sans-medium text-primary-600 dark:text-primary-400">
                    ＋ 일정 추가
                  </Text>
                </Pressable>
              </OrderGroup>
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
          ⚠️ StackHeader 는 이 컴포넌트 밖이라 상단 헤더 띠는 덮이지 않는다(실기기 QA 항목). */}
        {chainSwapping ? (
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
              confirmRow({ key: 'roles', groupIndex: 0 });
            }}
            onClose={closeSheet}
          />
        )}
        {/* 일정·모집 시트 2종(그룹 스코프) — 날짜(달력+세그먼트)·시간역할 통합.
          행 탭 경로에는 시트→시트 스왑이 없다. 미설정 연쇄(confirmRow)만 SHEET_CHAIN_SWAP_MS
          지연 후 다음 시트를 마운트한다(#244 겹침 회피 패턴 승계). */}
        {datesTarget && (
          <ScheduleDatesSheet
            visible
            postingType={values.postingType}
            initialSelectedDates={
              datesTarget.mode === 'add'
                ? []
                : (scheduleGroups[datesTarget.groupIndex]?.dates ?? [])
            }
            existingDates={scheduleGroups
              .filter((_, i) => i !== datesTarget.groupIndex)
              .flatMap((g) => g.dates ?? [])}
            showSegment={datesTarget.mode === 'whole'}
            initialSegment={scheduleGroups[datesTarget.groupIndex]?.grouped ? 'grouped' : 'same'}
            onConfirm={({ dates, segment }) => {
              handleDatesConfirm(datesTarget, dates, segment);
              setActiveSheet(null);
              confirmRow({ key: 'dates', groupIndex: datesTarget.groupIndex });
            }}
            onClose={closeSheet}
          />
        )}
        {slotsTarget && (
          <ScheduleSlotsSheet
            visible
            value={scheduleGroups[slotsTarget.groupIndex]?.timeSlots ?? []}
            onConfirm={(next) => {
              const nextGroups = scheduleGroups.map((g, i) =>
                i === slotsTarget.groupIndex ? { ...g, timeSlots: next } : g
              );
              form.setValue('scheduleGroups', nextGroups, {
                shouldDirty: true,
                shouldValidate: true,
              });
              // 시간·역할이 한 번에 확정되므로 역할별 급여 동기화도 여기 1회로 수렴한다
              // (구 TimeSlotsSheet/RolesSheet 이중 호출 제거).
              applyRoleSalarySync(nextGroups);
              confirmRow({ key: 'roles', groupIndex: slotsTarget.groupIndex });
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
        {/* 조건 시트 — 복장·경력 프리셋. */}
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
