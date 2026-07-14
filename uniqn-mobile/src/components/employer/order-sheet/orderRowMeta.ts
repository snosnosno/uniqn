/**
 * UNIQN Mobile - 주문서(공고작성 키오스크) 행 메타 (순수 로직)
 *
 * @description 폼 상태(OrderSheetFormValues = z.input)를 소비해 각 행의 라벨/요약값/미설정
 * 판정을 계산한다. 행 unset 판정은 zod 통과 가능성과 정렬돼야 한다(리뷰 H5) — 어긋나면
 * "라벨은 '이대로 등록'인데 눌러도 무반응"인 죽은 버튼이 생긴다.
 */
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';
import { STAFF_ROLES } from '@/constants/jobPosting';
import { PROVIDED_FLAG } from '@/utils/settlement';

export type OrderRowKey =
  | 'title'
  | 'place'
  | 'contact'
  | 'description'
  | 'dates'
  | 'time'
  | 'roles'
  | 'salary'
  | 'welfare'
  | 'tax'
  | 'conditions'
  | 'preQuestions';

export interface OrderRowState {
  label: string;
  value: string;
  unset: boolean;
  optional: boolean;
}

/** 행 타깃 — 일정 행(dates/time/roles)은 그룹 스코프(S1), 나머지는 groupIndex 0 고정 */
export interface OrderRowTarget {
  key: OrderRowKey;
  groupIndex: number;
}

export const ORDER_GROUPS = [
  { title: '기본 정보', rows: ['title', 'place', 'contact', 'description'] },
  { title: '일정 · 모집', rows: ['dates', 'time', 'roles'] },
  { title: '급여', rows: ['salary', 'welfare', 'tax'] },
  { title: '조건', rows: ['conditions'] },
  { title: '사전질문', rows: ['preQuestions'] },
] as const satisfies readonly { title: string; rows: readonly OrderRowKey[] }[];

/** RHF errors의 최상위 필드 → 행 매핑 (scheduleGroups는 아래 경로 워커가 처리) */
const ERROR_FIELD_TO_ROW: Record<string, OrderRowKey> = {
  title: 'title',
  location: 'place',
  contactPhone: 'contact',
  description: 'description',
  salary: 'salary',
  roleSalaries: 'salary',
  allowances: 'welfare',
  taxSettings: 'tax',
  conditions: 'conditions',
  preQuestions: 'preQuestions',
};

const hasMessage = (v: unknown): v is { message: string } =>
  typeof v === 'object' && v !== null && typeof (v as { message?: unknown }).message === 'string';

/**
 * RHF 에러 → 행 타깃 경로 워커 (리뷰 Eng-H1 — 문자열 맵 대체).
 *
 * errors.scheduleGroups가 배열이면 그룹별 순회: dates→dates행 · timeSlots(배열 min/루트)→time행 ·
 * timeSlots[i].startTime→time행 · timeSlots[i].roles→roles행. 배열 루트 에러(min(1)·상한)는
 * message/root 어느 형상이든 그룹0 dates 행으로 폴백(zodResolver 실측 테스트가 형상 고정).
 * 죽은 제출 버튼(H5/F5) 방지 — 어떤 에러든 행 하나로는 반드시 흘러가야 한다.
 */
export function errorRowTargets(errors: Record<string, unknown>): OrderRowTarget[] {
  const targets: OrderRowTarget[] = [];
  const push = (key: OrderRowKey, groupIndex: number) => {
    if (!targets.some((t) => t.key === key && t.groupIndex === groupIndex)) {
      targets.push({ key, groupIndex });
    }
  };

  const sg = errors['scheduleGroups'];
  if (Array.isArray(sg)) {
    sg.forEach((groupErr, gi) => {
      if (typeof groupErr !== 'object' || groupErr === null) return;
      const g = groupErr as Record<string, unknown>;
      if (g['dates'] !== undefined) push('dates', gi);
      const ts = g['timeSlots'];
      if (ts !== undefined) {
        if (Array.isArray(ts)) {
          for (const slotErr of ts) {
            if (typeof slotErr !== 'object' || slotErr === null) continue;
            const s = slotErr as Record<string, unknown>;
            if (s['startTime'] !== undefined) push('time', gi);
            if (s['roles'] !== undefined) push('roles', gi);
          }
          // 배열 자체 root 에러(min 등)
          if ((ts as unknown as Record<string, unknown>)['root'] !== undefined) push('time', gi);
        } else {
          push('time', gi); // timeSlots min(1) — 배열이 아니라 message 오브젝트로 온다
        }
      }
      if ((g['root'] as unknown) !== undefined) push('dates', gi);
    });
    // 배열이면서 루트 메시지가 병기되는 형상 방어
    const rootish = sg as unknown as Record<string, unknown>;
    if (hasMessage(rootish) || hasMessage(rootish['root'])) push('dates', 0);
  } else if (sg !== undefined) {
    // 배열 루트 에러(min(1)·합산 상한) — 그룹0 dates 행 폴백
    push('dates', 0);
  }

  for (const [field, err] of Object.entries(errors)) {
    if (field === 'scheduleGroups' || err === undefined) continue;
    const key = ERROR_FIELD_TO_ROW[field];
    if (key) push(key, 0);
  }
  return targets;
}

/** 행 단위 에러 메시지 — 중첩(그룹·roleSalaries 금액) 에러도 행 배지로 읽는다(S2 리뷰 L-2 해소) */
export function errorMessageForRow(
  errors: Record<string, unknown>,
  key: OrderRowKey,
  groupIndex: number
): string | undefined {
  const firstMessage = (...candidates: unknown[]): string | undefined => {
    for (const c of candidates) {
      if (hasMessage(c)) return c.message;
      if (typeof c === 'object' && c !== null && hasMessage((c as Record<string, unknown>)['root']))
        return ((c as Record<string, unknown>)['root'] as { message: string }).message;
    }
    return undefined;
  };

  if (key === 'dates' || key === 'time' || key === 'roles') {
    const sg = errors['scheduleGroups'];
    if (sg === undefined) return undefined;
    if (!Array.isArray(sg)) {
      return key === 'dates' && groupIndex === 0 ? firstMessage(sg) : undefined;
    }
    const g = sg[groupIndex] as Record<string, unknown> | undefined;
    if (key === 'dates') {
      return (
        firstMessage(g?.['dates'], g?.['root']) ?? (groupIndex === 0 ? firstMessage(sg) : undefined)
      );
    }
    const ts = g?.['timeSlots'];
    if (key === 'time') {
      if (ts === undefined) return undefined;
      if (!Array.isArray(ts)) return firstMessage(ts);
      for (const slotErr of ts) {
        const m = firstMessage((slotErr as Record<string, unknown> | undefined)?.['startTime']);
        if (m) return m;
      }
      return firstMessage((ts as unknown as Record<string, unknown>)['root']);
    }
    // roles
    if (!Array.isArray(ts)) return undefined;
    for (const slotErr of ts) {
      const roles = (slotErr as Record<string, unknown> | undefined)?.['roles'];
      const m = firstMessage(roles, roles);
      if (m) return m;
    }
    return undefined;
  }

  if (key === 'salary') {
    const salary = errors['salary'] as Record<string, unknown> | undefined;
    const rs = errors['roleSalaries'];
    const nested: unknown[] = [];
    if (Array.isArray(rs)) {
      for (const item of rs) {
        const s = (item as Record<string, unknown> | undefined)?.['salary'] as
          | Record<string, unknown>
          | undefined;
        nested.push(s?.['amount'], s);
      }
    }
    return firstMessage(salary, salary?.['amount'], rs, ...nested);
  }

  const field = Object.entries(ERROR_FIELD_TO_ROW).find(([, k]) => k === key)?.[0];
  return field ? firstMessage(errors[field]) : undefined;
}

/** 그룹 날짜 요약 — 연속 '7/20~21' · 비연속 '7/20 외 2일' · 단일 '7/20' (a11y는 호출부가 전체 나열) */
export function summarizeGroupDates(dates: string[]): string {
  if (dates.length === 0) return '';
  const sorted = [...dates].sort();
  const md = (ymd: string) => {
    const [, m, d] = ymd.split('-');
    return `${Number(m)}/${Number(d)}`;
  };
  if (sorted.length === 1) return md(sorted[0]!);
  const consecutive = sorted.every((date, i) => {
    if (i === 0) return true;
    const [y, m, d] = sorted[i - 1]!.split('-').map(Number);
    const next = new Date(y!, (m ?? 1) - 1, (d ?? 1) + 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}` === date;
  });
  if (!consecutive) return `${md(sorted[0]!)} 외 ${sorted.length - 1}일`;
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const sameMonth = first.slice(0, 7) === last.slice(0, 7);
  return sameMonth ? `${md(first)}~${Number(last.split('-')[2])}` : `${md(first)}~${md(last)}`;
}

const SALARY_TYPE_LABEL = {
  hourly: '시급',
  daily: '일급',
  monthly: '월급',
  other: '협의',
} as const;
const WELFARE_LABEL = {
  guaranteedHours: '보장시간',
  meal: '식사',
  transportation: '교통',
  accommodation: '숙소',
} as const;
const START_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** 역할 표시명 — 'other'는 customRole(없으면 '기타'), 그 외는 STAFF_ROLES 한글명. raw key 노출 금지(요약 일관성). */
export const roleName = (role: string, customRole?: string) =>
  role === 'other'
    ? (customRole ?? '기타')
    : (STAFF_ROLES.find((r) => r.key === role)?.name ?? role);
const roleKey = (role: string, customRole?: string) =>
  role === 'other' ? `other:${customRole ?? ''}` : role;

const salaryLabel = (s: { type: keyof typeof SALARY_TYPE_LABEL; amount: number }) =>
  s.type === 'other' ? '협의' : `${SALARY_TYPE_LABEL[s.type]} ${s.amount.toLocaleString()}원`;

type OrderSheetGroupSlots = NonNullable<
  OrderSheetFormValues['scheduleGroups']
>[number]['timeSlots'];

/** 전 그룹 순회 슬롯 합집합 — 급여 커버 판정·총원 요약 공용 소스(S1) */
function allSlots(values: OrderSheetFormValues): OrderSheetGroupSlots {
  return (values.scheduleGroups ?? []).flatMap((g) => g.timeSlots ?? []);
}

function summarizeRoles(slots: OrderSheetGroupSlots): string {
  const totals = new Map<string, number>();
  for (const slot of slots) {
    for (const r of slot.roles) {
      const name = roleName(r.role, r.customRole);
      totals.set(name, (totals.get(name) ?? 0) + r.count);
    }
  }
  return [...totals.entries()].map(([name, count]) => `${name} ${count}`).join(' · ');
}

/** 섹션 헤더 총원 캡션(리뷰 Design-L1) — "딜러 8 · 플로어 2" (전 그룹 합산) */
export function summarizeTotalRoles(values: OrderSheetFormValues): string {
  return summarizeRoles(allSlots(values));
}

function summarizeWelfare(values: OrderSheetFormValues): string {
  const parts = Object.entries(values.allowances ?? {})
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      const label = WELFARE_LABEL[k as keyof typeof WELFARE_LABEL] ?? k;
      if (k === 'guaranteedHours') return `${label} ${Number(v)}시간`;
      return v === PROVIDED_FLAG ? label : `${label} ${Number(v).toLocaleString()}`;
    });
  return parts.length > 0 ? parts.join(' · ') : '없음';
}

// FormValues(z.input)는 default 필드가 optional — 전 케이스에서 ?? 폴백으로 소비한다.
// 일정 행(dates/time/roles)은 groupIndex 스코프(S1) — 나머지 행은 무시.
export function getRowState(
  values: OrderSheetFormValues,
  key: OrderRowKey,
  groupIndex = 0
): OrderRowState {
  const group = (values.scheduleGroups ?? [])[groupIndex];
  switch (key) {
    case 'title':
      return {
        label: '제목',
        value: values.title,
        unset: values.title.length === 0,
        optional: false,
      };
    case 'place':
      return {
        label: '장소',
        value: values.location?.name ?? '',
        unset: values.location === null,
        optional: false,
      };
    case 'contact':
      return {
        label: '연락처',
        value: values.contactPhone,
        unset: values.contactPhone.length === 0,
        optional: false,
      };
    case 'description':
      return {
        label: '설명',
        value: (values.description ?? '') || '없음',
        unset: false,
        optional: true,
      };
    case 'dates': {
      const dates = group?.dates ?? [];
      return {
        label: '날짜',
        value: dates.join(', '),
        unset: dates.length === 0,
        optional: false,
      };
    }
    case 'time': {
      // H5 근본 수정: 해당 그룹 모든 슬롯의 startTime이 유효해야 set — 하나라도 빈 값이면 unset (zod와 정렬)
      const slots = group?.timeSlots ?? [];
      const allValid = slots.length > 0 && slots.every((s) => START_TIME_RE.test(s.startTime));
      const starts = slots.map((s) => s.startTime).filter((t) => START_TIME_RE.test(t));
      return {
        label: '시간',
        value: allValid ? `출근 ${starts.join(' · ')}` : '',
        unset: !allValid,
        optional: false,
      };
    }
    case 'roles': {
      // 해당 그룹 모든 슬롯에 역할 1개 이상이어야 set (zod min(1)과 정렬)
      const slots = group?.timeSlots ?? [];
      const allHaveRoles = slots.length > 0 && slots.every((s) => s.roles.length > 0);
      return {
        label: '역할',
        value: allHaveRoles ? summarizeRoles(slots) : '',
        unset: !allHaveRoles,
        optional: false,
      };
    }
    case 'salary': {
      const useSame = values.useSameSalary ?? false; // 기본 by_role(설계 §S2.1) — 5지점 통일
      if (!useSame) {
        // by_role: 전 그룹 시간대의 고유 역할 전부에 급여가 있어야 set (2026-07-14 결정, S1 전 그룹 순회)
        const roleSalaries = values.roleSalaries ?? [];
        const salaryByRole = new Map(
          roleSalaries.map((rs) => [roleKey(rs.role, rs.customRole), rs.salary])
        );
        const uniqueRoles = new Map<string, { role: string; customRole?: string }>();
        for (const slot of allSlots(values))
          for (const r of slot.roles) uniqueRoles.set(roleKey(r.role, r.customRole), r);
        const covered =
          uniqueRoles.size > 0 &&
          [...uniqueRoles.keys()].every((k) => {
            const s = salaryByRole.get(k);
            return s !== undefined && (s.type === 'other' || s.amount > 0);
          });
        const parts = [...uniqueRoles.values()].map((r) => {
          const s = salaryByRole.get(roleKey(r.role, r.customRole));
          return `${roleName(r.role, r.customRole)} ${
            s ? (s.type === 'other' ? '협의' : s.amount.toLocaleString()) : '미정'
          }`;
        });
        // 금액 truncation 금지(impeccable §26) — 역할 3개+면 첫 항목 + 개수 축약(2차 Design-medium)
        const summary =
          parts.length >= 3 ? `${parts[0]} 외 ${parts.length - 1}개 역할` : parts.join(' · ');
        return { label: '급여', value: covered ? summary : '', unset: !covered, optional: false };
      }
      const { type, amount } = values.salary;
      const set = type === 'other' || amount > 0;
      return {
        label: '급여',
        value: set ? salaryLabel(values.salary) : '',
        unset: !set,
        optional: false,
      };
    }
    case 'welfare':
      return { label: '복지', value: summarizeWelfare(values), unset: false, optional: true };
    case 'tax': {
      const t = values.taxSettings;
      const value =
        t === undefined || t.type === 'none'
          ? '세금 없음'
          : t.type === 'rate'
            ? `원천징수 ${t.value}%`
            : `정액 ${t.value.toLocaleString()}원`;
      return { label: '세금', value, unset: false, optional: true };
    }
    case 'conditions': {
      const c = values.conditions ?? {};
      const parts = [c.dressCode, c.experience].filter(Boolean);
      return {
        label: '조건',
        value: parts.length > 0 ? parts.join(' · ') : '없음',
        unset: false,
        optional: true,
      };
    }
    case 'preQuestions': {
      const qs = values.preQuestions ?? [];
      return {
        label: '사전질문',
        value: (values.usesPreQuestions ?? false) && qs.length > 0 ? `${qs.length}개` : '없음',
        unset: false,
        optional: true,
      };
    }
  }
}

/**
 * 첫 미설정 행 타깃 — 일정·모집 섹션은 그룹 순회(그룹0 dates→time→roles → 그룹1 …).
 * 제출 유도(H5)와 에러 배지가 같은 타깃을 흘려받는다(리뷰 Design-M3).
 */
export function firstUnsetRow(values: OrderSheetFormValues): OrderRowTarget | null {
  const groupCount = Math.max(1, (values.scheduleGroups ?? []).length);
  for (const section of ORDER_GROUPS) {
    const isSchedule = section.title === '일정 · 모집';
    const groupIndexes = isSchedule ? [...Array(groupCount).keys()] : [0];
    for (const groupIndex of groupIndexes) {
      for (const key of section.rows) {
        const state = getRowState(values, key, groupIndex);
        if (!state.optional && state.unset) return { key, groupIndex };
      }
    }
  }
  return null;
}
