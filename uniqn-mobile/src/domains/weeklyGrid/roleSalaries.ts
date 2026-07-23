/**
 * roleSalaries — 지점(컨테이너) 역할별 단가표 경량 파서 + 조회 (JIT 급여 설계 §A)
 *
 * 컨테이너 schedule.roleSalaries(JSONB 배열)를 PostingRoleCatalogEntry[] 로 관대하게 파싱한다.
 * 이형/부재는 빈 배열(strict null 증발 회피 — venueContainer 패턴). 쓰기는 SECDEF RPC
 * set_venue_role_salary 단일 경로(클라 직접 UPDATE 는 jp_container_no_direct_update 가 차단).
 * 키 규약: 표준 역할=role, 커스텀=other:<customRole> (getPostingRoleKey 와 동일).
 */
import { z } from 'zod';
import type { PostingRoleCatalogEntry, SalaryInfo } from '@/types';

const salarySchema = z.object({
  type: z.enum(['hourly', 'daily', 'monthly', 'other']),
  amount: z.number(),
});

const entrySchema = z.object({
  role: z.string().min(1),
  customRole: z.string().optional(),
  salary: salarySchema.optional(),
});

/** schedule(unknown)에서 roleSalaries 배열을 관대 파싱. 이형 항목은 개별 스킵. */
export function getRoleSalaries(schedule: unknown): PostingRoleCatalogEntry[] {
  if (!schedule || typeof schedule !== 'object') return [];
  const raw = (schedule as { roleSalaries?: unknown }).roleSalaries;
  if (!Array.isArray(raw)) return [];
  const out: PostingRoleCatalogEntry[] = [];
  for (const item of raw) {
    const parsed = entrySchema.safeParse(item);
    if (parsed.success) out.push(parsed.data as PostingRoleCatalogEntry);
  }
  return out;
}

const entryKey = (role: string, customRole?: string): string =>
  role === 'other' && customRole ? `other:${customRole}` : role;

/** 역할(커스텀은 other:<customRole> 단위)에 설정된 단가. 미설정이면 undefined. */
export function findRoleSalary(
  entries: PostingRoleCatalogEntry[],
  role: string,
  customRole?: string
): SalaryInfo | undefined {
  const key = entryKey(role, customRole);
  return entries.find((e) => entryKey(e.role, e.customRole) === key)?.salary;
}

/** JIT 노출 조건 판정 — 해당 역할 단가 설정 여부. */
export function hasRoleSalary(
  entries: PostingRoleCatalogEntry[],
  role: string,
  customRole?: string
): boolean {
  return findRoleSalary(entries, role, customRole) !== undefined;
}
