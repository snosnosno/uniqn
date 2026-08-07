/**
 * 주문서 화면의 공용 타입·상수 — 화면과 그 훅들이 함께 읽는다.
 *
 * `OrderSheetScreen.tsx` 안에 있던 것을 그대로 옮겼다. 훅으로 로직을 갈라내면서
 * 화면과 훅이 같은 좌표계(일정 타깃·그룹 타입)를 말해야 했기 때문이고, 정의를 옮긴 것 외에
 * 의미는 바뀌지 않았다.
 */
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';
import type { OrderRowKey } from './orderRowMeta';

export type ScheduleGroups = NonNullable<OrderSheetFormValues['scheduleGroups']>;
export type GroupTimeSlots = ScheduleGroups[number]['timeSlots'];

/**
 * 활성 시트 상태 — 행 키(비일정) 또는 일정 타깃.
 *
 * 날짜 시트는 **전 일정 스코프** 하나뿐이다(조건 유도 그룹핑 — 사장은 날짜만 고르고 카드
 * 경계는 조건이 정한다). 구 whole/edit/add 3모드와 3지 세그먼트가 여기서 사라진다.
 */
export type DatesTarget = { key: 'dates' };

/**
 * 시간·역할 시트 타깃 — 좌표를 **날짜집합**으로 든다(§3.7·F9).
 * 시트가 열려 있는 동안 정규화가 카드 순서를 바꿀 수 있으므로 confirm 시점에 재해석한다.
 *
 * 구 `mode: 'edit' | 'exception'` 은 사라졌다 — 시트가 "적용할 날짜"를 항상 보여주고
 * 0개 선택이 곧 카드 전체 편집이라, 두 모드가 하나의 연산(`applyConditionToDates`)으로 합쳐졌다.
 * 모드 전환이 없어지면서 리마운트·편집값 승계(구 seedSlots) 문제도 함께 소멸했다.
 */
export type SlotsTarget = {
  key: 'slots';
  dates: readonly string[];
  fallbackIndex: number;
};

export type ActiveSheet =
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
export const SLOTS_SHEET_ROWS: readonly OrderRowKey[] = ['time', 'roles'];

/** 폼 슬롯 깊은복사(F1/E6) — 분할·시드 시 참조 공유로 타 그룹이 오염되는 것을 차단 */
export const cloneSlots = (slots: GroupTimeSlots | undefined): GroupTimeSlots =>
  (slots ?? []).map((s) => ({ ...s, roles: s.roles.map((r) => ({ ...r })) }));

/** 고정 전환/방어 시드 기본값 — 제품 기본 주 5일(레거시 INITIAL은 0=협의, jobPostingForm.ts:202) */
export const defaultFixedSchedule = (): NonNullable<OrderSheetFormValues['fixedSchedule']> => ({
  daysPerWeek: 5,
  isStartTimeNegotiable: false,
  roles: [],
});

/** 자동 시드된 기본값과 다른, **사용자가 실제로 넣은** 근무조건이 있는가. */
export function hasUserFixedInput(fixed: OrderSheetFormValues['fixedSchedule']): boolean {
  if (fixed === undefined) return false;
  const seed = defaultFixedSchedule();
  return (
    (fixed.roles?.length ?? 0) > 0 ||
    fixed.startTime !== undefined ||
    fixed.isStartTimeNegotiable !== seed.isStartTimeNegotiable ||
    fixed.daysPerWeek !== seed.daysPerWeek
  );
}
