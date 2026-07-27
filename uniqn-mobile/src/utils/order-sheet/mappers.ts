/**
 * UNIQN Mobile - 주문서(공고작성 키오스크) 값 ↔ canonical draft 매퍼
 *
 * @description OrderSheetValues(폼 제출 결과)와 JobPostingDraft/CreateJobPostingInput 사이의
 * 단일 왕복 계층. 이후 UI 태스크(주문서 화면·프리셋·그리드 프리필)가 전부 이 매퍼를 소비한다.
 */
import type { OrderSheetFormValues, OrderSheetValues } from '@/schemas/orderSheet.schema';
import type {
  CreateJobPostingInput,
  PostingRoleCatalogEntry,
  PostingTimeSlot,
  SalaryInfo,
  UpdateJobPostingInput,
} from '@/types/jobPosting';
import type { JobPostingDraft } from '@/types/jobPostingDraft';
import type { JobPostingTemplate } from '@/types/jobTemplate';
import { templateToDraft } from '@/types/jobTemplate';
import {
  buildFixedSyntheticRequirement,
  draftToCreateJobPostingInput,
  draftToUpdateJobPostingInput,
} from '@/utils/job-posting/draftAdapter';
import { toDateString } from '@/utils/date';
import { DEFAULT_SLOT_START_TIME } from '@/domains/weeklyGrid';
import { DEFAULT_SALARY_BY_TYPE } from '@/constants/jobPosting';
import { syncRoleSalaries } from '@/utils/order-sheet/roleSalaries';
import { generateId } from '@/utils/generateId';

// 정의는 의존성 0 모듈(constants/jobPosting)로 이동 — roleSalaries.ts와의 순환 차단. 기존 소비처용 재수출.
export { DEFAULT_SALARY_BY_TYPE };
export const HOURLY_STEP = 1000;

type OrderSheetScheduleGroups = OrderSheetValues['scheduleGroups'];
type OrderSheetGroupTimeSlots = OrderSheetScheduleGroups[number]['timeSlots'];

/** 초기 주문서 SSOT — INITIAL_JOB_POSTING_DRAFT 경유 금지(by_role·09:00 기본슬롯 유입, 리뷰 실측). */
export function initialOrderSheetValues(): OrderSheetFormValues {
  return {
    postingType: 'regular',
    title: '',
    location: null,
    contactPhone: '', // create.tsx가 프로필 phone으로 덮어씀 (Task 5 Step 6)
    description: '',
    // 빈 단일 그룹 = 구 평탄(dates:[]·timeSlots:[]) 초기 상태와 동등(S1)
    scheduleGroups: [{ dates: [], timeSlots: [], grouped: false }],
    salary: { type: 'hourly', amount: DEFAULT_SALARY_BY_TYPE.hourly },
    useSameSalary: false, // 기본 by_role(설계 §S2.1) — 5지점 통일
    roleSalaries: [],
    allowances: {},
    conditions: {},
    usesPreQuestions: false,
    preQuestions: [],
  };
}

/** 날짜별 requirements가 참조를 공유하지 않도록 호출마다 새 슬롯 생성 + id 부여 (gridPrefill.ts 관례, F1).
 *  시간 미정 슬롯은 startTime을 **기록하지 않고** isTimeToBeAnnounced=true만 싣는다
 *  (unified TimeSlotInfo 계약 — 미정이면 startTime null/부재, createTimeSlotInfo와 동형). */
function toPostingTimeSlots(slots: OrderSheetGroupTimeSlots): PostingTimeSlot[] {
  return slots.map((slot) => ({
    id: generateId(),
    ...(slot.isTimeToBeAnnounced === true
      ? { isTimeToBeAnnounced: true as const }
      : { startTime: slot.startTime }),
    roles: slot.roles.map((r) => ({
      id: generateId(),
      role: r.role,
      ...(r.role === 'other' && r.customRole !== undefined ? { customRole: r.customRole } : {}),
      count: r.count,
    })),
  }));
}

/** 전 그룹 순회 슬롯 합집합 — 급여 파생(uniqueRoles·커버 게이트·roleCatalog) 공용 소스 */
function allGroupTimeSlots(values: OrderSheetValues): OrderSheetGroupTimeSlots {
  return values.scheduleGroups.flatMap((g) => g.timeSlots);
}

type OrderSheetFixedSchedule = NonNullable<OrderSheetValues['fixedSchedule']>;
type FormRoleRef = OrderSheetFixedSchedule['roles'][number];

/** fixed/dated 공용 역할 목록 — roleCatalog·급여 파생의 단일 소스(S2).
 *  fixed는 fixedSchedule 부재여도 dated 소스로 새지 않는다(valuesToDraft fixed 분기와 동일 계약). */
function collectFormRoles(values: OrderSheetValues): FormRoleRef[] {
  if (values.postingType === 'fixed') {
    return values.fixedSchedule?.roles ?? [];
  }
  return allGroupTimeSlots(values).flatMap((slot) => slot.roles);
}

const roleKey = (role: string, customRole?: string) =>
  role === 'other' ? `other:${customRole ?? ''}` : role;

function toRoleCatalog(values: OrderSheetValues): PostingRoleCatalogEntry[] {
  const salaryByRole = new Map<string, SalaryInfo>(
    values.useSameSalary
      ? []
      : values.roleSalaries.map((rs) => [roleKey(rs.role, rs.customRole), rs.salary])
  );
  const seen = new Map<string, PostingRoleCatalogEntry>();
  // 역할 소스는 collectFormRoles(fixed=fixedSchedule.roles / dated=전 그룹 슬롯 역할) — dated 결과 불변.
  for (const r of collectFormRoles(values)) {
    const key = roleKey(r.role, r.customRole);
    if (!seen.has(key)) {
      // 동등성 계약(레거시 buildRoleCatalogFromFormData 동등): shared(동일급여)이면 defaultSalary(values.salary)를
      // 각 엔트리에 복사한다. roleCatalog[].salary 를 진실원으로 읽는 소비지점(협의 급여 표시 core.ts:154·
      // 사업주 수정화면 SalarySection)의 레거시 대비 회귀를 막는다. 왕복은 draftToValues 가 by_role 일 때만
      // roleSalaries 를 복원해 유지한다.
      const salary = values.useSameSalary ? values.salary : salaryByRole.get(key);
      seen.set(key, {
        role: r.role,
        ...(r.role === 'other' && r.customRole !== undefined ? { customRole: r.customRole } : {}),
        ...(salary !== undefined ? { salary } : {}),
      });
    }
  }
  return [...seen.values()];
}

/**
 * by_role의 defaultSalary = roleSalaries 최저값 (CEO-1 — 유령 세그먼트 캐리어 기록 금지).
 *
 * defaultSalary 소비처 실측 3곳(정산 폴백 SettlementCalculator·카드 a11y 헤드라인
 * postingSurfaceModel·급여 필터 salary_*_max)이 폴백으로 읽어도 "최저가부터" 의미가 되도록 한다.
 * 협의(other) 행은 금액 축이 없어 최저값 산정에서 제외 — 전원 협의면 협의로 기록.
 * 고아(timeSlots에서 사라진 역할) 엔트리도 제외(리뷰 H-1) — 어떤 실 역할도 지급하지 않는 금액이
 * 카드 헤드라인·정산 폴백에 기록되는 과소 공시를 막는다. 고아 잔류는 폼 상태 한정 결정이다.
 */
function resolveDefaultSalary(values: OrderSheetValues): SalaryInfo {
  if (values.useSameSalary || values.roleSalaries.length === 0) return values.salary;
  const activeKeys = new Set<string>();
  for (const r of collectFormRoles(values)) activeKeys.add(roleKey(r.role, r.customRole));
  const active = values.roleSalaries.filter((rs) =>
    activeKeys.has(roleKey(rs.role, rs.customRole))
  );
  if (active.length === 0) return values.salary;
  const priced = active.filter((rs) => rs.salary.type !== 'other');
  if (priced.length === 0) return { type: 'other', amount: 0 };
  return priced.reduce(
    (min, rs) => (rs.salary.amount < min.amount ? rs.salary : min),
    priced[0]!.salary
  );
}

export function valuesToDraft(values: OrderSheetValues): JobPostingDraft {
  // 축 무관 공통 필드(postingType/title/roleCatalog/compensation/questions/conditions) — fixed·dated 공유.
  // 직접 조립(스프레드 없음) — JobPostingDraft 필수 필드는 TS가 강제, INITIAL 오염 원천 차단.
  const compensation = {
    mode: values.useSameSalary ? ('shared' as const) : ('by_role' as const),
    defaultSalary: resolveDefaultSalary(values),
    ...(Object.keys(values.allowances).length > 0 ? { allowances: values.allowances } : {}),
    ...(values.taxSettings !== undefined ? { taxSettings: values.taxSettings } : {}),
  };
  const common = {
    postingType: values.postingType,
    title: values.title,
    description: values.description,
    location: values.location,
    contactPhone: values.contactPhone,
    tags: [] as string[],
    ...(values.venueId !== undefined ? { venueId: values.venueId } : {}),
    roleCatalog: toRoleCatalog(values),
    compensation,
    questions: { items: values.usesPreQuestions ? values.preQuestions : [] },
    ...(values.conditions.dressCode !== undefined || values.conditions.experience !== undefined
      ? { conditions: values.conditions }
      : {}),
  };

  // ── 고정(fixed) 조립 ── 날짜 축 없음. fixedSchedule.roles → date:null synthetic requirement(레거시 등가).
  // postingType만으로 분기(#194 방어, 전체리뷰 P4) — fixedSchedule 부재(비정상 잔여 상태)에서 dated로
  // 오분기하면 {postingType:'fixed', kind:'dated'} mixed draft가 저장돼 재로드 시 regular로 침묵 전환된다.
  if (values.postingType === 'fixed') {
    const fs = values.fixedSchedule ?? { daysPerWeek: 0, isStartTimeNegotiable: false, roles: [] };
    const roles = fs.roles.map((r) => ({
      role: r.role,
      ...(r.role === 'other' && r.customRole !== undefined ? { customRole: r.customRole } : {}),
      count: r.count,
    }));
    return {
      ...common,
      schedule: {
        kind: 'fixed',
        daysPerWeek: fs.daysPerWeek,
        ...(fs.startTime ? { startTime: fs.startTime } : {}),
        isStartTimeNegotiable: fs.isStartTimeNegotiable,
        requirements: [buildFixedSyntheticRequirement(roles, fs.startTime)],
      },
    };
  }

  // ── dated 조립(기존) ──
  // 그룹 flatMap 쓰기(S1) — grouped=true 그룹만 isGrouped 기록(F6: 지원자 묶음지원 축, 미기록=날짜별 지원),
  // 날짜별 timeSlots는 호출마다 새로 생성(F1 deepClone). requirements·allDates는 날짜 전역 정렬(2차 Eng-H1),
  // allDates는 dedupe 합집합(F2 — 중복은 스키마 E1이 원천 차단하나 방어 유지).
  const requirements = values.scheduleGroups
    .flatMap((g) =>
      g.dates.map((date) => ({
        date,
        timeSlots: toPostingTimeSlots(g.timeSlots),
        ...(g.grouped ? { isGrouped: true as const } : {}),
      }))
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const allDates = [...new Set(values.scheduleGroups.flatMap((g) => g.dates))].sort();

  return {
    ...common,
    schedule: {
      kind: 'dated',
      primaryDate: allDates[0] ?? '',
      allDates,
      requirements,
      templateTimeSlots: toPostingTimeSlots(values.scheduleGroups[0]?.timeSlots ?? []),
    },
  };
}

/** 왕복 비교용 — draft 슬롯의 생성 id를 벗겨 구조만 비교한다. 미정 플래그는 시그니처에 포함
 *  (미정 슬롯과 시각 슬롯이 같은 그룹으로 병합되는 오류 차단 — startTime 부재는 JSON에서 증발). */
const stripSlotIds = (slots: PostingTimeSlot[]) =>
  slots.map((s) => ({
    startTime: s.startTime,
    ...(s.isTimeToBeAnnounced === true ? { isTimeToBeAnnounced: true as const } : {}),
    roles: s.roles.map((r) => ({
      role: r.role,
      ...(r.customRole !== undefined ? { customRole: r.customRole } : {}),
      count: r.count,
    })),
  }));

/** draft 슬롯 → 폼 슬롯(id 제거·구조만) — 그룹 복원 공용. 미정 플래그는 true일 때만 복원(optional 계약). */
function toFormTimeSlots(slots: PostingTimeSlot[]): OrderSheetGroupTimeSlots {
  return slots.map((slot) => ({
    startTime: slot.startTime ?? '',
    ...(slot.isTimeToBeAnnounced === true ? { isTimeToBeAnnounced: true as const } : {}),
    roles: slot.roles.map((r) => ({
      role: r.role ?? 'other',
      ...(r.customRole !== undefined ? { customRole: r.customRole } : {}),
      count: r.count,
    })),
  }));
}

/** 'YYYY-MM-DD' 연속(다음 날) 판정 — 로컬 자정 기준(문자열 산술 금지) */
function isNextDay(prev: string, next: string): boolean {
  const [y, m, d] = prev.split('-').map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` === next;
}

export function draftToValues(draft: JobPostingDraft): OrderSheetFormValues {
  // ── 고정(fixed) 복원(S2 — 구 throw 제거) ── date 축 없는 draft를 fixedSchedule 폼 값으로 되돌린다.
  // 급여 복원(roleSalaries·salary·useSameSalary)은 dated 말미와 동일 계약을 미러링한다.
  if (draft.schedule.kind === 'fixed') {
    const sched = draft.schedule;
    // SP1 정규형은 requirements 1개·timeSlots 1개지만, 정규화 전 레거시 draft(복수 슬롯)도
    // 침묵 드랍 없이 전 슬롯 역할을 흡수한다(왕복 데이터는 항상 단일 슬롯 — 동작 동일).
    const slotRoles = sched.requirements
      .flatMap((req) => req.timeSlots)
      .flatMap((slot) => slot.roles);
    const roleSalaries =
      draft.compensation.mode === 'by_role'
        ? draft.roleCatalog
            .filter(
              (r): r is PostingRoleCatalogEntry & { salary: SalaryInfo } => r.salary !== undefined
            )
            .map((r) => ({
              role: r.role,
              ...(r.customRole !== undefined ? { customRole: r.customRole } : {}),
              salary: r.salary,
            }))
        : [];
    return {
      postingType: 'fixed',
      title: draft.title,
      location: draft.location,
      contactPhone: draft.contactPhone,
      description: draft.description,
      scheduleGroups: [],
      fixedSchedule: {
        daysPerWeek: sched.daysPerWeek ?? 0,
        ...(sched.startTime ? { startTime: sched.startTime } : {}),
        isStartTimeNegotiable: sched.isStartTimeNegotiable ?? false,
        // role 부재(레거시 관용 필드)를 '딜러'로 조작(fabrication)하지 않는다(전체리뷰 P6) —
        // customRole이 있으면 'other'로 승격해 의도를 보존하고, 둘 다 없으면 드랍한다
        // (잘못된 역할로 공개 모집되는 사고 차단 — 드랍분은 역할 행 unset 유도로 사용자가 재입력).
        roles: slotRoles.flatMap((r) => {
          const role = r.role ?? (r.customRole !== undefined ? ('other' as const) : undefined);
          if (role === undefined) return [];
          return [
            {
              role,
              ...(r.customRole !== undefined ? { customRole: r.customRole } : {}),
              count: r.count,
            },
          ];
        }),
      },
      salary: draft.compensation.defaultSalary ??
        roleSalaries[0]?.salary ?? { type: 'hourly', amount: DEFAULT_SALARY_BY_TYPE.hourly },
      useSameSalary: draft.compensation.mode === 'shared',
      roleSalaries,
      allowances: { ...(draft.compensation.allowances ?? {}) },
      ...(draft.compensation.taxSettings !== undefined
        ? { taxSettings: draft.compensation.taxSettings }
        : {}),
      conditions: { ...(draft.conditions ?? {}) },
      usesPreQuestions: draft.questions.items.length > 0,
      preQuestions: [...draft.questions.items],
      ...(draft.venueId !== undefined ? { venueId: draft.venueId } : {}),
    };
  }
  // 여기부터 draft.schedule.kind === 'dated' 로 좁혀진다.
  // 그룹핑 복원(S1 — 구 M8 throw 제거, 2차 Eng-H1 확정 규칙):
  // · isGrouped===true: 연속 run + 동일 시그니처(stripSlotIds JSON) 경계 보존 → grouped 그룹
  //   (groupRequirementsToDateRanges 시맨틱 — 묶음지원 범위를 그대로 살린다)
  // · falsy: 시그니처 병합 → shared 그룹(동일 조건 개별 날짜들의 병합은 지원자 화면 산출이
  //   동일해 정규형으로 수용 — 비연속 dates 허용)
  // 왕복 불변식 = 정규형 동등(draft→values→draft에서 isGrouped·시그니처·날짜 집합 보존).
  // 레거시 date는 Date/null 가능 — 문자열 정규화 후 무효(date 없음) requirements는 제외.
  const reqs = draft.schedule.requirements
    .map((r) => ({ ...r, date: r.date ? toDateString(r.date) : '' }))
    .filter((r) => r.date !== '')
    .sort((a, b) => a.date.localeCompare(b.date));
  type FormGroup = OrderSheetScheduleGroups[number];
  const groups: FormGroup[] = [];
  const sharedBySig = new Map<string, FormGroup>();
  let run: { sig: string; lastDate: string; group: FormGroup } | null = null;
  for (const r of reqs) {
    const sig = JSON.stringify(stripSlotIds(r.timeSlots));
    if (r.isGrouped === true) {
      if (run !== null && run.sig === sig && isNextDay(run.lastDate, r.date)) {
        run.group.dates.push(r.date);
        run.lastDate = r.date;
      } else {
        const group: FormGroup = {
          dates: [r.date],
          timeSlots: toFormTimeSlots(r.timeSlots),
          grouped: true,
        };
        groups.push(group);
        run = { sig, lastDate: r.date, group };
      }
    } else {
      run = null; // grouped run은 비-grouped 날짜로 단절(날짜 연속성과 별개의 명시 경계)
      const existing = sharedBySig.get(sig);
      if (existing) {
        existing.dates.push(r.date);
      } else {
        const group: FormGroup = {
          dates: [r.date],
          timeSlots: toFormTimeSlots(r.timeSlots),
          grouped: false,
        };
        sharedBySig.set(sig, group);
        groups.push(group);
      }
    }
  }
  // requirements 없는 draft(빈 템플릿 등) — 구 동작(allDates+templateTimeSlots 단일 그룹) 보존
  if (groups.length === 0) {
    groups.push({
      dates: [...draft.schedule.allDates],
      timeSlots: toFormTimeSlots(draft.schedule.templateTimeSlots ?? []),
      grouped: false,
    });
  }
  // 역할별 급여(by_role) 복원 — hourly 강제 변환 금지, 협의(other)는 그대로 유지(2026-07-14 결정).
  // shared 는 roleCatalog 에 defaultSalary 를 복사(동등성 계약)하므로, by_role 일 때만 roleSalaries 를
  // 복원해야 왕복이 성립한다(shared 에서 되채우면 baseValues.roleSalaries=[] 와 불일치).
  const roleSalaries =
    draft.compensation.mode === 'by_role'
      ? draft.roleCatalog
          .filter(
            (r): r is PostingRoleCatalogEntry & { salary: SalaryInfo } => r.salary !== undefined
          )
          .map((r) => ({
            role: r.role,
            ...(r.customRole !== undefined ? { customRole: r.customRole } : {}),
            salary: r.salary,
          }))
      : [];
  return {
    // 이 경로는 dated 스케줄 전용(kind:'fixed'는 위 조기 분기). valuesToDraft가 fixed를 항상 kind:'fixed'로
    // 조립하므로 신규 draft에선 도달 불가 — 남는 건 레거시/손상 mixed draft({postingType:'fixed', kind:'dated'})
    // 방어 + TS 망라성으로, 그 경우에만 'regular'로 접는다(스케줄 축이 진실원).
    postingType: draft.postingType === 'fixed' ? 'regular' : draft.postingType,
    title: draft.title,
    location: draft.location,
    contactPhone: draft.contactPhone,
    description: draft.description,
    scheduleGroups: groups,
    salary: draft.compensation.defaultSalary ??
      roleSalaries[0]?.salary ?? { type: 'hourly', amount: DEFAULT_SALARY_BY_TYPE.hourly },
    useSameSalary: draft.compensation.mode === 'shared',
    roleSalaries,
    allowances: { ...(draft.compensation.allowances ?? {}) },
    ...(draft.compensation.taxSettings !== undefined
      ? { taxSettings: draft.compensation.taxSettings }
      : {}),
    conditions: { ...(draft.conditions ?? {}) },
    usesPreQuestions: draft.questions.items.length > 0,
    preQuestions: [...draft.questions.items],
    ...(draft.venueId !== undefined ? { venueId: draft.venueId } : {}),
  };
}

export function templateToValues(template: JobPostingTemplate): OrderSheetFormValues {
  const values = draftToValues(templateToDraft(template));
  // F4: 그룹 구조·timeSlots는 유지하고 각 그룹 dates만 비운다(z.input 단계 허용, 제출 시 검증)
  return {
    ...values,
    scheduleGroups: (values.scheduleGroups ?? []).map((g) => ({ ...g, dates: [] })),
  };
}

/**
 * 완료 화면 요약 소스(리뷰 Eng-M2) — 다중 그룹 규칙: primaryDate(전 그룹 최소 날짜) +
 * 그 날짜가 속한 그룹의 첫 슬롯 출근시간 + 고유 날짜 수("외 N일" 접미는 호출부 조립).
 */
export function primaryScheduleInfo(values: OrderSheetValues): {
  primaryDate?: string;
  startTime?: string;
  totalDates: number;
} {
  const uniqueDates = [...new Set(values.scheduleGroups.flatMap((g) => g.dates))].sort();
  const primaryDate = uniqueDates[0];
  const primaryGroup =
    primaryDate === undefined
      ? undefined
      : values.scheduleGroups.find((g) => g.dates.includes(primaryDate));
  return {
    ...(primaryDate !== undefined ? { primaryDate } : {}),
    // 미정 슬롯(startTime '')은 요약에 싣지 않는다 — "출근 " 빈 표기 방지
    ...(primaryGroup?.timeSlots[0]?.startTime
      ? { startTime: primaryGroup.timeSlots[0].startTime }
      : {}),
    totalDates: uniqueDates.length,
  };
}

/**
 * 프리셋 "저장" 경로 전용 — 검증 전(z.input) 폼 값을 draft 로 변환한다.
 *
 * 제출(valuesToCreateInput)과 달리 날짜 미완성·장소 미선택 상태에서도 템플릿으로 저장하므로
 * z.output 검증 게이트를 거치지 않는다. z.input 의 optional/default 필드를 스키마 기본값과
 * 동일하게 채운 뒤 valuesToDraft(단일 조립 계층)로 위임한다. 장소 null 은 draft.location(nullable)로
 * 그대로 흘려보낸다(비어 있으면 extractTemplateData 가 저장에서 드롭).
 */
export function formValuesToDraft(values: OrderSheetFormValues): JobPostingDraft {
  // fixedSchedule 는 ...values 에서 분리해 z.input(isStartTimeNegotiable optional)→z.output(필수 boolean)로
  // 정규화한다 — 미정규화면 valuesToDraft 의 fixed 분기가 undefined 를 보고 dated 로 오분기(#194 클래스).
  const { fixedSchedule, ...rest } = values;
  return valuesToDraft({
    ...rest,
    description: values.description ?? '',
    ...(fixedSchedule
      ? {
          fixedSchedule: {
            ...fixedSchedule,
            isStartTimeNegotiable: fixedSchedule.isStartTimeNegotiable ?? false,
          },
        }
      : {}),
    // z.input 그룹은 grouped optional — z.output 필수 boolean으로 채움(최종 검증 NIT-2)
    scheduleGroups: (values.scheduleGroups ?? []).map((g) => ({
      dates: g.dates,
      timeSlots: g.timeSlots,
      grouped: g.grouped ?? false,
    })),
    useSameSalary: values.useSameSalary ?? false, // 기본 by_role(설계 §S2.1) — 5지점 통일
    roleSalaries: values.roleSalaries ?? [],
    allowances: values.allowances ?? {},
    conditions: values.conditions ?? {},
    usesPreQuestions: values.usesPreQuestions ?? false,
    preQuestions: values.preQuestions ?? [],
    // z.output 은 refine 으로 location 을 non-null 로 좁히지만, 저장 경로는 미선택(null) 도 허용한다.
    location: values.location as OrderSheetValues['location'],
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 주간 배치 그리드 "부족 N명 → 공고 열기" 프리필 파라미터(구 gridPrefill.ts에서 이주 — 유일 소비자). */
export interface GridPrefillParams {
  venueId?: string;
  /** YYYY-MM-DD (그리드 선택일) */
  date?: string;
  /** 모집 인원(부족 인원). 미지정/비정상은 1로 클램프. */
  count?: number;
}

/** 그리드 프리필 — 파라미터 정규화(보안 리뷰: 비-UUID venueId drop, count 1..99 클램프) 후 직접 조립. */
export function gridParamsToValues(params: GridPrefillParams): OrderSheetFormValues {
  const base = initialOrderSheetValues();
  const venueId = params.venueId && UUID_RE.test(params.venueId) ? params.venueId : undefined;
  const count = Math.min(99, Math.max(1, Math.trunc(params.count ?? 1)));
  const hasDate = typeof params.date === 'string' && DATE_RE.test(params.date);
  if (venueId === undefined && !hasDate) return base; // 일반 생성 — venueId 키 부재 무회귀
  const timeSlots = [
    { startTime: DEFAULT_SLOT_START_TIME, roles: [{ role: 'dealer' as const, count }] },
  ];
  return {
    ...base,
    ...(venueId !== undefined ? { venueId } : {}),
    ...(hasDate
      ? {
          // 단일 그룹 형태로 이행(S1) — 주간그리드 프리필 의미 무변
          scheduleGroups: [{ dates: [params.date as string], timeSlots, grouped: false as const }],
          // 반환 직전 프리필(Eng-H3) — 미적용 시 그리드 출하 플로우가 "급여 시트 강제 방문"으로 회귀
          roleSalaries: syncRoleSalaries(timeSlots, [], base.salary.type),
        }
      : {}),
  };
}

export function valuesToCreateInput(values: OrderSheetValues): CreateJobPostingInput {
  return draftToCreateJobPostingInput(valuesToDraft(values));
}

/**
 * 주문서 값 → 공고 수정 입력(S3). 레거시 draftToUpdateJobPostingInput에 위임해
 * 신·구 등가성이 구조적으로 성립한다(valuesToCreateInput과 동형 패턴).
 * tournamentConfig는 UpdateJobPostingInput 타입에 없어 이 경로가 승인 상태를 만질 수
 * 없다(설계 확정 ⑥ — update 직렬화가 current에서 보존, serialization.ts tournament 분기).
 */
export function valuesToUpdateInput(values: OrderSheetValues): UpdateJobPostingInput {
  return draftToUpdateJobPostingInput(valuesToDraft(values));
}
