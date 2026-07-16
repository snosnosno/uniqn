import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
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
  errorMessageForRow,
  errorRowTargets,
  firstUnsetRow,
  getRowState,
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
import { TimeSlotsSheet } from './sheets/TimeSlotsSheet';
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
 * slotRoles: 특정 그룹·시간대(slotIndex)의 역할만 편집. fromTimeSheet=true 면 확인/닫기 시
 * TimeSlotsSheet 로 복귀(#244 지연 전환), false 면 rows 로 닫는다(단일 슬롯 직접 진입).
 */
type DatesTarget = { key: 'dates'; groupIndex: number; mode: 'whole' | 'edit' | 'add' };
type TimeTarget = { key: 'time'; groupIndex: number };
type SlotRolesTarget = {
  key: 'slotRoles';
  groupIndex: number;
  slotIndex: number;
  fromTimeSheet: boolean;
};
type ActiveSheet =
  // 'workConditions'는 Exclude<OrderRowKey,...>에 이미 포함(고정 근무조건 시트).
  // 'fixedRoles'는 OrderRowKey가 아닌 고정 전용 시트 키 — 그룹 슬롯 roles와 구분하려 별도 추가(S2).
  | Exclude<OrderRowKey, 'dates' | 'time' | 'roles'>
  | 'fixedRoles'
  | DatesTarget
  | TimeTarget
  | SlotRolesTarget
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
  /**
   * 레거시 폼 위임 콜백 — 대회(S1)·고정(S2) 모두 주문서 내부 처리로 이관돼 더 이상 호출되지 않는다.
   * create.tsx가 계속 전달하므로 계약은 유지하고(optional — 편집 화면은 미전달), 소비는 하지 않는다. S4에서 제거 예정.
   */
  onSwitchToLegacyForm?: (type: 'fixed' | 'tournament') => void;
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
  // onSwitchToLegacyForm는 의도적으로 구조분해하지 않는다 — S2에서 고정도 내부 처리로 이관돼 미호출(위 계약 주석).
  onDirtyChange,
  myPhone = '',
  presets,
  onSaveTemplate,
  mode = 'create',
  scheduleLocked = false,
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

  // 일정 타깃(객체) 좁히기 — rows/기타 시트 키(문자열)와 구분
  const scheduleTarget =
    activeSheet !== null && typeof activeSheet === 'object' ? activeSheet : null;
  const datesTarget = scheduleTarget?.key === 'dates' ? scheduleTarget : null;
  const timeTarget = scheduleTarget?.key === 'time' ? scheduleTarget : null;
  const slotRolesTarget = scheduleTarget?.key === 'slotRoles' ? scheduleTarget : null;

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

  // 행 탭 라우팅(그룹 스코프) — dates는 단일 그룹=whole(세그먼트)·다그룹=edit(헤더 재편집),
  // roles는 그룹 슬롯 수에 따라 분기(1개=직접 역할 편집, 그 외=TimeSlotsSheet).
  // switchSheet 지연 전환 창(300ms) 중에는 무시 — 그 사이 새 시트를 열면 예약 타이머와 충돌(#244 레이스).
  const handleRowPress = useCallback(
    (key: OrderRowKey, groupIndex = 0) => {
      if (guardScheduleLock(key)) return;
      if (pendingSheetRef.current) return;
      const groups = form.getValues().scheduleGroups ?? [];
      if (key === 'dates') {
        setActiveSheet({ key: 'dates', groupIndex, mode: groups.length > 1 ? 'edit' : 'whole' });
        return;
      }
      if (key === 'time') {
        setActiveSheet({ key: 'time', groupIndex });
        return;
      }
      if (key === 'roles') {
        // 고정(fixed)은 그룹 슬롯이 아니라 단일 fixedSchedule.roles 편집 — 전용 시트로 분기(S2).
        if (form.getValues().postingType === 'fixed') {
          seedFixedScheduleIfMissing();
          setActiveSheet('fixedRoles');
          return;
        }
        const count = groups[groupIndex]?.timeSlots?.length ?? 0;
        setActiveSheet(
          count === 1
            ? { key: 'slotRoles', groupIndex, slotIndex: 0, fromTimeSheet: false }
            : { key: 'time', groupIndex }
        );
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

  /** 그룹 삭제(즉시) + Undo 토스트 5초 — impeccable §12, 리뷰 Design-M2.
   *  복원은 삭제 그룹 단건 재삽입(리뷰 L-6) — 5초 내 타 그룹 편집을 함께 되돌리지 않는다. */
  const handleDeleteGroup = useCallback(
    (groupIndex: number) => {
      if (guardScheduleLock()) return;
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
    [form, addToast, guardScheduleLock]
  );

  /** "+ 일정 추가" — 새 그룹은 날짜 시트부터, 시간/역할은 직전 그룹 깊은복사 시드(리뷰 Design-L2).
   *  add 모드는 세그먼트 미노출(v1 확정 — 리뷰 M-2 기록): 다그룹 상태에서 새 묶음지원(②) 구간은
   *  전체 날짜 whole+② 경로(동일 조건)로 우회 가능하고, 조건이 다른 복수 묶음 구간은 v1 범위 밖.
   *  confirm-시점-분할 단순성(E6 구조적 회피)을 유지하는 절충이다. */
  const handleAddSchedule = useCallback(() => {
    if (guardScheduleLock()) return;
    if (pendingSheetRef.current) return;
    const groups = form.getValues().scheduleGroups ?? [];
    setActiveSheet({ key: 'dates', groupIndex: groups.length, mode: 'add' });
  }, [form, guardScheduleLock]);

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
    [form]
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
    [form]
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
      <View className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-2 bg-surface-page border-t border-secondary-100 dark:border-surface-overlay">
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
          }}
          onClose={() => setActiveSheet(null)}
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
              applySyncedRoleSalaries(prev, syncRoleSalariesForRoles(next, prev, cur.salary.type));
            }
          }}
          onClose={() => setActiveSheet(null)}
        />
      )}
      {/* 일정·모집 시트 3종(그룹 스코프) — 날짜(달력+세그먼트)·시간(다중 시간대)·역할(슬롯별).
          rows 진입은 즉시, TimeSlotsSheet↔RolesSheet 스왑만 switchSheet(#244 지연 전환)을 태운다. */}
      {datesTarget && (
        <ScheduleDatesSheet
          visible
          postingType={values.postingType}
          initialSelectedDates={
            datesTarget.mode === 'add' ? [] : (scheduleGroups[datesTarget.groupIndex]?.dates ?? [])
          }
          existingDates={scheduleGroups
            .filter((_, i) => i !== datesTarget.groupIndex)
            .flatMap((g) => g.dates ?? [])}
          showSegment={datesTarget.mode === 'whole'}
          initialSegment={scheduleGroups[datesTarget.groupIndex]?.grouped ? 'grouped' : 'same'}
          onConfirm={({ dates, segment }) => {
            handleDatesConfirm(datesTarget, dates, segment);
            setActiveSheet(null);
          }}
          onClose={() => setActiveSheet(null)}
        />
      )}
      {timeTarget && (
        <TimeSlotsSheet
          visible
          value={scheduleGroups[timeTarget.groupIndex]?.timeSlots ?? []}
          onConfirm={(next) => {
            const nextGroups = scheduleGroups.map((g, i) =>
              i === timeTarget.groupIndex ? { ...g, timeSlots: next } : g
            );
            form.setValue('scheduleGroups', nextGroups, {
              shouldDirty: true,
              shouldValidate: true,
            });
            applyRoleSalarySync(nextGroups);
          }}
          onClose={() => setActiveSheet(null)}
          onEditSlotRoles={(slotIndex) =>
            switchSheet({
              key: 'slotRoles',
              groupIndex: timeTarget.groupIndex,
              slotIndex,
              fromTimeSheet: true,
            })
          }
        />
      )}
      {slotRolesTarget && (
        <RolesSheet
          visible
          value={
            scheduleGroups[slotRolesTarget.groupIndex]?.timeSlots?.[slotRolesTarget.slotIndex]
              ?.roles ?? []
          }
          onConfirm={(next) => {
            const nextGroups = scheduleGroups.map((g, gi) =>
              gi === slotRolesTarget.groupIndex
                ? {
                    ...g,
                    timeSlots: (g.timeSlots ?? []).map((s, si) =>
                      si === slotRolesTarget.slotIndex ? { ...s, roles: next } : s
                    ),
                  }
                : g
            );
            form.setValue('scheduleGroups', nextGroups, {
              shouldDirty: true,
              shouldValidate: true,
            });
            applyRoleSalarySync(nextGroups);
          }}
          onClose={() =>
            slotRolesTarget.fromTimeSheet
              ? switchSheet({ key: 'time', groupIndex: slotRolesTarget.groupIndex })
              : setActiveSheet(null)
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
