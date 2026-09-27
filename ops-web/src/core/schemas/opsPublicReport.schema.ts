// ⚠️ 자동 생성 파일 — 직접 수정 금지. 정본: uniqn-mobile/src/schemas/opsPublicReport.schema.ts
// 갱신: node scripts/sync-ops-core.mjs (설계 docs/planning/2026-09-27-ops-web-design.md §3.2)
/**
 * ops 공개뷰 익명 신고 zod 스키마 (S1 B2/D7).
 * 서버 CHECK(reason 택소노미·details ≤500)와 1:1 + XSS 검증(전 사용자 입력 필수 규칙).
 */
import { z } from 'zod';
import { xssValidation } from '@/core/utils/security';

export const opsPublicReportSchema = z.object({
  tokenKind: z.enum(['monitor', 'player']),
  token: z.string().min(32, '유효하지 않은 신고 대상이에요.').max(128),
  reason: z.enum(['gambling', 'illegal_gambling', 'other'], {
    message: '신고 사유를 선택해주세요.',
  }),
  details: z
    .string()
    .max(500, '상세 내용은 500자 이내로 입력해주세요.')
    .refine(xssValidation, { message: '사용할 수 없는 문자가 포함되어 있어요.' })
    .optional()
    .nullable(),
});

export type OpsPublicReportInput = z.infer<typeof opsPublicReportSchema>;
