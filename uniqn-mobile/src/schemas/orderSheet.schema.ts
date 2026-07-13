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
import { PROVIDED_FLAG } from '@/utils/settlement';
import { preQuestionsArraySchema } from '@/schemas/preQuestion.schema';
import type { TaxSettings } from '@/types/jobPosting';

const safeText = (max: number) =>
  z.string().max(max).refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' });

// 협의(other) 선택 가능(2026-07-14 결정) — { type: 'other', amount: 0 }로 발행.
// 문서 게이트 salaryInfoSchema.amount: min(0)이 허용함을 실측(jobPosting.schema.ts:51-53).
export const orderSheetSalarySchema = z
  .object({
    type: z.enum(['hourly', 'daily', 'monthly', 'other']),
    amount: z.number().int().min(0),
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

export const orderSheetLocationSchema = z.object({
  name: safeText(50).min(1, '장소를 선택해주세요'),
  address: safeText(200).optional(),
  district: safeText(50).optional(),
  region: z
    .string()
    .refine((s) => isRegionSlug(s), '지역 값이 올바르지 않습니다')
    .optional(),
  detailedAddress: safeText(200).optional(),
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

export const orderSheetValuesSchema = z.object({
  postingType: z.enum(['regular', 'urgent']),
  title: safeText(25).min(1, '제목을 입력해주세요'),
  // ⚠️ 아래 refine의 TS 추론 프레디킷이 z.output에서 null을 제거한다(의도된 동작 — 매퍼가 가드 없이 소비)
  location: orderSheetLocationSchema.nullable().refine((v) => v !== null, '장소를 선택해주세요'),
  contactPhone: safeText(20).min(1, '연락처를 입력해주세요'),
  description: safeText(500).default(''),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1, '날짜를 선택해주세요'),
  timeSlots: z.array(orderSheetTimeSlotSchema).min(1, '시간대를 추가해주세요'),
  salary: orderSheetSalarySchema,
  useSameSalary: z.boolean().default(true),
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
});

export type OrderSheetFormValues = z.input<typeof orderSheetValuesSchema>;
export type OrderSheetValues = z.output<typeof orderSheetValuesSchema>;
