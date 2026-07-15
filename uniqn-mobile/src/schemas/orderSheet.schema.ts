/**
 * UNIQN Mobile - 주문서(공고작성 키오스크) 폼 상태 스키마
 *
 * @description RHF 3제네릭(useForm<OrderSheetFormValues, unknown, OrderSheetValues>)이
 * 소비하는 폼 계약. z.input=폼 상태(장소 null 허용·default 필드 optional),
 * z.output=제출 결과(검증 통과·장소 non-null·default 채움). 매퍼가 canonical draft와 왕복한다.
 */
import { z } from 'zod';
import { xssValidation } from '@/utils/security';
import { isRegionSlug } from '@/constants/regions';
import { DATE_CONSTRAINTS, MAX_SALARY_AMOUNT } from '@/constants/jobPosting';
import { PROVIDED_FLAG } from '@/utils/settlement';
import { preQuestionsArraySchema } from '@/schemas/preQuestion.schema';
import type { TaxSettings } from '@/types/jobPosting';

const safeText = (max: number) =>
  z.string().max(max).refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' });

// 협의(other) 선택 가능(2026-07-14 결정) — { type: 'other', amount: 0 }로 발행.
// 문서 게이트 salaryInfoSchema.amount: min(0)이 허용함을 실측(jobPosting.schema.ts:51-53).
// 상한 1억(Eng-M4) — 역할별 입력 지점 확대 시점에 조임(프리셋 경유 이상치 재검증 포함).
export const orderSheetSalarySchema = z
  .object({
    type: z.enum(['hourly', 'daily', 'monthly', 'other']),
    amount: z.number().int().min(0).max(MAX_SALARY_AMOUNT, '금액이 너무 큽니다'),
  })
  .superRefine((s, ctx) => {
    if (s.type !== 'other' && s.amount <= 0) {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: '급여를 입력해주세요' });
    }
  });

export const orderSheetRoleSchema = z.object({
  role: z.enum(['dealer', 'floor', 'serving', 'manager', 'staff', 'other']),
  customRole: safeText(20).optional(),
  count: z.number().int().min(1).max(99),
});

// useSameSalary=false일 때 역할별 급여(2026-07-14 결정) — roleCatalog[].salary의 캐리어
export const orderSheetRoleSalarySchema = z.object({
  role: z.enum(['dealer', 'floor', 'serving', 'manager', 'staff', 'other']),
  customRole: safeText(20).optional(),
  salary: orderSheetSalarySchema,
});

export const orderSheetTimeSlotSchema = z.object({
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, '출근 시간을 선택해주세요'),
  roles: z.array(orderSheetRoleSchema).min(1, '역할을 추가해주세요'),
});

const START_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * 고정(fixed) 근무조건(S2) — 날짜 축이 없는 상시 반복 근무. 역할은 평탄 배열(레거시 formData.roles 시맨틱).
 * startTime은 협의(isStartTimeNegotiable)면 부재 허용, 아니면 필수(superRefine).
 * daysPerWeek 0 = 협의(레거시 DAYS_OPTIONS와 동일).
 */
export const orderSheetFixedScheduleSchema = z
  .object({
    daysPerWeek: z.number().int().min(0).max(7),
    startTime: z.string().regex(START_TIME_RE, '출근 시간을 선택해주세요').optional(),
    isStartTimeNegotiable: z.boolean().default(false),
    roles: z.array(orderSheetRoleSchema).min(1, '역할을 추가해주세요'),
  })
  .superRefine((fs, ctx) => {
    if (!fs.isStartTimeNegotiable && !fs.startTime) {
      ctx.addIssue({ code: 'custom', path: ['startTime'], message: '출근 시간을 선택해주세요' });
    }
  });

/**
 * 일정 그룹(S1) — "같은 시간·역할을 공유하는 날짜 묶음". 개별 설정 = 날짜 1개짜리 그룹.
 *
 * grouped = 묶음지원(구형 isGrouped) 축 — 세그먼트 ②("연속 날짜 묶음 지원")에서만 true.
 * "같은 조건"(시간·역할 공유)과 별개 축이다(2차 Eng-C1 CRITICAL): true면 지원자 화면이
 * 묶음지원(연속 범위 일괄 지원)으로 분기하므로 그룹 크기>1 자동 설정 절대 금지.
 */
export const orderSheetScheduleGroupSchema = z.object({
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1, '날짜를 선택해주세요'),
  timeSlots: z.array(orderSheetTimeSlotSchema).min(1, '시간대를 추가해주세요'),
  grouped: z.boolean().default(false),
});

export const orderSheetLocationSchema = z
  .object({
    name: safeText(50).min(1, '장소를 선택해주세요'),
    address: safeText(200).optional(),
    district: safeText(50).optional(),
    // 지역 필수(2026-07-15) — location nullable 관례와 동형: z.input 은 관용(optional),
    // 제출(z.output)에서 미선택을 거부한다(타입 파급 0 — z.output region 은 string|undefined 유지).
    // 레거시 region-less draft 는 로드·편집 관용, 제출 시 아래 게이트가 거부해 지역 추가를 유도.
    // 슬러그 형식만 필드 refine 으로 검사(값이 있을 때) — '지역 값이 올바르지 않습니다'.
    region: z
      .string()
      .refine((s) => isRegionSlug(s), '지역 값이 올바르지 않습니다')
      .optional(),
    detailedAddress: safeText(200).optional(),
  })
  // 필수 게이트는 객체 레벨에 둔다 — zod 는 "부재(absent)한 optional 키"의 필드 refine 을
  // 건너뛰므로(present-undefined 만 잡힘) 필드 레벨 refine 으론 { name } 처럼 region 키가
  // 아예 없는 제출을 못 막는다. superRefine 은 항상 실행되어 absent·undefined 를 함께 거부한다.
  .superRefine((loc, ctx) => {
    if (loc.region === undefined) {
      ctx.addIssue({ code: 'custom', path: ['region'], message: '지역을 선택해주세요' });
    }
  });

export const orderSheetConditionsSchema = z.object({
  dressCode: safeText(50).optional(),
  experience: safeText(50).optional(),
});

// 복지: 기존 Allowances 시맨틱을 타입으로 인코딩(리뷰 CRITICAL 반영) —
// 보장시간=시간값(0 이상, 문서 게이트 min(0)과 정합·PROVIDED_FLAG 금지), 나머지 3종=-1(제공) 또는 양수 금액
export const orderSheetAllowancesSchema = z.object({
  guaranteedHours: z.number().int().min(0).optional(),
  meal: z.union([z.literal(PROVIDED_FLAG), z.number().int().positive()]).optional(),
  transportation: z.union([z.literal(PROVIDED_FLAG), z.number().int().positive()]).optional(),
  accommodation: z.union([z.literal(PROVIDED_FLAG), z.number().int().positive()]).optional(),
});

export const orderSheetValuesSchema = z
  .object({
    postingType: z.enum(['regular', 'urgent', 'tournament', 'fixed']),
    title: safeText(25).min(1, '제목을 입력해주세요'),
    // ⚠️ 아래 refine의 TS 추론 프레디킷이 z.output에서 null을 제거한다(의도된 동작 — 매퍼가 가드 없이 소비)
    location: orderSheetLocationSchema.nullable().refine((v) => v !== null, '장소를 선택해주세요'),
    contactPhone: safeText(20).min(1, '연락처를 입력해주세요'),
    description: safeText(500).default(''),
    scheduleGroups: z.array(orderSheetScheduleGroupSchema).default([]),
    // 고정(fixed) 근무조건 — dated면 undefined, fixed면 present(superRefine 강제). scheduleGroups와 상호배타.
    fixedSchedule: orderSheetFixedScheduleSchema.optional(),
    salary: orderSheetSalarySchema,
    // 기본 false(by_role) — 설계 §S2.1. 살아있는 기본값 5지점(schema·initialOrderSheetValues·
    // formValuesToDraft·orderRowMeta·OrderSheetScreen) 전수 통일 — 하나라도 어긋나면 zod 게이트와
    // UI 판정이 갈라져 "이대로 등록인데 제출 침묵 실패"(H5) 재발.
    useSameSalary: z.boolean().default(false),
    roleSalaries: z.array(orderSheetRoleSalarySchema).default([]),
    allowances: orderSheetAllowancesSchema.default({}),
    taxSettings: z.custom<TaxSettings>().optional(),
    conditions: orderSheetConditionsSchema.default({}),
    usesPreQuestions: z.boolean().default(false),
    // 기존 preQuestion 스키마 재사용(question xss·max10 확보) + 레거시 라이브 게이트(validation.ts:154-159)의
    // options xss 검사를 UI측에서 승계(문서 스키마엔 없음 — 회귀 방지, 보안 리뷰 MEDIUM).
    // ⚠️ 문서 스키마(preQuestion.schema.ts:35)를 조이는 건 금지 — 읽기 공용이라 기존 prod 문서 read-null 위험.
    preQuestions: preQuestionsArraySchema
      .superRefine((qs, ctx) => {
        qs.forEach((q, i) =>
          q.options?.forEach((opt, j) => {
            if (opt.trim() && !xssValidation(opt)) {
              ctx.addIssue({
                code: 'custom',
                path: [i, 'options', j],
                message: '위험한 문자가 포함되어 있습니다',
              });
            }
          })
        );
      })
      .default([]),
    venueId: z.string().uuid().optional(),
  })
  .superRefine((v, ctx) => {
    // ── 급여 by_role 커버 게이트(공유) — 소스만 타입별로 다르다 ──
    // useSameSalary=false면 대상 역할 집합(roleKeys)을 roleSalaries가 전부 커버해야 통과.
    // 고유 역할 0개면 skip(Eng-M5). 협의(other)는 amount 없이 커버 인정, 그 외는 amount>0 필요.
    const keyOf = (role: string, customRole?: string) =>
      role === 'other' ? `other:${customRole ?? ''}` : role;
    const coverByRole = (roleKeys: Set<string>) => {
      if (v.useSameSalary || roleKeys.size === 0) return;
      const salaryByRole = new Map(
        v.roleSalaries.map((rs) => [keyOf(rs.role, rs.customRole), rs.salary] as const)
      );
      const allCovered = [...roleKeys].every((k) => {
        const s = salaryByRole.get(k);
        return s !== undefined && (s.type === 'other' || s.amount > 0);
      });
      if (!allCovered) {
        ctx.addIssue({
          code: 'custom',
          path: ['roleSalaries'],
          message: '역할별 급여를 모두 입력해주세요',
        });
      }
    };

    // ── 고정(fixed) 분기 ── 날짜 축 없음. fixedSchedule 필수 + 역할 커버만 검사.
    if (v.postingType === 'fixed') {
      if (v.fixedSchedule === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['fixedSchedule'],
          message: '근무조건을 입력해주세요',
        });
        return;
      }
      const fixedKeys = new Set<string>();
      for (const r of v.fixedSchedule.roles) fixedKeys.add(keyOf(r.role, r.customRole));
      coverByRole(fixedKeys);
      return;
    }

    // ── dated(지원·급구·대회) 분기 ── (기존 로직 유지 + scheduleGroups 비어있음 게이트)
    // 빈 그룹 게이트는 기존 scheduleGroups.min(1) 이관 — 경로·메시지 동일 유지.
    if (v.scheduleGroups.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['scheduleGroups'], message: '날짜를 선택해주세요' });
      return;
    }
    // E1: 그룹 간 날짜 중복 금지 — issue path는 뒤에 온 중복 그룹의 dates(해당 그룹 행에 배지).
    // F2: allDates 중복 → filled counts 키스페이스 충돌의 원천 차단이기도 하다.
    const seenDates = new Set<string>();
    v.scheduleGroups.forEach((g, gi) => {
      let flagged = false;
      for (const d of g.dates) {
        if (seenDates.has(d)) {
          if (!flagged) {
            ctx.addIssue({
              code: 'custom',
              path: ['scheduleGroups', gi, 'dates'],
              message: '이미 다른 일정에 포함된 날짜예요',
            });
            flagged = true;
          }
        } else {
          seenDates.add(d);
        }
      }
    });
    // 합산 고유 날짜 ≤ 타입별 상한(2차 Eng-M4/CEO-3) — 평탄 dates.max 소실로 그룹×N일 우회 차단
    const maxDates = DATE_CONSTRAINTS[v.postingType].maxDates;
    if (seenDates.size > maxDates) {
      ctx.addIssue({
        code: 'custom',
        path: ['scheduleGroups'],
        message: `날짜는 최대 ${maxDates}개까지 선택할 수 있어요`,
      });
    }
    // 역할별 급여(by_role) 전수 커버 게이트 — 전 그룹 timeSlots의 고유 역할(기타는 customRole 단위)이
    // 소스. orderRowMeta의 unset 판정과 대칭 — 스키마는 최후 게이트, UI(급여 시트)는 UX 게이트.
    const uniqueKeys = new Set<string>();
    for (const g of v.scheduleGroups)
      for (const slot of g.timeSlots)
        for (const r of slot.roles) uniqueKeys.add(keyOf(r.role, r.customRole));
    coverByRole(uniqueKeys);
  });

export type OrderSheetFormValues = z.input<typeof orderSheetValuesSchema>;
export type OrderSheetValues = z.output<typeof orderSheetValuesSchema>;
