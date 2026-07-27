/**
 * UNIQN Mobile - Supabase JobPosting Repository Settlement Helpers
 *
 * @description 정산 설정 업데이트 시 역할 카탈로그 병합/정규화 헬퍼
 */

import type { PostingRoleCatalogEntry, PostingSchedule } from '@/types';
import type { StaffRole } from '@/types/role';

export type SettlementRolePayload = {
  role?: PostingRoleCatalogEntry['role'];
  name?: string;
  customRole?: string;
  salary?: PostingRoleCatalogEntry['salary'];
};

export function settlementRoleKey(r: {
  role?: string;
  name?: string;
  customRole?: string;
}): string {
  const id = r.role ?? r.name ?? '';
  return id === 'other' && r.customRole ? `other:${r.customRole}` : id;
}

export function mergeSettlementRoles(
  base: PostingRoleCatalogEntry[],
  incoming: Record<string, unknown>[]
): PostingRoleCatalogEntry[] {
  const typed = incoming as SettlementRolePayload[];
  if (base.length === 0) {
    return typed.map((r) => ({
      role: (r.role ?? r.name ?? 'dealer') as StaffRole | 'other',
      ...(r.customRole ? { customRole: r.customRole } : {}),
      ...(r.salary ? { salary: r.salary } : {}),
    }));
  }
  const byKey = new Map(typed.map((r) => [settlementRoleKey(r), r] as const));
  return base.map((r) => {
    const inc = byKey.get(settlementRoleKey(r));
    if (!inc || !Object.prototype.hasOwnProperty.call(inc, 'salary')) return r;
    return { ...r, ...(inc.salary ? { salary: inc.salary } : { salary: undefined }) };
  });
}

/**
 * 정산 단가 매칭 키 — `getRoleSalaryFromRoles`(@/domains/settlement)의 매칭 규칙과 **같은 규칙**이어야 한다.
 *
 * @description 정산은 JIT 다 — `settlementCalculation` 이 정산 시점 공고를 다시 읽어
 * `work_log.role`(+ customRole)로 단가를 찾는다. 그래서 "확정자가 배정된 역할이 공고에 아직
 * 남아 있는가"를 판정하려면 정산이 쓰는 것과 **동일한 키**로 비교해야 한다. 여기가 어긋나면
 * 가드는 통과시키는데 정산은 기본 단가로 떨어지는 조용한 오답이 된다.
 * `settlementRoleKey`(위)와 달리 other 는 `other:` 접두 없이 customRole 자체가 실효 키다.
 */
export function settlementRoleMatchKey(role?: string | null, customRole?: string | null): string {
  return role === 'other' && customRole ? customRole : (role ?? '');
}

/**
 * 스케줄이 실제로 제공하는 정산 역할 키 집합.
 *
 * @description `getPostingRoleStats`(@/domains/job-posting)와 동일한 순회(요구 → 슬롯 → 역할)를 쓴다 —
 * 정산 단가표(`getPostingSettlementContext.roles`)가 roleCatalog 가 아니라 **스케줄**에서 만들어지기
 * 때문이다. roleCatalog 에만 남기고 스케줄에서 빼면 단가표에서 사라진다.
 */
export function collectScheduleRoleMatchKeys(schedule: PostingSchedule): Set<string> {
  const keys = new Set<string>();
  schedule.requirements.forEach((requirement) => {
    requirement.timeSlots.forEach((slot) => {
      slot.roles.forEach((role) => {
        const key = settlementRoleMatchKey(role.role, role.customRole);
        if (key) keys.add(key);
      });
    });
  });
  return keys;
}
