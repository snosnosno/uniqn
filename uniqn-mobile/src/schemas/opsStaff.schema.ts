/**
 * ops 스태프 로스터(1e) 도메인 zod 스키마.
 *
 * 읽기 경로는 내성(tolerant) 파싱 — role 이 미지 enum 값(DB enum 발산)이어도 레코드가
 * 증발하지 않도록 표시용 필드만 `.catch()`로 흡수한다(MEMORY: pitfall_enum_divergence_read_disappearance).
 * 쓰기 경로(로스터 수동 추가)는 반대로 strict 검증 — 사용자 실수를 조용히 흡수하면 안 되고,
 * 자유 텍스트(customRole)는 XSS 방어가 필수(CLAUDE.md: 모든 사용자 입력에 xssValidation refine).
 */
import { z } from 'zod';
import { xssValidation } from '@/utils/security';
import { VALID_STAFF_ROLES } from '@/types/role';

/**
 * 읽기 전용 role 파서 — 미지 값은 'other' 로 흡수(레코드 evaporate 방지).
 * 표시용(라벨 매핑)에만 사용하고, 실제 업무 로직 분기에는 strict 스키마를 쓴다.
 */
export const opsStaffRoleReadSchema = z.enum(VALID_STAFF_ROLES).catch('other');

/** ops_staff.source — 미지 값은 'manual' 로 흡수(표시용). */
export const opsStaffSourceReadSchema = z.enum(['snapshot_import', 'manual']).catch('manual');

/**
 * ops_staff 행 읽기 스키마(표시용 내성 파싱).
 * Repository 는 toCamelCase 매핑만으로 OpsStaff 를 반환(기존 Ops*Repository 관례와 동일 수준) —
 * 이 스키마는 Service/Hook 계층에서 방어적으로 재검증하고 싶을 때 선택적으로 사용한다.
 */
export const opsStaffReadSchema = z.object({
  id: z.string(),
  tournamentId: z.string(),
  staffId: z.string(),
  role: opsStaffRoleReadSchema,
  customRole: z.string().nullable(),
  staffName: z.string(),
  staffNickname: z.string().nullable(),
  source: opsStaffSourceReadSchema,
  sourceWorkLogId: z.string().nullable(),
  createdAt: z.string(),
});
export type OpsStaffReadData = z.infer<typeof opsStaffReadSchema>;

/**
 * 로스터 수동 추가 입력(쓰기) — role 은 strict(사용자 실수를 'other' 로 조용히 흡수하지 않음),
 * customRole 은 자유 텍스트라 XSS 방어 필수.
 */
export const addOpsStaffInputSchema = z.object({
  staffId: z.string().uuid({ message: '올바른 스태프를 선택해주세요' }),
  role: z.enum(VALID_STAFF_ROLES, { error: '올바른 역할을 선택해주세요' }),
  customRole: z
    .string()
    .trim()
    .max(20, { message: '역할명은 20자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '특수문자가 포함될 수 없습니다' })
    .nullable()
    .optional(),
});
export type AddOpsStaffInputData = z.infer<typeof addOpsStaffInputSchema>;
