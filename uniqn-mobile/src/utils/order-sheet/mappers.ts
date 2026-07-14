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
} from '@/types/jobPosting';
import type { JobPostingDraft } from '@/types/jobPostingDraft';
import type { JobPostingTemplate } from '@/types/jobTemplate';
import { templateToDraft } from '@/types/jobTemplate';
import { draftToCreateJobPostingInput } from '@/utils/job-posting/draftAdapter';
import type { GridPrefillParams } from '@/utils/job-posting/gridPrefill';
import { DEFAULT_SLOT_START_TIME } from '@/domains/weeklyGrid';
import { generateId } from '@/utils/generateId';

export const DEFAULT_SALARY_BY_TYPE = { hourly: 20000, daily: 200000, monthly: 2500000 } as const;
export const HOURLY_STEP = 1000;

/** 초기 주문서 SSOT — INITIAL_JOB_POSTING_DRAFT 경유 금지(by_role·09:00 기본슬롯 유입, 리뷰 실측). */
export function initialOrderSheetValues(): OrderSheetFormValues {
  return {
    postingType: 'regular',
    title: '',
    location: null,
    contactPhone: '', // create.tsx가 프로필 phone으로 덮어씀 (Task 5 Step 6)
    description: '',
    dates: [],
    timeSlots: [],
    salary: { type: 'hourly', amount: DEFAULT_SALARY_BY_TYPE.hourly },
    useSameSalary: true,
    roleSalaries: [],
    allowances: {},
    conditions: {},
    usesPreQuestions: false,
    preQuestions: [],
  };
}

/** 날짜별 requirements가 참조를 공유하지 않도록 호출마다 새 슬롯 생성 + id 부여 (gridPrefill.ts 관례). */
function toPostingTimeSlots(values: OrderSheetValues): PostingTimeSlot[] {
  return values.timeSlots.map((slot) => ({
    id: generateId(),
    startTime: slot.startTime,
    roles: slot.roles.map((r) => ({
      id: generateId(),
      role: r.role,
      ...(r.role === 'other' && r.customRole !== undefined ? { customRole: r.customRole } : {}),
      count: r.count,
    })),
  }));
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
  for (const slot of values.timeSlots) {
    for (const r of slot.roles) {
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
  }
  return [...seen.values()];
}

export function valuesToDraft(values: OrderSheetValues): JobPostingDraft {
  // 직접 조립(스프레드 없음) — JobPostingDraft 필수 필드는 TS가 강제, INITIAL 오염 원천 차단
  return {
    postingType: values.postingType,
    title: values.title,
    description: values.description,
    location: values.location,
    contactPhone: values.contactPhone,
    tags: [],
    ...(values.venueId !== undefined ? { venueId: values.venueId } : {}),
    schedule: {
      kind: 'dated',
      primaryDate: values.dates[0] ?? '',
      allDates: [...values.dates],
      requirements: values.dates.map((date) => ({ date, timeSlots: toPostingTimeSlots(values) })),
      templateTimeSlots: toPostingTimeSlots(values),
    },
    roleCatalog: toRoleCatalog(values),
    compensation: {
      mode: values.useSameSalary ? 'shared' : 'by_role',
      defaultSalary: values.salary,
      ...(Object.keys(values.allowances).length > 0 ? { allowances: values.allowances } : {}),
      ...(values.taxSettings !== undefined ? { taxSettings: values.taxSettings } : {}),
    },
    questions: { items: values.usesPreQuestions ? values.preQuestions : [] },
    ...(values.conditions.dressCode !== undefined || values.conditions.experience !== undefined
      ? { conditions: values.conditions }
      : {}),
  };
}

/** 왕복 비교용 — draft 슬롯의 생성 id를 벗겨 구조만 비교한다. */
const stripSlotIds = (slots: PostingTimeSlot[]) =>
  slots.map((s) => ({
    startTime: s.startTime,
    roles: s.roles.map((r) => ({
      role: r.role,
      ...(r.customRole !== undefined ? { customRole: r.customRole } : {}),
      count: r.count,
    })),
  }));

export function draftToValues(draft: JobPostingDraft): OrderSheetFormValues {
  if (draft.schedule.kind !== 'dated') {
    throw new Error('주문서는 dated 스케줄(지원·급구)만 지원합니다');
  }
  // 날짜별 시간대가 상이하면 조용한 평탄화 대신 throw(리뷰 M8) — 호출부(프리셋)가 try/catch로 스킵
  const reqs = draft.schedule.requirements;
  const canonical = JSON.stringify(stripSlotIds(reqs[0]?.timeSlots ?? []));
  if (reqs.some((r) => JSON.stringify(stripSlotIds(r.timeSlots)) !== canonical)) {
    throw new Error('날짜별 시간대가 서로 달라 주문서로 표현할 수 없습니다');
  }
  const firstSlots = reqs[0]?.timeSlots ?? draft.schedule.templateTimeSlots ?? [];
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
    postingType: draft.postingType === 'urgent' ? 'urgent' : 'regular',
    title: draft.title,
    location: draft.location,
    contactPhone: draft.contactPhone,
    description: draft.description,
    dates: [...draft.schedule.allDates],
    timeSlots: firstSlots.map((slot) => ({
      startTime: slot.startTime ?? '',
      roles: slot.roles.map((r) => ({
        role: r.role ?? 'other',
        ...(r.customRole !== undefined ? { customRole: r.customRole } : {}),
        count: r.count,
      })),
    })),
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
  return { ...values, dates: [] };
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
  return valuesToDraft({
    ...values,
    description: values.description ?? '',
    useSameSalary: values.useSameSalary ?? true,
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

/** 그리드 프리필 — 파라미터 정규화(보안 리뷰: 비-UUID venueId drop, count 1..99 클램프) 후 직접 조립. */
export function gridParamsToValues(params: GridPrefillParams): OrderSheetFormValues {
  const base = initialOrderSheetValues();
  const venueId = params.venueId && UUID_RE.test(params.venueId) ? params.venueId : undefined;
  const count = Math.min(99, Math.max(1, Math.trunc(params.count ?? 1)));
  const hasDate = typeof params.date === 'string' && DATE_RE.test(params.date);
  if (venueId === undefined && !hasDate) return base; // 일반 생성 — venueId 키 부재 무회귀
  return {
    ...base,
    ...(venueId !== undefined ? { venueId } : {}),
    ...(hasDate
      ? {
          dates: [params.date as string],
          timeSlots: [
            { startTime: DEFAULT_SLOT_START_TIME, roles: [{ role: 'dealer' as const, count }] },
          ],
        }
      : {}),
  };
}

export function valuesToCreateInput(values: OrderSheetValues): CreateJobPostingInput {
  return draftToCreateJobPostingInput(valuesToDraft(values));
}
