/**
 * UNIQN Mobile - 주문서(공고작성 키오스크) 행 메타 (순수 로직)
 *
 * @description 폼 상태(OrderSheetFormValues = z.input)를 소비해 각 행의 라벨/요약값/미설정
 * 판정을 계산한다. 행 unset 판정은 zod 통과 가능성과 정렬돼야 한다(리뷰 H5) — 어긋나면
 * "라벨은 '이대로 등록'인데 눌러도 무반응"인 죽은 버튼이 생긴다.
 */
import { START_TIME_RE, type OrderSheetFormValues } from '@/schemas/orderSheet.schema';
import { STAFF_ROLES } from '@/constants/jobPosting';
import { PROVIDED_FLAG } from '@/utils/settlement';

export type OrderRowKey =
  | 'title'
  | 'place'
  | 'contact'
  | 'description'
  | 'dates'
  | 'time'
  | 'workConditions'
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

/** 고정(fixed) 섹션 — 날짜·시간 축이 없고 '근무조건' 행(요일·출근시간) + 역할로 모집을 구성한다(S2). */
export const FIXED_ORDER_GROUPS = [
  { title: '기본 정보', rows: ['title', 'place', 'contact', 'description'] },
  { title: '근무조건', rows: ['workConditions', 'roles'] },
  { title: '급여', rows: ['salary', 'welfare', 'tax'] },
  { title: '조건', rows: ['conditions'] },
  { title: '사전질문', rows: ['preQuestions'] },
] as const satisfies readonly { title: string; rows: readonly OrderRowKey[] }[];

/** postingType별 섹션 구성 — fixed는 날짜·시간 대신 근무조건 행. */
export function orderGroupsFor(postingType: OrderSheetFormValues['postingType']) {
  return postingType === 'fixed' ? FIXED_ORDER_GROUPS : ORDER_GROUPS;
}

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

  // 고정(fixed) 근무조건 에러 — roles 하위(min 1)는 '역할' 행, 그 외(startTime·요일·최상위 부재)는
  // '근무조건' 행으로. 죽은 제출 버튼(H5) 방지 — 어떤 형상이든 최소 한 행으로 흘러가야 한다.
  const fs = errors['fixedSchedule'];
  if (fs !== undefined) {
    const fsObj =
      typeof fs === 'object' && fs !== null ? (fs as Record<string, unknown>) : undefined;
    if (fsObj?.['roles'] !== undefined) push('roles', 0);
    if (
      fsObj?.['roles'] === undefined ||
      fsObj?.['startTime'] !== undefined ||
      fsObj?.['daysPerWeek'] !== undefined
    ) {
      push('workConditions', 0);
    }
  }

  for (const [field, err] of Object.entries(errors)) {
    if (field === 'scheduleGroups' || field === 'fixedSchedule' || err === undefined) continue;
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

  // 고정(fixed) 근무조건/역할 — errors.fixedSchedule 경로(전체리뷰 P3·P6: 라우팅(errorRowTargets)만
  // 되고 메시지 미배선이면 행 배지가 침묵한다 — dated L-1/L-2에서 고친 클래스의 fixed 재발 차단).
  const fse = errors['fixedSchedule'] as Record<string, unknown> | undefined;
  if (key === 'workConditions') {
    return firstMessage(
      fse?.['startTime'],
      fse?.['daysPerWeek'],
      fse?.['isStartTimeNegotiable'],
      fse
    );
  }
  if (key === 'roles' && fse !== undefined) {
    const roles = fse['roles'];
    let m = firstMessage(roles);
    if (m === undefined && Array.isArray(roles)) {
      for (const roleErr of roles) {
        const r = roleErr as Record<string, unknown> | undefined;
        m = firstMessage(r?.['customRole'], r?.['count'], r);
        if (m !== undefined) break;
      }
    }
    if (m !== undefined) return m;
    // roles 관련 에러가 아니면 아래 dated 경로 폴백 — fixed에선 scheduleGroups 에러가 없어 무해
  }

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
    // roles — 배열 루트(min 1) 메시지 우선, 없으면 아이템(customRole XSS·count) 중첩 메시지 순회(리뷰 L-1)
    if (!Array.isArray(ts)) return undefined;
    for (const slotErr of ts) {
      const roles = (slotErr as Record<string, unknown> | undefined)?.['roles'];
      let m = firstMessage(roles);
      if (m === undefined && Array.isArray(roles)) {
        for (const roleErr of roles) {
          const r = roleErr as Record<string, unknown> | undefined;
          m = firstMessage(r?.['customRole'], r?.['count'], r);
          if (m !== undefined) break;
        }
      }
      if (m !== undefined) return m;
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

  if (key === 'place') {
    // location 중첩(name XSS·region 필수) 에러도 행 배지로 — 루트(null refine) 우선
    const loc = errors['location'] as Record<string, unknown> | undefined;
    return firstMessage(
      loc,
      loc?.['region'],
      loc?.['name'],
      loc?.['address'],
      loc?.['detailedAddress']
    );
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

/** fixed/dated 공용 고유역할 소스 — 급여 커버·역할 요약(S2). fixed는 평탄 배열, dated는 전 그룹 슬롯 합집합. */
function formRoleList(
  values: OrderSheetFormValues
): { role: string; customRole?: string; count: number }[] {
  if (values.postingType === 'fixed') {
    return values.fixedSchedule?.roles ?? [];
  }
  return allSlots(values).flatMap((s) => s.roles);
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
    case 'place': {
      const loc = values.location;
      return {
        label: '장소',
        value: loc?.name ?? '',
        // 지역 필수(2026-07-15) — zod 통과 가능성과 정렬(H5): region 없으면 '이대로 등록' 오표기 금지
        unset: loc === null || !loc.region,
        optional: false,
      };
    }
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
      // H5 근본 수정: 해당 그룹 모든 슬롯이 유효(시각 HH:MM 또는 시간 미정)해야 set — zod superRefine과 정렬
      const slots = group?.timeSlots ?? [];
      const slotSet = (s: (typeof slots)[number]) =>
        s.isTimeToBeAnnounced === true || START_TIME_RE.test(s.startTime);
      const allValid = slots.length > 0 && slots.every(slotSet);
      const starts = slots
        .filter(slotSet)
        .map((s) => (s.isTimeToBeAnnounced === true ? '미정' : s.startTime));
      return {
        label: '시간',
        value: allValid ? `출근 ${starts.join(' · ')}` : '',
        unset: !allValid,
        optional: false,
      };
    }
    case 'workConditions': {
      // 고정(fixed) 근무조건 — 요일(0=협의) + 출근시간(협의면 부재 허용). zod superRefine과 정렬(H5).
      const fs = values.fixedSchedule;
      const negotiable = fs?.isStartTimeNegotiable ?? false;
      const timeSet = negotiable || (!!fs?.startTime && START_TIME_RE.test(fs.startTime));
      const daysLabel =
        fs === undefined ? '' : fs.daysPerWeek === 0 ? '주 협의' : `주 ${fs.daysPerWeek}일`;
      const timeLabel = fs === undefined ? '' : negotiable ? '출근 협의' : `출근 ${fs.startTime}`;
      return {
        label: '근무조건',
        value: fs !== undefined && timeSet ? `${daysLabel} · ${timeLabel}` : '',
        unset: fs === undefined || !timeSet,
        optional: false,
      };
    }
    case 'roles': {
      // fixed는 평탄 역할 배열(min 1), dated는 해당 그룹 모든 슬롯에 역할 1개 이상 (zod min(1)과 정렬)
      if (values.postingType === 'fixed') {
        const roles = values.fixedSchedule?.roles ?? [];
        return {
          label: '역할',
          value: roles.length > 0 ? summarizeRoles([{ startTime: '', roles }]) : '',
          unset: roles.length === 0,
          optional: false,
        };
      }
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
        // fixed/dated 공용 소스 — 급여 커버 대상 고유 역할(S2)
        for (const r of formRoleList(values)) uniqueRoles.set(roleKey(r.role, r.customRole), r);
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
 * 화면에 보이는 순서대로의 전체 행 타깃 목록 — 일정·모집 섹션은 그룹 수만큼 반복한다.
 * firstUnsetRow / nextUnsetRowAfter 의 공통 순회 소스(DRY).
 */
export function orderedRowTargets(values: OrderSheetFormValues): OrderRowTarget[] {
  const isFixed = values.postingType === 'fixed';
  // fixed 는 날짜 축이 없어 단일 그룹(index 0)만 순회 — dated 는 그룹 수만큼 일정·모집 반복(S1)
  const groupCount = isFixed ? 1 : Math.max(1, (values.scheduleGroups ?? []).length);
  const targets: OrderRowTarget[] = [];
  for (const section of orderGroupsFor(values.postingType)) {
    const isSchedule = section.title === '일정 · 모집';
    const groupIndexes = isSchedule ? [...Array(groupCount).keys()] : [0];
    for (const groupIndex of groupIndexes) {
      for (const key of section.rows) {
        targets.push({ key, groupIndex });
      }
    }
  }
  return targets;
}

/** 해당 타깃이 "채워야 하는데 비어 있는" 상태인지 */
function isUnsetTarget(values: OrderSheetFormValues, target: OrderRowTarget): boolean {
  const state = getRowState(values, target.key, target.groupIndex);
  return !state.optional && state.unset;
}

/**
 * 첫 미설정 행 타깃 — 일정·모집 섹션은 그룹 순회(그룹0 dates→time→roles → 그룹1 …).
 * 제출 유도(H5)와 에러 배지가 같은 타깃을 흘려받는다(리뷰 Design-M3).
 */
export function firstUnsetRow(values: OrderSheetFormValues): OrderRowTarget | null {
  return orderedRowTargets(values).find((t) => isUnsetTarget(values, t)) ?? null;
}

/**
 * 연쇄 입력용 — current 다음 위치부터 순환 순회하며 첫 미설정 행을 낸다.
 *
 * 전역 첫 미설정(firstUnsetRow)을 쓰면 뒤쪽 행을 확정했을 때 앞쪽 미설정 행으로 되돌아가
 * 사용자가 끌려가는 느낌을 받는다. 한 바퀴 돌아 current 로 돌아오면 null 을 반환해
 * 연쇄를 끝낸다 — current 가 확인 후에도 여전히 unset 인 경우(금액 0 확인 등)의
 * 무한 재오픈을 구조적으로 차단한다.
 *
 * current 가 목록에 없으면(타입 전환 등으로 행 구성이 바뀐 경우) 앞에서부터 훑는다.
 *
 * @param coveredKeys 방금 확인한 시트가 함께 확정한 행들. 기본값은 current 하나.
 *   ⚠️ 행과 시트는 1:1 이 아니다 — 시간·역할 두 행은 ScheduleSlotsSheet 하나로 열리고
 *   확인은 roles 로만 보고된다. current 하나만 제외하면 time 이 곧바로 다음 타깃이 되어
 *   **같은 시트가 무한 재오픈**된다(슬롯 추가 후 시간 미선택 확인으로 재현). 시트가
 *   커버하는 행 전체를 넘겨야 "확인한 것은 다시 묻지 않는다"는 가드가 성립한다.
 *   같은 그룹에만 적용되므로 다른 그룹의 동일 행은 정상적으로 다음 타깃이 된다.
 */
export function nextUnsetRowAfter(
  values: OrderSheetFormValues,
  current: OrderRowTarget,
  coveredKeys: readonly OrderRowKey[] = [current.key]
): OrderRowTarget | null {
  const targets = orderedRowTargets(values);
  const currentIndex = targets.findIndex(
    (t) => t.key === current.key && t.groupIndex === current.groupIndex
  );
  const start = currentIndex + 1; // 못 찾으면 -1 → 0 부터 = 앞에서부터 훑기
  for (let offset = 0; offset < targets.length; offset += 1) {
    const target = targets[(start + offset) % targets.length];
    if (target === undefined) continue;
    if (currentIndex >= 0 && (start + offset) % targets.length === currentIndex) break;
    if (target.groupIndex === current.groupIndex && coveredKeys.includes(target.key)) continue;
    if (isUnsetTarget(values, target)) return target;
  }
  return null;
}
