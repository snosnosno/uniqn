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

export const ORDER_GROUPS = [
  { title: '기본 정보', rows: ['title', 'place', 'contact', 'description'] },
  { title: '일정 · 모집', rows: ['dates', 'time', 'roles'] },
  { title: '급여', rows: ['salary', 'welfare', 'tax'] },
  { title: '조건', rows: ['conditions'] },
  { title: '사전질문', rows: ['preQuestions'] },
] as const satisfies readonly { title: string; rows: readonly OrderRowKey[] }[];

/** RHF errors의 최상위 필드 → 행 매핑 (에러 배지·onInvalid 시트 유도용) */
const ERROR_FIELD_TO_ROW: Record<string, OrderRowKey> = {
  title: 'title',
  location: 'place',
  contactPhone: 'contact',
  description: 'description',
  dates: 'dates',
  timeSlots: 'time',
  salary: 'salary',
  roleSalaries: 'salary',
  allowances: 'welfare',
  taxSettings: 'tax',
  conditions: 'conditions',
  preQuestions: 'preQuestions',
};
export function rowKeyForErrorField(field: string): OrderRowKey | null {
  return ERROR_FIELD_TO_ROW[field] ?? null;
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

const roleName = (role: string, customRole?: string) =>
  role === 'other'
    ? (customRole ?? '기타')
    : (STAFF_ROLES.find((r) => r.key === role)?.name ?? role);
const roleKey = (role: string, customRole?: string) =>
  role === 'other' ? `other:${customRole ?? ''}` : role;

const salaryLabel = (s: { type: keyof typeof SALARY_TYPE_LABEL; amount: number }) =>
  s.type === 'other' ? '협의' : `${SALARY_TYPE_LABEL[s.type]} ${s.amount.toLocaleString()}원`;

function summarizeRoles(values: OrderSheetFormValues): string {
  const totals = new Map<string, number>();
  for (const slot of values.timeSlots ?? []) {
    for (const r of slot.roles) {
      const name = roleName(r.role, r.customRole);
      totals.set(name, (totals.get(name) ?? 0) + r.count);
    }
  }
  return [...totals.entries()].map(([name, count]) => `${name} ${count}`).join(' · ');
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
export function getRowState(values: OrderSheetFormValues, key: OrderRowKey): OrderRowState {
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
    case 'dates':
      return {
        label: '날짜',
        value: values.dates.join(', '),
        unset: values.dates.length === 0,
        optional: false,
      };
    case 'time': {
      // H5 근본 수정: 모든 슬롯의 startTime이 유효해야 set — 하나라도 빈 값이면 unset (zod와 정렬)
      const slots = values.timeSlots ?? [];
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
      // 모든 슬롯에 역할 1개 이상이어야 set (zod min(1)과 정렬)
      const slots = values.timeSlots ?? [];
      const allHaveRoles = slots.length > 0 && slots.every((s) => s.roles.length > 0);
      return {
        label: '역할',
        value: allHaveRoles ? summarizeRoles(values) : '',
        unset: !allHaveRoles,
        optional: false,
      };
    }
    case 'salary': {
      const useSame = values.useSameSalary ?? true;
      if (!useSame) {
        // by_role: 시간대의 고유 역할 전부에 급여가 있어야 set (2026-07-14 결정)
        const roleSalaries = values.roleSalaries ?? [];
        const salaryByRole = new Map(
          roleSalaries.map((rs) => [roleKey(rs.role, rs.customRole), rs.salary])
        );
        const uniqueRoles = new Map<string, { role: string; customRole?: string }>();
        for (const slot of values.timeSlots ?? [])
          for (const r of slot.roles) uniqueRoles.set(roleKey(r.role, r.customRole), r);
        const covered =
          uniqueRoles.size > 0 &&
          [...uniqueRoles.keys()].every((k) => {
            const s = salaryByRole.get(k);
            return s !== undefined && (s.type === 'other' || s.amount > 0);
          });
        const summary = [...uniqueRoles.values()]
          .map((r) => {
            const s = salaryByRole.get(roleKey(r.role, r.customRole));
            return `${roleName(r.role, r.customRole)} ${
              s ? (s.type === 'other' ? '협의' : s.amount.toLocaleString()) : '미정'
            }`;
          })
          .join(' · ');
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

export function firstUnsetRow(values: OrderSheetFormValues): OrderRowKey | null {
  for (const group of ORDER_GROUPS) {
    for (const key of group.rows) {
      const state = getRowState(values, key);
      if (!state.optional && state.unset) return key;
    }
  }
  return null;
}
